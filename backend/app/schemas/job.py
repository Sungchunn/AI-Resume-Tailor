from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class JobBase(BaseModel):
    """Base schema for job data."""

    title: str = Field(..., min_length=1, max_length=255)
    company: str | None = Field(None, max_length=255)
    raw_content: str = Field(..., min_length=1)
    url: str | None = Field(None, max_length=500)


class JobCreate(JobBase):
    """Schema for creating a job."""

    pass


class JobUpdate(BaseModel):
    """Schema for updating a job (all fields optional)."""

    title: str | None = Field(None, min_length=1, max_length=255)
    company: str | None = Field(None, max_length=255)
    raw_content: str | None = Field(None, min_length=1)
    url: str | None = Field(None, max_length=500)


class JobResponse(JobBase):
    """
    Schema for job responses - uses public_id as 'id'.

    Security: Never expose internal integer ID or owner_id in public responses.
    """

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID = Field(validation_alias="public_id")
    parsed_content: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime | None = None


class JobListResponse(BaseModel):
    """Schema for listing multiple jobs."""

    items: list[JobResponse]
    total: int
    skip: int
    limit: int
