# Fix Production Database Connection Config

## Context

Supabase dashboard shows a slow internal role-settings query accumulating ~41.9s across thousands of calls. The backend's connection pooling setup is already well-configured (NullPool + port 6543 + disabled prepared statements), but two `.env` config issues were found during audit.

## Changes

### 1. Add `prepared_statement_cache_size=0` to production `DATABASE_URL`

- **File:** `backend/.env` (line 2)
- **What:** Append `?prepared_statement_cache_size=0` to the async DATABASE_URL
- **Why:** Belt-and-suspenders with the `connect_args` in `session.py` — ensures asyncpg doesn't cache prepared statements even if connect_args are bypassed

### 2. Switch `DATABASE_URL_SYNC` to direct connection (port 5432)

- **File:** `backend/.env` (line 3)
- **What:** Change from pooler host (`pooler.supabase.com:6543`) to direct host (`db.supabase.co:5432`)
- **Why:** DDL operations in Alembic migrations can interact poorly with PgBouncer's transaction pooling mode

## Verification

- Confirm `backend/.env` has updated URLs
- Run `poetry run alembic current` to verify sync URL connects successfully
- Deploy and monitor Supabase query performance dashboard for any change in the role-settings query frequency/timing
