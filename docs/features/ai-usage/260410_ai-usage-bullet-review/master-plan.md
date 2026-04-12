# AI Usage Tracking: Bullet Review Endpoints

## Context

The AI bullet review feature (090426) was implemented across phases 1-5 but its two endpoints in `resume_builds.py` never log AI usage to the `AIUsageLog` table. The existing admin dashboard at `/admin/ai-usage` auto-discovers endpoints from that table, so **no frontend changes are needed** — only backend logging needs to be wired up.

The `analyze-bullets` endpoint in `tailor.py` already has tracking and serves as the reference pattern.

## Changes

### File 1: `backend/app/services/job/diff/engine.py`

Thread `return_metrics` through the DiffEngine facade. Both methods already support it in `SuggestionGenerator` — the facade just doesn't expose it.

- **`generate_suggestions()`** — add `return_metrics: bool = False` param, update return type to `dict[str, Any] | tuple[dict[str, Any], AIResponse | None]`, pass through to `self._suggestions.generate_suggestions()`
- **`suggest_single_bullet()`** — same pattern
- Add import: `from app.services.ai.response import AIResponse`

### File 2: `backend/app/api/routes/resume_builds.py`

Add AI usage logging to both endpoints.

- Add import: `from app.services.ai import get_usage_tracker`

**`generate_suggestions()` endpoint (line 227):**

- Call `diff_engine.generate_suggestions(..., return_metrics=True)` and destructure as `result, ai_response`
- After the existing conditional commit, log usage and commit:

```python
if ai_response:
    await usage_tracker.log_generation(
        db=db, user_id=current_user_id,
        endpoint=f"/resume-builds/{resume_build_id}/suggest",
        response=ai_response,
    )
    await db.commit()
```

**`suggest_bullet()` endpoint (line 287):**

- Call `diff_engine.suggest_single_bullet(..., return_metrics=True)` and destructure as `result, ai_response`
- Before the return, log usage (with `None` guard since short bullets skip the AI call):

```python
if ai_response:
    await usage_tracker.log_generation(
        db=db, user_id=current_user_id,
        endpoint=f"/resume-builds/{resume_build_id}/suggest-bullet",
        response=ai_response,
    )
    await db.commit()
```

## Key Files

| File | Role |
| ----- | ----- |
| `backend/app/services/job/diff/engine.py` | DiffEngine facade (modify) |
| `backend/app/api/routes/resume_builds.py` | Endpoint handlers (modify) |
| `backend/app/services/job/diff/suggestions.py` | Already supports `return_metrics` (no changes) |
| `backend/app/services/ai/usage_tracker.py` | Existing tracker (no changes) |
| `backend/app/api/routes/tailor.py:706-789` | Reference implementation (no changes) |

## Verification

1. Start backend: `poetry run uvicorn app.main:app --reload`
2. Hit `POST /resume-builds/{id}/suggest-bullet` with a valid bullet
3. Hit `POST /resume-builds/{id}/suggest` with a valid resume build
4. Query `ai_usage_log` table — new rows should appear with the correct endpoint strings
5. Visit `/admin/ai-usage` dashboard — new endpoints should show in the "by endpoint" breakdown
