# Phase 4 — Next-Page Query Optimization & Daily-Refresh Caching

**Date:** 2026-04-11
**Status:** Planning
**Parent:** [master-plan.md](./master-plan.md)

## Context

Phases 1–3 trimmed the list payload, added an in-process cache, and set edge-cache headers. Pagination "next page" clicks still hit Postgres harder than necessary:

1. `job_listing_repository.list()` runs a separate `SELECT COUNT(*)` on every call. Every next-page click re-executes the same count because the row cache key includes `offset`, so pages 2, 3, 4… miss the cache and recompute an identical total. For a user paging through five pages, that's five identical count queries.
2. `_fetch_public_listings()` caches row payloads with `expire=120` and `get_filter_options()` with `expire=300`, but the scraper clears the entire cache on completion (`scheduler.py:461`) and only runs once per day. The TTLs are two orders of magnitude shorter than the real invalidation cadence.
3. The default sort path `WHERE is_active = TRUE ORDER BY date_posted DESC LIMIT 20 OFFSET N` has no partial index. `ix_job_listings_date_posted` is a plain B-tree and does not cover the `is_active` predicate.
4. The in-process cache starts empty after every daily `FastAPICache.clear()`, so the first user after 02:00 UTC always eats a cold-path query.

**Intended outcome:** "Next page" clicks on the default view after the first request should execute a single indexed `SELECT` (no `COUNT`, no filter-options lookup, no cold cache) and return in well under 100 ms on the 1 GB droplet.

## Scope

**In scope:** Count caching, TTL extension tied to daily-refresh invalidation, partial index for default sort, post-scrape cache warming (default view + top countries).

**Out of scope:** Keyset pagination, `tsvector` full-text search, moving the cache to Redis. The master plan defers all three.

## Design

### 1. Decouple count caching from row caching

The count query result depends on every filter *except* `limit` and `offset`. Cache it under a separate key so pages 2+ reuse page 1's count.

**`backend/app/api/routes/job_listings.py`** — add a second cache-key helper and update `_fetch_public_listings`:

```python
def _public_count_cache_key(filters: "JobListingFilters") -> str:
    public_bits = filters.model_dump(
        exclude={"is_saved", "is_hidden", "applied", "limit", "offset"}
    )
    raw = repr(sorted(public_bits.items(), key=lambda kv: kv[0]))
    digest = hashlib.md5(raw.encode()).hexdigest()  # noqa: S324
    return f"{FastAPICache.get_prefix()}:job-listings:public-count:{digest}"
```

In `_fetch_public_listings`:

1. Compute both keys (`rows_key`, `count_key`).
2. Look up the rows cache first. If hit, return directly (existing path).
3. On row miss, look up the count cache. If hit, call `repository.list(..., known_total=cached_total)` which internally sets `skip_count=True`.
4. Run the repo query, cache rows under `rows_key`, and if count was computed (not supplied), cache it under `count_key`.

Both caches use the same long TTL (see §3).

### 2. Repository: `known_total` in `list()`

**`backend/app/crud/job_listing.py:135-379`** — extend the signature:

```python
async def list(
    self,
    db: AsyncSession,
    *,
    filters: JobListingFilters,
    user_id: int | None = None,
    slim: bool = True,
    known_total: int | None = None,
) -> tuple[list[JobListing], int]:
```

When `known_total is not None`, skip the count query at lines 362–363 entirely and use the supplied value. Leave behavior unchanged when `None`. Callers that don't pass it (search, saved, applied, user-interaction path) keep running the count.

User-interaction branches intentionally stay out of this optimization because their cache key would have to include the user id and cached-count values would still be per-user.

### 3. Dynamic TTL anchored to the next scraper run

**The risk a fixed TTL introduces:** if TTL is shorter than the inter-scrape interval, users see unnecessary cold misses. If TTL is longer than the interval *and* the post-scrape `FastAPICache.clear()` silently fails (it is wrapped in try/except at `scheduler.py:463`), fresh data the scraper just wrote would not surface on the webapp until the next eviction.

