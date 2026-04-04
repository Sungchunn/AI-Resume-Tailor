# Phase 1: Connection Pooling & Critical Index

**Priority:** P0 - Critical
**Estimated Time:** 1 hour
**Risk Level:** Low (configuration changes, additive migration)

---

## Overview

This phase addresses the most critical issues causing CPU/memory spikes:

1. SQLAlchemy connection pool misconfiguration
2. Using direct Supabase connection instead of pooler
3. Missing engine cleanup on shutdown
4. Missing index on `created_at` for cleanup job

---

## Task 1.1: Configure SQLAlchemy Connection Pooling

### Current Code

**File:** `backend/app/db/session.py` (lines 1-36)

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    future=True,
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
```

### Problem Analysis

The `create_async_engine()` call uses SQLAlchemy defaults:

- `pool_size=5` - 5 persistent connections
- `max_overflow=10` - Up to 10 additional connections under load
- **Total: 15 concurrent connections possible**

Supabase free tier has limited connection slots. With background scheduler jobs + API requests, we can easily exhaust the pool.

### Solution: Use NullPool with Supabase Pooler

When connecting through Supabase's PgBouncer pooler (port 6543), we should use `NullPool` to:

1. Let Supabase manage all connection pooling
2. Avoid double-pooling (SQLAlchemy pool + PgBouncer pool)
3. Ensure each request gets a fresh connection from PgBouncer

### New Code

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator

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
```

### Why NullPool Instead of Small Pool?

| Option | Pros | Cons |
| ------ | ---- | ---- |
| `NullPool` | No local connections held, PgBouncer manages everything | Slightly more connection overhead per request |
| `pool_size=2` | Local connection reuse | Double-pooling with PgBouncer, potential conflicts |

For Supabase with PgBouncer, NullPool is the recommended pattern.

---

## Task 1.2: Update Database URL to Use Pooler

### Current Configuration

**File:** `backend/.env` (lines 15-16)

```bash
DATABASE_URL=postgresql+asyncpg://postgres:YOUR-PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres
DATABASE_URL_SYNC=postgresql://postgres:YOUR-PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres
```

### Problem Analysis

- Port `5432` is the **direct connection** to PostgreSQL
- Each connection consumes server resources directly
- No connection pooling at the Supabase level

### Solution: Switch to Pooler URL

Supabase provides a PgBouncer pooler at port `6543`. The URL format is different:

```text
# Direct (current - port 5432):
db.PROJECT-REF.supabase.co:5432

# Pooler (recommended - port 6543):
aws-0-REGION.pooler.supabase.com:6543
```

### New Configuration

**File:** `backend/.env`

```bash
# PostgreSQL via Supabase Transaction Pooler (recommended for free tier)
# The ?prepared_statement_cache_size=0 is REQUIRED for asyncpg + PgBouncer
DATABASE_URL=postgresql+asyncpg://postgres.YOUR-PROJECT-REF:YOUR-PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?prepared_statement_cache_size=0

# Sync URL for Alembic migrations (use direct connection for DDL)
DATABASE_URL_SYNC=postgresql://postgres:YOUR-PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres
```

### Critical: `prepared_statement_cache_size=0`

This query parameter is **mandatory** when using asyncpg with PgBouncer in transaction mode. Without it:

- asyncpg caches prepared statements
- PgBouncer routes different transactions to different backends
- Cached statements don't exist on the new backend
- Queries fail with "prepared statement does not exist"

### How to Find Your Pooler URL

1. Go to Supabase Dashboard → Project Settings → Database
2. Look for "Connection Pooling" section
3. Copy the "Connection string" with mode "Transaction"
4. Replace `[YOUR-PASSWORD]` with your actual password
5. Add `?prepared_statement_cache_size=0` for asyncpg

---

## Task 1.3: Update .env.example Template

**File:** `backend/.env.example` (lines 11-16)

### Current Template

