# /jobs Page Caching & Performance — Master Plan

**Date:** 2026-04-11
**Status:** Planning
**Owner:** Sungchunn

## Context

The `/jobs` page has an observed ~2 s delay on initial load. Backend, frontend, Redis, and Postgres all share a single **1 GB RAM DigitalOcean droplet** behind **Cloudflare**. We cannot add more Redis memory pressure — any new backend caching must live in-process in the FastAPI worker.

This plan explains the root causes, the three-phase execution, and links to the per-phase detail documents.

## Related documents

- [Phase 1 — Payload Trimming & React Query Persistence](./phase-1-payload-and-query.md)
- [Phase 2 — In-Process Backend Cache](./phase-2-inmemory-cache.md)
- [Phase 3 — HTTP Cache-Control + Cloudflare](./phase-3-http-headers.md)
- [Phase 4 — Next-Page Query Optimization & Daily-Refresh Caching](./phase-4-query-optimization.md)

## Root causes (verified against the codebase)

Ordered by impact.

1. **Bloated list payload.** `JobListingResponse` returns ~36 fields per row including `job_description`, `job_description_html`, `company_description` (large TEXT) plus JSONB arrays. The list view in `frontend/src/components/jobs/JobListingCard.tsx` only renders ~10 of them. Default response = 20 rows × 10–100 KB each → **200 KB – 5 MB per request**. On a constrained droplet with TLS and cold Postgres TOAST reads, this alone can explain most of the 2 s.

2. **No backend caching on any `/job-listings` endpoint.** `backend/app/services/core/cache.py` exists but is only used by parser/tailor/ATS flows. Routes in `backend/app/api/routes/job_listings.py:124-389` hit Postgres on every request.

3. **`/job-listings/filter-options` runs 4 full GROUP BY queries** on every filter-sidebar mount. See `backend/app/crud/job_listing.py:692-768`. The frontend doesn't even wrap it in React Query, so navigation re-fires it (`frontend/src/components/jobs/JobListingFilters.tsx:40-50`).

4. **React Query cache evaporates on refresh.** No `persistQueryClient` means every full page reload starts cold. `frontend/src/providers/QueryProvider.tsx:12` also uses `staleTime: 60s` — too short for job listings that update on a scraper schedule.

5. **Full-text search uses ILIKE on a large TEXT column.** `crud/job_listing.py:259-267`. Trigram indexes exist but ILIKE on `job_description` often sidesteps them. **Out of scope** for this plan — caching won't help uncached search misses.

## Three-phase plan at a glance

| Phase | Scope | Expected impact | Doc |
| ----- | ----- | --------------- | --- |
| 1 | Backend payload trimming + frontend React Query persistence via `localStorage` | Response size 60–90% smaller; FCP < 1 s on warm cache | [phase-1](./phase-1-payload-and-query.md) |
| 2 | In-process FastAPI cache (no Redis) with public/user-interaction split | Filter-options drops from 4 GROUP BYs to a dict lookup; shared public list cache across users | [phase-2](./phase-2-inmemory-cache.md) |
| 3 | `Cache-Control` headers + Cloudflare edge caching of public endpoints | Near-instant `filter-options` globally; sub-500 ms back/forward nav | [phase-3](./phase-3-http-headers.md) |
| 4 | Split count/row cache keys, scraper-anchored TTLs, partial index for default sort, post-scrape cache warming | Next-page clicks run one indexed `SELECT` instead of `COUNT + SELECT`; first request after scrape served from memory | [phase-4](./phase-4-query-optimization.md) |

Each phase is independently shippable. Ship Phase 1 first, measure, then decide whether Phases 2 and 3 are still needed.

## Memory budget check (1 GB droplet)

- Postgres: ~200–300 MB
- FastAPI workers (1–2): ~200–400 MB including app code
- Redis (existing): ~50–150 MB
- Next.js frontend (if same droplet): ~150–300 MB
- **In-process cache budget**: target ≤ 20 MB. With 5 min TTL on list entries and a realistic working set (~50 filter combos), we stay well under.

## Verification strategy

Before starting, capture baselines with Chrome DevTools and record them in this directory as `baseline.md`:

1. `/jobs` first-load time — Performance tab FCP + time to first card rendered.
2. `/api/job-listings?limit=20` response size + TTFB (Network tab).
3. `/api/job-listings/filter-options` TTFB.

After each phase, re-measure the same three numbers and record the delta in a `results-phase-N.md` file next to this plan. Targets:

- **Phase 1 alone**: response size 60–90% smaller, FCP < 1 s on warm persisted cache.
- **Phase 1 + 2**: cold-start `filter-options` near 0 ms after first request.
- **All phases**: sub-500 ms back/forward navigation on `/jobs`.

## Out-of-scope follow-ups

- **Full-text search**: ILIKE on `job_description` is slow; needs proper Postgres FTS (`tsvector` + GIN). Separate migration.
- **Cursor-based pagination**: offset pagination is fine until the listings table grows past ~100k rows.
- **Image optimization**: `JobListingCard` uses raw `<img>`; could move to `next/image`. Minor win, unrelated to caching.
- **RSC migration**: moving `/jobs` to server components with `unstable_cache` is a larger architectural change. Revisit only if Phases 1–3 don't hit the target.

## Critical architecture note

Phase 2 uses an **in-process** cache, which means each Uvicorn worker has its own copy. On a 1 GB droplet we run 1–2 workers, so cache duplication is negligible. This must be documented in `/docs/architecture/backend-architecture.md` when Phase 2 ships, along with the multi-worker caveat.