The scraper schedule is not static — it is configurable via `ScraperScheduleSettings` (DB singleton) and can be reconfigured at runtime through `scheduler.reconfigure_from_db()`. So the TTL must be **derived** from the current schedule, not hardcoded.

**Approach:** compute `seconds_until_next_scraper_run()` at cache-set time and use that as the `expire=` value. This makes the worst-case staleness bounded by *the gap between two scrapes*, independent of whether `clear()` succeeded.

**New helper `backend/app/services/scraping/schedule_utils.py`:**

```python
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone

# Safety bounds — never cache longer than a day, never shorter than a minute.
_MIN_TTL_SECONDS = 60
_MAX_TTL_SECONDS = 86_400

def seconds_until_next_scraper_run(
    schedule_hour: int,
    schedule_minute: int,
    now: datetime | None = None,
) -> int:
    """Return seconds from now until the next UTC cron fire of the scraper.

    Clamped to [60, 86400] so a mis-configured schedule cannot produce
    pathological cache lifetimes.
    """
    now = now or datetime.now(timezone.utc)
    trigger = CronTrigger(
        hour=schedule_hour, minute=schedule_minute, timezone="UTC"
    )
    next_fire = trigger.get_next_fire_time(None, now)
    delta = int((next_fire - now).total_seconds())
    return max(_MIN_TTL_SECONDS, min(_MAX_TTL_SECONDS, delta))
```

**Schedule settings access:** reading `ScraperScheduleSettings` from Postgres on every cache write would undo the savings. Instead, the settings are loaded once into a module-level cache on app startup and refreshed whenever `SchedulerService.reconfigure_from_db()` is called (it already runs when the admin updates the schedule). Expose it as:

```python
# backend/app/services/scraping/schedule_utils.py
_cached_schedule: tuple[int, int] | None = None

def set_cached_schedule(hour: int, minute: int) -> None:
    global _cached_schedule
    _cached_schedule = (hour, minute)

def get_cache_ttl_seconds() -> int:
    if _cached_schedule is None:
        return _MAX_TTL_SECONDS  # fall back to 24 h before startup wires it up
    hour, minute = _cached_schedule
    return seconds_until_next_scraper_run(hour, minute)
```

Wire `set_cached_schedule` into:

- `SchedulerService.start()` — after reading settings, call `set_cached_schedule(settings.scraper_schedule_hour, settings.scraper_schedule_minute)`.
- `SchedulerService.reconfigure_from_db()` — after loading the new settings, call it again.

**Usage in `backend/app/api/routes/job_listings.py`:**

```python
from app.services.scraping.schedule_utils import get_cache_ttl_seconds

# In _fetch_public_listings — for both rows_key and count_key
await backend.set(rows_key, coder.encode(payload), expire=get_cache_ttl_seconds())

# In get_filter_options
await backend.set(cache_key, coder.encode(payload), expire=get_cache_ttl_seconds())
```

**Invariant this gives us:** a cache entry written at time `T` expires at or before `next_scrape(T)`. Combined with the post-scrape `FastAPICache.clear()` call, this means the maximum age of any served row is strictly bounded by the scraper interval, regardless of `clear()` failures.

**Header changes:**

- `/filter-options` response header: `public, max-age=60, stale-while-revalidate=30` → `public, max-age=300, stale-while-revalidate=86400`. Cloudflare's edge cache can serve stale while the origin revalidates, and the origin's cache is bounded by `get_cache_ttl_seconds()`.
- List `Cache-Control` stays `private, max-age=60, stale-while-revalidate=30`. Browser caching remains short-lived because the list is user-specific after interaction merge.

### 4. Partial index for the default sort path

New alembic migration under `backend/alembic/versions/`:

