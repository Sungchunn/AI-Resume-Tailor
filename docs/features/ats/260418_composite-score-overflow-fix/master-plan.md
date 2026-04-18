# ATS Composite Score Overflow Fix

## Context

Production bug on `/tailor/analyze`: SSE stream aborted with "Connection lost. Please try again." Real error hidden behind the SSE close:

```text
ValidationError for ATSCompositeScore
final_score: Input should be less than or equal to 100
input_value=100.1
```

A `keyword_score` slightly above 100 (e.g., 100.25) cascades into the composite:

```text
15.0 + (100.25 × 0.40) + 25.0 + 20.0 = 100.1  → fails le=100
```

## Root Cause

**File:** `backend/app/services/job/ats/analyzers/keyword/analyzer.py`

The `keyword_score` ratio has mismatched bounds:

| Operand | Definition | Per-keyword max |
| ------- | ---------- | --------------- |
| Numerator (`total_weighted_score`) | Additive scoring in `scorer.py:148-` | **5.25** (per `MAX_KEYWORD_SCORE`) |
| Denominator (`max_possible_score`) | Sum of `importance_weight` (line 410) | **2.0** |

`keyword_score = numerator / denominator × 100` can theoretically reach **262.5**.

The `MAX_KEYWORD_SCORE = 5.25` constant in `scorer.py:145` was defined for normalization but never imported into `analyzer.py` — a refactor-drift bug.

## Decision

**Fix the math.** Use `MAX_KEYWORD_SCORE` as the per-keyword denominator. Scores shift downward ~2-3× across all users, so cache invalidation (backend + frontend) is mandatory.

## Changes

### 1. Fix keyword denominator

**File:** `backend/app/services/job/ats/analyzers/keyword/analyzer.py`

- Add import: `from .scorer import MAX_KEYWORD_SCORE`
- Line 410: `max_possible_score += importance_weight` → `max_possible_score += MAX_KEYWORD_SCORE`

`importance_weight` is still used for per-keyword reporting/detail; only the denominator changes.

### 2. Defensive clamp at composite boundary

**File:** `backend/app/api/routes/ats/helpers.py` (lines 171-178)

Collect raw value, then clamp to `[0, 100]` before inserting into `scores`:

```python
if stage_key == "structure":
    raw = float(result.format_score)
elif stage_key == "keywords-enhanced":
    raw = float(result.keyword_score)
elif stage_key == "content-quality":
    raw = float(result.content_quality_score)
elif stage_key == "role-proximity":
    raw = float(result.role_proximity_score)
scores[stage_key] = max(0.0, min(raw, 100.0))
```

Single boundary-check line; protects composite against any future analyzer drift.

### 3. Tighten `format_score` schema

**File:** `backend/app/schemas/ats/structure.py:40`

```python
format_score: int = Field(..., ge=0, le=100, description="...")
```

Closes a latent gap — `format_score` is declared `int` with no explicit upper bound today.

### 4. Cache invalidation (backend)

**File:** `backend/app/services/core/cache.py:80-90`

Change `_make_ats_key` from `ats:{hash}:{job_id}` to `ats:v2:{hash}:{job_id}`. Old keys become orphans and expire via their 24h TTL.

### 5. Cache invalidation (frontend)

**File:** `frontend/src/lib/stores/atsProgressStore.ts:172-181`

Add `version: 2` to the Zustand `persist` config. The middleware wipes localStorage on version mismatch — no migrate function needed; we want the old inflated data discarded.

### 6. UI score-threshold audit

**Status:** Deferred to follow-up. Audit findings below.

Thresholds consuming composite `final_score` or stage scores (affected by our fix):

