from typing import Annotated, AsyncGenerator, TypedDict, cast

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db import get_db
from app.db.mongodb import get_mongodb
from app.db.session import AsyncSessionLocal
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _validate_token(token: str | None) -> int:
    """Validate token and return user_id. Raises HTTPException on failure."""
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

    NOTE: This does NOT set RLS context. Use get_databases_with_rls for
    endpoints that access RLS-protected tables.
    """
    return {"pg": pg, "mongo": mongo}


async def get_current_user_id(
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> int:
    """
    Validate JWT token and return current user ID.
    Raises 401 if token is invalid or missing.
    """
    return _validate_token(token)


async def get_current_user_id_sse(
    ticket: str | None = Query(None, description="One-time SSE auth ticket"),
) -> int:
    """
    Validate a one-time SSE ticket from Redis.
    Tickets are created via POST /auth/sse-ticket and are single-use (getdel).
    """
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing SSE ticket",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.db.redis import get_redis

    redis = get_redis()
    user_id_str = await redis.getdel(f"sse-ticket:{ticket}")

    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired SSE ticket",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return int(user_id_str)


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

    if not cast(bool, user.is_active):
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


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Require the current user to be an admin.
    Checks the is_admin boolean field on the user model.
    """
    if not cast(bool, current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_db_with_user_context(
    user_id: Annotated[int, Depends(get_current_user_id)],
) -> AsyncGenerator[AsyncSession, None]:
    """
    Database session with RLS context set.
    Use this dependency for all authenticated endpoints.

    This sets the PostgreSQL session variable `app.current_user_id`
    which RLS policies use to filter rows to only those owned by
    the authenticated user.
    """
    async with AsyncSessionLocal() as session:
        # SET LOCAL scopes the variable to the current transaction
        # Note: SET LOCAL does not support parameterized queries in PostgreSQL.
        # Using f-string is safe here because user_id is a validated int from JWT.
        await session.execute(text(f"SET LOCAL app.current_user_id = '{user_id}'"))
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_databases_with_rls(
    pg: Annotated[AsyncSession, Depends(get_db_with_user_context)],
    mongo: Annotated[AsyncIOMotorDatabase, Depends(get_mongo_db)],
) -> DatabaseSessions:
    """
    Get both PostgreSQL and MongoDB sessions with RLS context set.
    Use this for cross-database endpoints that access RLS-protected tables
    (job_descriptions, resume_builds, user_job_interactions).
    """
    return {"pg": pg, "mongo": mongo}


async def resolve_ai_model(
    user_id: int,
    db: AsyncSession,
    category: str = "general",
) -> str:
    """Resolve the AI model for a user and endpoint category.

    Priority: user preference > endpoint category default.
    """
    from app.core.ai_models import get_default_model, is_valid_model

    result = await db.execute(
        select(User.preferred_ai_model).where(User.id == user_id)
    )
    preferred = result.scalar_one_or_none()

    if preferred and is_valid_model(preferred):
        return preferred

    return get_default_model(category)


# Type aliases for cleaner dependency injection
DBSession = Annotated[AsyncSession, Depends(get_db_session)]
DBSessionWithRLS = Annotated[AsyncSession, Depends(get_db_with_user_context)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]
DatabaseSessionsWithRLS = Annotated[DatabaseSessions, Depends(get_databases_with_rls)]
