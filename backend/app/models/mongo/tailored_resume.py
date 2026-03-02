"""MongoDB Pydantic model for TailoredResume documents."""

from datetime import datetime
from typing import Any, Literal

from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer

from app.models.mongo.resume import PyObjectId


# Default section order for new tailored resumes
DEFAULT_SECTION_ORDER = ["summary", "experience", "skills", "education", "projects"]


class JobSource(BaseModel):
    """Reference to the job this resume was tailored for."""

    type: Literal["user_created", "job_listing"]  # Maps to Postgres table
    id: int  # FK to job_descriptions.id or job_listings.id


class Suggestion(BaseModel):
    """AI suggestion for resume improvement."""

    id: str  # UUID for individual suggestion tracking
    section: str  # e.g., "experience", "summary"
    path: str  # JSON path like "experience.0.bullets.1"
    original: str
    suggested: str
    reason: str
    status: Literal["pending", "accepted", "rejected"] = "pending"


class ATSKeywords(BaseModel):
    """ATS keyword analysis results."""

    matched: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    score: float | None = None


class TailoredResumeDocument(BaseModel):
    """MongoDB TailoredResume document schema."""

    id: PyObjectId | None = Field(default=None, alias="_id")
    resume_id: PyObjectId  # FK to MongoDB resumes._id
    user_id: int  # FK to Postgres users.id (denormalized for queries)

    job_source: JobSource

    content: str  # Final tailored resume text
    section_order: list[str] = Field(default_factory=lambda: DEFAULT_SECTION_ORDER.copy())

    suggestions: list[Suggestion] = Field(default_factory=list)

    match_score: float | None = None
    ats_keywords: ATSKeywords | None = None

    style_settings: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

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
    content: str
    section_order: list[str] | None = None
    suggestions: list[Suggestion] | None = None
    match_score: float | None = None
    ats_keywords: ATSKeywords | None = None
    style_settings: dict[str, Any] | None = None


class TailoredResumeUpdate(BaseModel):
    """Schema for updating an existing tailored resume."""

    content: str | None = None
    section_order: list[str] | None = None
    suggestions: list[Suggestion] | None = None
    match_score: float | None = None
    ats_keywords: ATSKeywords | None = None
    style_settings: dict[str, Any] | None = None
