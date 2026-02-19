"""
Pydantic schemas for JobListing and UserJobInteraction models.

These schemas handle the system-wide job listings from external sources
and user interactions (save, hide, apply).
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, HttpUrl


# Enums for filtering
class SeniorityLevel(str, Enum):
    """Job seniority levels for filtering."""
    ENTRY = "entry"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    EXECUTIVE = "executive"


class SortBy(str, Enum):
    """Sort options for job listings."""
    DATE_POSTED = "date_posted"
    SALARY_MIN = "salary_min"
    SALARY_MAX = "salary_max"
    COMPANY_NAME = "company_name"
    JOB_TITLE = "job_title"
    CREATED_AT = "created_at"


class SortOrder(str, Enum):
    """Sort order options."""
    ASC = "asc"
    DESC = "desc"


# ============================================================================
# JobListing Schemas
# ============================================================================


class JobListingBase(BaseModel):
    """Base schema for job listing fields."""

    external_job_id: str = Field(..., min_length=1, max_length=255)
    job_title: str = Field(..., min_length=1, max_length=500)
    company_name: str = Field(..., min_length=1, max_length=255)
    location: str | None = Field(None, max_length=500)
    seniority: str | None = Field(None, max_length=100)
    job_function: str | None = Field(None, max_length=255)
    industry: str | None = Field(None, max_length=255)
    job_description: str = Field(..., min_length=1)
    job_url: str = Field(..., min_length=1, max_length=2000)

    # Salary information
    salary_min: int | None = Field(None, ge=0)
    salary_max: int | None = Field(None, ge=0)
    salary_currency: str = Field(default="USD", max_length=10)
    salary_period: str | None = Field(None, max_length=20)

    # Metadata
    date_posted: datetime | None = None
    source_platform: str | None = Field(None, max_length=100)


class JobListingCreate(JobListingBase):
    """Schema for creating a job listing (via webhook)."""

    is_active: bool = True


class JobListingUpdate(BaseModel):
    """Schema for updating a job listing."""

    job_title: str | None = Field(None, min_length=1, max_length=500)
    company_name: str | None = Field(None, min_length=1, max_length=255)
    location: str | None = Field(None, max_length=500)
    seniority: str | None = Field(None, max_length=100)
    job_function: str | None = Field(None, max_length=255)
    industry: str | None = Field(None, max_length=255)
    job_description: str | None = Field(None, min_length=1)
    job_url: str | None = Field(None, min_length=1, max_length=2000)
    salary_min: int | None = Field(None, ge=0)
    salary_max: int | None = Field(None, ge=0)
    salary_currency: str | None = Field(None, max_length=10)
    salary_period: str | None = Field(None, max_length=20)
    date_posted: datetime | None = None
    source_platform: str | None = Field(None, max_length=100)
    is_active: bool | None = None


class JobListingResponse(JobListingBase):
    """Schema for job listing response."""

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    # User interaction status (populated per-user)
    is_saved: bool = False
    is_hidden: bool = False
    applied_at: datetime | None = None

    model_config = {"from_attributes": True}


class JobListingListResponse(BaseModel):
    """Schema for paginated job listing list response."""

    listings: list[JobListingResponse]
    total: int
    limit: int
    offset: int


# ============================================================================
# Filtering Schemas
# ============================================================================


class JobListingFilters(BaseModel):
    """Query parameters for filtering job listings."""

    # Location filters (comma-separated for multi-select)
    location: str | None = None
    locations: list[str] | None = None

    # Seniority filters (comma-separated for multi-select)
    seniority: str | None = None
    seniorities: list[str] | None = None

    # Category filters
    job_function: str | None = None
    industry: str | None = None

    # Salary filters
    salary_min: int | None = Field(None, ge=0)
    salary_max: int | None = Field(None, ge=0)

    # Date filter
    date_posted_after: datetime | None = None

    # Full-text search
    search: str | None = None

    # User interaction filters
    is_saved: bool | None = None
    is_hidden: bool | None = None
    applied: bool | None = None

    # Only show active listings (default True)
    active_only: bool = True

    # Sorting
    sort_by: SortBy = SortBy.DATE_POSTED
    sort_order: SortOrder = SortOrder.DESC

    # Pagination
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


# ============================================================================
# UserJobInteraction Schemas
# ============================================================================


class UserJobInteractionBase(BaseModel):
    """Base schema for user job interaction."""

    is_saved: bool = False
    is_hidden: bool = False


class UserJobInteractionCreate(UserJobInteractionBase):
    """Schema for creating a user job interaction."""

    job_listing_id: int


class UserJobInteractionResponse(UserJobInteractionBase):
    """Schema for user job interaction response."""

    id: int
    user_id: int
    job_listing_id: int
    applied_at: datetime | None = None
    last_viewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class SaveJobRequest(BaseModel):
    """Request to save/unsave a job."""

    save: bool = True  # True to save, False to unsave


class HideJobRequest(BaseModel):
    """Request to hide/unhide a job."""

    hide: bool = True  # True to hide, False to unhide


class ApplyJobRequest(BaseModel):
    """Request to mark a job as applied."""

    applied: bool = True  # True to mark applied, False to unmark


class JobInteractionActionResponse(BaseModel):
    """Response for job interaction actions."""

    success: bool
    message: str
    interaction: UserJobInteractionResponse


# ============================================================================
# Webhook Schemas (n8n Ingestion)
# ============================================================================


class WebhookJobListing(BaseModel):
    """Schema for a single job from n8n webhook."""

    external_job_id: str = Field(..., min_length=1, max_length=255)
    job_title: str = Field(..., min_length=1, max_length=500)
    company_name: str = Field(..., min_length=1, max_length=255)
    location: str | None = None
    seniority: str | None = None
    job_function: str | None = None
    industry: str | None = None
    job_description: str = Field(..., min_length=1)
    job_url: str = Field(..., min_length=1, max_length=2000)
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = "USD"
    salary_period: str | None = None
    date_posted: datetime | None = None
    source_platform: str | None = None


class WebhookBatchRequest(BaseModel):
    """Schema for batch job ingestion from n8n."""

    jobs: list[WebhookJobListing] = Field(..., min_length=1, max_length=1000)


class WebhookBatchResponse(BaseModel):
    """Response for batch job ingestion."""

    created: int
    updated: int
    failed: int
    errors: list[dict[str, Any]] = Field(default_factory=list)


# ============================================================================
# Resume Style Schemas (for PDF generation)
# ============================================================================


class ResumeStyle(BaseModel):
    """Style settings for resume PDF generation."""

    font_family: str = Field(default="Calibri", max_length=50)
    font_size_body: int = Field(default=11, ge=8, le=14)
    font_size_heading: int = Field(default=14, ge=10, le=20)
    font_size_subheading: int = Field(default=12, ge=9, le=16)
    margin_top: float = Field(default=0.75, ge=0.25, le=2.0)  # inches
    margin_bottom: float = Field(default=0.75, ge=0.25, le=2.0)
    margin_left: float = Field(default=0.75, ge=0.25, le=2.0)
    margin_right: float = Field(default=0.75, ge=0.25, le=2.0)
    line_spacing: float = Field(default=1.15, ge=1.0, le=2.0)
    section_spacing: float = Field(default=12, ge=6, le=24)  # points


class PDFPreviewRequest(BaseModel):
    """Request for PDF preview generation."""

    sections: dict[str, Any]
    style: ResumeStyle = Field(default_factory=ResumeStyle)


class PDFPreviewResponse(BaseModel):
    """Response for PDF preview (cached)."""

    pdf_url: str
    content_hash: str
    cached: bool
    expires_at: datetime
