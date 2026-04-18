# Backend Opaque-500 Audit

**Date:** 2026-04-18
**Scope:** `backend/app/` — exception handling gaps that produce opaque 500 responses.

## Context

Following the `/job-listings/filter-options` fix (commit `fc2071b`), this audit finds the next batch of unhandled-exception sites that produce opaque 500s. The catch-all `Exception` handler added in `backend/app/main.py:121` now wraps everything in a structured envelope with `error_code="internal_error"` — so nothing crashes silently anymore, but **clients still cannot distinguish bug-vs-conflict-vs-upstream-outage** because no domain exception classes are registered. This audit finds the unregistered domain exceptions and the route-level external calls that bubble up without semantic mapping.

Currently registered handlers (verified in `main.py:121-225`):

| Handler | Status code | `error_code` |
| ------- | ----------- | ------------ |
| `Exception` (catch-all) | 500 | `internal_error` |
| `IntegrityError` | 409 | `db_integrity` |
| `OperationalError` | 503 | `db_unavailable` |
| `SQLTimeoutError` | 504 | `db_timeout` |

No domain handlers. No Mongo / Redis / HTTPX handlers.

## Punch List (15 items)

### A. Unregistered domain exceptions — add `@app.exception_handler(...)` in `main.py`

| # | Sev | Exception (defined at) | Today | Proposed fix |
| - | --- | ---------------------- | ----- | ------------ |
| 1 | HIGH | `VersionConflictError` (`crud/mongo/exceptions.py:4`, raised at `crud/mongo/resume.py:186`) | 500 `internal_error` — client cannot distinguish stale-write from server bug | Register handler → 409 `document_version_conflict` |
| 2 | HIGH | `IDResolutionError` (`api/utils/id_resolution.py:24`, raised at `:131`, `:187`) | 500 `internal_error` — auth/existence failures look like bugs | Register handler → 404 `resource_not_found` |
| 3 | HIGH | `ApifyClientError` (`services/scraping/apify_client.py:24`, raised at `:112`) | 500 `internal_error` — upstream outage looks like local bug | Register handler → 502 `external_api_error` |
| 4 | MED | `FileStorageError` (`services/storage/file_storage.py:21`, raised at `:65`, `:69`, `:158`) | 500 `internal_error` — S3/disk outages indistinguishable | Register handler → 503 `storage_unavailable` |
| 5 | MED | `DocumentConversionError` (`services/document/converter.py:18`) | Caught only in `upload.py:126`; uncaught paths → 500 | Register handler → 422 `document_conversion_failed` |

### B. Route-level external calls with no try/except

| # | Sev | Site | Today | Proposed fix |
| - | --- | ---- | ----- | ------------ |
| 6 | HIGH | `routes/ats/keywords.py:448` GET — `keyword_override_crud.get()` (Mongo) | Motor `OperationFailure`/`InvalidId` → 500 `internal_error` | Wrap in try/except, map `InvalidId` → 422, `OperationFailure` → 503 |
| 7 | HIGH | `routes/ats/keywords.py:577` PUT — `keyword_override_crud.upsert()` | Same as #6 — silent failure on save | Same wrap; explicit `pg.rollback()` if dual-DB |
| 8 | HIGH | `routes/resume_builds.py:259` — `diff_engine.generate_suggestions()` | AI errors → 500 `internal_error` | Wrap; map `AIServiceError` → 503 (or rely on #A handler once added) |
| 9 | HIGH | `routes/resume_builds.py:340` — `diff_engine.suggest_single_bullet()` | Same as #8 | Same wrap |
| 10 | MED | `routes/resumes.py:403` — `export_service.export_docx()` (PDF at `:384` already wrapped) | Malformed HTML crashes converter → 500 | Mirror the existing PDF try/except at `:394` |
| 11 | MED | `routes/ats/progressive.py:186` — `cache.get_ats_result()` inside SSE generator | Stale cache decode breaks SSE stream mid-flight (same root cause as `fc2071b`) | Wrap, treat decode error as cache miss, log + continue |
| 12 | MED | `routes/admin.py:351` — `apify_client.run_adhoc_scrape()` | HTTP failure → 500 (admin-only, lower blast radius) | Wrap, return 502 — or covered by A.3 once registered |

### C. Dual-DB transaction safety (CLAUDE.md rule #7)

| # | Sev | Site | Today | Proposed fix |
| - | --- | ---- | ----- | ------------ |
| 13 | HIGH | `routes/tailor.py:229` — `tailored_resume_crud.create(mongo, ...)` runs **after** `pg.commit()` at `:201` | If Mongo insert fails, AI usage is logged and billed but tailored doc never persists → orphan billing | Move `pg.commit()` to AFTER Mongo create succeeds; catch + `pg.rollback()` |
| 14 | MED | `routes/tailor.py:500` — Mongo `finalize()` after Postgres reads | Mongo failure leaves Postgres state inconsistent | Wrap finalize in try/except; explicit rollback |

### D. Misc

| # | Sev | Site | Today | Proposed fix |
| - | --- | ---- | ----- | ------------ |
| 15 | MED | `routes/auth.py:300` — `redis.setex()` for SSE ticket | Redis outage → 500 `internal_error`; user cannot auth SSE | Wrap, catch `RedisError`, return 503 `cache_unavailable` |

## Out of scope (intentionally not flagged)

- `AIServiceError` — already caught at the route level in `tailor.py:212` and bullet endpoints; a global handler would be defense-in-depth but isn't urgent.
- `TailoringValidationError` — handled at `tailor.py:203`.
- `RetryableError` / `NonRetryableError` — internal to scheduler, never reach a request handler.
- The new SSE cache-write at `progressive.py:341` — write failure is silent (no client impact), low priority.

## Verification (when fixes land)

For each registered handler, add a unit test in `backend/tests/test_main.py` that raises the exception inside a fake route and asserts the structured envelope (`status_code`, `error_code`, `error_id` present). For the dual-DB rollback fixes, add an integration test that injects a Mongo failure and asserts the Postgres row is absent after the request.

## Follow-up plans (to be scoped separately)

Each bucket above should land as its own plan + PR, not a single megadiff:

- `phase-1-register-domain-exception-handlers.md` — bucket A (5 handlers in `main.py`)
- `phase-2-route-external-call-hardening.md` — bucket B (7 routes)
- `phase-3-tailor-dual-db-rollback.md` — bucket C (rule #7 compliance)
- Auth SSE ticket Redis wrap — bundle into bucket A.4 PR once `FileStorageError` handler exists
