# Caching & ID Consistency Improvements

## Context

Gemini CLI flagged that the backend uses `InMemoryBackend` for FastAPI's cache, which causes per-worker isolation in multi-process deployments. The suggestion was to switch to Redis. After investigation, this is **partially valid** — Redis is already extensively used for the heavy-lifting (parsing, tailoring, ATS), but the job listings cache still uses `InMemoryBackend`. Two other gaps exist: FitToPageService has no caching, and there are HTTP status code inconsistencies in job ID resolution error handling.

**What Gemini got right:** InMemoryBackend is used for job listings; FitToPageService lacks caching.

**What Gemini got wrong:** AI Client response caching is unnecessary — the services that call it already cache their results in Redis. Adding client-level caching would be double-caching with stale-response risk.

---

## Phase 1: Fix ID Resolution Error Consistency (2 files, ~4 lines)

Two routes return `403 FORBIDDEN` when `IDResolutionError` is caught, while every other route returns `404 NOT_FOUND`. Since `IDResolutionError` is raised for both "not found" and "not authorized" cases indistinguishably, returning 403 leaks that the resource exists.

**Files:**

- `backend/app/api/routes/tailor.py:636-640` — change `HTTP_403_FORBIDDEN` to `HTTP_404_NOT_FOUND`, detail to `"Job not found"`
- `backend/app/api/routes/ats/bullets.py:85-89` — change `HTTP_403_FORBIDDEN` to `HTTP_404_NOT_FOUND`, detail to `"Job not found"`

---

## Phase 2: Add FitToPageService Render Caching (1 file, ~30 lines)

WeasyPrint rendering is the most CPU-expensive operation. The `fit()` method calls `_render_count()` up to 6 times per request. Each call does a full HTML layout pass.

**Approach:** In-process hash-based cache (not Redis) — the HTML content is too large for network round-trips to be worthwhile, and the cache hit pattern is within a single request's iteration loop.

**File:** `backend/app/services/export/fit_to_page.py`

- Add a module-level bounded dict `_render_cache` keyed by `sha256(html + sorted_style_json + page_size)` → `(page_count, timestamp)`
- Max 50 entries, 5-minute TTL
- Check cache before calling `HTMLToDocumentService.render_page_count()`
- Prune expired entries on each cache miss

---

## Phase 3: Migrate FastAPICache to RedisBackend (1 file + docs)

Switch the job listings `InMemoryBackend` to `RedisBackend` from `fastapi-cache2`. Redis is already connected at startup before `FastAPICache.init()` runs.

**File:** `backend/app/main.py:37`

```python
# Before
from fastapi_cache.backends.inmemory import InMemoryBackend
FastAPICache.init(InMemoryBackend(), prefix="rb-cache")

# After
from fastapi_cache.backends.redis import RedisBackend
from app.db.redis import get_redis
FastAPICache.init(RedisBackend(get_redis()), prefix="rb-cache")
```

- No changes needed in `job_listings.py` or `cache_warm.py` — they use the `FastAPICache.get_backend()` abstraction
- `FastAPICache.clear()` in `scheduler.py` works with both backends
- Add try/except fallback to `InMemoryBackend` if Redis is unavailable at boot

**Docs:** Update `docs/architecture/backend-architecture.md` — revise the "In-Process Job-Listings Cache" section to reflect Redis migration.

---

## Phase 4: Consolidate Redis Connections (3 files, ~10 lines each)

Three services create their own `redis.from_url()` connections instead of reusing the shared `db/redis.py` client:

| File | Current | Change to |
| ----- | ----- | ----- |
| `backend/app/services/core/cache.py:20-21` | `redis.from_url(redis_url)` | Accept `Redis` instance from `get_redis()` |
| `backend/app/middleware/rate_limiter.py:248` | `redis.from_url(self.redis_url)` | Use `get_redis()` |
| `backend/app/services/resume/parse_task.py:29` | `redis.from_url(redis_url)` | Use `get_redis()` |

This reduces file descriptors and memory on the 1GB droplet.

---

## Skipped: AI Client Response Caching

**Not implementing.** Every service that calls the AI client already caches its own results in Redis:

- `ResumeParser` → `CacheService.get_parsed_resume()` (24h)
- `JobAnalyzer` → `CacheService.get_parsed_job()` (24h)
- `TailoringService` → `CacheService.get_tailored_result()` (7 days)
- ATS → `CacheService.get_ats_result()` (24h)

Adding client-level caching would double-cache and risk serving stale AI text.

---

## Verification

1. **Phase 1:** `grep -n "IDResolutionError" backend/app/api/routes/` — every catch block should return `HTTP_404_NOT_FOUND`
2. **Phase 2:** Manually trigger fit-to-page export twice with same content; second call should skip WeasyPrint renders (visible in logs)
3. **Phase 3:** After migration, run `redis-cli KEYS "rb-cache:*"` to verify job listing cache keys appear in Redis after browsing job listings
4. **Phase 4:** After consolidation, `grep -rn "from_url" backend/app/` should show only the single call in `db/redis.py`
