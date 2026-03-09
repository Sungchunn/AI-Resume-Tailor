"""
Pydantic schemas for APIFY scraper configuration and results.

These schemas define the configuration for multi-region LinkedIn scraping
and track results from scraper runs.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator

from app.models.scraper_request import RequestStatus


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


class AdHocScrapeRequest(BaseModel):
    """Request for ad-hoc LinkedIn scraping via admin UI."""

    url: str = Field(..., min_length=1, description="LinkedIn job search URL")
    count: int = Field(default=100, ge=1, le=500, description="Max jobs to scrape")

    @field_validator("url")
    @classmethod
    def validate_linkedin_url(cls, v: str) -> str:
        """Validate that the URL is a legitimate LinkedIn jobs URL."""
        parsed = urlparse(v)

        # Must have valid scheme
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https scheme")

        # Domain must be exactly linkedin.com or www.linkedin.com
        domain = parsed.netloc.lower()
        if domain not in ("linkedin.com", "www.linkedin.com"):
            raise ValueError("URL must be from linkedin.com domain")

        # Path must start with /jobs
        if not parsed.path.lower().startswith("/jobs"):
            raise ValueError("URL must be a LinkedIn jobs URL")

        return v


class AdHocScrapeResponse(BaseModel):
    """Response from ad-hoc scraping operation."""

    status: str = Field(..., description="success, partial, error, timeout")
    jobs_found: int = Field(default=0, ge=0)
    jobs_created: int = Field(default=0, ge=0)
    jobs_updated: int = Field(default=0, ge=0)
    errors: int = Field(default=0, ge=0)
    error_details: list[dict[str, Any]] = Field(default_factory=list)
    duration_seconds: float | None = None


# ============================================================================
# Scraper Preset Schemas
# ============================================================================


class ScraperPresetCreate(BaseModel):
    """Request to create a new scraper preset."""

    name: str = Field(..., min_length=1, max_length=100, description="Name for the preset")
    url: str = Field(..., min_length=1, description="LinkedIn job search URL")
    count: int = Field(default=100, ge=1, le=500, description="Max jobs to scrape")
    is_active: bool = Field(default=True, description="Whether the preset is active")

    @field_validator("url")
    @classmethod
    def validate_linkedin_url(cls, v: str) -> str:
        """Validate that the URL is a legitimate LinkedIn jobs URL."""
        parsed = urlparse(v)

        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https scheme")

        domain = parsed.netloc.lower()
        if domain not in ("linkedin.com", "www.linkedin.com"):
            raise ValueError("URL must be from linkedin.com domain")

        if not parsed.path.lower().startswith("/jobs"):
            raise ValueError("URL must be a LinkedIn jobs URL")

        return v


class ScraperPresetUpdate(BaseModel):
    """Request to update a scraper preset."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    url: str | None = Field(default=None, min_length=1)
    count: int | None = Field(default=None, ge=1, le=500)
    is_active: bool | None = None

    @field_validator("url")
    @classmethod
    def validate_linkedin_url(cls, v: str | None) -> str | None:
        """Validate that the URL is a legitimate LinkedIn jobs URL."""
        if v is None:
            return v

        parsed = urlparse(v)

        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https scheme")

        domain = parsed.netloc.lower()
        if domain not in ("linkedin.com", "www.linkedin.com"):
            raise ValueError("URL must be from linkedin.com domain")

        if not parsed.path.lower().startswith("/jobs"):
            raise ValueError("URL must be a LinkedIn jobs URL")

        return v


class ScraperPresetResponse(BaseModel):
    """Response containing a scraper preset."""

    id: int
    name: str
    url: str
    count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class ScraperPresetListResponse(BaseModel):
    """Response containing a list of scraper presets."""

    presets: list[ScraperPresetResponse]
    total: int


# ============================================================================
# Schedule Settings Schemas
# ============================================================================