```bash
# Database (PostgreSQL)
# For local Docker:
# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/resume_tailor
# For Supabase (replace YOUR-PASSWORD with actual password):
DATABASE_URL=postgresql+asyncpg://postgres:YOUR-PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres
DATABASE_URL_SYNC=postgresql://postgres:YOUR-PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres
```

### New Template

```bash
# Database (PostgreSQL)
# For local Docker:
# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/resume_tailor

# For Supabase (recommended - use Transaction Pooler for free tier):
# 1. Go to Supabase Dashboard > Project Settings > Database > Connection Pooling
# 2. Copy the "Transaction" mode connection string
# 3. IMPORTANT: Add ?prepared_statement_cache_size=0 for asyncpg compatibility
DATABASE_URL=postgresql+asyncpg://postgres.YOUR-PROJECT-REF:YOUR-PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?prepared_statement_cache_size=0

# Sync URL for Alembic migrations (use direct connection for DDL operations):
DATABASE_URL_SYNC=postgresql://postgres:YOUR-PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres
```

---

## Task 1.4: Add Engine Disposal on Shutdown

### Current Code

**File:** `backend/app/main.py` (lines 20-45)

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown events."""
    # Startup: Initialize MongoDB connection
    await connect_mongodb()

    # Startup: Initialize Redis connection
    await connect_redis()

    # Startup: Initialize scheduler
    scheduler = get_scheduler_service()
    scheduler.start()

    # Load schedule settings from database and register preset-based job
    await scheduler.reconfigure_from_db()

    yield

    # Shutdown: Stop scheduler gracefully
    scheduler.stop()

    # Shutdown: Close Redis connection
    await close_redis()

    # Shutdown: Close MongoDB connection
    await close_mongodb()
```

### Problem Analysis

- MongoDB and Redis have explicit close handlers
- PostgreSQL engine has **no corresponding cleanup**
- On server restart/redeploy, connections may not be properly released
- With NullPool this is less critical, but still good hygiene

### Solution: Add engine.dispose()

### New Code

```python
from app.db.session import engine  # ADD THIS IMPORT

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown events."""
    # Startup: Initialize MongoDB connection
    await connect_mongodb()

    # Startup: Initialize Redis connection
    await connect_redis()

    # Startup: Initialize scheduler
    scheduler = get_scheduler_service()
    scheduler.start()

    # Load schedule settings from database and register preset-based job
    await scheduler.reconfigure_from_db()

    yield

    # Shutdown: Stop scheduler gracefully
    scheduler.stop()

    # Shutdown: Dispose PostgreSQL engine (releases all connections)
    await engine.dispose()  # ADD THIS LINE

    # Shutdown: Close Redis connection
    await close_redis()

    # Shutdown: Close MongoDB connection
    await close_mongodb()
```

### Order Matters

The shutdown order should be:

1. Stop scheduler (prevents new DB operations)
2. Dispose PostgreSQL engine (releases connections)
3. Close Redis (used by scheduler/cache)
4. Close MongoDB (document storage)

---

## Task 1.5: Add Index on created_at for Cleanup Job

### Problem Analysis

**File:** `backend/app/crud/job_listing.py` (lines 788-802)

```python
async def delete_expired(
    self,
    db: AsyncSession,
    *,
    retention_days: int = 90,
) -> int:
    """Delete job listings older than retention_days."""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)

    result = await db.execute(
        delete(JobListing).where(JobListing.created_at < cutoff_date)
    )
    await db.flush()

    deleted_count = result.rowcount
    # ...
