"""Profile schemas for user profile operations."""

from datetime import datetime
from pydantic import BaseModel, Field


class GenerateAboutMeRequest(BaseModel):
    """Request to generate an About Me blurb."""

    force_refresh: bool = False


class AboutMeResponse(BaseModel):
    """Response containing the About Me blurb."""

    about_me: str
    generated_at: datetime


class UpdateProfileRequest(BaseModel):
    """Request to update user profile fields."""

    full_name: str | None = Field(None, max_length=255)
    headline: str | None = Field(None, max_length=255)
    about_me: str | None = None
    timezone: str | None = Field(None, max_length=100)


class ProfileResponse(BaseModel):
    """Response containing profile fields."""

    full_name: str | None = None
    headline: str | None = None
    about_me: str | None = None
    timezone: str | None = None
