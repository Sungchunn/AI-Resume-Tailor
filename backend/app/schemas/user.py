import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None


class UserCreate(UserBase):
    full_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    created_at: datetime
    headline: str | None = None
    about_me: str | None = None
    about_me_generated_at: datetime | None = None
    timezone: str | None = "UTC"

    # OAuth fields
    auth_provider: Literal["email", "google"] = "email"
    has_password: bool = Field(description="Whether user can use password login")
    google_linked: bool = Field(description="Whether Google is linked")

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class GoogleAuthRequest(BaseModel):
    """Request body for Google OAuth login/signup."""

    id_token: str = Field(..., description="Google ID token from frontend")


class GoogleAuthResponse(BaseModel):
    """Response for Google OAuth, extends Token with metadata."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = Field(description="True if this is a newly created account")
    account_linked: bool = Field(
        description="True if Google was linked to existing email account"
    )


# AI Preferences


class AIModelInfo(BaseModel):
    """Information about an available AI model."""

    id: str
    name: str
    description: str
    provider: str


class AIPreferencesResponse(BaseModel):
    """Response for user AI preferences."""

    preferred_model: str | None = Field(
        description="User's preferred model ID, null means endpoint defaults apply"
    )
    available_models: list[AIModelInfo]


class AIPreferencesUpdate(BaseModel):
    """Request to update user AI preferences."""

    preferred_model: str | None = Field(
        description="Model ID to set, or null to reset to defaults"
    )
