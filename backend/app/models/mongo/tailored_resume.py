"""MongoDB Pydantic model for TailoredResume documents.

Two Copies Architecture:
- tailored_data: Complete AI-generated resume (validated against ParsedContent schema)
- finalized_data: User's final approved version after accepting/rejecting changes
- Frontend does diffing between original resume and tailored_data
"""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer

from app.models.mongo.resume import PyObjectId, ParsedContent


# Default section order for new tailored resumes (all 16 sections)
DEFAULT_SECTION_ORDER = [
    "summary",
    "experience",
    "skills",
    "education",
    "projects",
    "certifications",
    "languages",
    "volunteer",
    "publications",
    "awards",
    "leadership",
    "memberships",
    "courses",
    "interests",
    "references",
]


class TailoredResumeStatus(str, Enum):
    """Status of a tailored resume in the approval workflow."""

    PENDING = "pending"  # AI generated, waiting for user review
    FINALIZED = "finalized"  # User approved and finalized
    ARCHIVED = "archived"  # No longer active


class JobSource(BaseModel):
    """Reference to the job this resume was tailored for."""

    type: Literal["user_created", "job_listing"]  # Maps to Postgres table
    id: int  # FK to job_descriptions.id or job_listings.id


class ATSKeywords(BaseModel):
    """ATS keyword analysis results."""

    matched: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    score: float | None = None


class TailoredResumeDocument(BaseModel):
    """MongoDB TailoredResume document schema.

    Two Copies Model:
    - tailored_data: Complete AI-tailored resume content (same structure as ParsedContent)
    - finalized_data: User's final version after partial approvals (same structure)

    The frontend fetches both the original resume (from resumes collection) and
    tailored_data, then does client-side diffing. User accepts/rejects sections
    to build finalized_data, which gets POSTed back here.
    """

    id: PyObjectId | None = Field(default=None, alias="_id")
    resume_id: PyObjectId  # FK to MongoDB resumes._id
    user_id: int  # FK to Postgres users.id (denormalized for queries)

    job_source: JobSource

    # Two Copies: Complete documents, not suggestions
    tailored_data: dict[str, Any]  # AI-generated complete resume (ParsedContent structure)
    finalized_data: dict[str, Any] | None = None  # User's final approved version

    status: TailoredResumeStatus = TailoredResumeStatus.PENDING

    section_order: list[str] = Field(default_factory=lambda: DEFAULT_SECTION_ORDER.copy())

    # Scoring and analysis
    match_score: float | None = None
    ats_keywords: ATSKeywords | None = None

    # Metadata
    ai_model: str | None = None  # Which model generated this
    job_title: str | None = None  # Denormalized for quick display
    company_name: str | None = None  # Denormalized for quick display

    style_settings: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    finalized_at: datetime | None = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    @field_serializer("id")
    def serialize_id(self, v: PyObjectId | None) -> str | None:
        return str(v) if v else None

    @field_serializer("resume_id")
    def serialize_resume_id(self, v: PyObjectId) -> str:
        return str(v)

    @property
    def job_source_type(self) -> str:
        """Return which type of job source is being used."""
        return self.job_source.type


class TailoredResumeCreate(BaseModel):
    """Schema for creating a new tailored resume."""

    resume_id: str  # ObjectId as string
    user_id: int
    job_source: JobSource
    tailored_data: dict[str, Any]  # Complete AI-generated resume
    section_order: list[str] | None = None
    match_score: float | None = None
    ats_keywords: ATSKeywords | None = None
    ai_model: str | None = None
    job_title: str | None = None
    company_name: str | None = None
    style_settings: dict[str, Any] | None = None


class TailoredResumeUpdate(BaseModel):
    """Schema for updating an existing tailored resume."""

    tailored_data: dict[str, Any] | None = None
    section_order: list[str] | None = None
    match_score: float | None = None
    ats_keywords: ATSKeywords | None = None
    style_settings: dict[str, Any] | None = None


class TailoredResumeFinalize(BaseModel):
    """Schema for finalizing a tailored resume with user's approved changes."""

    finalized_data: dict[str, Any]  # The merged document from frontend
