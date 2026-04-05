"""
Pydantic schemas for ResumeBuild API endpoints.

These schemas handle request validation and response serialization
for all resume build-related operations.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.core.protocols import DiffOperation, ResumeBuildStatus, SuggestionImpact


class DiffSuggestion(BaseModel):
    """Schema for a single diff-based suggestion."""

    operation: DiffOperation = Field(..., description="JSON Patch operation type")
    path: str = Field(..., description="JSON Pointer path (RFC 6901)")
    value: Any = Field(..., description="New value to apply")
    original_value: Any | None = Field(None, description="Original value being replaced")
    reason: str = Field(..., description="Explanation for why this improves job fit")
    impact: SuggestionImpact = Field(..., description="Impact level of the suggestion")


class ResumeBuildBase(BaseModel):
    """Base schema with common resume build fields."""

    job_title: str = Field(..., min_length=1, max_length=255)
    job_company: str | None = Field(None, max_length=255)
    job_description: str | None = Field(None, min_length=1)


class ResumeBuildCreate(ResumeBuildBase):
    """Schema for creating a new resume build."""

    pass


class ResumeBuildUpdate(BaseModel):
    """Schema for updating a resume build. All fields optional."""

    job_title: str | None = Field(None, min_length=1, max_length=255)
    job_company: str | None = Field(None, max_length=255)
    job_description: str | None = None


class ResumeBuildResponse(ResumeBuildBase):
    """Schema for resume build API responses."""

    id: str  # MongoDB ObjectId as string
    user_id: int
    status: str
    sections: dict[str, Any] = Field(default_factory=dict)
    section_order: list[str] = Field(default_factory=list)
    pending_diffs: list[DiffSuggestion] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime | None = None
    exported_at: datetime | None = None

    model_config = {"from_attributes": True}


class ResumeBuildListResponse(BaseModel):
    """Schema for paginated resume build list responses."""

    resume_builds: list[ResumeBuildResponse]
    total: int
    limit: int
    offset: int


class SuggestRequest(BaseModel):
    """Schema for requesting AI suggestions."""

    max_suggestions: int = Field(10, ge=1, le=50, description="Maximum suggestions to generate")
    focus_sections: list[str] | None = Field(None, description="Sections to focus on (None=all)")


class SuggestResponse(BaseModel):
    """Schema for suggestion generation response."""

    resume_build: ResumeBuildResponse
    new_suggestions_count: int
    gaps_identified: list[str] = Field(default_factory=list, description="Skill gaps identified in resume")


class DiffActionRequest(BaseModel):
    """Schema for accepting or rejecting a diff."""

    diff_index: int = Field(..., ge=0, description="Index of the diff in pending_diffs")


class DiffActionResponse(BaseModel):
    """Schema for diff action response."""

    resume_build: ResumeBuildResponse
    action: str = Field(..., description="accept or reject")
    applied_diff: DiffSuggestion | None = None


class UpdateSectionsRequest(BaseModel):
    """Schema for updating resume build sections."""

    sections: dict[str, Any] = Field(..., description="Section content to update/merge")


class UpdateStatusRequest(BaseModel):
    """Schema for updating resume build status."""

    status: ResumeBuildStatus


class ExportRequest(BaseModel):
    """Schema for export request."""

    format: str = Field("docx", pattern="^(pdf|docx|txt|json)$", description="Export format")
    template: str = Field("default", description="Template to use")


class BulletSuggestionEntryContext(BaseModel):
    """Context about the experience entry containing the bullet."""

    title: str = Field(..., description="Job title for the experience entry")
    company: str = Field(..., description="Company name")
    date_range: str = Field(..., description="Date range (e.g., 'Jan 2020 - Present')")


class BulletSuggestionRequest(BaseModel):
    """Schema for single bullet point suggestion request."""

    bullet_text: str = Field(..., min_length=1, description="The bullet point text to improve")
    entry_context: BulletSuggestionEntryContext = Field(..., description="Context about the experience entry")
    job_description: str = Field(..., min_length=1, description="Target job description")


class BulletSuggestionResponse(BaseModel):
    """Schema for single bullet point suggestion response."""

    original: str = Field(..., description="Original bullet text")
    suggested: str = Field(..., description="Suggested improved bullet text")
    reason: str = Field(..., description="Explanation for the suggestion")
    impact: SuggestionImpact = Field(..., description="Impact level of the suggestion")
