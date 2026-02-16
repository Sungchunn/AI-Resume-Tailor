from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any


class ResumeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    raw_content: str = Field(..., min_length=1)


class ResumeCreate(ResumeBase):
    pass


class ResumeUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    raw_content: str | None = Field(None, min_length=1)


class ResumeResponse(ResumeBase):
    id: int
    owner_id: int
    parsed_content: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
