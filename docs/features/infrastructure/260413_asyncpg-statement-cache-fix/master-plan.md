# Fix asyncpg prepared statement errors with Supavisor

## Context

After deploying commit `837bbe8` (which changed query shapes by adding `load_only()` to selectinload), Supabase logs show:

```text
ERROR: prepared statement "__asyncpg_stmt_15__" does not exist
ERROR: prepared statement "__asyncpg_stmt_11__" does not exist
ERROR: prepared statement "__asyncpg_stmt_f__"  does not exist
```

The `__asyncpg_stmt_*__` naming is asyncpg's auto-generated statement names, confirming these come from asyncpg's internal statement cache — not SQLAlchemy's adapter cache.

## Root Cause

`backend/app/db/session.py` correctly disables **SQLAlchemy's** prepared statement cache:

- `prepared_statement_cache_size=0` — disables the adapter's LRU cache
- `prepared_statement_name_func=lambda: ""` — forces unnamed statements

But **asyncpg's own** `statement_cache_size` (default: 100) is never set to 0. This matters because of a safety mechanism in asyncpg's `Connection._get_statement()`:

```python
if (not statement.name and not self._stmt_cache_enabled):
    statement.mark_unprepared()  # Forces re-parse on every execute
```

When `statement_cache_size > 0` (the current default), `_stmt_cache_enabled=True`, so `mark_unprepared()` is **never called** on unnamed statements. Without this safety, asyncpg can try to reuse stale server-side statement state after Supavisor rotates the underlying PostgreSQL connection — causing "prepared statement does not exist" errors.

**Two distinct cache layers:**

| Layer | Parameter | Current value | Correct value |
| ----- | --------- | ------------- | ------------- |
| SQLAlchemy adapter LRU | `prepared_statement_cache_size` (in `connect_args`) | `0` | `0` (already correct) |
| asyncpg built-in cache | `statement_cache_size` (in `connect_args`) | `100` (default) | `0` (must add) |

## Plan

### Step 1 -- Add `statement_cache_size=0` to connect_args

**File:** `backend/app/db/session.py` (lines 22-30)

```python
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
```

### Why this preserves query optimization

The `load_only()` changes from `837bbe8` work at the **ORM level** — SQLAlchemy generates a narrower SELECT list, reducing data transfer and skipping TOAST decompression. This is independent of how statements are cached. Disabling statement caching adds a small per-query parse overhead (~0.1-0.5ms) but eliminates connection-pooler errors entirely.

## Verification

1. Deploy and confirm no more `prepared statement does not exist` errors in Supabase logs
2. Hit the kanban board endpoint to exercise the `load_only()` queries
3. Confirm the health check passes
