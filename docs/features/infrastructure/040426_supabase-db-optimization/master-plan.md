# PostgreSQL Performance Optimization - Supabase Free Tier

## Problem Statement

The application is experiencing severe performance issues on Supabase free tier:

- **CPU:** Spiking to 100% repeatedly
- **Memory:** Elevated to 411 MB (approaching limits)
- **Context:** No real user load - the app isn't publicly launched yet

This indicates internal processes (scheduler jobs, connection management, inefficient queries) are consuming resources.

---

## Investigation Summary

A comprehensive audit of the codebase identified **8 distinct issues** across 4 categories:

| Category | Issues Found | Severity |
| -------- | ------------ | -------- |
| Connection Pooling | 3 | Critical |
| Missing Indexes | 3 | High |
| N+1 Query Patterns | 1 | Medium |
| Table Bloat | 1 | Low |

---

## Root Causes (Prioritized)

### P0 - Critical (Immediate Fix Required)

| # | Issue | File | Line | Impact |
| --- | ----- | ---- | ---- | ------ |
| 1 | No SQLAlchemy pool configuration | `backend/app/db/session.py` | 9-13 | Default 5+10=15 connections overwhelm free tier |
| 2 | Direct port 5432 instead of pooled 6543 | `.env` | 15-16 | Bypasses Supabase's PgBouncer connection pooler |
| 3 | Missing `engine.dispose()` on shutdown | `backend/app/main.py` | 36-45 | Connections linger after restart, pool exhaustion |
| 4 | Missing index on `created_at` | `backend/app/crud/job_listing.py` | 791 | Full table scan during daily cleanup job |

### P1 - High (Fix This Week)

| # | Issue | File | Lines | Impact |
| --- | ----- | ---- | ----- | ------ |
| 5 | N+1 queries in listing endpoints | `backend/app/api/routes/job_listings.py` | 214-218, 254-259, 291-296 | Extra DB round-trip per listing |
| 6 | `func.lower()` bypasses B-tree indexes | `backend/app/crud/job_listing.py` | 150, 155, 178, 188 | Full scans on seniority/city filters |
| 7 | ILIKE without GIN trigram indexes | `backend/app/crud/job_listing.py` | 137-142, 163-171, 231, 236 | Full scans on location/region/country |

### P2 - Medium (Optimize Later)

| # | Issue | File | Lines | Impact |
| --- | ----- | ---- | ----- | ------ |
| 8 | Full row updates in batch upsert | `backend/app/crud/job_listing.py` | 637-646 | Large TEXT/JSONB rewrites cause bloat |

---

## Implementation Phases

The fix is broken into **3 phases** with separate documentation:

| Phase | Focus | Files | Time |
| ----- | ----- | ----- | ---- |
| [Phase 1](./phase-1-connection-pooling.md) | Connection pooling & cleanup index | 4 files | 1 hour |
| [Phase 2](./phase-2-query-indexes.md) | Expression indexes & GIN indexes | 2 migrations | 30 min |
| [Phase 3](./phase-3-n1-optimization.md) | N+1 query fix with batch fetching | 2 files | 1 hour |

---

## Files to Modify

| File | Phase | Change Type |
| ---- | ----- | ----------- |
| `backend/app/db/session.py` | 1 | Edit - add NullPool |
| `backend/app/main.py` | 1 | Edit - add engine.dispose() |
| `backend/.env` | 1 | Edit - change port 5432 → 6543 |
| `backend/.env.example` | 1 | Edit - update template |
| `backend/alembic/versions/20260404_0001_*.py` | 1 | Create - created_at index |
| `backend/alembic/versions/20260404_0002_*.py` | 2 | Create - expression indexes |
| `backend/alembic/versions/20260404_0003_*.py` | 2 | Create - GIN trigram indexes |
| `backend/app/crud/user_job_interaction.py` | 3 | Edit - add get_batch() |
| `backend/app/api/routes/job_listings.py` | 3 | Edit - use batch fetch |

---

## Verification Plan

After implementation, verify success via:

1. **Connection count** - Should stay at 1-2 with NullPool
2. **CPU baseline** - Should drop below 50%
3. **Memory** - Should stabilize below 300MB
4. **Cleanup job** - Should use index scan (verify with EXPLAIN ANALYZE)

See individual phase docs for detailed verification steps.

---

## Good News

The investigation also found several **well-implemented patterns**:

- `echo=True` only in development (no production logging overhead)
- All route handlers use dependency injection for sessions
- Proper `async with` context managers throughout
- Exception handling with rollback in session dependency
- MongoDB has explicit pool configuration (min=10, max=50)
