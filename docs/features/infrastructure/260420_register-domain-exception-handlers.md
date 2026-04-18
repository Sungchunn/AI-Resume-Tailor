# Register Domain Exception Handlers

**Created:** 2026-04-20 (planned landing)
**Parent audit:** [`260418_backend-error-handling-audit.md`](./260418_backend-error-handling-audit.md) — bucket A (items 1–5) + bucket D (item 15)
**Scope:** `backend/app/main.py` + new `backend/tests/test_main.py`

## Context

Commit `fc2071b` added a catch-all `Exception` handler in `backend/app/main.py:121-141` that wraps every uncaught exception in a structured envelope (`{detail, error_id, error_code}`) with `error_code="internal_error"`. Nothing crashes silently anymore, but **clients cannot tell a real bug apart from a stale-write conflict, an auth/404, or an upstream outage** — all six collapse to `500 internal_error`.

The audit identified five unregistered domain exception classes (bucket A) and one Redis call site that should share the same treatment (bucket D). This plan registers global `@app.exception_handler(...)` blocks for all six, so every path that raises these — whether in a route, a service, or a CRUD helper — returns a typed envelope with the right HTTP status and a stable `error_code` the frontend can branch on.

No route code changes in this PR. Route-level hardening ships separately as `260421_route-external-call-hardening.md`.

## Goal

Register six net-new exception handlers in `backend/app/main.py`. Establish the handler test pattern in a new `backend/tests/test_main.py`. Zero route-code edits.

Non-goals:

- Refactoring the four existing handlers (`Exception`, `IntegrityError`, `OperationalError`, `SQLTimeoutError`)
- Introducing new exception classes (we register handlers for classes that already exist)
- Route-level try/except work (deferred to `260421_*`)

## Current state (handlers already registered)

| Handler | Status | `error_code` | Source |
| ------- | ------ | ------------ | ------ |
| `Exception` (catch-all) | 500 | `internal_error` | `main.py:121-141` |
| `IntegrityError` | 409 / 400 | `db_integrity` | `main.py:144-176` |
| `OperationalError` | 503 / 500 | `db_unavailable` / `db_operational` | `main.py:179-208` |
| `SQLTimeoutError` | 504 | `db_timeout` | `main.py:211-225` |

Helper to reuse: `_make_error_response(status_code, detail, error_code)` at `main.py:104-118`. It returns `(error_id, JSONResponse)` with `error_id = uuid.uuid4().hex[:12]`.

Logging precedent:

- `logger.warning` for 4xx (see `IntegrityError` at `main.py:170`)
- `logger.error` for 5xx (see `OperationalError` at `main.py:202`)
- Always log `error_id`, `request.method`, `request.url.path`, and the exception message

## Handlers to register

| # | Exception | Defined at | Status | `error_code` | Log level |
| - | --------- | ---------- | ------ | ------------ | --------- |
| H1 | `VersionConflictError` | `crud/mongo/exceptions.py:4` | 409 | `document_version_conflict` | `warning` |
| H2 | `IDResolutionError` | `api/utils/id_resolution.py:24` | 404 | `resource_not_found` | `warning` |
| H3 | `ApifyClientError` | `services/scraping/apify_client.py:24` | 502 | `external_api_error` | `error` |
| H4 | `FileStorageError` (base) | `services/storage/file_storage.py:21` | 503 | `storage_unavailable` | `error` |
| H5 | `DocumentConversionError` | `services/document/converter.py:18` | 422 | `document_conversion_failed` | `warning` |
| H6 | `RedisError` (base) | `redis.exceptions.RedisError` | 503 | `cache_unavailable` | `error` |

### H1 — `VersionConflictError` → 409 `document_version_conflict`

Raised when a Mongo document's `version` field does not match the expected value during an update (optimistic-concurrency check). The class carries `document_id` and `expected_version` attributes; surface both in the `detail` dict so clients can recover (e.g., refetch and retry).

- Raised at: `crud/mongo/resume.py:186`
- Shape: `detail = {"message": exc.message, "document_id": exc.document_id, "expected_version": exc.expected_version}`

