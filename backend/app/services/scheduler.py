"""
Background job scheduler for automated scraper runs.

Uses APScheduler to schedule daily LinkedIn job scraping across
multiple regions using the APIFY client.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import Settings, get_settings
from app.crud.job_listing import job_listing_repository
from app.db.session import AsyncSessionLocal
from app.schemas.scraper import (
    SCRAPER_CONFIGS,
    ScraperBatchResult,
    ScraperRunResult,
)
from app.services.apify_client import get_apify_client

logger = logging.getLogger(__name__)


class SchedulerService:
    """
    Background job scheduler using APScheduler.

    Manages daily scraper jobs that fetch LinkedIn job listings
    via APIFY and upsert them into the database.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.scheduler = AsyncIOScheduler()
        self._last_run_time: datetime | None = None
        self._last_run_result: ScraperBatchResult | None = None
        self._is_running = False

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
            self._run_scraper_job,
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

    async def trigger_scraper_now(self) -> ScraperBatchResult:
        """
        Manual trigger for testing or on-demand scraping.

        Returns:
            ScraperBatchResult with aggregated results from all regions.
        """
        logger.info("Manual scraper trigger initiated")
        return await self._run_scraper_job()

    def get_status(self) -> dict[str, Any]:
        """
        Return scheduler status and last run info.

        Returns:
            Dict containing scheduler state, next run time, and last run details.
        """
        return {
            "scheduler_running": self._is_running,
            "scraper_enabled": self.settings.scraper_enabled,
            "next_run_time": self.get_next_run_time(),
            "last_run_time": self._last_run_time,
            "last_run_result": self._last_run_result,
        }

    def get_next_run_time(self) -> datetime | None:
        """Get the next scheduled run time for the scraper job."""
        if not self._is_running:
            return None

        job = self.scheduler.get_job("daily_linkedin_scraper")
        if job and job.next_run_time:
            return job.next_run_time
        return None

    async def _run_scraper_job(self) -> ScraperBatchResult:
        """
        Execute the scraper job for all configured regions.

        This is the main job function that:
        1. Iterates through all scraper configurations
        2. Calls APIFY for each region
        3. Upserts results into the database
        4. Aggregates and stores results
        """
        started_at = datetime.now(timezone.utc)
        logger.info("Starting scheduled scraper job")

        apify_client = get_apify_client()
        region_results: list[ScraperRunResult] = []
        total_jobs_found = 0
        total_jobs_created = 0
        total_jobs_updated = 0
        total_errors = 0

        # Process each region configuration
        for config in SCRAPER_CONFIGS:
            logger.info(f"Processing region: {config.region.value}")

            try:
                # Fetch jobs from APIFY
                jobs, run_result = await apify_client.run_actor(config)

                # Update counters from actor run
                total_jobs_found += run_result.jobs_found
                total_errors += run_result.errors

                # Upsert jobs into database
                if jobs:
                    created_count, updated_count = await self._upsert_jobs(jobs)
                    run_result.jobs_created = created_count
                    run_result.jobs_updated = updated_count
                    total_jobs_created += created_count
                    total_jobs_updated += updated_count

                region_results.append(run_result)

            except Exception as e:
                logger.error(f"Error processing region {config.region.value}: {e}")
                total_errors += 1
                region_results.append(
                    ScraperRunResult(
                        region=config.region,
                        status="error",
                        jobs_found=0,
                        errors=1,
                        error_details=[{"error": "unexpected", "message": str(e)}],
                        started_at=started_at,
                        completed_at=datetime.now(timezone.utc),
                    )
                )

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
            total_jobs_created=total_jobs_created,
            total_jobs_updated=total_jobs_updated,
            total_errors=total_errors,
            region_results=region_results,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration,
        )

        # Store last run info
        self._last_run_time = started_at
        self._last_run_result = batch_result

        logger.info(
            f"Scraper job completed: status={status}, "
            f"found={total_jobs_found}, created={total_jobs_created}, "
            f"updated={total_jobs_updated}, errors={total_errors}, "
            f"duration={duration:.2f}s"
        )

        return batch_result

    async def _upsert_jobs(self, jobs: list) -> tuple[int, int]:
        """
        Upsert jobs into the database.

        Args:
            jobs: List of ApifyJobListing objects

        Returns:
            Tuple of (created_count, updated_count)
        """
        created_count = 0
        updated_count = 0

        async with AsyncSessionLocal() as db:
            try:
                for job in jobs:
                    try:
                        listing, is_created = await job_listing_repository.upsert_from_apify(
                            db, job_data=job
                        )
                        if is_created:
                            created_count += 1
                        else:
                            updated_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to upsert job {job.id}: {e}")

                await db.commit()
            except Exception as e:
                logger.error(f"Database error during upsert: {e}")
                await db.rollback()
                raise

        return created_count, updated_count


# Module-level singleton instance
_scheduler_service: SchedulerService | None = None


def get_scheduler_service() -> SchedulerService:
    """Get the singleton scheduler service instance."""
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = SchedulerService(settings=get_settings())
    return _scheduler_service
