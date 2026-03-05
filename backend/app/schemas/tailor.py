"""API schemas for resume tailoring endpoints.

Two Copies Architecture:
- AI generates complete tailored_data (same structure as ParsedContent)
- Frontend does client-side diffing between original and tailored
- User approves/rejects changes to build finalized_data
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, computed_field, model_validator

from app.models.mongo.tailored_resume import TailoredResumeStatus


def _format_tailored_name(job_title: str | None, company_name: str | None, created_at: datetime) -> str:
    """Generate human-readable version name for tailored resumes.

    Format: "{job_title} @ {company_name} — {date}"
    Falls back gracefully when job_title or company_name is missing.
    """
    # Format the date as "Mar 5" (month abbreviation + day without leading zero)
    date_str = created_at.strftime("%b %-d") if hasattr(created_at, "strftime") else str(created_at)[:10]

    if job_title and company_name:
        return f"{job_title} @ {company_name} — {date_str}"
    elif job_title:
        return f"{job_title} — {date_str}"
    elif company_name:
        return f"{company_name} — {date_str}"
    else:
        return f"Tailored Resume — {date_str}"


# =============================================================================
# Parsed Content Schema (matches MongoDB resume.parsed structure)
# =============================================================================


class ContactInfoSchema(BaseModel):
    """Contact information in parsed resume."""

    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    github: str | None = None
    website: str | None = None


class ExperienceEntrySchema(BaseModel):
    """Work experience entry in parsed resume."""

    id: str | None = None  # Unique ID for diffing
    title: str | None = None
    company: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    bullets: list[str] = []


class EducationEntrySchema(BaseModel):
    """Education entry in parsed resume."""

    id: str | None = None  # Unique ID for diffing
    degree: str | None = None
    institution: str | None = None
    location: str | None = None
    graduation_date: str | None = None
    gpa: str | None = None
    honors: list[str] = []


class ProjectEntrySchema(BaseModel):
    """Project entry in parsed resume."""

    id: str | None = None  # Unique ID for diffing
    name: str | None = None
    description: str | None = None
    technologies: list[str] = []
    url: str | None = None


class ParsedContentSchema(BaseModel):
    """Structured parsed content from resume - used for both original and tailored."""

    contact: ContactInfoSchema | None = None
    summary: str | None = None
    experience: list[ExperienceEntrySchema] = []
    education: list[EducationEntrySchema] = []
    skills: list[str] = []
    certifications: list[str] = []
    projects: list[ProjectEntrySchema] = []


# =============================================================================
# Request Schemas
# =============================================================================


class TailorRequest(BaseModel):
    """Request to tailor a resume for a job."""

    resume_id: str  # MongoDB ObjectId as string
    job_id: int | None = None  # Postgres job_descriptions.id
    job_listing_id: int | None = None  # Postgres job_listings.id
    focus_keywords: list[str] | None = None  # User-selected keywords to emphasize

    @model_validator(mode="after")
    def validate_job_source(self) -> "TailorRequest":
        """Ensure exactly one job source is provided."""
        if self.job_id is None and self.job_listing_id is None:
            raise ValueError("Either job_id or job_listing_id must be provided")
        if self.job_id is not None and self.job_listing_id is not None:
            raise ValueError("Only one of job_id or job_listing_id can be provided")
        return self


class QuickMatchRequest(BaseModel):
    """Request for quick match score without full tailoring."""

    resume_id: str  # MongoDB ObjectId as string
    job_id: int | None = None  # Postgres job_descriptions.id
    job_listing_id: int | None = None  # Postgres job_listings.id

    @model_validator(mode="after")
    def validate_job_source(self) -> "QuickMatchRequest":
        """Ensure exactly one job source is provided."""
        if self.job_id is None and self.job_listing_id is None:
            raise ValueError("Either job_id or job_listing_id must be provided")
        if self.job_id is not None and self.job_listing_id is not None:
            raise ValueError("Only one of job_id or job_listing_id can be provided")
        return self


class TailoredResumeFinalizeRequest(BaseModel):
    """Request to finalize a tailored resume with user's approved changes.

    The finalized_data is the merged document the frontend built by
    accepting some AI changes and keeping some originals.
    """

    finalized_data: dict[str, Any]  # ParsedContent structure


class TailoredResumeUpdateRequest(BaseModel):
    """Request to update a tailored resume's content or style."""

    tailored_data: dict[str, Any] | None = None  # ParsedContent structure
    style_settings: dict[str, Any] | None = None
    section_order: list[str] | None = None


