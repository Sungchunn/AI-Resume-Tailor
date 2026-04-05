# Phase 2: Backend Service and Endpoint

## Overview

Add a Google OAuth verification service and a new `/api/auth/google` endpoint that verifies Google ID tokens and returns JWT access/refresh tokens.

## Dependencies

Add `google-auth` to verify Google ID tokens:

```bash
cd backend
poetry add google-auth
```

## Configuration

**File:** `/backend/app/core/config.py`

Add to the Settings class:

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # Google OAuth
    google_client_id: str = ""
    google_oauth_enabled: bool = False

    @property
    def google_oauth_configured(self) -> bool:
        """Check if Google OAuth is properly configured."""
        return bool(self.google_client_id) and self.google_oauth_enabled
```

**File:** `/backend/.env.example`

Add:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_ENABLED=true
```

## Google OAuth Service

**File:** `/backend/app/services/google_oauth.py`

```python
"""Google OAuth token verification service."""
from dataclasses import dataclass
from typing import Optional

from google.oauth2 import id_token
from google.auth.transport import requests

from app.core.config import settings


@dataclass
class GoogleUserInfo:
    """Verified Google user information."""
    google_id: str  # Google's 'sub' claim
    email: str
    email_verified: bool
    full_name: Optional[str]
    picture_url: Optional[str]


class GoogleOAuthService:
    """Service for verifying Google OAuth ID tokens."""

    def __init__(self, client_id: str):
        self.client_id = client_id

    async def verify_id_token(self, token: str) -> Optional[GoogleUserInfo]:
        """
        Verify a Google ID token and extract user information.

        Args:
            token: The ID token from Google Sign-In

        Returns:
            GoogleUserInfo if valid, None if verification fails

        Raises:
            ValueError: If token is invalid or expired
        """
        try:
            # Verify the token with Google's servers
            # This checks:
            # - Token signature
            # - Token expiration (exp claim)
            # - Audience matches our client ID (aud claim)
            # - Issuer is Google (iss claim)
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                self.client_id
            )

            # Additional security checks
            if idinfo.get("iss") not in [
                "accounts.google.com",
                "https://accounts.google.com"
            ]:
                return None

            return GoogleUserInfo(
                google_id=idinfo["sub"],
                email=idinfo["email"],
                email_verified=idinfo.get("email_verified", False),
                full_name=idinfo.get("name"),
                picture_url=idinfo.get("picture"),
            )

        except ValueError:
            # Token is invalid
            return None


def get_google_oauth_service() -> GoogleOAuthService:
    """Dependency injection for Google OAuth service."""
    return GoogleOAuthService(client_id=settings.google_client_id)
```

## Pydantic Schemas

**File:** `/backend/app/schemas/user.py`

Add new schemas:

```python
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Literal
import re


# ... existing schemas ...


class GoogleAuthRequest(BaseModel):
    """Request body for Google OAuth login/signup."""
    id_token: str = Field(..., description="Google ID token from frontend")


class GoogleAuthResponse(BaseModel):
    """Response for Google OAuth, extends Token with metadata."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = Field(
        description="True if this is a newly created account"
    )
    account_linked: bool = Field(
        description="True if Google was linked to existing email account"
    )


class UserResponse(UserBase):
    """Extended user response with OAuth fields."""
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
```

## Auth Router

**File:** `/backend/app/api/routes/auth.py`

Add the Google auth endpoint:

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash_async,
    verify_password_async,
)
from app.models import User
from app.schemas import (
    Token,
    TokenRefresh,
    UserCreate,
    UserLogin,
    UserResponse,
    GoogleAuthRequest,
    GoogleAuthResponse,
)
from app.services.google_oauth import get_google_oauth_service, GoogleOAuthService

router = APIRouter()


# ... existing endpoints (register, login, refresh, me) ...


