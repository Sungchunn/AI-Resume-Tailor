"""
Pydantic schemas for APIFY scraper configuration and results.

These schemas define the configuration for multi-region LinkedIn scraping
and track results from scraper runs.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ScraperRegion(str, Enum):
    """Geographic regions for job scraping."""

    THAILAND = "thailand"
    MALAYSIA = "malaysia"
    SINGAPORE = "singapore"
    EUROPE = "europe"
    APAC = "apac"


class ScraperConfig(BaseModel):
    """Configuration for a single region's scraper run."""

    region: ScraperRegion
    geo_id: str = Field(..., description="LinkedIn geo ID for the region")
    count: int = Field(..., ge=1, le=1000, description="Max jobs to scrape")
    search_url: str = Field(..., description="LinkedIn search URL with filters")


class ScraperRunResult(BaseModel):
    """Result from a single scraper run."""

    region: ScraperRegion
    status: str = Field(..., description="success, error, timeout")
    jobs_found: int = Field(default=0, ge=0)
    jobs_created: int = Field(default=0, ge=0)
    jobs_updated: int = Field(default=0, ge=0)
    errors: int = Field(default=0, ge=0)
    error_details: list[dict[str, Any]] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: float | None = None


class ScraperBatchResult(BaseModel):
    """Aggregated results from running all regional scrapers."""

    status: str = Field(..., description="success, partial, error")
    total_jobs_found: int = Field(default=0, ge=0)
    total_jobs_created: int = Field(default=0, ge=0)
    total_jobs_updated: int = Field(default=0, ge=0)
    total_errors: int = Field(default=0, ge=0)
    region_results: list[ScraperRunResult] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: float | None = None


class ScraperStatusResponse(BaseModel):
    """Response for scraper status endpoint."""

    scheduler_running: bool
    scraper_enabled: bool
    next_run_time: datetime | None = None
    last_run_time: datetime | None = None
    last_run_result: ScraperBatchResult | None = None


class ScraperStatsResponse(BaseModel):
    """Response for scraper stats endpoint."""

    total_listings: int
    listings_by_region: dict[str, int]
    listings_by_status: dict[str, int]
    last_24h_created: int
    last_7d_created: int


# Hardcoded scraper configurations using exact user URLs
# TODO: Re-enable all regions after testing
SCRAPER_CONFIGS = [
    ScraperConfig(
        region=ScraperRegion.THAILAND,
        geo_id="105146118",
        count=10,  # Reduced for testing
        search_url="https://www.linkedin.com/jobs/search/?currentJobId=4340303441&f_E=1%2C2%2C3&f_TPR=r604800&f_WT=1%2C3&geoId=105146118&keywords=%22data%20analyst%22%20OR%20%22data%20engineer%22%20OR%20%22data%20specialist%22%20OR%20%22software%20engineer%22%20OR%20%22n8n%22&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true",
    ),
    # ScraperConfig(
    #     region=ScraperRegion.MALAYSIA,
    #     geo_id="104187078",
    #     count=100,
    #     search_url="https://www.linkedin.com/jobs/search/?currentJobId=4325263422&f_E=1%2C2%2C3&f_TPR=r604800&f_WT=1%2C3&geoId=104187078&keywords=%22data%20analyst%22%20OR%20%22data%20engineer%22%20OR%20%22data%20specialist%22%20OR%20%22software%20engineer%22%20OR%20%22n8n%22&origin=JOB_SEARCH_PAGE_LOCATION_AUTOCOMPLETE&refresh=true",
    # ),
    # ScraperConfig(
    #     region=ScraperRegion.SINGAPORE,
    #     geo_id="102454443",
    #     count=200,
    #     search_url="https://www.linkedin.com/jobs/search/?currentJobId=4317344775&f_E=1%2C2%2C3&f_TPR=r604800&f_WT=1%2C3&geoId=102454443&keywords=%22data%20analyst%22%20OR%20%22data%20engineer%22%20OR%20%22data%20specialist%22%20OR%20%22software%20engineer%22%20OR%20%22n8n%22&origin=JOB_SEARCH_PAGE_SEARCH_BUTTON&refresh=true",
    # ),
    # ScraperConfig(
    #     region=ScraperRegion.EUROPE,
    #     geo_id="91000002",
    #     count=200,
    #     search_url="https://www.linkedin.com/jobs/search/?alertAction=viewjobs&currentJobId=4373121301&f_E=1%2C2&f_T=9%2C2732%2C25201%2C30128%2C25764%2C3172%2C25194&f_TPR=a1771468957-&f_WT=2&geoId=91000002&keywords=software%20engineer&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true&sortBy=R&spellCorrectionEnabled=true",
    # ),
    # ScraperConfig(
    #     region=ScraperRegion.APAC,
    #     geo_id="91000003",
    #     count=300,
    #     search_url="https://www.linkedin.com/jobs/search/?alertAction=viewjobs&currentJobId=4375472384&distance=25&f_E=1%2C2&f_T=9%2C25201%2C30128%2C25194%2C2732%2C25764%2C3172&f_TPR=a1771468957-&geoId=91000003&keywords=software%20engineer&origin=JOB_ALERT_IN_APP_NOTIFICATION&originToLandingJobPostings=4375472384%2C4373671523%2C4373681426%2C4374067823%2C4370507154%2C4366980504&savedSearchId=15671109132&sortBy=R",
    # ),
]
