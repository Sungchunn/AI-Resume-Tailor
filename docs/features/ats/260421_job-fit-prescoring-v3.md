# Job Fit Pre-Scoring v3 — Compact Bar + Square-Root Curve

## Context

v2 (`260421_job-fit-prescoring-v2.md`) shipped earlier today with a semi-circle gauge in the top-right of each card and a capped-denominator linear score (N=12, 20–100 display skew). Two issues in practice:

1. **Cards got taller.** The gauge (48px) stacked above the save/hide buttons made every row noticeably thicker. Triaging a list of 20 jobs now takes more scrolling.
2. **Scores still feel low.** Linear `overlap/N` on real data lands most jobs in the 40–60 range even after the 20-100 skew. A resume that clearly matches a role reads as a B-minus.

v3 addresses both: the gauge becomes a compact horizontal bar inline with the title, and the raw score uses a square-root curve that naturally lifts mid-range matches without losing monotonicity.

## Decisions

| Area | v2 | v3 |
| ---- | --- | --- |
| Card visual | 48px SVG semi-circle stacked above save/hide (top-right column) | Slim horizontal bar (~16px tall) + number inline with the title, left of the save/hide buttons |
| Detail-page visual | Large gauge (size="lg") in header | Same compact bar, scaled up (size="lg" = wider and taller but still a bar) |
| Table view | Compact badge with mini-arc glyph | Unchanged from v2 |
| Score math | `raw = min(overlap, N) / min(N, len_job_kws) * 100`, N=12 | `raw = round(sqrt(min(overlap, N) / min(N, len_job_kws)) * 100)`, N=10 |
| Display skew | `display = round(20 + raw * 0.8)` | Removed. `display = raw` (the sqrt curve already reads generously) |
| Tier thresholds (on display) | 75 / 55 | 75 / 55 (unchanged) |

## Math spec

```python
TOP_N = 10


def compute_raw_score(resume_keywords: set[str], job_keywords: set[str]) -> int:
    denom = min(TOP_N, len(job_keywords))
    if denom == 0:
        return 0
    overlap = len(resume_keywords & job_keywords)
    ratio = min(overlap, denom) / denom  # 0.0 .. 1.0
    return round(math.sqrt(ratio) * 100)
```

Sample outputs on a 30-keyword JD (denom=10):

| Overlap | Ratio | v2 raw | v2 display | v3 raw = display |
| ------- | ----- | ------ | ---------- | ---------------- |
| 1 | 0.10 | 8 | 26 | 32 |
| 3 | 0.30 | 25 | 40 | 55 |
| 5 | 0.50 | 42 | 54 | 71 |
| 8 | 0.80 | 67 | 74 | 89 |
| 10+ | 1.00 | 100 | 100 | 100 |

Properties kept: monotonic (higher overlap → higher score), bounded (0–100), deterministic, no AI. Ceiling is still real — matching TOP_N=10 JD keywords is achievable for a well-aligned resume.

Frontend:

```ts
// No skew. Raw is already the display score.
const displayScore = Math.round(rawScore);
```

## Implementation plan

### Phase 0 — Write and commit this doc

This file is Phase 0. Commit as `docs: add job-fit pre-scoring v3 plan (compact bar + sqrt curve)` before touching code.

### Phase 1 — Backend

1. `backend/app/services/fit_scoring/scorer.py`:
   - Change `TOP_N` from 12 to 10.
   - Rewrite `compute_raw_score` to use `math.sqrt`. Import `math` at top.
2. Existing tests in `backend/tests/services/test_fit_scoring.py` need updating — recalibrate expected values for sqrt curve. Keep coverage on: empty JD, short-JD full match, long-JD cap, overflow cap, partial match, zero overlap.

### Phase 2 — Frontend

3. `frontend/src/components/jobs/FitScoreGauge.tsx`: rewrite as a horizontal bar. Props stay the same (`rawScore`, `isStale`, `size`, `className`). Render:
   - A pill-shaped track (gray) with a tier-colored fill, width proportional to `displayScore / 100`.
   - The number next to the bar (right side), same tier color.
   - A small "MATCH" label or an accessible `aria-label`.
   - Sizes: `md` ≈ 72px wide × 6px tall bar + number, `lg` ≈ 140px wide × 8px tall bar + larger number.
   - Remove the 20–100 display skew — use `rawScore` directly.
4. `frontend/src/components/jobs/FitScoreBadge.tsx`: remove the skew so table view matches the gauge numerically. Keep the mini-arc glyph + compact styling.
5. `frontend/src/components/jobs/JobListingCard.tsx`: restore the previous layout where save/hide sit far right. Put the bar inline with the title on the right, before the action buttons — something like `[title ... bar+number] [save][hide]`. The gauge no longer occupies its own column, so vertical height matches pre-v2.
6. `frontend/src/app/(protected)/jobs/[id]/page.tsx`: keep `FitScoreGauge size="lg"` — it's a bar now, so the header stays compact.

### Phase 3 — Docs

7. Update `docs/api/job-listings.md` fit-score note: reference v3 doc, document sqrt curve + N=10, remove display-skew note.
8. Add a "Superseded-by" pointer at the top of `260421_job-fit-prescoring-v2.md`.

## Critical files

| File | Change |
| ---- | ------ |
| `backend/app/services/fit_scoring/scorer.py` | N=10, sqrt curve |
| `backend/tests/services/test_fit_scoring.py` | Recalibrate expected values |
| `frontend/src/components/jobs/FitScoreGauge.tsx` | Rewrite as horizontal bar |
| `frontend/src/components/jobs/FitScoreBadge.tsx` | Drop display skew |
| `frontend/src/components/jobs/JobListingCard.tsx` | Bar inline with title, save/hide back to far right |
| `frontend/src/app/(protected)/jobs/[id]/page.tsx` | No structural change; gauge is smaller now |
| `docs/api/job-listings.md` | Note v3 math |
| `docs/features/ats/260421_job-fit-prescoring-v2.md` | Superseded-by pointer |

## Verification

1. Backend: `poetry run pytest tests/services/test_fit_scoring.py` — all 6 tests pass with recalibrated expected values.
2. Admin trigger: after deploy, `POST /api/v1/admin/fit-scoring/run`. Spot-check that scores visibly rose (a job that was 54 before should now land in the high 60s or 70s if it had ~4 matches out of 10–15 keywords).
3. Frontend: `/jobs` card rows should be the same height as pre-v2. Bar + number sits between title and save/hide buttons. Sort-by-Fit Score works unchanged.
4. Detail page: header still shows the score prominently (bar + number).
5. Dark mode: bar track and fill remain visible against zinc-800 card backgrounds.

## Out of scope

- Changing keyword extraction (still deterministic; no re-extraction needed).
- Weighted keyword importance (still future work, tracked in 260420 plan).
- Min-score filter (still deferred).