### H2 — `IDResolutionError` → 404 `resource_not_found`

Raised when a public UUID cannot be resolved to an internal record OR the caller isn't authorized to access it. We fold auth-miss into 404 deliberately — exposing 403 would leak existence. Bare exception (no custom attributes); use `str(exc)` for `detail`.

- Raised at: `api/utils/id_resolution.py:131`, `api/utils/id_resolution.py:187`

### H3 — `ApifyClientError` → 502 `external_api_error`

Raised when the Apify scraping API returns a failure. Clearly an upstream outage — map to 502, not 500. Once this handler lands, the audit's item #12 (`admin.py:351` adhoc scrape) no longer needs a route-local wrap.

- Raised at: `services/scraping/apify_client.py:112`

### H4 — `FileStorageError` → 503 `storage_unavailable`

Base class for file-storage failures; `StorageFileNotFoundError` and `FileUploadError` are subclasses and are caught by the same handler. Map to 503 because the most common cause is S3/disk unavailability (transient). If a route needs `not-found` semantics specifically, it should catch `StorageFileNotFoundError` locally and raise `HTTPException(404)` — the global handler is the fallback.

- Raised at: `services/storage/file_storage.py:65`, `:69`, `:158`

### H5 — `DocumentConversionError` → 422 `document_conversion_failed`

Raised when a document can't be converted to HTML (corrupted file, unsupported format). 422 because it's typically caller-fixable (upload a different file). **Preserve the existing fallback at `routes/upload.py:126`** — that route catches `DocumentConversionError` and falls back to plain-text; the global handler only fires on uncaught paths (e.g., export flows).

- Raised at: multiple sites in `services/document/converter.py`

### H6 — `RedisError` → 503 `cache_unavailable`

