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
        # The LinkedIn Jobs Scraper expects urls as array of objects with url key
        actor_input = {
            "urls": [config.search_url],
            "maxItems": config.count,
            "proxyConfiguration": {"useApifyProxy": True},
        }

        # Build the API URL for sync run with dataset items
        url = f"{APIFY_BASE_URL}/acts/{self.actor_id}/run-sync-get-dataset-items"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}",
        }

        jobs: list[ApifyJobListing] = []
        error_details: list[dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                logger.info(
                    f"Running APIFY actor for {config.region.value} "
                    f"(geo_id={config.geo_id}, max_items={config.count})"
                )

                response = await client.post(
                    url,
                    json=actor_input,
                    headers=headers,
                )

                if response.status_code != 200 and response.status_code != 201:
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