class ScheduleSettingsUpdate(BaseModel):
    """Request to update schedule settings."""

    is_enabled: bool | None = None
    schedule_type: str | None = Field(default=None, pattern="^(daily|weekly)$")
    schedule_hour: int | None = Field(default=None, ge=0, le=23)
    schedule_minute: int | None = Field(default=None, ge=0, le=59)
    schedule_day_of_week: int | None = Field(default=None, ge=0, le=6)
    schedule_timezone: str | None = Field(default=None, max_length=50)

    @field_validator("schedule_timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            ZoneInfo(v)
            return v
        except KeyError:
            raise ValueError(f"Invalid timezone: {v}")


class ScheduleSettingsResponse(BaseModel):
    """Response containing schedule settings."""

    is_enabled: bool
    schedule_type: str
    schedule_hour: int
    schedule_minute: int
    schedule_day_of_week: int | None
    schedule_timezone: str
    last_run_at: datetime | None
    next_run_at: datetime | None
    updated_at: datetime | None

    model_config = {"from_attributes": True}


# ============================================================================
# Apify Cost Tracking Schemas
# ============================================================================


class ApifyCostSummary(BaseModel):
    """Response for Apify cost monitoring endpoint."""

    daily_used_usd: float = Field(..., description="Amount spent today in USD")
    daily_limit_usd: float = Field(..., description="Daily spending limit in USD")
    daily_remaining_usd: float = Field(..., description="Remaining daily budget in USD")
    weekly_used_usd: float = Field(..., description="Amount spent this week in USD")
    weekly_limit_usd: float = Field(..., description="Weekly spending limit in USD")
    weekly_remaining_usd: float = Field(..., description="Remaining weekly budget in USD")
    budget_exceeded: bool = Field(..., description="Whether any budget limit has been exceeded")


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


# ============================================================================
# Scraper Request Schemas (User-submitted job URL requests)
# ============================================================================


class ScraperRequestCreate(BaseModel):
    """Request to submit a new scraper request."""

    url: str = Field(..., min_length=1, description="LinkedIn job search URL")
    name: str | None = Field(default=None, max_length=100, description="Suggested preset name")
    reason: str | None = Field(default=None, max_length=500, description="Why you want these jobs")

    @field_validator("url")
    @classmethod
    def validate_linkedin_url(cls, v: str) -> str:
        """Validate that the URL is a legitimate LinkedIn jobs URL."""
        parsed = urlparse(v)

        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https scheme")

        domain = parsed.netloc.lower()
        if domain not in ("linkedin.com", "www.linkedin.com"):
            raise ValueError("URL must be from linkedin.com domain")

        if not parsed.path.lower().startswith("/jobs"):
            raise ValueError("URL must be a LinkedIn jobs URL")

        return v


class ScraperRequestResponse(BaseModel):
    """Response containing a scraper request (user view)."""

    id: int
    url: str
    name: str | None
    reason: str | None
    status: RequestStatus
    admin_notes: str | None
    created_at: datetime
    updated_at: datetime | None
    reviewed_at: datetime | None
    preset_id: int | None

    model_config = {"from_attributes": True}


class ScraperRequestListResponse(BaseModel):
    """Response containing a list of scraper requests (user view)."""

    requests: list[ScraperRequestResponse]
    total: int


class ScraperRequestAdminResponse(ScraperRequestResponse):
    """Response containing a scraper request (admin view)."""

    user_id: int
    user_email: str
    reviewed_by: int | None
    reviewer_email: str | None


class ScraperRequestAdminListResponse(BaseModel):
    """Response containing a list of scraper requests (admin view)."""

    requests: list[ScraperRequestAdminResponse]
    total: int


class ScraperRequestApproveRequest(BaseModel):
    """Request to approve a scraper request."""

    admin_notes: str | None = Field(default=None, max_length=500, description="Optional notes")
    create_preset: bool = Field(default=True, description="Whether to create a preset")
    preset_name: str | None = Field(default=None, max_length=100, description="Override preset name")
    preset_count: int = Field(default=100, ge=1, le=500, description="Max jobs to scrape")
    preset_is_active: bool = Field(default=True, description="Whether preset is active")


class ScraperRequestRejectRequest(BaseModel):
    """Request to reject a scraper request."""

    admin_notes: str = Field(..., min_length=1, max_length=500, description="Rejection reason")