Covers bucket D (audit item #15) — `routes/auth.py:300` calls `redis.setex()` for SSE tickets with no wrap. Rather than adding a route-local try/except, register the generic `redis.exceptions.RedisError` base so any Redis outage (connection, auth, timeout) returns a typed envelope. Use the base class, not `ConnectionError`, to catch `AuthenticationError`, `TimeoutError`, etc.

- Raised at: `routes/auth.py:300` (and anywhere else Redis is called directly)

## Implementation

### Step 1 — Imports

Add to the import block at `backend/app/main.py:1-13`:

```python
from redis.exceptions import RedisError

from app.api.utils.id_resolution import IDResolutionError
from app.crud.mongo.exceptions import VersionConflictError
from app.services.document.converter import DocumentConversionError
from app.services.scraping.apify_client import ApifyClientError
from app.services.storage.file_storage import FileStorageError
```

### Step 2 — Register handlers (append after line 225)

Follow the `OperationalError` template at `main.py:179-208` for 5xx handlers and the `IntegrityError` template at `main.py:144-176` for 4xx handlers. Each handler:

1. Calls `_make_error_response(...)`
2. Logs at the right level with `error_id`, `request.url.path`, and the exception
3. Returns the JSONResponse

Shape (illustrative, H1):

```python
@app.exception_handler(VersionConflictError)
async def version_conflict_handler(
    request: Request, exc: VersionConflictError
) -> JSONResponse:
    """Handle Mongo optimistic-concurrency conflicts."""
    error_id, response = _make_error_response(
        status_code=409,
        detail={
            "message": exc.message,
            "document_id": exc.document_id,
            "expected_version": exc.expected_version,
        },
        error_code="document_version_conflict",
    )
    logger.warning(
        "document_version_conflict error_id=%s path=%s document_id=%s",
        error_id,
        request.url.path,
        exc.document_id,
    )
    return response
```

Repeat the pattern for H2–H6, swapping:

- `status_code` and `error_code` per the table above
- `detail` shape: dict for H1 (carries attrs), `str(exc)` for H2/H3/H5, fixed string for H4/H6 (`"Storage temporarily unavailable"`, `"Cache temporarily unavailable"`)
- Log level (`warning` for H1/H2/H5, `error` for H3/H4/H6)

Place handlers in the order: H1, H2, H5 (4xx group) then H3, H4, H6 (5xx group). The grouping is cosmetic — FastAPI's handler lookup is by exact type, not order.

### Step 3 — Establish test pattern

No `backend/tests/test_main.py` exists today. Create one with this shape:

```python
# backend/tests/test_main.py
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.crud.mongo.exceptions import VersionConflictError
# ... import remaining five exceptions

def _build_test_app() -> FastAPI:
    """Build a FastAPI app with the same handlers as main.app plus raise-routes."""
    from app.main import app as real_app  # reuses registered handlers
    test_app = FastAPI()
    # copy exception_handlers over
    for exc_type, handler in real_app.exception_handlers.items():
        test_app.add_exception_handler(exc_type, handler)

    @test_app.get("/__raise/version_conflict")
    async def _raise_vc():
        raise VersionConflictError(document_id="abc", expected_version=3)

    # ... one raise-route per handler
    return test_app

@pytest.fixture
def client():
    return TestClient(_build_test_app())

def test_version_conflict_returns_409_envelope(client):
    resp = client.get("/__raise/version_conflict")
    assert resp.status_code == 409
    body = resp.json()
    assert body["error_code"] == "document_version_conflict"
    assert len(body["error_id"]) == 12
    assert body["detail"]["document_id"] == "abc"
    assert body["detail"]["expected_version"] == 3
```

One test per handler (H1–H6) plus one regression test asserting that unregistered exceptions still hit the catch-all and return `error_code="internal_error"` at 500.

Reuse pytest fixture plumbing from `backend/tests/conftest.py` if it provides a shared app/client — otherwise the `TestClient` usage above stands alone.

## Verification

1. Run the new suite: `cd backend && poetry run pytest tests/test_main.py -v` — seven tests pass (H1–H6 + catch-all regression)
2. `cd backend && poetry run pytest` — full suite still green; no existing tests regress
3. Manual smoke: start backend, `curl -X GET http://localhost:8000/job-listings/filter-options` and a few previously-500ing flows, confirm envelopes now carry semantic `error_code`s where applicable
4. Grep check: `grep -rn "raise HTTPException(status_code=500" backend/app/` returns only the 4xx-escalation or intentional-500 cases (no opaque mappings of the six registered types)

## Risks / gotchas

- **Dependency for bucket B:** Once H3 (`ApifyClientError`) lands, the audit's item #12 (`routes/admin.py:351`) no longer needs its own wrap. Bucket B plan (`260421_*`) will skip #12 if this PR is merged first.
- **`FileStorageError` base vs subclasses:** The base-class handler catches `StorageFileNotFoundError` and `FileUploadError` too (Python exception resolution). If a route wants 404-specific semantics for not-found, it must catch the subclass locally and raise `HTTPException(404)` before the global handler fires.
- **`DocumentConversionError` fallback preservation:** `routes/upload.py:126` has a route-local try/except that falls back to plain-text on conversion failure. That still wins — the global handler fires only when the exception bubbles past the route. **Do not touch `upload.py` in this PR.**
- **`RedisError` scope:** `redis.exceptions.RedisError` is the base of all `redis-py` exceptions. Catching the base means the handler fires for Redis decode errors too; that's intentional — audit item #11 (SSE progressive) is route-level because it needs to continue the stream, not abort.
- **Catch-all ordering:** FastAPI picks the most-specific handler; none of these six subclass `Exception` at a level that matters (all inherit directly from `Exception` or from a sibling like `RedisError`). No ordering concerns.

## Files to modify

| File | Change |
| ---- | ------ |
| `backend/app/main.py` | Add 5 imports + 6 `@app.exception_handler` blocks after `:225` |
| `backend/tests/test_main.py` | New file — 7 tests (6 handlers + catch-all regression) |

## Completion checklist

- [ ] 6 handlers registered in `main.py`
- [ ] 5 new imports added
- [ ] `backend/tests/test_main.py` created with 7 tests passing
- [ ] Full backend test suite green
- [ ] Manual smoke test: at least one known-failing site now returns semantic `error_code`
- [ ] `grep` check for opaque 500s clean
