# Job Fit Pre-Scoring v2 — Capped Denominator + Gauge UI

## Context

The daily pre-scoring batch shipped on 260420 (see `260420_job-fit-prescoring/master-plan.md`). Three problems surfaced in use:

1. **Denominator punishes long JDs.** `raw = overlap / len(job_keywords) * 100` — a JD with 40 keywords needs 20 matches to hit 50, while a 10-keyword JD only needs 5. Same resume, very different score.
2. **Display skew hides reality.** The frontend does `40 + raw * 0.55` so the lowest score anyone sees is 40%. A weak match (raw 5 → display 43) looks nearly identical to a decent match (raw 30 → display 57). Users can't tell them apart.
3. **Score isn't a decision signal.** The pill is one chip among many in the meta row. Users ignore it because nothing says "this should drive your choice."

This refinement makes the score the headline of each card, gives it honest math with a defined ceiling, and lets users sort by it.

## Decisions

| Area | Decision |
| ---- | -------- |
| Algorithm | Cap denominator at top-N (N=12). `denom = min(12, len(job_kws))`, `raw = min(overlap, denom) / denom * 100`. Ceiling of 100 is realistic (matching 12 JD keywords). |
| Display skew | Softer floor: `display = round(20 + raw * 0.8)`. Range is 20–100. Floor prevents demoralizing single-digits; bad matches still look visibly bad (20–35 range). |
| Prominence | Semi-circle speedometer gauge (SVG arc, number inside) in the top-right corner of each job card + detail page header. Table view uses a compact inline mini-arc glyph + number. |
| Sort/Filter scope | Sort only — add "Fit Score" to existing sort dropdown. No min-score filter yet. |

## Math spec

Backend (`scorer.py`):

```python
TOP_N = 12
denom = min(TOP_N, len(job_keywords))
if denom == 0:
    continue  # existing skip-no-job-kws path
overlap = len(resume_keywords & job_keywords)
raw_score = round(min(overlap, denom) / denom * 100)  # 0..100
```

Properties:

- A JD with fewer than 12 keywords is scored against its own keyword count (so a 5-keyword JD maxes at 5 matches = 100).
- A JD with 12 or more keywords only needs 12 matches to hit 100. This is the ceiling.
- `min(overlap, denom)` prevents extra matches beyond `denom` from inflating — the cap is a real cap.

Frontend display skew (`FitScoreBadge.tsx` / new `FitScoreGauge.tsx`):

```ts
const displayScore = Math.round(20 + rawScore * 0.8);  // 20..100
```

Tier thresholds (applied to `displayScore`):

- 75 and up: green (strong match)
- 55 and up: amber (moderate)
- else: gray (weak)

## Implementation plan

### Phase 0 — Docs

Commit this file and cross-reference it from `260420_job-fit-prescoring/master-plan.md` before any code changes land.

### Phase 1 — Backend

1. `backend/app/services/fit_scoring/scorer.py` (lines 140–153): swap the two math lines for the capped formula above. Define `TOP_N = 12` as a module-level constant.
2. `backend/app/schemas/job_listing.py`: extend `JobListingSortBy` enum with `fit_score`.
3. `backend/app/api/routes/job_listings.py` (around `list_job_listings`): add sort branch for `fit_score`. Needs a `LEFT JOIN` on `user_job_interactions` — order by `UserJobInteraction.fit_score_raw` with `NULLS LAST` so unscored jobs fall to the bottom. Confirm the existing query already joins interactions; if not, extend.
4. Re-score all existing interactions after deploy: trigger the existing admin endpoint `POST /api/v1/admin/fit-scoring/run` (or let the daily scheduler pick it up naturally — scores will refresh within 24h). Note in PR description that numbers will visibly change.

### Phase 2 — Frontend gauge component

5. `frontend/src/components/jobs/FitScoreGauge.tsx` (new): SVG semi-circle (0°–180° arc). Props: `rawScore: number | null`, `isStale?: boolean`, `size?: "md" | "lg"`. Renders:
   - Background track (full arc, gray)
   - Foreground arc (stroke-dasharray proportional to `displayScore / 100`, tier color)
   - Centered number (displayScore) below or inside the arc
   - Small "MATCH" label below number
   - `title` attribute with stale-refresh explanation when `isStale`
