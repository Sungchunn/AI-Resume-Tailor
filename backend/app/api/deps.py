from typing import Annotated, AsyncGenerator, TypedDict

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import decode_token
from app.db import get_db
from app.db.mongodb import get_mongodb
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get PostgreSQL database session dependency."""
    async for session in get_db():
        yield session


def get_mongo_db() -> AsyncIOMotorDatabase:
    """Get MongoDB database dependency."""
    return get_mongodb()


class DatabaseSessions(TypedDict):
    """Type definition for dual database sessions."""

    pg: AsyncSession
    mongo: AsyncIOMotorDatabase


async def get_databases(
    pg: Annotated[AsyncSession, Depends(get_db_session)],
    mongo: Annotated[AsyncIOMotorDatabase, Depends(get_mongo_db)],
) -> DatabaseSessions:
    """
    Get both PostgreSQL and MongoDB sessions for cross-database operations.
    Use this when you need to query both databases in a single endpoint.
    """
    return {"pg": pg, "mongo": mongo}


async def get_current_user_id(
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> int:
    """
    Validate JWT token and return current user ID.
    Raises 401 if token is invalid or missing.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Ensure it's an access token, not a refresh token
    if payload.get("type") == "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cannot use refresh token for authentication",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return int(user_id)


async def get_current_user(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    """Get the current authenticated user object."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


async def get_optional_user_id(
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> int | None:
    """
    Get user ID if token is provided, otherwise return None.
    Useful for endpoints that work both authenticated and unauthenticated.
    """
    if not token:
        return None

    payload = decode_token(token)
    if not payload or payload.get("type") == "refresh":
        return None

    user_id = payload.get("sub")
    return int(user_id) if user_id else None


async def verify_webhook_key(
    x_api_key: Annotated[str, Header(alias="X-API-Key")],
) -> None:
    """
    Validate webhook API key from X-API-Key header.
    Used to authenticate webhook requests from n8n/external services.
    """
    settings = get_settings()
    if not settings.n8n_webhook_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook not configured",
        )
    if x_api_key != settings.n8n_webhook_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Require the current user to be an admin.
    Checks the is_admin boolean field on the user model.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
