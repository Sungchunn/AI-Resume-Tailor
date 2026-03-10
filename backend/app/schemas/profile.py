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

    headline: str | None = Field(None, max_length=255)
    about_me: str | None = None


class ProfileResponse(BaseModel):
    """Response containing profile fields."""

    headline: str | None = None
    about_me: str | None = None