6. `frontend/src/components/jobs/FitScoreBadge.tsx`: keep for the compact table-view variant. Update skew to `20 + raw * 0.8` and tier thresholds to 75/55. Rename display string from "X% Match" to a compact "X" with a small icon prefix.

### Phase 3 — Frontend page integration

7. `frontend/src/components/jobs/JobListingCard.tsx` (line 96 region): restructure header — logo + title/company stays left, action buttons (save/hide) move below the gauge. Gauge occupies the top-right slot (~72x48 px). Remove `<FitScoreBadge>` from the meta row (line 126).
8. `frontend/src/components/jobs/JobListingTable.tsx`: add a "Fit" column (rightmost or after Company) rendering the compact `FitScoreBadge` variant.
9. `frontend/src/app/(protected)/jobs/[id]/page.tsx` (around line 167): replace the badge with a larger `FitScoreGauge size="lg"` in the detail-page header.
10. `frontend/src/components/jobs/JobListingFilters.tsx` (`SORT_OPTIONS` around line 13): add `{ value: "fit_score", label: "Fit Score" }`. Default remains date_posted, but if the page detects the user has a master resume, flip initial `sort_by` to `fit_score` desc on first load (page.tsx state init).
11. `frontend/src/lib/api/types.ts` (~line 855): extend `JobListingSortBy` union with `"fit_score"`.

## Critical files reference

| File | What changes |
| ---- | ------------ |
| `backend/app/services/fit_scoring/scorer.py:140-153` | Math swap |
| `backend/app/schemas/job_listing.py` (JobListingSortBy) | Enum extension |
| `backend/app/api/routes/job_listings.py` (list_job_listings) | Sort branch |
| `frontend/src/components/jobs/FitScoreGauge.tsx` | NEW |
| `frontend/src/components/jobs/FitScoreBadge.tsx` | Skew update, compact variant |
| `frontend/src/components/jobs/JobListingCard.tsx:96` | Gauge placement |
| `frontend/src/components/jobs/JobListingTable.tsx` | Fit column |
| `frontend/src/app/(protected)/jobs/[id]/page.tsx:167` | Detail-page gauge |
| `frontend/src/components/jobs/JobListingFilters.tsx:13` | Sort option |
| `frontend/src/lib/api/types.ts:855` | Type extension |
| `docs/api/job-listings.md` | Document new sort_by value + note about algo change |
| `docs/features/ats/260420_job-fit-prescoring/master-plan.md` | Cross-reference v2 doc |

## Verification

1. Backend unit: add one test in `backend/tests/services/fit_scoring/test_scorer.py` (or create) covering: short-JD (5 kws, 5 matches → 100), long-JD (30 kws, 12 matches → 100, 6 matches → 50), zero matches → 0.
2. Re-score: after merge, call `POST /api/v1/admin/fit-scoring/run` and spot-check 5 jobs in DB to confirm new raw values.
3. API: hit `GET /api/job-listings?sort_by=fit_score&sort_order=desc` and confirm ordering + NULLS LAST.
4. Frontend visual: start dev server (`docker-compose up -d`, then `cd frontend && bun dev`), visit `/jobs`:
   - Verify gauge renders at top-right of cards, correct colors per tier
   - Toggle to table view, confirm Fit column
   - Select "Fit Score" in sort dropdown, confirm list reorders
   - Visit a job detail page, confirm large gauge in header
   - Check dark mode styling
5. Stale state: set a resume's `keywords_content_hash` to a different value, reload `/jobs`, confirm gauges render with `opacity-60`.

## Out of scope

- Min-score filter (deferred; revisit if users ask)
- Weighted/importance-based scoring (tracked in the original 260420 plan's "future work" section)
- Re-running keyword extraction on existing jobs (not needed; only the aggregation math changes)
