"""
Scraper orchestrator for multi-region LinkedIn job scraping.

Coordinates running all regional scrapers sequentially and
persisting results to the database.
"""

import logging
from datetime import datetime, timezone

from app.crud import job_listing_repository
from app.db.session import AsyncSessionLocal
from app.schemas.scraper import (
    SCRAPER_CONFIGS,
    ScraperBatchResult,
    ScraperConfig,
    ScraperRunResult,
)
from app.services.apify_client import get_apify_client

logger = logging.getLogger(__name__)


class ScraperOrchestrator:
    """Orchestrates multi-region LinkedIn job scraping."""

    def __init__(self):
        self.apify_client = get_apify_client()
        self.last_run_result: ScraperBatchResult | None = None

    async def run_single_scraper(
        self,
        config: ScraperConfig,
    ) -> ScraperRunResult:
        """
        Run a single regional scraper and persist jobs to database.

        Args:
            config: Scraper configuration for the region

        Returns:
            ScraperRunResult with job counts after DB persistence
        """
        logger.info(f"Starting scraper for region: {config.region.value}")

        # Run the APIFY actor
        jobs, result = await self.apify_client.run_actor(config)

        if result.status != "success" or not jobs:
            logger.warning(
                f"Scraper for {config.region.value} returned status={result.status}, "
                f"jobs_found={result.jobs_found}"
            )
            return result

        # Persist jobs to database
        jobs_created = 0
        jobs_updated = 0
        db_errors: list[dict] = []

        async with AsyncSessionLocal() as db:
            try:
                for job in jobs:
                    try:
                        listing, is_created = await job_listing_repository.upsert_from_apify(
                            db, job_data=job, source_platform="linkedin"
                        )
                        if is_created:
                            jobs_created += 1
                        else:
                            jobs_updated += 1
                    except Exception as e:
                        db_errors.append(
                            {
                                "job_id": job.id,
                                "error": str(e),
                            }
                        )
                        logger.warning(
                            f"Failed to upsert job {job.id}: {e}"
                        )

                await db.commit()

                logger.info(
                    f"Scraper for {config.region.value} completed: "
                    f"{jobs_created} created, {jobs_updated} updated, "
                    f"{len(db_errors)} DB errors"
                )

            except Exception as e:
                await db.rollback()
                logger.error(f"Database error during scrape for {config.region.value}: {e}")
                result.errors += 1
                result.error_details.append({"error": "db_commit", "message": str(e)})

        # Update result with DB counts
        result.jobs_created = jobs_created
        result.jobs_updated = jobs_updated
        result.errors += len(db_errors)
        result.error_details.extend(db_errors)

        return result

    async def run_all_scrapers(
        self,
        configs: list[ScraperConfig] | None = None,
    ) -> ScraperBatchResult:
        """
        Run all regional scrapers sequentially.

        Args:
            configs: Optional list of configs to run. Defaults to all SCRAPER_CONFIGS.

        Returns:
            ScraperBatchResult with aggregated stats from all regions
        """
        if configs is None:
            configs = SCRAPER_CONFIGS

        started_at = datetime.now(timezone.utc)
        region_results: list[ScraperRunResult] = []

        total_jobs_found = 0
        total_jobs_created = 0
        total_jobs_updated = 0
        total_errors = 0
        success_count = 0

        logger.info(f"Starting batch scrape for {len(configs)} regions")

        for config in configs:
            try:
                result = await self.run_single_scraper(config)
                region_results.append(result)

                total_jobs_found += result.jobs_found
                total_jobs_created += result.jobs_created
                total_jobs_updated += result.jobs_updated
                total_errors += result.errors

                if result.status == "success":
                    success_count += 1

            except Exception as e:
                logger.error(f"Unexpected error running scraper for {config.region.value}: {e}")
                region_results.append(
                    ScraperRunResult(
                        region=config.region,
                        status="error",
                        errors=1,
                        error_details=[{"error": "orchestrator", "message": str(e)}],
                        started_at=datetime.now(timezone.utc),
                        completed_at=datetime.now(timezone.utc),
                    )
                )
                total_errors += 1

        completed_at = datetime.now(timezone.utc)
        duration = (completed_at - started_at).total_seconds()

        # Determine overall status
        if success_count == len(configs):
            status = "success"
        elif success_count > 0:
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

        self.last_run_result = batch_result

        logger.info(
            f"Batch scrape completed: status={status}, "
            f"found={total_jobs_found}, created={total_jobs_created}, "
            f"updated={total_jobs_updated}, errors={total_errors}, "
            f"duration={duration:.1f}s"
        )

        return batch_result


# Module-level singleton
_orchestrator: ScraperOrchestrator | None = None


def get_scraper_orchestrator() -> ScraperOrchestrator:
    """Get the singleton scraper orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = ScraperOrchestrator()
    return _orchestrator
