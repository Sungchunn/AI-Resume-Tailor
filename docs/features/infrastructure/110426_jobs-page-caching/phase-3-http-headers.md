# Phase 3 — HTTP Cache-Control + Cloudflare

**Parent:** [master-plan.md](./master-plan.md)
**Depends on:** [Phase 2](./phase-2-inmemory-cache.md) (specifically the public/user split)
**Status:** Planning
**Goal:** Let Cloudflare's edge absorb repeat traffic so the droplet doesn't see it at all.

## Why this phase

With Phase 1 + 2 in place, the backend is fast. Phase 3 removes the droplet from the picture entirely for the most cacheable endpoint (`/filter-options`) by letting Cloudflare serve it at the edge. For user-scoped responses, browser-level caching gives free back/forward navigation within the TTL window.

This phase is nearly free — the code change is one line per endpoint. The work is in getting the cacheability rules correct.

## 3a. Cache-Control headers

### Rule of thumb

| Response contains user-specific fields? | Header |
| --------------------------------------- | ------ |
| No (fully public data) | `public, max-age=60, stale-while-revalidate=30` |
| Yes (per-user `is_saved`, `is_hidden`, etc.) | `private, max-age=60, stale-while-revalidate=30` |
| Highly sensitive / personalized | `private, no-store` |

### Per-endpoint assignment

| Endpoint | Cacheability | Header |
| -------- | ------------ | ------ |
| `GET /api/job-listings/filter-options` | Public (no user data) | `public, max-age=60, stale-while-revalidate=30` |
| `GET /api/job-listings` (list) | Mixed (merges user interactions) | `private, max-age=60, stale-while-revalidate=30` |
| `GET /api/job-listings/saved` | User-specific | `private, no-store` |
| `GET /api/job-listings/kanban` | User-specific | `private, no-store` |
| `GET /api/job-listings/{id}` | Mixed | `private, max-age=60, stale-while-revalidate=30` |

### File: `backend/app/api/routes/job_listings.py`

```python
from fastapi import Response

@router.get("/filter-options", ...)
async def get_filter_options(response: Response, ...):
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
    ...

@router.get("", response_model=JobListingListItemResponse)
async def list_job_listings(response: Response, ...):
    response.headers["Cache-Control"] = "private, max-age=60, stale-while-revalidate=30"
    ...
```

### Critical safety rule

Endpoints that return `is_saved`, `is_hidden`, or `applied_at` in the body must **never** be `public`-cached. If two users share a Cloudflare POP and both hit a `public` response, they will see each other's interaction state. The table above is the source of truth — follow it strictly.

## 3b. Cloudflare configuration

Cloudflare **will not cache** responses with an `Authorization` header by default. To make `public` caching actually work at the edge for `filter-options`, do one of:

**Option A (recommended):** serve `filter-options` without auth. It's not user-specific anyway. Guard with a per-IP rate limit.

**Option B:** add a Cloudflare Page Rule / Cache Rule that explicitly caches `/api/job-listings/filter-options` and strips or ignores the `Authorization` header. More brittle.

Recommend Option A. Changes needed:

### File: `backend/app/api/routes/job_listings.py` (auth removal)

Remove the auth dependency from `get_filter_options`:

```python
# Before
@router.get("/filter-options", ...)
async def get_filter_options(
    user_id: int = Depends(get_current_user_id),  # remove
    db: AsyncSession = Depends(get_db),
):

# After
@router.get("/filter-options", ...)
async def get_filter_options(
    db: AsyncSession = Depends(get_db),
    # rate limit via middleware
):
```

### Cloudflare dashboard

Add a Cache Rule:

- **URL path** matches `/api/job-listings/filter-options`
- **Cache eligibility**: Eligible for cache
- **Edge TTL**: Respect origin (uses the `max-age=60` we set)
- **Browser TTL**: Respect origin

## Expected impact

- **`filter-options`**: near-instant for every user globally after the first request per Cloudflare POP. Droplet sees ~1 request per minute per POP.
- **`/job-listings` list**: sub-500 ms back/forward navigation within 60 s. No droplet load for those.
- **Overall**: droplet headroom increases meaningfully during traffic spikes.

## Files touched (checklist)

- [ ] `backend/app/api/routes/job_listings.py` — `Cache-Control` headers on each GET endpoint per the table above
- [ ] `backend/app/api/routes/job_listings.py` — remove auth dep from `get_filter_options` (Option A)
- [ ] Cloudflare dashboard — Cache Rule for `/api/job-listings/filter-options`
- [ ] `docs/api/job-listings.md` — document the new caching behavior and which endpoints return `public` vs `private`

## Phase 3 verification

1. **Cloudflare edge cache HIT** — `curl -I https://<domain>/api/job-listings/filter-options` twice. First response shows `cf-cache-status: MISS`, second should show `cf-cache-status: HIT`.
2. **Browser back/forward** — load `/jobs`, navigate to `/jobs/[id]`, click browser back. Network tab should show the list response served from `(disk cache)` or `(memory cache)` with no network round-trip.
3. **Private cache isolation** — open DevTools Network tab. Verify every endpoint returning user-specific data has `Cache-Control: private` or `no-store`. Any `public` response for user-scoped data is a security bug.
4. **Filter-options auth removal** — confirm `/api/job-listings/filter-options` returns 200 without an `Authorization` header (tests Option A took effect).
5. **Rate limiting** — verify the filter-options endpoint still has rate limiting applied (check `backend/app/middleware/rate_limiter.py` category assignment).
