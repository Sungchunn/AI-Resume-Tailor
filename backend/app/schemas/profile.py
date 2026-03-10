"""Profile schemas for user profile operations."""

from datetime import datetime
from pydantic import BaseModel


class GenerateAboutMeRequest(BaseModel):
    """Request to generate an About Me blurb."""

    force_refresh: bool = False


class AboutMeResponse(BaseModel):
    """Response containing the About Me blurb."""

    about_me: str
    generated_at: datetime