| File | Lines | Threshold pattern |
| ---- | ----- | ----------------- |
| `components/tailoring/ATSProgressStepper.tsx` | 294-301 | `finalScore >= 80` (green), `>= 60` (amber) |
| `components/workshop/WorkshopControlPanel.tsx` | 76-78 | `final_score >= 80` / `>= 60` |
| `components/workshop/wizard/steps/ReviewStep.tsx` | 152-175 | `finalScore >= 80` / `>= 60` |
| `components/workshop/panels/ats/ATSScoreSummary.tsx` | 27-28, 107-108 | `score >= 80` / `>= 60` |
| `components/workshop/panels/ats/StageScoreBar.tsx` | 21-22 | `score >= 80` / `>= 60` |
| `components/workshop/ScoreGauge.tsx` | 22-37, 149-151 | `score >= 85` / `>= 70` |
| `components/editor/ATSKeywordsPanel.tsx` | 53, 59 | `percentage >= 70` |

Thresholds consuming `match_score` (from `/tailor/quick-match` — different scoring system, NOT affected):

- `components/tailoring/VersionHistoryPanel.tsx`, `VersionHistorySidebar.tsx`
- `components/editor/EditorLayout.tsx`
- `components/workshop/MatchScoreGauge.tsx`, `MatchScoreBadge.tsx`, `wizard/steps/DifferenceStep.tsx`
- `app/(protected)/tailor/page.tsx`

**Rationale for deferring:**

- Numeric bounds are still `[0, 100]` — no type-level breakage.
- The rescaling makes "excellent match" (>=80) legitimately rarer, which is arguably more honest.
- Recalibrating without real distribution data is speculative. Better to ship, observe scores from real resumes over ~1 week, then tune bands with evidence.

**Follow-up:** separate ticket once ~20-30 real post-fix scores are collected. Decision needed on whether to recalibrate thresholds (e.g., 60/40 split) or keep the current 80/60 split and let scores redistribute naturally.

### 7. Regression tests

**Append:** `backend/tests/services/ats/test_keywords.py`

```python
async def test_keyword_score_never_exceeds_100(self, ...):
    # Mock AI returns required-tier keywords; fixture resume matches in
    # skills + experience (exercises cross-section bonus + placement + density).
    # Assert result.keyword_score <= 100.0
```

**New:** `backend/tests/api/test_ats_helpers.py`

```python
def test_composite_clamps_out_of_bound_stage():
    # stage_results with keyword_score=105.0; assert calculate_composite_score
    # returns with final_score <= 100 and no ValidationError.
```

## Critical Files

| File | Change |
| ---- | ------ |
| `backend/app/services/job/ats/analyzers/keyword/analyzer.py` | Import `MAX_KEYWORD_SCORE`; fix line 410 |
| `backend/app/api/routes/ats/helpers.py` | Clamp at stage ingest (171-178) |
| `backend/app/schemas/ats/structure.py` | Add `ge=0, le=100` at line 40 |
| `backend/app/services/core/cache.py` | Bump key to `ats:v2:...` (line 90) |
| `frontend/src/lib/stores/atsProgressStore.ts` | Add `version: 2` (line 172-181) |
| `frontend/src/components/ats/**` | Audit + recalibrate score thresholds |
| `backend/tests/services/ats/test_keywords.py` | Regression test |
| `backend/tests/api/test_ats_helpers.py` | New test file |

## Verification

1. **Unit tests:** `cd backend && poetry run pytest tests/services/ats/test_keywords.py tests/api/test_ats_helpers.py tests/api/test_ats_api.py -v`. New tests pass; no regressions.
2. **Local repro:** `docker-compose up -d`, navigate to `/tailor/analyze?resume_id=...&job_listing_id=7946` (the failing pair). Analysis completes without error.
3. **Score distribution spot-check:** analyze 3-5 resume/job pairs; note new composite score ranges. Use to calibrate UI thresholds.
4. **Cache behavior:** verify first-time analysis caches under `ats:v2:*` in Redis; localStorage wipes on next frontend load after version bump.
5. **Post-deploy monitoring:** 24h observation for any residual `ATSCompositeScore` validation errors in logs.

## Out of Scope

- **Better SSE error surfacing** (the "Connection lost" message) — independent UX improvement. The root-cause fix means this error path is no longer hit.
- **Structured warning logging on clamp** — math fix + defensive clamp is deterministic; add observability later only if regressions appear.
