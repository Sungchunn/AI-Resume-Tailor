"""
HTTP client for APIFY API to run LinkedIn job scraper actors.

Handles running the actor, parsing responses, and converting them
to internal ApifyJobListing format.
"""

import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.job_listing import ApifyJobListing
from app.schemas.scraper import ScraperConfig, ScraperRunResult

logger = logging.getLogger(__name__)

APIFY_BASE_URL = "https://api.apify.com/v2"


class ApifyClientError(Exception):
    """Custom exception for APIFY client errors."""

    pass


class ApifyClient:
    """HTTP client for APIFY API."""

    def __init__(
        self,
        api_token: str,
        actor_id: str,
        timeout_seconds: int = 300,
        max_retries: int = 3,
    ):
        self.api_token = api_token
        self.actor_id = actor_id
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    async def run_actor(
        self,
        config: ScraperConfig,
    ) -> tuple[list[ApifyJobListing], ScraperRunResult]:
        """
        Run LinkedIn scraper actor for a region.

        Args:
            config: Scraper configuration with region, geo_id, count, and search_url

        Returns:
            Tuple of (parsed job listings, scraper run result)
        """
        started_at = datetime.now(timezone.utc)

        # Build the actor input payload
        # Use "count" parameter as expected by the Apify LinkedIn scraper actor
        actor_input = {
            "count": config.count,
            "scrapeCompany": True,
            "splitByLocation": False,
            "urls": [config.search_url],
        }

        # Build the API URL for sync run with dataset items
        # Add timeout parameter to limit actor run time on Apify's side
        api_url = (
            f"{APIFY_BASE_URL}/acts/{self.actor_id}/run-sync-get-dataset-items"
            f"?timeout={self.timeout_seconds}"
        )

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}",
        }

        jobs: list[ApifyJobListing] = []
        error_details: list[dict[str, Any]] = []

        try:
            # HTTP timeout should be slightly longer than Apify timeout to receive the response
            http_timeout = self.timeout_seconds + 30
            async with httpx.AsyncClient(timeout=http_timeout) as client:
                logger.info(
                    f"Running APIFY actor for {config.region.value} "
                    f"(geo_id={config.geo_id}, count={config.count}, timeout={self.timeout_seconds}s)"
                )

                response = await client.post(
                    api_url,
                    json=actor_input,
                    headers=headers,
                )

                if response.status_code not in (200, 201):
                    error_msg = f"APIFY API error: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    raise ApifyClientError(error_msg)

                data = response.json()

                # Parse each job item
                for item in data:
                    try:
                        # Add region to the item
                        item["region"] = config.region.value
                        job = ApifyJobListing.model_validate(item)
                        jobs.append(job)
                    except Exception as e:
                        error_details.append(
                            {
                                "item_id": item.get("id", "unknown"),
                                "error": str(e),
                            }
                        )
                        logger.warning(
                            f"Failed to parse job item: {e}, item_id={item.get('id', 'unknown')}"
                        )

                completed_at = datetime.now(timezone.utc)
                duration = (completed_at - started_at).total_seconds()

                result = ScraperRunResult(
                    region=config.region,
                    status="success",
                    jobs_found=len(jobs),
                    jobs_created=0,  # Will be updated by orchestrator after DB upsert
                    jobs_updated=0,  # Will be updated by orchestrator after DB upsert
                    errors=len(error_details),
                    error_details=error_details,
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_seconds=duration,
                )

                logger.info(
                    f"APIFY actor completed for {config.region.value}: "
                    f"{len(jobs)} jobs found, {len(error_details)} parse errors"
                )

                return jobs, result

        except httpx.TimeoutException as e:
            completed_at = datetime.now(timezone.utc)
            duration = (completed_at - started_at).total_seconds()

            logger.error(f"APIFY actor timeout for {config.region.value}: {e}")

            result = ScraperRunResult(
                region=config.region,
                status="timeout",
                jobs_found=0,
                errors=1,
                error_details=[{"error": "timeout", "message": str(e)}],
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=duration,
            )
            return [], result

        except httpx.HTTPError as e:
            completed_at = datetime.now(timezone.utc)
            duration = (completed_at - started_at).total_seconds()

            logger.error(f"APIFY HTTP error for {config.region.value}: {e}")

            result = ScraperRunResult(
                region=config.region,
                status="error",
                jobs_found=0,
                errors=1,
                error_details=[{"error": "http_error", "message": str(e)}],
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=duration,
            )
            return [], result

        except Exception as e:
            completed_at = datetime.now(timezone.utc)
            duration = (completed_at - started_at).total_seconds()

            logger.error(f"APIFY unexpected error for {config.region.value}: {e}")

            result = ScraperRunResult(
                region=config.region,
                status="error",
                jobs_found=0,
                errors=1,
                error_details=[{"error": "unexpected", "message": str(e)}],
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=duration,
            )
            return [], result


    async def run_adhoc_scrape(
        self,
        url: str,
        count: int = 100,
    ) -> tuple[list[ApifyJobListing], dict[str, Any]]:
        """
        Run an ad-hoc LinkedIn scraper with custom URL and parameters.

        Args:
            url: LinkedIn job search URL
            count: Maximum number of jobs to scrape

        Returns:
            Tuple of (parsed job listings, result metadata dict)
        """
        started_at = datetime.now(timezone.utc)

        # Build the actor input payload for ad-hoc scraping
        # Use "count" parameter as expected by the Apify LinkedIn scraper actor
        actor_input = {
            "count": count,
            "scrapeCompany": True,
            "splitByLocation": False,
            "urls": [url],
        }

        # Build the API URL for sync run with dataset items
        # Add timeout parameter to limit actor run time on Apify's side
        # This ensures the actor stops after the specified time even if maxItems isn't reached
        api_url = (
            f"{APIFY_BASE_URL}/acts/{self.actor_id}/run-sync-get-dataset-items"
            f"?timeout={self.timeout_seconds}"
        )

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}",
        }

        jobs: list[ApifyJobListing] = []
        error_details: list[dict[str, Any]] = []

        try:
            # HTTP timeout should be slightly longer than Apify timeout to receive the response
            http_timeout = self.timeout_seconds + 30
            async with httpx.AsyncClient(timeout=http_timeout) as client:
                logger.info(
                    f"Running ad-hoc APIFY scrape: url={url}, count={count}, "
                    f"apify_timeout={self.timeout_seconds}s, http_timeout={http_timeout}s"
                )

                response = await client.post(
                    api_url,
                    json=actor_input,
                    headers=headers,
                )

                if response.status_code not in (200, 201):
                    error_msg = f"APIFY API error: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    completed_at = datetime.now(timezone.utc)
                    return [], {
                        "status": "error",
                        "jobs_found": 0,
                        "errors": 1,
                        "error_details": [{"error": "api_error", "message": error_msg}],
                        "duration_seconds": (completed_at - started_at).total_seconds(),
                    }

                data = response.json()

                # Parse each job item
                for item in data:
                    try:
                        # Ad-hoc scrapes don't have a region
                        item["region"] = "adhoc"
                        job = ApifyJobListing.model_validate(item)
                        jobs.append(job)
                    except Exception as e:
                        error_details.append(
                            {
                                "item_id": item.get("id", "unknown"),
                                "error": str(e),
                            }
                        )
                        logger.warning(
                            f"Failed to parse job item: {e}, item_id={item.get('id', 'unknown')}"
                        )

                completed_at = datetime.now(timezone.utc)
                duration = (completed_at - started_at).total_seconds()

                logger.info(
                    f"Ad-hoc APIFY scrape completed: "
                    f"{len(jobs)} jobs found, {len(error_details)} parse errors"
                )

                return jobs, {
                    "status": "success" if not error_details else "partial",
                    "jobs_found": len(jobs),
                    "errors": len(error_details),
                    "error_details": error_details,
                    "duration_seconds": duration,
                }

        except httpx.TimeoutException as e:
            completed_at = datetime.now(timezone.utc)
            duration = (completed_at - started_at).total_seconds()
            logger.error(f"Ad-hoc APIFY scrape timeout: {e}")
            return [], {
                "status": "timeout",
                "jobs_found": 0,
                "errors": 1,
                "error_details": [{"error": "timeout", "message": str(e)}],
                "duration_seconds": duration,
            }

        except httpx.HTTPError as e:
            completed_at = datetime.now(timezone.utc)
            duration = (completed_at - started_at).total_seconds()
            logger.error(f"Ad-hoc APIFY HTTP error: {e}")
            return [], {
                "status": "error",
                "jobs_found": 0,
                "errors": 1,
                "error_details": [{"error": "http_error", "message": str(e)}],
                "duration_seconds": duration,
            }

        except Exception as e:
            completed_at = datetime.now(timezone.utc)
            duration = (completed_at - started_at).total_seconds()
            logger.error(f"Ad-hoc APIFY unexpected error: {e}")
            return [], {
                "status": "error",
                "jobs_found": 0,
                "errors": 1,
                "error_details": [{"error": "unexpected", "message": str(e)}],
                "duration_seconds": duration,
            }


@lru_cache
def get_apify_client() -> ApifyClient:
    """Get a singleton APIFY client instance."""
    settings = get_settings()
    return ApifyClient(
        api_token=settings.apify_api_token,
        actor_id=settings.apify_actor_id,
        timeout_seconds=settings.apify_timeout_seconds,
        max_retries=settings.apify_max_retries,
    )
