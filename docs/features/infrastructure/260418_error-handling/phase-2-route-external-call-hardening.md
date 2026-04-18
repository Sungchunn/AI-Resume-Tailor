# Route-Level External Call Hardening

**Created:** 2026-04-21 (planned landing)
**Parent audit:** [`master-plan.md`](./master-plan.md) — bucket B (items 6–12)
**Depends on:** [`phase-1-register-domain-exception-handlers.md`](./phase-1-register-domain-exception-handlers.md) must land first
**Scope:** 6 route files; no service-layer changes

## Context

Bucket A (`phase-1-*`) registers global handlers for 6 domain exception classes. That covers most cases where a service raises a typed exception. It does **not** cover:

1. **Driver-level errors from Motor/PyMongo** (`InvalidId`, `OperationFailure`) — these aren't domain classes; they need route-local mapping to HTTP status
2. **AI service errors in non-tailor routes** — `AIServiceError` is intentionally kept route-local (see audit's "out of scope" note)
3. **Errors that must not abort an SSE stream** — the progressive ATS endpoint yields events; a decode error mid-stream must be swallowed and treated as a cache miss, not returned as an error envelope
4. **Errors from third-party libraries with bare exception hierarchies** — e.g., WeasyPrint `RuntimeError`, python-docx conversion errors

This plan wraps 6 specific sites with try/except that maps driver/third-party errors to `HTTPException`, mirroring existing patterns at `routes/tailor.py:212` (`AIServiceError → 503`) and `routes/resumes.py:382-399` (PDF export → 500).

Audit item #12 (`routes/admin.py:351`) is **not** in scope — it becomes redundant once `phase-1-*` registers `ApifyClientError` handler H3. Skip it in this PR.

## Goal

Add try/except around 6 external-call sites, each mapping driver-level exceptions to `HTTPException` with semantic `detail` and status. No decorator/helper abstraction yet — site-specific mappings differ enough that a shared wrapper would hide intent.

Non-goals:

- Re-catching domain exceptions already handled globally by `phase-1-*` (would double-handle)
- Refactoring the SSE generator structure in `progressive.py`
- Moving `admin.py:351` (deletable work; skipped here)

## Sites to harden

| # | File | Line | Call | Map to | `error_code` | Notes |
| - | ---- | ---- | ---- | ------ | ------------ | ----- |
| S1 | `routes/ats/progressive.py` | 186 | `cache.get_ats_result(...)` (inside SSE gen) | swallow + log, continue as cache miss | n/a (no envelope) | audit #11; same root cause as `fc2071b` |
| S2 | `routes/ats/progressive.py` | 341 | `cache.set_ats_result(...)` (inside SSE gen) | swallow + log, continue | n/a | not in audit but same pattern — write failure is silent-safe |
| S3 | `routes/ats/keywords.py` | 448 | `keyword_override_crud.get(...)` | `InvalidId → 422`, `OperationFailure → 503` | `invalid_id` / `mongo_unavailable` | audit #6 |
| S4 | `routes/ats/keywords.py` | 577 | `keyword_override_crud.upsert(...)` | same as S3 + dual-DB rollback | same | audit #7 |
| S5 | `routes/resume_builds.py` | 259 | `diff_engine.generate_suggestions(...)` | `AIServiceError → 503` | `ai_unavailable` | audit #8 |
| S6 | `routes/resume_builds.py` | 340 | `diff_engine.suggest_single_bullet(...)` | `AIServiceError → 503` | `ai_unavailable` | audit #9 |
| S7 | `routes/resumes.py` | 403 | `export_service.export_docx(...)` | mirror PDF try/except at `:383-399` | same shape as PDF handler | audit #10 |

Audit item #12 (`admin.py:351`) is **skipped** — covered by `ApifyClientError` handler in `phase-1-*`.

## Precedents to mirror

- `routes/tailor.py:212-217` — `AIServiceError → 503` with `detail=f"AI service error: {str(e)}"`. Use verbatim for S5, S6.
- `routes/resumes.py:382-399` — PDF export try/except on `RuntimeError`. Mirror for S7 DOCX.
- `routes/upload.py:126` — fallback-on-exception pattern (returns a degraded result instead of raising). Model for S1 "treat decode error as cache miss."

## Prerequisite: module-level loggers

The code snippets below reference `logger.warning(...)` / `logger.error(...)`. As of commit `d0151cd`, neither `routes/ats/progressive.py` nor `routes/ats/keywords.py` defines a module-level logger. Add these to the top of each affected file before the main edits:

```python
# progressive.py and keywords.py (top of file)
import logging

logger = logging.getLogger(__name__)
```

`resume_builds.py` and `resumes.py` do not need a logger for the snippets here (S5/S6/S7 don't log), but adding one is cheap if the route will gain log statements later.

## Implementation

### Step 1 — S1 and S2 (progressive SSE cache)

The SSE generator at `progressive.py` yields events to the client. If `cache.get_ats_result()` raises mid-stream, re-raising breaks the stream — the client sees a dropped connection, not a typed error. Treat a cache failure as a cache miss and continue to the full analysis path.

```python
# S1 — routes/ats/progressive.py:186
try:
    cached_result = (
        None
        if force_refresh
        else await cache.get_ats_result(resume_content_hash, effective_job_id)
    )
except Exception as exc:
    logger.warning(
        "ats_cache_get_failed resume_hash=%s job=%s error=%s",
        resume_content_hash, effective_job_id, exc,
    )
    cached_result = None
```

S2 (`:341` set) gets the same treatment — a write failure is already silent-safe (the audit calls this out as low priority), but we add the same try/except for symmetry and to avoid future reintroduction of the bug.

Use a broad `Exception` here deliberately — the cache decode bug in `fc2071b` was a `TypeError`, not a Redis exception. We want to catch any cache-layer failure and downgrade it.

### Step 2 — S3 and S4 (keywords Mongo)

Both sites call Mongo through `keyword_override_crud`. The crud layer can raise `bson.errors.InvalidId` (bad 24-char hex) or `pymongo.errors.OperationFailure` (driver/server). Map each to an HTTP status.

```python
# S3 — routes/ats/keywords.py:448
from bson.errors import InvalidId
from pymongo.errors import OperationFailure

try:
    override = await keyword_override_crud.get(
        mongo_db,
        user_id=user_id,
        job_listing_id=job_listing_id,
        job_id=job_id,
    )
except InvalidId as exc:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid ID format: {exc}",
    )
except OperationFailure as exc:
    logger.error("mongo_operation_failed path=%s error=%s", request.url.path, exc)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Document store temporarily unavailable",
    )
```

S4 is the same wrap around `keyword_override_crud.upsert(...)` at `:577`. **Dual-DB note:** if the route also writes Postgres before the Mongo upsert, wrap Postgres work in its own try/flush and call `await pg.rollback()` in the `except OperationFailure` block. Today the route does not appear to have a preceding PG write, but re-verify before landing (spot-check the function body for any `pg.add(...)` / `pg.flush()` calls above line 577).

### Step 3 — S5 and S6 (resume_builds AI)

Mirror `tailor.py:212-217` verbatim:

```python
# S5 — routes/resume_builds.py:259
try:
    result, ai_response = await diff_engine.generate_suggestions(
        workshop=resume_build,
        job_description=resume_build.get("job_description", ""),
        available_blocks=[],
        max_suggestions=suggest_in.max_suggestions,
        focus_sections=suggest_in.focus_sections,
        return_metrics=True,
    )
except AIServiceError as exc:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"AI service error: {str(exc)}",
    )
```

S6 at `:340` is the same wrap around `diff_engine.suggest_single_bullet(...)`.

### Step 4 — S7 (resumes DOCX export)

Mirror the PDF wrap at `resumes.py:383-399`:

```python
# S7 — routes/resumes.py:403
else:  # docx
    try:
        content = await export_service.export_docx(
            html_content=html_content,
            template=export_in.template,
            font_family=export_in.font_family,
            font_size=export_in.font_size,
            margin_top=export_in.margin_top,
            margin_bottom=export_in.margin_bottom,
            margin_left=export_in.margin_left,
            margin_right=export_in.margin_right,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    extension = "docx"
```

If `export_docx` raises a more specific exception than `RuntimeError` (e.g., a custom class from the docx library), catch that instead. Check the service implementation at `backend/app/services/export/html_to_document.py:674` (the concrete `export_docx` method; the factory `get_html_export_service()` at `:707` returns this service) before finalizing — use the narrowest type that makes sense. `DocumentConversionError` from the upload converter is a **different class** and is already covered by H5 in `phase-1-*`; don't conflate them.

## Implementation order

Ship within a single PR, but stage commits in this order for reviewability:

1. S1, S2 — progressive SSE (same root cause as `fc2071b`; highest impact)
2. S3, S4 — keywords (Mongo pattern; sets the InvalidId/OperationFailure template)
3. S5, S6 — resume_builds (AIServiceError; trivial mirror of tailor.py)
4. S7 — DOCX export (mirror of existing PDF handler)

## Tests

Extend existing route-test files — do not create new ones. One failure-injection test per site, asserting the response shape (status + `error_code` or, for SSE, that the stream continues and emits a cache-miss event).

| Site | Test file | Pattern |
| ---- | --------- | ------- |
| S1, S2 | `backend/tests/api/test_ats_progressive.py` (extend or create) | `TestClient.stream()`; monkeypatch `cache.get_ats_result` to raise; assert stream produces `stage_start` events (cache miss path) |
| S3, S4 | `backend/tests/api/test_keywords.py` (extend) | monkeypatch `keyword_override_crud.get`/`upsert` to raise `InvalidId` / `OperationFailure`; assert 422 / 503 |
| S5, S6 | `backend/tests/api/test_resume_builds.py` (extend) | monkeypatch `diff_engine.generate_suggestions`/`suggest_single_bullet` to raise `AIServiceError`; assert 503 with `detail` prefix |
| S7 | `backend/tests/api/test_resumes_export.py` (extend) | monkeypatch `export_service.export_docx` to raise `RuntimeError("weasyprint missing")`; assert 500 with message |

Reuse `backend/tests/conftest.py` fixtures for authenticated client and mongo/pg sessions.

## Verification

1. `cd backend && poetry run pytest tests/api/ -v` — all existing + new tests pass
2. Full suite: `poetry run pytest`
3. Manual: trigger each failure mode against a running backend (e.g., stop Mongo to test S3/S4; corrupt Redis cache entry to test S1)
4. SSE verification: use `curl -N` on `/ats/progressive/stream` with `force_refresh=false` after poisoning the cache entry — stream must complete with fresh results, not terminate

## Risks / gotchas

- **S1/S2 must NOT re-raise.** The SSE generator swallows cache failures; the client never sees an error envelope for this path. That is intentional. Do not "improve" this to return an HTTP error — it would break the client's stream-handling code.
- **S4 dual-DB check:** Re-read `keywords.py:550-580` for any Postgres write before the Mongo upsert. If one exists, the `except` block must call `await pg.rollback()`. Bucket C (`phase-3-*`) handles a separate tailor.py case and does not cover this file.
- **Skip #12 (`admin.py:351`).** Covered by `ApifyClientError` handler H3 in `phase-1-*`. Adding a wrap here would double-handle. If `phase-1-*` hasn't merged yet, land that first.
- **S7 exception type:** Check `services/export/html_export.py` — if `export_docx` raises a specific class, narrow the catch. `except Exception` is too broad and would mask unrelated bugs.
- **Don't add a decorator yet.** With 7 sites and 4 different failure-to-status mappings, a shared wrapper would either be too generic (loses intent) or too specific (same LOC as inline). Revisit at 15+ sites.
- **AIServiceError global handler:** Audit's "out of scope" note says a global handler for `AIServiceError` would be defense-in-depth but not urgent. If a future plan registers one, S5/S6 wraps can be deleted.

## Files to modify

| File | Change |
| ---- | ------ |
| `backend/app/api/routes/ats/progressive.py` | Wrap lines 186 (S1) and 341 (S2) |
| `backend/app/api/routes/ats/keywords.py` | Wrap lines 448 (S3) and 577 (S4); add `bson`/`pymongo` imports |
| `backend/app/api/routes/resume_builds.py` | Wrap lines 259 (S5) and 340 (S6) |
| `backend/app/api/routes/resumes.py` | Wrap line 403 (S7); mirror `:383-399` shape |
| `backend/tests/api/test_ats_progressive.py` | Add S1/S2 failure-injection tests |
| `backend/tests/api/test_keywords.py` | Add S3/S4 tests |
| `backend/tests/api/test_resume_builds.py` | Add S5/S6 tests |
| `backend/tests/api/test_resumes_export.py` | Add S7 test |

## Completion checklist

- [ ] `phase-1-*` merged (dependency)
- [ ] S1–S7 wrapped in try/except with correct mapping
- [ ] 7 failure-injection tests added, all pass
- [ ] Full backend test suite green
- [ ] Manual SSE test: poisoned cache entry does not terminate stream
- [ ] `admin.py:351` (audit #12) intentionally left unwrapped (covered by H3)