```python
def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS
            ix_job_listings_active_date_posted
        ON job_listings (date_posted DESC, id DESC)
        WHERE is_active = TRUE
        """
    )

def downgrade() -> None:
    op.execute(
        "DROP INDEX CONCURRENTLY IF EXISTS ix_job_listings_active_date_posted"
    )
```

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Follow the project's existing pattern for non-transactional migrations (see migration `20260404_0003` that creates the trigram GIN indexes): set the migration-level `transactional = False` flag or call `op.get_bind().execute(text("COMMIT"))` before the `CREATE` statement.

Verify with `EXPLAIN ANALYZE` before and after:

```sql
EXPLAIN ANALYZE
SELECT id, job_title, company_name, date_posted
FROM job_listings
WHERE is_active = TRUE
ORDER BY date_posted DESC
LIMIT 20 OFFSET 60;
```

Expect a plan change from `Index Scan using ix_job_listings_date_posted` (with a filter recheck on `is_active`) to `Index Only Scan using ix_job_listings_active_date_posted`.

### 5. Post-scrape cache warming

**`backend/app/services/scraping/scheduler.py`** — after `FastAPICache.clear()` at line 461:

```python
try:
    await FastAPICache.clear()
    logger.info("rb-cache: cleared after scraper run")
    await _warm_default_job_listing_cache()
except Exception as cache_err:
    logger.warning(
        "rb-cache: clear/warm failed after scraper run: %s",
        cache_err,
        exc_info=True,
    )
```

`_warm_default_job_listing_cache` lives in a new module `backend/app/services/scraping/cache_warm.py` (keeps scheduler.py lean) and:

1. Opens a short-lived `AsyncSessionLocal()`.
2. Populates the filter-options cache by calling `job_listing_repository.get_filter_options(db, active_only=True)` and writing the encoded payload under `_filter_options_cache_key()`.
3. Warms the default unfiltered view via three `_fetch_public_listings(db, filters)` calls at `(limit=20, offset=0 / 20 / 40)`.
4. Warms page 1 for the top N countries discovered in step 2 (default N=5, module-level constant). The `countries` list returned by `get_filter_options` is already ordered by count desc; take the first N and construct `JobListingFilters(country=code, limit=20, offset=0)` for each.
5. Each warming call is individually wrapped in try/except so a single failure (e.g., a malformed country code) does not abort the rest of the warm-up or the scraper batch commit.

**Total cost per scrape:** 1 filter-options query + 3 default-view queries + 5 single-country queries ≈ 9 queries, a few hundred ms total.

**Cache footprint:** ≤ 9 × ~30 KB ≈ 270 KB, well under the 20 MB Phase 2 budget.

Import `_fetch_public_listings` and `_filter_options_cache_key` from `app.api.routes.job_listings` into the new warming module. They are the existing entry points and must not be duplicated.

## Critical files to modify

| File | Change |
| ---- | ------ |
| `backend/app/api/routes/job_listings.py` | Add `_public_count_cache_key`; split count/row caching in `_fetch_public_listings`; bump TTLs; tighten `/filter-options` `Cache-Control` |
| `backend/app/crud/job_listing.py` | Add `known_total` param to `list()`; skip count query when supplied |
| `backend/app/services/scraping/scheduler.py` | Call `set_cached_schedule()` from `start()` and `reconfigure_from_db()`; call `_warm_default_job_listing_cache()` after `FastAPICache.clear()` |
| `backend/app/services/scraping/cache_warm.py` | **New.** Warms filter-options + default view pages 1–3 + page 1 for top 5 countries |
| `backend/app/services/scraping/schedule_utils.py` | **New.** `seconds_until_next_scraper_run()`, `set_cached_schedule()`, `get_cache_ttl_seconds()` |
| `backend/alembic/versions/<new>_partial_index_active_date_posted.py` | New migration for `CREATE INDEX CONCURRENTLY ... WHERE is_active` |
| `docs/features/infrastructure/110426_jobs-page-caching/master-plan.md` | Add Phase 4 row to the phase table |
| `docs/architecture/backend-architecture.md` | Cache section update (count/row key split, 6 h TTL anchored to daily scraper) |
| `docs/api/job-listings.md` | `Cache-Control` header update for `/filter-options` |

