# Fit-Score v4 Transparency — /jobs and /jobs/{id} Redesign

## Context

Fit-score v4 (embedding + keyword + required-skill gate) shipped in commit `aa42cc0` via `260423_job-fit-scoring-v4/master-plan.md`. The math is correct and tested, but the UI still surfaces only the opaque 0-100 integer. Two design screenshots define the follow-up:

1. **`/jobs`** — "Make the batch score legible — no fake AI signal." Show the two terms (semantic + keyword), mark capped scores, signal "this is a daily batch, not a real-time AI call." Keeps costs linear with logins, not job count.
2. **`/jobs/{id}`** — "Show the v4 formula, gate to deep analysis." Expose the math transparently, show required-skills and keyword overlap, and gate AI-heavy work behind an explicit "Run deep analysis" CTA.

The score math (`backend/app/services/fit_scoring/scorer.py:100-128`) stays as-is — only the output surface needs to expose what it already computes.

## Scope — Wave 1 only

Wave 1 ships here: data + `/jobs` legibility + `/jobs/{id}` transparency. Wave 2 (`Run deep analysis` orchestrator + CTA) is deferred; see the "Wave 2" section for pre-agreed decisions.

**What ships in this plan:** backend breakdown JSONB + `is_capped` flag + batch-run timestamp on every score; `/jobs` redesign with mini-bars, tier labels, `hide_capped` filter (default ON); `/jobs/{id}` redesign with transparent formula panel, required-skills row, keyword overlap. The existing `Optimize Resume for This Job` link to `/tailor` stays untouched in this wave.

---

## Plan (Wave 1)

### 1a. Database (single Alembic migration)

New migration `backend/alembic/versions/20260424_0001_add_fit_score_breakdown.py`.

**On `user_job_interactions`:**
- `fit_score_breakdown` JSONB, nullable. Shape:
  ```json
  {
    "version": 4,
    "semantic_sub": 89,
    "keyword_sub": 84,
    "keyword_matched": ["typescript", "node.js", "stripe"],
    "keyword_missing": ["langchain", "pinecone"],
    "keyword_total": 22,
    "required_total": 2,
    "required_matched": ["typescript / node.js", "api integrations"],
    "required_missing": [],
    "is_capped": false,
    "cap_value": 100
  }
  ```
  v3 fallback writes the same shape with `version: 3`, `semantic_sub: null`.
- `fit_score_is_capped` Boolean, nullable. Denormalized from breakdown for efficient `WHERE` filtering by the new "Hide capped scores" toggle.
- Partial index: `idx_uji_fit_not_capped (user_id, fit_score_raw DESC) WHERE fit_score_is_capped IS NOT TRUE` — keeps the common filtered-list query fast.

**New tiny table `fit_score_batch_runs`:**
- `id`, `started_at`, `completed_at`, `users_count`, `rows_written`, `status` (string: `running`/`completed`/`failed`).
- Read: `SELECT … ORDER BY started_at DESC LIMIT 1` gives "last run" for the UI. Written once per `score_all_users` invocation.

### 1b. Scorer refactor

`backend/app/services/fit_scoring/scorer.py`:
- Replace `compute_raw_score(...) -> int` with `compute_raw_score(...) -> tuple[int, dict]`. All three paths (v3 fallback, v4 uncapped, v4 capped) populate the same breakdown dict. Keep `TOP_N`, `_COS_MIN`, `_COS_MAX`, `_SEM_WEIGHT`, `_KW_WEIGHT`, `_REQUIRED_GATE_CAP` constants as-is.
- `_score_user` now upserts `fit_score_raw`, `fit_score_breakdown`, and `fit_score_is_capped` together.
- `score_all_users` writes a `fit_score_batch_runs` row at start (`status='running'`) and updates on completion (`status='completed'` + counts). Failure path writes `status='failed'`.

### 1c. Schemas + endpoints

`backend/app/schemas/job_listing.py`:
- Add `FitScoreBreakdown` Pydantic model matching the JSONB shape.
- Extend `JobListingListItem` and `JobListingResponse` with `fit_score_breakdown: FitScoreBreakdown | None` and `fit_score_is_capped: bool`.
- Extend `JobListingFilters` with `hide_capped: bool = False`.

`backend/app/api/routes/job_listings.py`:
- `_build_list_item_response` + detail builder populate the two new fields.
- Repository `list` respects `hide_capped` (adds `WHERE fit_score_is_capped IS NOT TRUE`).
- New endpoint `GET /job-listings/fit-score-meta` → `{ last_run_at, users_count, rows_written }`. Called once on `/jobs` for the "Scores refreshed Xh ago" subtitle.

### 1d. Backend tests

- Extend `backend/tests/services/test_fit_scoring.py` with 4 new cases asserting breakdown shape: v3 fallback, v4 uncapped full match, v4 uncapped partial, v4 capped.
- Add repository test for `hide_capped` filter.
- Add route test for `/fit-score-meta` returning the latest batch-run row.

