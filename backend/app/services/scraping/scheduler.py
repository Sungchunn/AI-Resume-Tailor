"""
Background job scheduler for automated scraper runs.

Uses APScheduler to schedule daily LinkedIn job scraping across
multiple regions using the APIFY client.

Features:
- Persistent audit trail via ScraperRun model
- Distributed locking to prevent duplicate runs
- Batch database upserts for performance
- Configurable concurrent region processing
- Retry logic for transient failures
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import Settings, get_settings
from app.crud.job_listing import job_listing_repository
from app.crud.scraper_run import scraper_run_repository
from app.db.session import AsyncSessionLocal
from app.schemas.scraper import (
    SCRAPER_CONFIGS,
    ScraperBatchResult,
    ScraperConfig,
    ScraperRunResult,
)
from app.services.scraping.apify_client import ApifyClientError, get_apify_client
from app.services.core.cache import get_cache_service

logger = logging.getLogger(__name__)

# Distributed lock configuration
SCRAPER_LOCK_KEY = "scraper:distributed_lock"
SCRAPER_LOCK_TTL = 1800  # 30 minutes - max expected run time


class RetryableError(Exception):
    """Error that can be retried (network issues, timeouts)."""

    pass


class NonRetryableError(Exception):
    """Error that should not be retried (validation, auth)."""

    pass


class SchedulerService:
    """
    Background job scheduler using APScheduler.

    Manages daily scraper jobs that fetch LinkedIn job listings
    via APIFY and upsert them into the database.

    Features:
    - Distributed locking prevents duplicate runs across instances
    - Persistent storage of run results for audit trail
    - Configurable concurrent region processing
    - Automatic retry for transient failures
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.scheduler = AsyncIOScheduler()
        self._is_running = False
        self._cache = get_cache_service()

        # Concurrency control: limit parallel APIFY calls
        # Set to 1 for sequential, or higher for parallel with rate limiting
        self._max_concurrent_regions = getattr(settings, "scraper_max_concurrent", 2)
        self._retry_attempts = getattr(settings, "scraper_retry_attempts", 2)
        self._retry_delay_seconds = getattr(settings, "scraper_retry_delay", 60)

    def start(self) -> None:
        """
        Register daily scraper job at configured time and start scheduler.

        The job runs at the hour/minute specified in settings (UTC).
        """
        if not self.settings.scraper_enabled:
            logger.info("Scraper is disabled via settings, scheduler not started")
            return

        # Register the daily scraper job
        trigger = CronTrigger(
            hour=self.settings.scraper_schedule_hour,
            minute=self.settings.scraper_schedule_minute,
            timezone="UTC",
        )

        self.scheduler.add_job(
            self._run_scraper_job_with_lock,
            trigger=trigger,
            id="daily_linkedin_scraper",
            name="Daily LinkedIn Job Scraper",
            replace_existing=True,
        )

        self.scheduler.start()
        self._is_running = True

        next_run = self.get_next_run_time()
        logger.info(
            f"Scheduler started. Daily scraper job registered at "
            f"{self.settings.scraper_schedule_hour:02d}:{self.settings.scraper_schedule_minute:02d} UTC. "
            f"Next run: {next_run}"
        )

    def stop(self) -> None:
        """Graceful shutdown of the scheduler."""
        if self._is_running:
            self.scheduler.shutdown(wait=True)
            self._is_running = False
            logger.info("Scheduler stopped gracefully")

    async def trigger_scraper_now(self, triggered_by: str = "manual") -> ScraperBatchResult:
        """
        Manual trigger for testing or on-demand scraping.

        Args:
            triggered_by: Identifier for who triggered the run

        Returns:
            ScraperBatchResult with aggregated results from all regions.
        """
        logger.info(f"Manual scraper trigger initiated by: {triggered_by}")
        return await self._run_scraper_job_with_lock(
            run_type="manual",
            triggered_by=triggered_by,
        )

    async def get_status(self) -> dict[str, Any]:
        """
        Return scheduler status and last run info from persistent storage.

        Returns:
            Dict containing scheduler state, next run time, and last run details.
        """
        # Get last run from database
        last_run = None
        last_run_result = None

        async with AsyncSessionLocal() as db:
            try:
                latest = await scraper_run_repository.get_latest(db)
                if latest:
                    last_run = latest.started_at
                    # Convert stored data back to ScraperBatchResult format
                    last_run_result = {
                        "status": latest.status,
                        "total_jobs_found": latest.total_jobs_found,
                        "total_jobs_created": latest.total_jobs_created,
                        "total_jobs_updated": latest.total_jobs_updated,
                        "total_errors": latest.total_errors,
                        "duration_seconds": latest.duration_seconds,
                        "region_results": latest.region_results,
                    }
            except Exception as e:
                logger.warning(f"Failed to fetch last run from DB: {e}")

        return {
            "scheduler_running": self._is_running,
            "scraper_enabled": self.settings.scraper_enabled,
            "next_run_time": self.get_next_run_time(),
            "last_run_time": last_run,
            "last_run_result": last_run_result,
        }

    def get_next_run_time(self) -> datetime | None:
        """Get the next scheduled run time for the scraper job."""
        if not self._is_running:
            return None

        job = self.scheduler.get_job("daily_linkedin_scraper")
        if job and job.next_run_time:
            return job.next_run_time
        return None

    async def _acquire_lock(self, lock_id: str) -> bool:
        """
        Acquire distributed lock via Redis.

        Uses SET NX (set if not exists) for atomic lock acquisition.

        Args:
            lock_id: Unique identifier for this lock attempt

        Returns:
            True if lock acquired, False if already held
        """
        try:
            # Try to set lock with NX (only if not exists) and TTL
            result = await self._cache.redis.set(
                SCRAPER_LOCK_KEY,
                lock_id,
                nx=True,  # Only set if not exists
                ex=SCRAPER_LOCK_TTL,  # Expire after TTL
            )
            return result is not None
        except Exception as e:
            logger.error(f"Failed to acquire distributed lock: {e}")
            # If Redis is down, allow the job to run (fail open)
            return True

    async def _release_lock(self, lock_id: str) -> None:
        """
        Release distributed lock if we hold it.

        Only releases if the lock value matches our lock_id,
        preventing accidental release of another instance's lock.
        """
        try:
            # Check if we hold the lock before deleting
            current = await self._cache.redis.get(SCRAPER_LOCK_KEY)
            if current == lock_id:
                await self._cache.redis.delete(SCRAPER_LOCK_KEY)
                logger.debug(f"Released distributed lock: {lock_id}")
        except Exception as e:
            logger.warning(f"Failed to release distributed lock: {e}")

    async def _run_scraper_job_with_lock(
        self,
        run_type: str = "scheduled",
        triggered_by: str | None = None,
    ) -> ScraperBatchResult:
        """
        Execute scraper job with distributed locking.

        Prevents multiple instances from running the same job simultaneously.
        """
        lock_id = str(uuid.uuid4())

        # Try to acquire distributed lock
        if not await self._acquire_lock(lock_id):
            logger.warning("Scraper job skipped - another instance is running")
            return ScraperBatchResult(
                status="skipped",
                total_jobs_found=0,
                total_jobs_created=0,
                total_jobs_updated=0,
                total_errors=0,
                region_results=[],
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                duration_seconds=0,
            )

        try:
            return await self._run_scraper_job(
                run_type=run_type,
                triggered_by=triggered_by,
            )
        finally:
            await self._release_lock(lock_id)

    async def _run_scraper_job(
        self,
        run_type: str = "scheduled",
        triggered_by: str | None = None,
    ) -> ScraperBatchResult:
        """
        Execute the scraper job for all configured regions.

        This is the main job function that:
        1. Iterates through all scraper configurations
        2. Calls APIFY for each region (with concurrency control)
        3. Batch upserts results into the database
        4. Persists run results for audit trail
        """
        started_at = datetime.now(timezone.utc)
        batch_id = str(uuid.uuid4())[:8]
        logger.info(f"Starting scraper job (batch_id={batch_id}, type={run_type})")

        apify_client = get_apify_client()

        # Use semaphore to control concurrent APIFY calls
        semaphore = asyncio.Semaphore(self._max_concurrent_regions)

        async def process_region(config: ScraperConfig) -> tuple[list, ScraperRunResult]:
            """Process a single region with semaphore control and retry logic."""
            async with semaphore:
                return await self._process_region_with_retry(apify_client, config)

        # Process all regions with controlled concurrency
        tasks = [process_region(config) for config in SCRAPER_CONFIGS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Aggregate results
        all_jobs = []
        region_results: list[ScraperRunResult] = []
        total_jobs_found = 0
        total_errors = 0

        for i, result in enumerate(results):
            config = SCRAPER_CONFIGS[i]
            if isinstance(result, Exception):
                logger.error(f"Region {config.region.value} failed: {result}")
                total_errors += 1
                region_results.append(
                    ScraperRunResult(
                        region=config.region,
                        status="error",
                        jobs_found=0,
                        errors=1,
                        error_details=[{"error": "exception", "message": str(result)}],
                        started_at=started_at,
                        completed_at=datetime.now(timezone.utc),
                    )
                )
            else:
                jobs, run_result = result
                all_jobs.extend(jobs)
                region_results.append(run_result)
                total_jobs_found += run_result.jobs_found
                total_errors += run_result.errors

        # Batch upsert all jobs to database
        total_created = 0
        total_updated = 0
        db_errors: list[dict] = []

        if all_jobs:
            total_created, total_updated, db_errors = await self._batch_upsert_jobs(all_jobs)
            total_errors += len(db_errors)

        # Determine overall status
        completed_at = datetime.now(timezone.utc)
        duration = (completed_at - started_at).total_seconds()

        successful_regions = sum(1 for r in region_results if r.status == "success")
        if successful_regions == len(region_results):
            status = "success"
        elif successful_regions > 0:
            status = "partial"
        else:
            status = "error"

        batch_result = ScraperBatchResult(
            status=status,
            total_jobs_found=total_jobs_found,
            total_jobs_created=total_created,
            total_jobs_updated=total_updated,
            total_errors=total_errors,
            region_results=region_results,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration,
        )

        # Persist run to database for audit trail
        await self._persist_run(
            batch_result,
            run_type=run_type,
            triggered_by=triggered_by,
            batch_id=batch_id,
        )

        logger.info(
            f"Scraper job completed (batch_id={batch_id}): status={status}, "
            f"found={total_jobs_found}, created={total_created}, "
            f"updated={total_updated}, errors={total_errors}, "
            f"duration={duration:.2f}s"
        )

        return batch_result

    async def _process_region_with_retry(
        self,
        apify_client,
        config: ScraperConfig,
    ) -> tuple[list, ScraperRunResult]:
        """
        Process a region with automatic retry for transient failures.

        Distinguishes between retryable errors (network, timeout) and
        non-retryable errors (auth, validation).
        """
        last_error = None

        for attempt in range(self._retry_attempts + 1):
            try:
                logger.info(
                    f"Processing region {config.region.value} "
                    f"(attempt {attempt + 1}/{self._retry_attempts + 1})"
                )

                jobs, run_result = await apify_client.run_actor(config)

                # Check if result indicates a retryable condition
                if run_result.status == "timeout":
                    raise RetryableError("APIFY actor timeout")

                return jobs, run_result

            except (httpx.TimeoutException, httpx.NetworkError, RetryableError) as e:
                last_error = e
                logger.warning(
                    f"Retryable error for {config.region.value} "
                    f"(attempt {attempt + 1}): {e}"
                )

                if attempt < self._retry_attempts:
                    await asyncio.sleep(self._retry_delay_seconds)
                    continue

            except (ApifyClientError, httpx.HTTPStatusError) as e:
                # Non-retryable errors (auth, validation, 4xx errors)
                logger.error(f"Non-retryable error for {config.region.value}: {e}")
                return [], ScraperRunResult(
                    region=config.region,
                    status="error",
                    jobs_found=0,
                    errors=1,
                    error_details=[{"error": "non_retryable", "message": str(e)}],
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc),
                )

            except Exception as e:
                logger.error(f"Unexpected error for {config.region.value}: {e}")
                return [], ScraperRunResult(
                    region=config.region,
                    status="error",
                    jobs_found=0,
                    errors=1,
                    error_details=[{"error": "unexpected", "message": str(e)}],
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc),
                )

        # All retries exhausted
        return [], ScraperRunResult(
            region=config.region,
            status="error",
            jobs_found=0,
            errors=1,
            error_details=[
                {
                    "error": "max_retries_exceeded",
                    "message": str(last_error),
                    "attempts": self._retry_attempts + 1,
                }
            ],
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )

    async def _batch_upsert_jobs(self, jobs: list) -> tuple[int, int, list[dict]]:
        """
        Batch upsert jobs into the database using efficient batch operations.

        Args:
            jobs: List of ApifyJobListing objects

        Returns:
            Tuple of (created_count, updated_count, errors)
        """
        async with AsyncSessionLocal() as db:
            try:
                created, updated, errors = await job_listing_repository.batch_upsert_from_apify(
                    db, jobs_data=jobs
                )
                await db.commit()
                return created, updated, errors
            except Exception as e:
                logger.error(f"Database error during batch upsert: {e}")
                await db.rollback()
                return 0, 0, [{"error": "db_error", "message": str(e)}]

    async def _persist_run(
        self,
        batch_result: ScraperBatchResult,
        run_type: str,
        triggered_by: str | None,
        batch_id: str,
    ) -> None:
        """
        Persist scraper run to database for audit trail.

        Args:
            batch_result: Results from the scraper run
            run_type: Type of run (scheduled, manual)
            triggered_by: Who/what triggered the run
            batch_id: Unique batch identifier
        """
        async with AsyncSessionLocal() as db:
            try:
                # Snapshot the config for audit
                config_snapshot = [
                    {
                        "region": c.region.value,
                        "geo_id": c.geo_id,
                        "count": c.count,
                    }
                    for c in SCRAPER_CONFIGS
                ]

                await scraper_run_repository.create(
                    db,
                    batch_result=batch_result,
                    run_type=run_type,
                    triggered_by=triggered_by,
                    config_snapshot={"batch_id": batch_id, "regions": config_snapshot},
                )
                await db.commit()
                logger.debug(f"Persisted scraper run (batch_id={batch_id})")
            except Exception as e:
                logger.error(f"Failed to persist scraper run: {e}")
                await db.rollback()


# Module-level singleton instance
_scheduler_service: SchedulerService | None = None


def get_scheduler_service() -> SchedulerService:
    """Get the singleton scheduler service instance."""
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = SchedulerService(settings=get_settings())
    return _scheduler_service
