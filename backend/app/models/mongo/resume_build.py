"""MongoDB Pydantic model for ResumeBuild (workshop) documents."""

from datetime import datetime
from typing import Any, Literal

from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer

from app.models.mongo.resume import PyObjectId


class JobInfo(BaseModel):
    """Job information for the resume build."""

    title: str
    company: str | None = None
    description: str | None = None
    embedding: list[float] | None = None  # 768-dim vector for semantic matching


class PendingDiff(BaseModel):
    """AI-generated diff suggestion for resume improvement."""

    id: str  # UUID for tracking
    section: str  # e.g., "experience", "summary", "skills"
    path: str  # JSON path like "experience.0.bullets.1"
    operation: Literal["update", "insert", "delete", "reorder"]
    original_value: Any | None = None
    suggested_value: Any | None = None
    reason: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ResumeSections(BaseModel):
    """Resume sections being built in the workshop."""

    summary: str | None = None
    experience: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[dict[str, Any]] = Field(default_factory=list)
    education: list[dict[str, Any]] = Field(default_factory=list)
    projects: list[dict[str, Any]] = Field(default_factory=list)


class ResumeBuildDocument(BaseModel):
    """MongoDB ResumeBuild (workshop) document schema."""

    id: PyObjectId | None = Field(default=None, alias="_id")
    user_id: int  # FK to Postgres users.id

    job: JobInfo

    status: Literal["draft", "in_progress", "exported"] = "draft"

    sections: ResumeSections = Field(default_factory=ResumeSections)
    section_order: list[str] = Field(
        default_factory=lambda: ["summary", "experience", "skills", "education", "projects"]
    )

    pulled_block_ids: list[int] = Field(default_factory=list)  # FK to Postgres experience_blocks.id

    pending_diffs: list[PendingDiff] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    exported_at: datetime | None = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    @field_serializer("id")
    def serialize_id(self, v: PyObjectId | None) -> str | None:
        return str(v) if v else None

    def is_draft(self) -> bool:
        """Check if resume build is in draft status."""
        return self.status == "draft"

    def is_in_progress(self) -> bool:
        """Check if resume build is being actively worked on."""
        return self.status == "in_progress"

    def is_exported(self) -> bool:
        """Check if resume build has been exported."""
        return self.status == "exported"


class ResumeBuildCreate(BaseModel):
    """Schema for creating a new resume build."""

    user_id: int
    job: JobInfo
    status: Literal["draft", "in_progress", "exported"] | None = "draft"
    sections: ResumeSections | None = None
    section_order: list[str] | None = None
    pulled_block_ids: list[int] | None = None


class ResumeBuildUpdate(BaseModel):
    """Schema for updating an existing resume build."""

    job: JobInfo | None = None
    status: Literal["draft", "in_progress", "exported"] | None = None
    sections: ResumeSections | None = None
    section_order: list[str] | None = None
    pulled_block_ids: list[int] | None = None
    pending_diffs: list[PendingDiff] | None = None
    exported_at: datetime | None = None