@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(
    data: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db_session),
    google_service: GoogleOAuthService = Depends(get_google_oauth_service),
) -> GoogleAuthResponse:
    """
    Authenticate or register user via Google OAuth.

    Flow:
    1. Verify Google ID token
    2. Check if user exists by google_id
    3. If not, check if user exists by email (for account linking)
    4. Create new user or link accounts as needed
    5. Return JWT tokens
    """
    # Check if Google OAuth is enabled
    if not settings.google_oauth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sign-In is not configured",
        )

    # Verify the Google ID token
    google_user = await google_service.verify_id_token(data.id_token)

    if not google_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )

    # Require verified email
    if not google_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified",
        )

    is_new_user = False
    account_linked = False

    # Try to find user by google_id first
    result = await db.execute(
        select(User).where(User.google_id == google_user.google_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        # No user with this google_id, check by email
        result = await db.execute(
            select(User).where(User.email == google_user.email)
        )
        user = result.scalar_one_or_none()

        if user:
            # Existing email user - link Google account
            if user.google_id and user.google_id != google_user.google_id:
                # Email already linked to different Google account
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This email is already linked to a different Google account",
                )

            # Link Google to existing account
            user.google_id = google_user.google_id
            user.google_linked_at = datetime.now(timezone.utc)
            account_linked = True

        else:
            # New user - create account with Google
            user = User(
                email=google_user.email,
                full_name=google_user.full_name,
                auth_provider="google",
                google_id=google_user.google_id,
                google_linked_at=datetime.now(timezone.utc),
                hashed_password=None,  # No password for Google-only users
            )
            db.add(user)
            is_new_user = True

        await db.commit()
        await db.refresh(user)

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Generate JWT tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return GoogleAuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        is_new_user=is_new_user,
        account_linked=account_linked,
    )


# Update login endpoint to handle Google-only users
@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db_session),
) -> Token:
    """Login and get access and refresh tokens."""
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    # Check if user exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user has a password (Google-only users don't)
    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google Sign-In. Please use the Google login button.",
        )

    # Verify password
    if not await verify_password_async(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )
```

## Account Linking Logic

| Scenario | google_id exists? | email exists? | has password? | Action |
| -------- | ----------------- | ------------- | ------------- | ------ |
| Returning Google user | Yes | - | - | Return tokens |
| New Google user | No | No | - | Create user with auth_provider="google" |
| Email user adds Google | No | Yes | Yes | Link Google, set google_linked_at |
| Conflict | No | Yes | - | Error if different google_id already linked |

## Security Considerations

1. **Token verification:** Always verify Google ID tokens server-side
2. **Email verification:** Only trust emails marked as verified by Google
3. **Rate limiting:** Apply existing auth rate limits to `/api/auth/google`
4. **Audit logging:** Consider logging account linking events

## Testing

**File:** `/backend/tests/test_google_auth.py`

```python
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from app.services.google_oauth import GoogleUserInfo


@pytest.fixture
def mock_google_user():
    return GoogleUserInfo(
        google_id="123456789",
        email="test@gmail.com",
        email_verified=True,
        full_name="Test User",
        picture_url=None,
    )


@pytest.mark.asyncio
async def test_google_auth_new_user(
    client: AsyncClient,
    mock_google_user: GoogleUserInfo,
):
    with patch(
        "app.services.google_oauth.GoogleOAuthService.verify_id_token",
        new_callable=AsyncMock,
        return_value=mock_google_user,
    ):
        response = await client.post(
            "/api/auth/google",
            json={"id_token": "fake-token"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_new_user"] is True
    assert data["account_linked"] is False
    assert "access_token" in data


@pytest.mark.asyncio
async def test_google_auth_invalid_token(client: AsyncClient):
    with patch(
        "app.services.google_oauth.GoogleOAuthService.verify_id_token",
        new_callable=AsyncMock,
        return_value=None,
    ):
        response = await client.post(
            "/api/auth/google",
            json={"id_token": "invalid-token"},
        )

    assert response.status_code == 401
```

## Verification

1. Start the backend: `poetry run uvicorn app.main:app --reload`
2. Check endpoint exists: `curl http://localhost:8000/api/auth/google -X POST`
3. Should return 503 if not configured, 422 if missing id_token
