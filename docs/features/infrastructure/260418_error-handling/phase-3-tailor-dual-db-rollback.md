# Tailor Dual-DB Rollback

**Created:** 2026-04-22 (planned landing)
**Parent audit:** [`master-plan.md`](./master-plan.md) — bucket C (items 13, 14)
**Depends on:** none — parallel-safe with `phase-1-*` and `phase-2-*`
**Scope:** `backend/app/api/routes/tailor.py` (2 call sites)

## Context

CLAUDE.md rule #7 (Dual-Database Transaction Safety) requires Postgres to act as the source of truth and **only commit after MongoDB operations succeed**. Two sites in `routes/tailor.py` violate that rule:

1. `tailor.py:201` — `await pg.commit()` runs **before** the Mongo `tailored_resume_crud.create(...)` at `:229`. If the Mongo insert fails, the `ai_usage` log row is already persisted (and billed). The tailored document is never created. Result: orphaned billing, frustrated user, silent data inconsistency.
2. `tailor.py:500` — `tailored_resume_crud.finalize(...)` runs without try/except. A Mongo failure here bubbles to the catch-all 500 handler, with no explicit rollback of any prior Postgres work in the request.

Today the route under `POST /tailor` logs AI usage (billing-relevant) via `usage_tracker.log_generation(db=pg, ...)` at `:195`, then immediately commits. The Mongo insert at `:229` is the actual source of truth the user expects. Ordering is inverted.

## Goal

- Commit Postgres only **after** the Mongo write succeeds
- On Mongo failure, explicitly call `await pg.rollback()` and re-raise
- Preserve the existing route behavior for `TailoringValidationError` and `AIServiceError` (already handled at `:203-217`)

Non-goals:

- Adding global exception handlers (that is `phase-1-*`)
- Changing `usage_tracker.log_generation(...)` semantics
- Refactoring the tailoring service

## Current shape (as of commit `faa11a2`)

```python
# routes/tailor.py:180-229 — CURRENT (unsafe ordering)
ai_client = get_ai_client_for_model(model)
service = get_tailoring_service(ai_client=ai_client)
try:
    result = await service.tailor(...)

    # Log AI usage metrics
    if "ai_metrics" in result:
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=pg,
            user_id=current_user_id,
            endpoint="/tailor",
            response=result["ai_metrics"],
        )
        await pg.commit()            # <-- COMMITS BEFORE MONGO WRITE

except TailoringValidationError as e:
    raise HTTPException(422, detail={...})
except AIServiceError as e:
    raise HTTPException(503, detail=f"AI service error: {str(e)}")

# Save to MongoDB with complete tailored_data
create_data = MongoTailoredResumeCreate(...)
tailored = await tailored_resume_crud.create(mongo, obj_in=create_data)  # <-- IF THIS FAILS, AI USAGE IS ORPHANED
```

## Site 1 — reorder commit (`:180-229`)

Move `pg.commit()` to run **after** the Mongo `create(...)` succeeds. Wrap the Mongo call so a failure triggers `pg.rollback()`.

```python
# routes/tailor.py:180-229 — TARGET
ai_client = get_ai_client_for_model(model)
service = get_tailoring_service(ai_client=ai_client)
try:
    result = await service.tailor(...)

    # Log AI usage metrics (flush, not commit, until Mongo succeeds)
    if "ai_metrics" in result:
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=pg,
            user_id=current_user_id,
            endpoint="/tailor",
            response=result["ai_metrics"],
        )
        await pg.flush()             # keep the write pending; commit after Mongo

except TailoringValidationError as e:
    raise HTTPException(422, detail={...})
except AIServiceError as e:
    raise HTTPException(503, detail=f"AI service error: {str(e)}")

# Save to MongoDB with complete tailored_data (source of truth)
create_data = MongoTailoredResumeCreate(...)
try:
    tailored = await tailored_resume_crud.create(mongo, obj_in=create_data)
except Exception:
    await pg.rollback()              # Mongo failed → undo AI usage log
    raise                            # bubble to global handler in phase-1-*

await pg.commit()                    # both writes succeeded → persist billing
```

Key changes:

- `pg.commit()` at `:201` → `pg.flush()` (keeps the row pending but not durable)
- New try/except around the Mongo `create(...)` call
- `pg.commit()` moved to **after** Mongo success
- Bare `except Exception` is deliberate: Mongo driver failures, serialization errors, network timeouts, and `VersionConflictError` all should trigger rollback. The re-raise preserves the exception type for the global handler.

## Site 2 — wrap `finalize()` (`:498-506`)

Current shape at `:498-506`:

```python
# routes/tailor.py:498-506 — CURRENT
finalize_data = MongoTailoredResumeFinalize(finalized_data=request.finalized_data)
updated = await tailored_resume_crud.finalize(mongo, id=tailored_id, obj_in=finalize_data)

if not updated:
    raise HTTPException(500, detail="Failed to finalize tailored resume")
```

Target shape: wrap the call, rollback any pending PG work, re-raise.