## Reused utilities (no new abstractions)

- `FastAPICache.get_backend()` / `get_coder()` — existing pattern at `job_listings.py:83-84` and `259`.
- `JobListingFilters.model_dump(exclude=...)` — existing pattern at `job_listings.py:67`.
- `job_listing_repository.list()` — existing entry point, only extended.
- `_fetch_public_listings()` — existing entry point, internal logic extended.
- `_filter_options_cache_key()` — existing, imported by the new warming module.
- `AsyncSessionLocal` — already used in `scheduler.py:190` for DB access from scheduler.

## Verification

### Unit / integration

- Add a backend test that calls `list(..., known_total=42)` and asserts (via a `sqlalchemy.event.listen('before_execute', ...)` spy or the `echo` log) that no `SELECT count(` statement fires.
- Add a route-level test: call `GET /job-listings?offset=0` then `GET /job-listings?offset=20` against a seeded DB and assert the second call produces one query (`SELECT ... LIMIT 20 OFFSET 20`) rather than two.

### Database

- `EXPLAIN ANALYZE` the default-sort pagination query before and after the migration. Confirm the plan switches to `Index Only Scan using ix_job_listings_active_date_posted` and that buffers/read counts drop.
- `\di+ job_listings` to confirm the partial index is present and sized reasonably.

### Runtime

- Start the backend (`poetry run uvicorn app.main:app --reload`) with `LOG_LEVEL=debug` to surface the `rb-cache: HIT/MISS` lines.
- Hit `/api/job-listings?limit=20&offset=0` — expect MISS on both the rows key and count key.
- Hit `/api/job-listings?limit=20&offset=20` — expect MISS on rows key, **HIT** on count key, no `SELECT count(` in the SQL echo.
- Hit the first URL again — expect HIT on both.
- Trigger `POST /api/admin/scraper/run` (or equivalent) and immediately re-hit `/api/job-listings` — expect HIT on the three warmed default pages (`offset=0,20,40`) and HIT on `/api/job-listings?country=<top_country>&limit=20&offset=0` for each of the top 5 countries.

### E2E

- Extend an existing Playwright jobs-page spec to click "next" twice and record total network time in a custom metric. Compare against the Phase 1 baseline in `baseline.md` (to be captured before shipping).

## Risks and open questions

- **`known_total` skew on filter changes:** not a concern — `known_total` is only supplied when the count cache hit under the filter-excluded key, which guarantees the count was computed under identical filters.
- **Index build on a live droplet:** `CREATE INDEX CONCURRENTLY` is safe but takes longer; run during a low-traffic window and coordinate with the user before `alembic upgrade head` in production.
- **Cache warming adds ~300 ms to scraper completion:** negligible compared to the full scraper batch duration and isolated in its own try/except.
- **Admin reschedules the scraper while cache is warm:** handled — `reconfigure_from_db()` calls `set_cached_schedule()` immediately, so every subsequent cache write uses the new TTL. Previously cached entries keep their old expiry, but will either expire before the new scrape fires (if the new schedule is sooner) or be cleared by the new scrape's `FastAPICache.clear()` (if later). Either way, no entry outlives the next actual scrape.
- **Startup ordering:** if a request arrives before `SchedulerService.start()` wires the cached schedule, `get_cache_ttl_seconds()` returns `_MAX_TTL_SECONDS` (24 h). Acceptable for the ~seconds-long gap at boot, and the very next scraper run will clear those entries.

## Expected impact

- **Next-page clicks:** one `SELECT` instead of `COUNT + SELECT`. ~50% fewer DB round-trips for the hot path.
- **Warm default view:** all three pages served from memory immediately after a scrape completes, for all users.
- **Filter-options endpoint:** near-zero cost during the entire day after the first post-scrape request, on top of Cloudflare edge caching.
- **Default-sort query plan:** index-only scan, avoiding a heap filter recheck on `is_active`.
