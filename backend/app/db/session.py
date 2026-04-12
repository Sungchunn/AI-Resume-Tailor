from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# Use NullPool when connecting through Supabase's PgBouncer pooler (port 6543).
# This delegates all connection pooling to Supabase, avoiding double-pooling
# and reducing connection exhaustion on free tier.
#
# For direct connections (port 5432), you would instead configure:
#   pool_size=2, max_overflow=3, pool_timeout=30, pool_recycle=300, pool_pre_ping=True
engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    future=True,
    poolclass=NullPool,
    connect_args={
        # Disable asyncpg's built-in statement cache (default: 100).
        # Required when behind Supavisor/PgBouncer — without this,
        # asyncpg skips mark_unprepared() on unnamed statements,
        # causing "prepared statement does not exist" after connection rotation.
        "statement_cache_size": 0,
        # Disable SQLAlchemy's adapter-level prepared-statement LRU cache.
        "prepared_statement_cache_size": 0,
        # Force unnamed statements so PostgreSQL never stores named
        # statements that become stale after pooler connection rotation.
        "prepared_statement_name_func": lambda: "",
    },
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session WITHOUT RLS context.
    Use for unauthenticated endpoints or admin operations.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
