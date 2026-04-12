# Phase 2 — In-Process Backend Cache

**Parent:** [master-plan.md](./master-plan.md)
**Depends on:** [Phase 1](./phase-1-payload-and-query.md)
**Status:** Planning
**Goal:** Cut server-side query cost for cold clients without adding Redis memory load on the 1 GB droplet.

## Why in-process instead of Redis

Redis already runs on the droplet for AI-layer caching, rate limiting, and scraper locks. Adding a list-cache on top of it would increase Redis memory pressure on a 1 GB machine. An in-process cache inside the FastAPI worker:

- Has zero network hop (microsecond reads vs. sub-millisecond Redis round-trips).
- Shares the worker's existing memory allocation.
- Needs no serialization beyond native Python objects.
- Is trivially bounded by TTL + entry count.

The tradeoff: each Uvicorn worker has its own cache. On 1–2 workers this duplication is negligible. Document it when shipping so future contributors understand why.

## 2a. Pick the caching primitive

| Option | Pros | Cons |
| ----- | ----- | ----- |
| `functools.lru_cache` | Stdlib, zero deps. Bounded by `maxsize`. | No native TTL. Doesn't play nicely with async. Hard to key by non-hashable filter dicts. |
| `fastapi-cache2` + `InMemoryBackend` **(Recommended)** | Async-native, TTL built-in, decorator API, custom key builder for query params, supports invalidation. | One extra dep. Per-worker cache (not shared across workers). |
| `cachetools.TTLCache` + custom helper | TTL support, bounded size. | Sync only — needs an `asyncio.Lock`. More glue code. |

**Recommendation: `fastapi-cache2` with `InMemoryBackend`.** Designed for exactly this use case and matches the 1 GB constraint.

## 2b. Initialization

### File: `backend/pyproject.toml`

```bash
cd backend
poetry add fastapi-cache2
```

### File: `backend/app/main.py`

```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

@app.on_event("startup")
async def init_cache():
    FastAPICache.init(InMemoryBackend(), prefix="rb-cache")
```

## 2c. Apply to `/filter-options`

The simplest target — no user-specific data, rarely changes.

### File: `backend/app/api/routes/job_listings.py`

```python
from fastapi_cache.decorator import cache

@router.get("/filter-options", ...)
@cache(expire=300)  # 5 min
async def get_filter_options(...):
    ...
```

## 2d. Apply to `/job-listings` list (public/user split)

The tricky case: per-user interaction fields (`is_saved`, `is_hidden`, `applied_at`) prevent naive caching. Two approaches:

**Option A (recommended):** cache only the **public portion** keyed by filter params (excluding user-specific filters), then merge in per-user interactions in a separate uncached query. Keeps hot anonymous-style queries shared across users.

**Option B:** cache the full per-user response keyed by `user_id`. Lower hit rate, higher memory use. **Not worth it on a 1 GB box.**

Go with A.

### Custom key builder

```python
def public_list_key_builder(
    func, namespace: str = "", request=None, response=None, *args, **kwargs
):
    params = kwargs.get("filters")
    # Exclude user-specific fields from the key
    public_bits = {
        k: v for k, v in params.model_dump().items()
        if k not in {"is_saved", "is_hidden", "applied"}
    }
    return f"{namespace}:public-list:{hash(frozenset(public_bits.items()))}"

@cache(expire=120, key_builder=public_list_key_builder)
async def _fetch_public_listings(filters: JobListingFilters) -> list[JobListingListItem]:
    ...
```

### Route handler flow

```python
@router.get("", response_model=JobListingListItemResponse)
async def list_job_listings(
    filters: JobListingFilters = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    public = await _fetch_public_listings(filters)                   # CACHED
    listing_ids = [row.id for row in public]
    interactions = await fetch_user_interactions(db, user_id, listing_ids)  # uncached, cheap
    return merge_public_with_interactions(public, interactions, filters)
```

The user-interaction fetch is a batch `IN` query against `user_job_interaction` — cheap enough that caching it isn't worth the invalidation headache.

## 2e. Invalidation

- **`filter-options`**: invalidate when the scraper finishes a run. Hook into `backend/app/services/scraping/scheduler.py:325` (end of scrape lock release). Call `FastAPICache.clear(namespace="rb-cache")` or a more targeted delete.
- **Public list cache**: rely on the 2 min TTL. Matches the "within 5 min" freshness requirement from the master plan and saves us writing invalidation for every scrape cycle.
- **Mutations (`save`, `hide`, `applied`)**: **no backend invalidation needed** because user-interaction state is merged post-cache. React Query on the frontend already handles the optimistic UI update.

## 2f. Memory budget

- Filter-options response: ~5–50 KB → 1 entry.
- List response per filter combo (after Phase 1 trim): ~20–50 KB → ~100 entries realistic working set.
- Total: well under 20 MB target.

Cap via `InMemoryBackend` size if needed — can subclass or monkeypatch to enforce a `maxsize`. Not strictly necessary with short TTLs.

## Expected impact

- Cold `/filter-options` requests: from ~4 GROUP BY queries down to a dict lookup.
- `/job-listings` list: default sort order for the first page becomes effectively free for the second+ user within a 2 min window.
- Hit rate improves as more users browse the same filter combinations.

## Files touched (checklist)

- [ ] `backend/pyproject.toml` — add `fastapi-cache2`
- [ ] `backend/app/main.py` — init `FastAPICache` on startup
- [ ] `backend/app/api/routes/job_listings.py` — `@cache` decorators + custom key builder + split route flow
- [ ] `backend/app/crud/job_listing.py` — split public vs. user-interaction queries
- [ ] `backend/app/services/scraping/scheduler.py:325` — invalidate on scrape complete
- [ ] `docs/architecture/backend-architecture.md` — document in-process cache + multi-worker caveat

## Phase 2 verification

1. **Cache hit logging** — add a log line in the cache wrapper for `HIT`/`MISS`. Run `docker-compose logs backend | grep rb-cache:` while browsing `/jobs` to verify cache behavior.
2. **Filter-options speedup** — hit `/api/job-listings/filter-options` twice in a row. Second request should return in single-digit milliseconds.
3. **Cross-user public cache** — user A hits `/jobs` → user B hits `/jobs` with same filters within 2 min. Backend logs should show `HIT` for user B's public-list fetch.
4. **User isolation** — user A saves a job. User B (separate account, same filters) should NOT see A's saved state. Tests that the public/user split is correct.
5. **Scraper invalidation** — trigger a scraper run → confirm filter-options reflects new countries/cities within a few seconds.
6. **Memory ceiling** — run `docker stats resume-tailor-backend` during a browse session. Worker RSS should stay within its existing envelope plus < 20 MB.