### 1e. Frontend data layer

`frontend/src/lib/api/types.ts`:
- Add `FitScoreBreakdown` type (mirrors backend).
- Extend `JobListingListItem` and `JobListingResponse`.
- Add `hide_capped` to `JobListingFilters`.

`frontend/src/lib/api/hooks.ts`:
- Add `useFitScoreMeta()` hitting `GET /job-listings/fit-score-meta` (stale time 5 min).

### 1f. `/jobs` redesign

**New components under `frontend/src/components/jobs/fit-score/`:**

| Component | Purpose |
| --------- | ------- |
| `FitScoreCell.tsx` | Per-row cell. Large tier-colored score + label (`STRONG FIT` / `GOOD FIT` / `LOW FIT` / `CAP 60` with lock icon when `is_capped`). Below: two mini-bars `SEM 89` and `KW 84`. Below that: `Required 2/2` or `Required 2/3 · miss Spring Boot`. Reuses the exported `Track` primitive from `FitScoreGauge`. |
| `FitScoreLegend.tsx` | Top strip: color key + one-line formula explainer. Dismissable, persisted in localStorage. |
| `FitScoreMetaHeader.tsx` | "914 jobs · sorted by Fit · Scores refreshed 3h ago (daily batch)". Uses `useFitScoreMeta` + `formatRelativeTime`. |

**Refactor `FitScoreGauge.tsx`** to export its `Track` primitive so `FitScoreCell` can consume it directly.

**Edits:**
- `frontend/src/app/(protected)/jobs/page.tsx`:
  - Title: `Job Listings` + a small `Fit estimate · v4 aware` pill.
  - Replace the current "Last updated" subtitle with `FitScoreMetaHeader`.
  - Render `FitScoreLegend` below subtitle on first visit (dismissable).
- `frontend/src/components/jobs/JobListingFilters.tsx`: add "Hide capped scores" checkbox. Default: on. Initial filter state in `/jobs/page.tsx` sets `hide_capped: true`.
- `frontend/src/components/jobs/JobListingTable.tsx`: rename `FIT` column header to `FIT ESTIMATE`; replace `FitScoreBadge compact` with `FitScoreCell variant="table"`.
- `frontend/src/components/jobs/JobListingCard.tsx`: replace inline `FitScoreGauge md` with `FitScoreCell variant="card"`.
- Add `NEW TODAY` chip on listings where `date_posted` is within 24h.

### 1g. `/jobs/{id}` redesign

**New components under `frontend/src/components/jobs/fit-score/`:**

| Component | Purpose |
| --------- | ------- |
| `FitScoreHero.tsx` | Tier chip + `Fit estimate · batch` sub-chip + large `87/100` number + `updated Xh ago · not pre-processed beyond your resume keywords + embedding` meta-line + one-sentence explanation derived from breakdown. |
| `FitScoreFormulaPanel.tsx` | "HOW THIS SCORE WAS COMPUTED" block. Three columns: `SEMANTIC × 0.5` + `KEYWORDS × 0.5` + `= total`. Hidden for v3-fallback; shows "Keyword-only score — embeddings unavailable" caption instead. |
| `RequiredSkillsRow.tsx` | "REQUIRED SKILLS: All present · no cap" or "Missing 1 required · CAP 60". Chips: ✓ green for matched, ✗ amber for missing. Hidden when `required_total=0`. |
| `KeywordOverlapSection.tsx` | "KEYWORD OVERLAP: 18/22 matched". Matched chips: solid green. "Nice to have, still missing:" sub-section with dashed amber chips. |

**Edits:**
- `frontend/src/app/(protected)/jobs/[id]/page.tsx`:
  - Remove the `FitScoreGauge size="lg"` from the header's right column. Keep Save / Hide buttons where they are.
  - Layout order after the existing action bar: `FitScoreHero` → `FitScoreFormulaPanel` → `RequiredSkillsRow` → `KeywordOverlapSection` → existing "About Company" → existing "Job Description".
  - The existing `Optimize Resume for This Job` link to `/tailor` stays unchanged in this wave.

---

## Wave 2 — Deferred

Not implemented here. Pre-agreed decisions for the follow-up plan:

- **Endpoint:** `POST /job-listings/{id}/analyze` → orchestrator in `backend/app/services/job_listings/deep_analysis.py` that calls existing keyword analyzer + `BulletAnalyzer`; Redis-cached per `(resume_hash, job_id)` with 24h TTL.
- **Result UX:** inline expand below the CTA on `/jobs/{id}`. User stays in context.
- **Gating:** daily quota of 5 runs/user/day, enforced by counting `ai_usage_log` rows with `endpoint = '/job-listings/analyze'`. Copy: "1 AI run".

New components at that time: `DeepAnalysisCTA.tsx`, `DeepAnalysisResult.tsx` under `frontend/src/components/jobs/fit-score/`.

---

## Verification

