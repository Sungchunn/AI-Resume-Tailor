# Fix Supabase RLS Security Warning

## Problem

Supabase detected tables in the `public` schema without Row-Level Security (RLS) enabled. While the frontend only accesses the database through FastAPI (not directly), the tables are still technically accessible via Supabase's anon key.

**Tables without RLS**: `users`, `resumes`, `job_listings`, `ai_usage_logs`, `audit_logs`, `ai_pricing_configs`, `scraper_presets`, `scraper_schedule_settings`, `scraper_runs`, `scraper_requests`

## Solution: Revoke Public Schema Access

Since all database access goes through FastAPI (using direct PostgreSQL connection), we can revoke access for Supabase's anonymous and authenticated roles. This is simpler than adding RLS to every table.

## Implementation

### Step 1: Create Alembic Migration

Create a new migration file at `/backend/alembic/versions/20260408_0001_revoke_public_schema_access.py`:

```python
"""Revoke public schema access for Supabase roles

Revision ID: 20260408_0001
Revises: 20260407_0003
Create Date: 2026-04-08

Since all database access goes through FastAPI (not Supabase client),
we revoke access for anon and authenticated roles to prevent direct access.
This resolves the Supabase security warning about tables without RLS.
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260408_0001"
down_revision: str | None = "20260407_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Revoke all privileges on public schema from Supabase roles
    op.execute("REVOKE ALL ON SCHEMA public FROM anon;")
    op.execute("REVOKE ALL ON SCHEMA public FROM authenticated;")

    # Revoke privileges on all existing tables
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;")
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;")

    # Revoke privileges on all sequences
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;")
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;")

    # Revoke default privileges for future tables
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE ALL ON TABLES FROM anon;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE ALL ON TABLES FROM authenticated;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE ALL ON SEQUENCES FROM anon;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE ALL ON SEQUENCES FROM authenticated;"
    )


def downgrade() -> None:
    # Re-grant schema usage (but not table access - that would need RLS)
    op.execute("GRANT USAGE ON SCHEMA public TO anon;")
    op.execute("GRANT USAGE ON SCHEMA public TO authenticated;")
```

### Step 2: Run Migration

```bash
cd backend
poetry run alembic upgrade head
```

### Step 3: Verify in Supabase Dashboard

1. Go to Supabase Dashboard -> Database -> Security Advisor
2. The warning should be resolved since the roles can no longer access the tables

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/alembic/versions/20260408_0001_revoke_public_schema_access.py` | Create new migration |

## Verification

1. **Run migration**: `poetry run alembic upgrade head`
2. **Check Supabase Security Advisor**: Warning should disappear
3. **Test frontend**: All functionality should work (since it goes through FastAPI)
4. **Optional - Test direct access fails**:

   ```sql
   -- In Supabase SQL Editor, run as anon role:
   SET ROLE anon;
   SELECT * FROM users;  -- Should fail with permission denied
   ```

## Why This Works

- Your frontend uses `NEXT_PUBLIC_API_URL` to call FastAPI endpoints
- FastAPI connects directly to PostgreSQL using the `postgres` user (not anon/authenticated roles)
- Revoking access for `anon` and `authenticated` roles doesn't affect your application
- This is simpler than adding RLS policies to 10+ tables

## Alternative Considered

We could enable RLS on all remaining tables, but:

- Adds complexity to maintain policies for system tables (`audit_logs`, `scraper_*`)
- `job_listings` would need a public-read policy, which is effectively the same as current behavior
- Revoking access is cleaner for a backend-only architecture