```

This query filters on `created_at < cutoff_date`. Without an index, PostgreSQL must scan the entire `job_listings` table.

### Current Indexes

**File:** `backend/app/models/job_listing.py` (lines 94-108)

```python
__table_args__ = (
    Index("ix_job_listings_company", "company_name"),
    Index("ix_job_listings_location", "location"),
    Index("ix_job_listings_seniority", "seniority"),
    Index("ix_job_listings_job_function", "job_function"),
    Index("ix_job_listings_industry", "industry"),
    Index("ix_job_listings_date_posted", "date_posted", postgresql_ops={"date_posted": "DESC"}),
    Index("ix_job_listings_salary", "salary_min", "salary_max"),
    Index("ix_job_listings_active", "is_active"),
    Index("ix_job_listings_country", "country"),
    Index("ix_job_listings_is_remote", "is_remote"),
    Index("ix_job_listings_region", "region"),
    Index("ix_job_listings_easy_apply", "easy_apply"),
)
```

**Note:** `created_at` is NOT indexed.

### Solution: Create Migration

**New file:** `backend/alembic/versions/20260404_0001_add_job_listings_created_at_index.py`

```python
"""Add index on job_listings.created_at for cleanup job performance.

Revision ID: 20260404_0001
Revises: 20260312_0003
Create Date: 2026-04-04

The daily cleanup job executes:
    DELETE FROM job_listings WHERE created_at < cutoff_date

Without an index on created_at, this causes a full sequential scan of the
entire job_listings table, consuming excessive CPU on each run.

This index enables efficient range scans for the deletion query.
"""
from collections.abc import Sequence
from alembic import op


revision: str = "20260404_0001"
down_revision: str | None = "20260312_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add index for cleanup job's WHERE created_at < cutoff filter
    # This enables efficient range scans instead of full table scans
    op.create_index(
        "ix_job_listings_created_at",
        "job_listings",
        ["created_at"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_job_listings_created_at",
        table_name="job_listings",
        if_exists=True,
    )
```

### Also Update Model

**File:** `backend/app/models/job_listing.py` (add to `__table_args__`)

```python
__table_args__ = (
    Index("ix_job_listings_company", "company_name"),
    Index("ix_job_listings_location", "location"),
    Index("ix_job_listings_seniority", "seniority"),
    Index("ix_job_listings_job_function", "job_function"),
    Index("ix_job_listings_industry", "industry"),
    Index("ix_job_listings_date_posted", "date_posted", postgresql_ops={"date_posted": "DESC"}),
    Index("ix_job_listings_salary", "salary_min", "salary_max"),
    Index("ix_job_listings_active", "is_active"),
    Index("ix_job_listings_country", "country"),
    Index("ix_job_listings_is_remote", "is_remote"),
    Index("ix_job_listings_region", "region"),
    Index("ix_job_listings_easy_apply", "easy_apply"),
    Index("ix_job_listings_created_at", "created_at"),  # ADD THIS LINE
)
```

---

## Verification Steps

### 1. Test Connection Pooling Locally

```bash
cd backend

# Update .env with pooler URL
# Then start the server
poetry run uvicorn app.main:app --reload

# In another terminal, check active connections via Supabase SQL editor:
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
# Should show 1-2 connections, not 5-15
```

### 2. Run Migration

```bash
cd backend
poetry run alembic upgrade head
```

### 3. Verify Index Created

```sql
-- Run in Supabase SQL Editor
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'job_listings' AND indexname LIKE '%created_at%';

-- Should return:
-- ix_job_listings_created_at | CREATE INDEX ix_job_listings_created_at ON public.job_listings USING btree (created_at)
```

### 4. Test Cleanup Query Performance

```sql
-- Run EXPLAIN ANALYZE on the cleanup query
EXPLAIN ANALYZE
DELETE FROM job_listings
WHERE created_at < NOW() - INTERVAL '90 days';

-- Look for "Index Scan" not "Seq Scan"
-- Example good output:
-- Delete on job_listings
--   -> Index Scan using ix_job_listings_created_at on job_listings
--        Index Cond: (created_at < ...)
```

### 5. Monitor Supabase Dashboard

After deployment:

1. Go to Supabase Dashboard → Reports → Database
2. Check "Active connections" - should be 1-2
3. Check CPU usage - should drop significantly
4. Monitor for 24 hours to catch the 3 AM cleanup job

---

## Rollback Plan

If issues arise:

1. **Connection errors:** Revert .env to port 5432, remove NullPool
2. **Migration issues:** `poetry run alembic downgrade -1`
3. **Engine disposal issues:** Remove the `await engine.dispose()` line

All changes are backward-compatible and can be reverted independently.
