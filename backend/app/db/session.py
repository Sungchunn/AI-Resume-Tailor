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
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
