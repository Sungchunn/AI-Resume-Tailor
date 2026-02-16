from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
from typing import Any


class JobBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    company: str | None = Field(None, max_length=255)
    raw_content: str = Field(..., min_length=1)
    url: str | None = Field(None, max_length=500)


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    company: str | None = Field(None, max_length=255)
    raw_content: str | None = Field(None, min_length=1)
    url: str | None = Field(None, max_length=500)


class JobResponse(JobBase):
    id: int
    owner_id: int
    parsed_content: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