### End-to-end manual
1. `poetry run alembic upgrade head` — migration applies cleanly on a local DB with pre-existing rows in `user_job_interactions` (existing rows should read as `is_capped=NULL`, `breakdown=NULL`).
2. `POST /admin/fit-scoring/run` (or wait for the 04:00 UTC batch) — breakdown + `is_capped` columns populate; one row written to `fit_score_batch_runs`.
3. `GET /job-listings/fit-score-meta` returns the new row.
4. Open `/jobs` — verify: "Fit estimate · v4 aware" pill, "Scores refreshed Xh ago" subtitle, mini-bars + tier labels + required-skill caption on each row, `NEW TODAY` chip on fresh rows, "Hide capped scores" checkbox pre-checked.
5. Toggle "Hide capped scores" off — capped rows reappear with `CAP 60` + lock icon and `Required 2/3 · miss X` caption.
6. Sort by fit score asc/desc — rows order correctly; confirm the partial index is used via `EXPLAIN ANALYZE` for the common filtered query.
7. Open a capped job detail page — `FitScoreHero` shows `Capped at 60`, `RequiredSkillsRow` shows missing skill in amber with the ✗ chip.
8. Open an uncapped job detail page — `FitScoreHero` shows `Strong fit` or `Good fit`, `FitScoreFormulaPanel` renders `SEM × 0.5 + KW × 0.5 = total` with the "embedding cosine, calibrated" footnote.
9. Run the batch on a user whose resume has no embedding (v3 fallback) — `FitScoreFormulaPanel` shows the "Keyword-only score — embeddings unavailable" caption, not the formula.
10. Dev-server dark-mode spot check on both pages (per CLAUDE.md rule #13).

### Automated
- `poetry run pytest backend/tests/services/test_fit_scoring.py` — breakdown-shape assertions pass for v3 fallback, v4 uncapped full match, v4 uncapped partial, v4 capped.
- Repository test: `hide_capped=True` filter excludes capped rows.
- Route test: `GET /fit-score-meta` returns latest `fit_score_batch_runs` row; empty-case returns `{last_run_at: null}`.
- Vitest / Jest for `FitScoreCell`, `FitScoreFormulaPanel`, `RequiredSkillsRow`, `KeywordOverlapSection` — covering capped, uncapped, and v3-fallback props.

---

## Critical files

### Backend (modify)
- `backend/app/services/fit_scoring/scorer.py` — tuple return + breakdown dict + batch-run writes
- `backend/app/models/user_job_interaction.py` — `fit_score_breakdown`, `fit_score_is_capped`
- `backend/app/schemas/job_listing.py` — `FitScoreBreakdown`, extend `JobListingListItem`, `JobListingResponse`, `JobListingFilters`
- `backend/app/api/routes/job_listings.py` — `/fit-score-meta` endpoint; include new fields in list + detail builders
- `backend/app/crud/job_listing_repository.py` — honor `hide_capped` filter

### Backend (new)
- `backend/alembic/versions/20260424_0001_add_fit_score_breakdown.py`
- `backend/app/models/fit_score_batch_run.py`

### Frontend (modify)
- `frontend/src/app/(protected)/jobs/page.tsx`
- `frontend/src/app/(protected)/jobs/[id]/page.tsx`
- `frontend/src/components/jobs/JobListingCard.tsx`
- `frontend/src/components/jobs/JobListingTable.tsx`
- `frontend/src/components/jobs/JobListingFilters.tsx`
- `frontend/src/components/jobs/FitScoreGauge.tsx` (export `Track` primitive)
- `frontend/src/lib/api/types.ts`, `frontend/src/lib/api/hooks.ts`

### Frontend (new) — all under `frontend/src/components/jobs/fit-score/`
- List surface: `FitScoreCell.tsx`, `FitScoreLegend.tsx`, `FitScoreMetaHeader.tsx`
- Detail surface: `FitScoreHero.tsx`, `FitScoreFormulaPanel.tsx`, `RequiredSkillsRow.tsx`, `KeywordOverlapSection.tsx`

---

## Reuse

- `compute_raw_score` (`backend/app/services/fit_scoring/scorer.py:100`) — math stays; breakdown computed alongside by the same function.
- `FitScoreGauge` `Track` primitive (`FitScoreGauge.tsx:53`) — export and reuse as the mini-bar atom in `FitScoreCell`.
- FastAPICache pattern in `job_listings.py:90-166` — the new `/fit-score-meta` endpoint uses the same backend for its short-TTL cache.
- `formatRelativeTime` (`frontend/src/lib/utils/date.ts`) — used by `FitScoreMetaHeader`.

---

## Decisions locked in

- **Scope:** Wave 1 only this plan. Wave 2 deferred.
- **Hide capped scores default:** ON.
- **Wave 2 deep-analysis result UX (when built):** inline expand on `/jobs/{id}`.
- **Wave 2 gating (when built):** daily quota of 5 runs/user/day, counted from `ai_usage_log`. Copy: "1 AI run".
