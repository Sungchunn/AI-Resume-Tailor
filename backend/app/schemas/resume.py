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


class ResumeResponse(ResumeBase):
    id: int
    owner_id: int
    html_content: str | None = None
    parsed_content: dict[str, Any] | None = None
    style: dict[str, Any] | None = None
    original_file_key: str | None = None
    original_filename: str | None = None
    file_type: Literal["pdf", "docx"] | None = None
    file_size_bytes: int | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ParseTaskResponse(BaseModel):
    """Response when triggering a parse task."""

    task_id: str
    status: Literal["pending", "completed", "failed"]
    resume_id: int


class ParseStatusResponse(BaseModel):
    """Response when checking parse task status."""

    task_id: str
    status: Literal["pending", "completed", "failed"]
    resume_id: int
    error: str | None = None
