from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any, Literal


class ResumeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    raw_content: str = Field(..., min_length=1)


class ResumeCreate(ResumeBase):
    html_content: str | None = None
    original_file_key: str | None = None
    original_filename: str | None = None
    file_type: Literal["pdf", "docx"] | None = None
    file_size_bytes: int | None = None


class ResumeUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    raw_content: str | None = Field(None, min_length=1)
    html_content: str | None = None
    parsed_content: dict[str, Any] | None = None
    style: dict[str, Any] | None = None


class OriginalFileInfo(BaseModel):
    """File information for uploaded resumes."""

    storage_key: str | None = None
    filename: str | None = None
    file_type: str | None = None
    size_bytes: int | None = None


class ResumeResponse(BaseModel):
    """Response model for resume endpoints (MongoDB)."""

    id: str  # MongoDB ObjectId as string
    user_id: int  # FK to PostgreSQL users
    title: str
    raw_content: str
    html_content: str | None = None
    parsed: dict[str, Any] | None = None
    style: dict[str, Any] | None = None
    original_file: OriginalFileInfo | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_mongo(cls, doc) -> "ResumeResponse":
        """Create response from MongoDB document model."""
        return cls(
            id=str(doc.id) if doc.id else "",
            user_id=doc.user_id,
            title=doc.title,
            raw_content=doc.raw_content,
            html_content=doc.html_content,
            parsed=doc.parsed.model_dump() if doc.parsed else None,
            style=doc.style.model_dump() if doc.style else None,
            original_file=OriginalFileInfo(
                storage_key=doc.original_file.storage_key,
                filename=doc.original_file.filename,
                file_type=doc.original_file.file_type,
                size_bytes=doc.original_file.size_bytes,
            ) if doc.original_file else None,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )


class ParseTaskResponse(BaseModel):
    """Response when triggering a parse task."""

    task_id: str
    status: Literal["pending", "completed", "failed"]
    resume_id: str  # MongoDB ObjectId as string


class ParseStatusResponse(BaseModel):
    """Response when checking parse task status."""

    task_id: str
    status: Literal["pending", "completed", "failed"]
    resume_id: str  # MongoDB ObjectId as string
    error: str | None = None
