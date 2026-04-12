from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.config import Settings, get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash_async,
    verify_password_async,
)
from app.models import User
from app.schemas import (
    GoogleAuthRequest,
    GoogleAuthResponse,
    Token,
    TokenRefresh,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.google_oauth import GoogleOAuthService, get_google_oauth_service

router = APIRouter()


def _is_admin_email(email: str, settings: Settings) -> bool:
    """Check if email is in the admin emails list."""
    return email.lower() in [e.lower() for e in settings.admin_emails]


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """Register a new user."""
    settings = get_settings()

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user (auto-grant admin if email is in ADMIN_EMAILS)
    user = User(
        email=user_data.email,
        hashed_password=await get_password_hash_async(user_data.password),
        full_name=user_data.full_name,
        is_admin=_is_admin_email(user_data.email, settings),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db_session),
) -> Token:
    """Login and get access and refresh tokens."""
    # Find user by email
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

    # Generate tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: TokenRefresh,
    db: AsyncSession = Depends(get_db_session),
) -> Token:
    """Refresh access token using refresh token."""
    payload = decode_token(token_data.refresh_token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify it's a refresh token
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = int(payload.get("sub", 0))
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate new tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current authenticated user."""
    return current_user


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
    settings = get_settings()

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
        result = await db.execute(select(User).where(User.email == google_user.email))
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
            if not user.full_name and google_user.full_name:
                user.full_name = google_user.full_name
            account_linked = True

        else:
            # New user - create account with Google
            # Auto-grant admin if email is in ADMIN_EMAILS
            user = User(
                email=google_user.email,
                full_name=google_user.full_name,
                auth_provider="google",
                google_id=google_user.google_id,
                google_linked_at=datetime.now(timezone.utc),
                hashed_password=None,  # No password for Google-only users
                is_admin=_is_admin_email(google_user.email, settings),
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
