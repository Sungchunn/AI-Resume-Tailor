from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db


async def get_current_user_id() -> int:
    """
    Temporary placeholder for user authentication.
    Returns a mock user ID until auth is implemented in Phase 4.
    """
    # TODO: Implement actual JWT authentication in Phase 4
    return 1


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session dependency."""
    async for session in get_db():
        yield session