```python
# routes/tailor.py:498-506 — TARGET
finalize_data = MongoTailoredResumeFinalize(finalized_data=request.finalized_data)
try:
    updated = await tailored_resume_crud.finalize(mongo, id=tailored_id, obj_in=finalize_data)
except Exception:
    await pg.rollback()              # no PG state should survive a failed finalize
    raise

if not updated:
    raise HTTPException(500, detail="Failed to finalize tailored resume")
```

Today the finalize endpoint does not appear to write to Postgres before this call (verify via a read of the full function body at `:440-510`). The defensive `pg.rollback()` is cheap — if nothing is pending, it's a no-op. Future edits that add a PG write before `finalize()` will be covered automatically.

## Tests

Add one integration test per site under `backend/tests/integration/` (or `backend/tests/api/` if that's where tailor tests live today — check before creating a new directory).

### Test 1 — Site 1 orphan-billing prevention

```python
# backend/tests/integration/test_tailor_dual_db.py
async def test_tailor_rollback_on_mongo_failure(
    authenticated_client, pg_session, mongo_db, monkeypatch,
):
    """If Mongo create fails, the ai_usage row must not be persisted."""
    from app.crud.mongo import tailored_resume as tr_crud

    # Count ai_usage rows before
    count_before = await pg_session.scalar(
        text("SELECT COUNT(*) FROM ai_usage WHERE user_id = :uid"),
        {"uid": TEST_USER_ID},
    )

    # Monkeypatch Mongo create to raise
    async def _fail(*args, **kwargs):
        raise RuntimeError("simulated mongo outage")
    monkeypatch.setattr(tr_crud, "create", _fail)

    resp = await authenticated_client.post("/tailor", json=VALID_TAILOR_PAYLOAD)
    assert resp.status_code == 500  # global handler maps RuntimeError → internal_error

    # Count ai_usage rows after — must be unchanged (rollback worked)
    count_after = await pg_session.scalar(
        text("SELECT COUNT(*) FROM ai_usage WHERE user_id = :uid"),
        {"uid": TEST_USER_ID},
    )
    assert count_after == count_before
```

### Test 2 — Site 2 finalize-failure rollback

Mirrors Test 1 but monkeypatches `tailored_resume_crud.finalize` to raise and asserts no PG state is persisted. If the finalize route does not write to Postgres today, the test can be lighter-weight (just assert the 500 is produced via the global handler and that `pg.rollback()` is called — use a mock session to verify).

## Verification

1. `cd backend && poetry run pytest tests/integration/test_tailor_dual_db.py -v`
2. Full suite: `poetry run pytest`
3. Manual: start backend, issue a `/tailor` request with Mongo stopped (`docker-compose stop mongodb`); confirm the response is a 5xx envelope and `SELECT COUNT(*) FROM ai_usage` is unchanged from baseline
4. CLAUDE.md rule #7 spot-check: no remaining `pg.commit()` that precedes a Mongo write in `tailor.py`

## Risks / gotchas

- **Billing double-decrement.** If `usage_tracker.log_generation(...)` internally decrements a quota counter in Redis (or similar cache) before the PG commit, a rollback leaves the cache out-of-sync. Re-read `app/services/ai/usage_tracker.py` before landing — if there's an auxiliary side-effect, either move it after the PG commit or add a compensating decrement in the rollback branch.
- **`pg.flush()` vs `pg.commit()`.** Flush sends the INSERT to the DB but does not release locks or end the transaction. Commit ends the transaction. Using flush here means the `ai_usage` row exists in the transaction's view but is not durable until commit. A subsequent read within the same session sees it; a separate connection does not. This matches the intent exactly.
- **Bare `except Exception`.** Deliberate (see Site 1 rationale). Do not narrow to `OperationFailure` — we want to catch every Mongo failure mode including serialization and network errors. The re-raise preserves type for the global handler.
- **No handler additions here.** Bucket A (`phase-1-*`) registers global handlers. Bucket C does not. Do not register new handlers in this PR.
- **Scope discipline.** If a third dual-DB site surfaces during implementation (e.g., another route found to have reversed ordering), open a separate ticket. Do not grow this PR.
- **Existing `AIServiceError` wrap stays.** `tailor.py:212-217` catches `AIServiceError` and raises 503 — that happens **before** any Mongo write, so it doesn't need rollback (no PG state is pending yet at that point in the flow). Leave it untouched.

## Files to modify

| File | Change |
| ---- | ------ |
| `backend/app/api/routes/tailor.py` | Reorder `:201` commit; wrap `:229` Mongo create; wrap `:500` finalize |
| `backend/tests/integration/test_tailor_dual_db.py` | New file — 2 tests (orphan-billing, finalize-rollback) |

## Completion checklist

- [ ] Site 1 reordered; `pg.commit()` runs only after Mongo success
- [ ] Site 1 Mongo create wrapped with `pg.rollback()` on failure
- [ ] Site 2 `finalize()` wrapped with `pg.rollback()` on failure
- [ ] Test 1 passes — ai_usage row absent after simulated Mongo failure
- [ ] Test 2 passes — finalize failure triggers rollback
- [ ] Full backend test suite green
- [ ] Manual test with `docker-compose stop mongodb` — no orphan billing
- [ ] `usage_tracker` audit confirmed no Redis/cache side-effects needing compensation