# =============================================================================
# Response Schemas
# =============================================================================


class QuickMatchResponse(BaseModel):
    """Response for quick match score."""

    match_score: int
    keyword_coverage: float
    skill_matches: list[str]
    skill_gaps: list[str]


class TailorResponse(BaseModel):
    """Response after generating a tailored resume.

    Two Copies Architecture: Returns the complete tailored_data,
    not individual suggestions. Frontend will fetch the compare
    endpoint to get both original and tailored for diffing.
    """

    id: str  # MongoDB ObjectId as string
    resume_id: str  # MongoDB ObjectId as string
    job_id: int | None = None  # Postgres job_descriptions.id
    job_listing_id: int | None = None  # Postgres job_listings.id
    tailored_data: dict[str, Any]  # Complete tailored resume (ParsedContent structure)
    status: TailoredResumeStatus
    match_score: float
    skill_matches: list[str]
    skill_gaps: list[str]
    keyword_coverage: float
    job_title: str | None = None
    company_name: str | None = None
    focus_keywords_used: list[str] | None = None  # Keywords that were used in tailoring
    created_at: datetime

    model_config = {"from_attributes": True}


class TailoredResumeCompareResponse(BaseModel):
    """Response for the compare endpoint - returns both documents for frontend diffing.

    This is the critical endpoint for the Two Copies architecture.
    Frontend uses these two documents to compute diffs client-side.
    """

    id: str  # Tailored resume ID
    resume_id: str  # Original resume ID
    original: dict[str, Any]  # Original resume's parsed content
    tailored: dict[str, Any]  # AI-generated tailored content
    status: TailoredResumeStatus
    match_score: float | None
    job_title: str | None = None
    company_name: str | None = None

    model_config = {"from_attributes": True}


class TailoredResumeListResponse(BaseModel):
    """List item response for tailored resumes."""

    id: str  # MongoDB ObjectId as string
    resume_id: str  # MongoDB ObjectId as string
    job_id: int | None = None  # Postgres job_descriptions.id
    job_listing_id: int | None = None  # Postgres job_listings.id
    status: TailoredResumeStatus
    match_score: float | None
    job_title: str | None = None
    company_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def formatted_name(self) -> str:
        """Human-readable version name: '{job_title} @ {company_name} — {date}'."""
        return _format_tailored_name(self.job_title, self.company_name, self.created_at)


class TailoredResumeFullResponse(BaseModel):
    """Full response including all fields."""

    id: str  # MongoDB ObjectId as string
    resume_id: str  # MongoDB ObjectId as string
    job_id: int | None  # Postgres job_descriptions.id
    job_listing_id: int | None  # Postgres job_listings.id
    tailored_data: dict[str, Any]
    finalized_data: dict[str, Any] | None
    status: TailoredResumeStatus
    match_score: float | None
    skill_matches: list[str] = []
    skill_gaps: list[str] = []
    keyword_coverage: float = 0.0
    job_title: str | None = None
    company_name: str | None = None
    style_settings: dict[str, Any] = {}
    section_order: list[str]
    created_at: datetime
    updated_at: datetime | None
    finalized_at: datetime | None = None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def formatted_name(self) -> str:
        """Human-readable version name: '{job_title} @ {company_name} — {date}'."""
        return _format_tailored_name(self.job_title, self.company_name, self.created_at)


# =============================================================================
# Style Settings (kept for PDF generation)
# =============================================================================


class StyleSettingsSchema(BaseModel):
    """Style settings for PDF generation."""

    font_family: str | None = None
    font_size_body: int | None = None
    font_size_heading: int | None = None
    font_size_subheading: int | None = None
    margin_top: float | None = None
    margin_bottom: float | None = None
    margin_left: float | None = None
    margin_right: float | None = None
    line_spacing: float | None = None
    section_spacing: float | None = None
