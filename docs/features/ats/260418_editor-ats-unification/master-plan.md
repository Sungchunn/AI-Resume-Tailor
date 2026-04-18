# Unify Editor Sidebar ATS Scoring with `/tailor/analyze` SOP

## Context

The editor sidebar (`/library/[id]/edit` → ATS Evaluation tab) and the
`/tailor/analyze?resume_id={id}&job_listing_id={id}` page show different ATS
scores for the same resume+job pair. The user wants `/tailor/analyze` treated as
the **SOP** and the editor sidebar to always match it.

Root cause is two unrelated endpoints with two unrelated scoring formulas:

| Aspect | Editor sidebar (current) | `/tailor/analyze` (SOP) |
| ------ | ------------------------ | ----------------------- |
| Endpoint | `POST /api/v1/ats/keywords/detailed` | `GET /api/v1/ats/analyze-progressive` (SSE) |
| Stages | Stage 2 keyword extraction only | All 5 stages (knockout, structure, keywords, content, role) |
| Score | `coverage_score = matched/total` (0–1) | Composite `final_score` (0–100), weighted 15/40/25/20 |
| Cache | None | Redis `ats:v2:{hash}:{job_id}`, 24h TTL |

These can't agree by construction — different inputs, different formula, different range.

A purpose-built endpoint already exists for editor live scoring:
**`POST /api/v1/ats/analyze-content`** (`backend/app/api/routes/ats/content.py`
lines 34–194). It runs the *same* 5-stage pipeline through the *same*
`helpers.py` executors, computes the *same* composite via
`calculate_composite_score()`, accepts raw/unsaved content, and is already used
by the workshop tailor flow (`useScoreCalculation.ts:57`,
`useBulletAnalysis.ts:543`). The library-editor sidebar is the only surface that
hasn't been migrated to it.

## Recommended approach: hybrid two-mode scoring

The editor sidebar pulls its primary score from one of two sources depending on
buffer state. This gives instant cache-hit parity with `/tailor/analyze` on
first open, plus correct live scoring on edits.

1. **Cache-hit mode (initial open, buffer clean).**
   - On mount, if `useATSProgressStore.compositeScore` already matches the
     current `(resumeId, jobId)`, render `compositeScore.finalScore`
     immediately. No network call.
   - Otherwise, kick off `useATSProgressiveAnalysis().startAnalysis(...)` —
     same SSE flow `/tailor/analyze` uses. On a cache hit it returns in ~50 ms
     with a number bit-identical to the SOP page.

2. **Live mode (buffer dirty).**
   - On every `blocks` change, debounce 1500 ms (matching
     `useScoreCalculation.DEFAULT_DEBOUNCE_MS`) then `POST /analyze-content`
     with `blocksToContent(blocks)` + the job description.
   - Use the response's `final_score` as the displayed score.
   - Transform `response.keyword_analysis` (enhanced 4-tier shape) via the
     existing `transformEnhancedToDetailedFormat()` helper and write it to
     `atsProgressStore.keywordAnalysisResult` so the inline suggestion queue
     keeps working.

### Why not single-mode

- **Always progressive**: needs DB-persisted resume; can't score the unsaved
  buffer; every edit would require save + force_refresh.
- **Always content**: misses the Redis cache on first open; ~3 s delay every
  time the editor opens, even for users coming straight from `/tailor/analyze`.

## Backend changes

**None required for correctness.** `/analyze-content` already returns the right
shape (`backend/app/schemas/ats/progressive.py` lines 95–126):

- `final_score: float` (0–100) — composite, matches `/analyze-progressive`
- `stage_scores: dict[str, float]` — raw per-stage scores
- `stage_breakdown: dict[str, float]` — weighted contributions
- `weights_used: dict[str, float]` — actual normalized weights
- `failed_stages: list[str]`
- `knockout_risks: list[KnockoutRiskItem]`
- `keyword_analysis: dict | None` — full `EnhancedKeywordAnalysis` serialization

**Optional, deferred (separate PR):** add LRU cache on
`KeywordExtractor.extract_keywords_with_importance()` keyed by
`sha256(job_description)[:16]`. Currently every `/analyze-content` call re-runs
AI extraction (verified: `grep cache` in
`backend/app/services/job/ats/analyzers/keyword/extractor.py` returns nothing).
This is the single biggest cost optimization but should be measured separately.

## Frontend changes

### 1. Fix the lying type — `frontend/src/lib/api/types.ts`

Line 1340 currently declares
`keyword_analysis: ATSKeywordDetailedResponse | null` on
`ATSContentAnalysisResponse`, but the backend serializes
`EnhancedKeywordAnalysis` (4-tier importance — see
`backend/app/services/job/ats/models/keywords.py` lines 67–115). Add a new
`ATSKeywordEnhancedAnalysis` interface mirroring the backend dataclass and
update the field. TypeScript will then force callers to handle the enhanced
shape correctly.

### 2. Promote shared transform — new file `frontend/src/lib/ats/transformKeywordAnalysis.ts`

Move `transformEnhancedToDetailedFormat()` out of
`frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts` lines
84–129 into this shared util. It collapses the 4-tier enhanced shape down to
the 3-tier detailed shape consumed by existing UI (`KeywordSection`,
`CoverageIndicator`, `useInlineSuggestionQueue`).

Update callers to import from the new location:

- `useATSProgressiveAnalysis.ts` (existing caller)
- `useScoreCalculation.ts` (currently mistypes — drive-by fix)
- New sidebar code below

### 3. Add hook — `frontend/src/lib/api/hooks.ts`

Add `useATSContentAnalysis()` adjacent to `useATSKeywordAnalysis()` (line 954).
Mark `useATSKeywordAnalysis()` as deprecated in a one-line comment but keep it
(tests + dead orphan editor still reference it).

### 4. Drive-by fix — `frontend/src/components/workshop/hooks/useScoreCalculation.ts`

Line 64 currently assigns `response.keyword_analysis` (enhanced) into state
typed `ATSKeywordDetailedResponse | null`. The type tightening in step 1 forces
this fix: wrap with `transformEnhancedToDetailedFormat(response.keyword_analysis)`.
This is a pre-existing bug; merging both surfaces uncovers it.

### 5. Sidebar rewrite — `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx`

This is the bulk of the work. Replace the `useATSKeywordAnalysis()` flow with
the hybrid two-mode scoring described above.

**State shape:**

- Local: `analysis: ATSContentAnalysisResponse | null`
- Store-derived: `compositeScore` from `useATSProgressStore`
- Derived: `displayScore = analysis?.final_score ?? compositeScore?.finalScore ?? null`
- Local: `detailedKeywordAnalysis = transformEnhancedToDetailedFormat(analysis.keyword_analysis)`,
  also written to `atsProgressStore.keywordAnalysisResult` (preserves contract
  with `useInlineSuggestionQueue`)

**Initial-load branches** (when `hasJobContext`):

1. Store has matching `compositeScore` for `(resumeId, jobId)` → use it, no fetch
2. Buffer clean, no analysis yet → call `useATSProgressiveAnalysis().startAnalysis(resumeId, {jobListingId})` so Redis can answer fast
3. Subsequent edits → debounced `/analyze-content` (1500 ms)

**Refresh handlers:**

- `handleLiveRefresh()` — immediate `/analyze-content` (used by header Refresh and stale banner Re-analyze)
- `handleProgressiveRefresh()` — `startAnalysis(..., {forceRefresh: true})` for explicit full re-run

**UI additions:**

- `CompositeBreakdown` sub-component: per-stage rows showing name, weight%,
  raw score, weighted contribution. Pulls from `analysis.stage_scores +
  weights_used + stage_breakdown` (or store equivalents). Fixes the "why is
  my score this number" gap.
- Knockout risk banner above the breakdown when `knockout_risks` non-empty
  (color by `severity`).
- Failed-stages warning if `failed_stages` non-empty.

**UI preserved:**

- Three `KeywordSection` blocks (Required / Preferred / Nice to Have) sourced
  from `detailedKeywordAnalysis`
- `CoverageIndicator` rows for Required/Preferred (drop the redundant
  "Overall" — composite already shows that)
- Suggestions + warnings from `detailedKeywordAnalysis`
- `analyzedContentHash` + `contentStale` staleness flow (no change)

**Debounce:** use `useDebouncedCallback` (already in repo via `useScoreCalculation`),
1500 ms, cancel on unmount.

### 6. Thread `resumeId` to the sidebar

`ATSEvaluationTab` needs `resumeId: string` for the SSE call. It's available in
the editor page; thread it through:

- `frontend/src/components/library/editor/EditorLayout.tsx` → already has it
- `frontend/src/components/library/editor/ControlPanel.tsx` → add to props,
  pass through
- `ATSEvaluationTab.tsx` → add to `ATSEvaluationTabProps`

### 7. Bump Zustand store version — `frontend/src/lib/stores/atsProgressStore.ts`

Line 174: `version: 2` → `version: 3`. Why: persisted v2 state may have a
stale `keywordAnalysisResult` but no `compositeScore` (users who used the old
sidebar but never visited `/tailor/analyze`). After the cut-over the sidebar
sources its score from `compositeScore.finalScore`; we want a clean slate so
first render auto-runs progressive instead of showing nothing.

Redis `ats:v2:*` namespace is **NOT** bumped — the scoring formula is
unchanged.

### 8. Dead-code removal

- Delete `frontend/src/components/editor/EditorLayout.tsx` (orphan, grep-confirmed nothing imports it)
- Delete `frontend/src/components/editor/ATSKeywordsPanel.tsx` (only used by the orphan above)

**Keep for now** (remove in a follow-up cleanup PR after a deploy cycle):

- `useATSKeywordAnalysis()` hook
- `atsApi.analyzeKeywordsDetailed()` client method
- `POST /keywords/detailed` backend route
- `ATSKeywordDetailedResponse` type (still used as the transform's *output*)

Tests in `backend/tests/api/test_ats_api.py` still hit `/keywords/detailed`;
removing it now would break them.

## Key risks to mitigate during implementation

1. **First-open race.** If user opens editor (we kick off SSE) and starts
   typing before SSE completes, the `complete` event could overwrite the
   live-debounced score with the cached pre-edit value. Guard: in the SSE
   `complete` handler, ignore the result if `analyzedContentHash` no longer
   matches the buffer hash at completion time.

2. **`blocksToContent` parity.** The whole "instant match on first open" claim
   rests on `blocksToContent(blocks)` producing the same dict shape that
   `MongoResumeCRUD.get().parsed.model_dump()` produces (the input
   `/analyze-progressive` sees). Sanity-check parity for common block types;
   any divergence (date formatting, skill list shape, etc.) breaks the
   cache-hit-equals-tailor promise.

3. **AI cost on live scoring.** Each `/analyze-content` re-runs AI keyword
   extraction. Debounce mitigates but doesn't eliminate. The optional
   `KeywordExtractor` LRU cache (separate PR) is the proper fix.

## Critical files

**Modify:**

- `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx` (full rewrite of analysis section + UI additions)
- `frontend/src/components/library/editor/ControlPanel.tsx` (thread `resumeId`)
- `frontend/src/components/library/editor/EditorLayout.tsx` (verify `resumeId` reaches `ControlPanel`)
- `frontend/src/lib/api/types.ts` line 1340 (fix `keyword_analysis` type, add `ATSKeywordEnhancedAnalysis`)
- `frontend/src/lib/api/hooks.ts` near line 954 (add `useATSContentAnalysis`)
- `frontend/src/lib/stores/atsProgressStore.ts` line 174 (`version: 2` → `3`)
- `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts` lines 84–129 (delete local transform, import from shared util)
- `frontend/src/components/workshop/hooks/useScoreCalculation.ts` line 64 (apply transform on enhanced response)

**Create:**

- `frontend/src/lib/ats/transformKeywordAnalysis.ts` (shared transform util + `ATSKeywordEnhancedAnalysis` interface)
- `docs/features/ats/260418_editor-ats-unification/master-plan.md` (canonical plan doc per user preference)

**Delete:**

- `frontend/src/components/editor/EditorLayout.tsx` (orphan)
- `frontend/src/components/editor/ATSKeywordsPanel.tsx` (orphan)

**Reference (read-only, the SOP we're matching):**

- `backend/app/api/routes/ats/progressive.py` lines 36–405
- `backend/app/api/routes/ats/content.py` lines 34–194
- `backend/app/api/routes/ats/helpers.py` lines 142–200 (`calculate_composite_score`)
- `backend/app/schemas/ats/progressive.py` lines 95–126 (`ATSContentAnalysisResponse`)
- `backend/app/services/job/ats/models/keywords.py` lines 67–115 (`EnhancedKeywordAnalysis`)

## Verification

1. **Numeric parity (manual, required before merge).**
   - Pick a test resume X + scraped job Y.
   - Open `/tailor/analyze?resume_id=X&job_listing_id=Y`. Wait for completion.
     Note the displayed `finalScore`.
   - Open `/library/resumes/X/edit?jobListingId=Y` in a second tab without
     editing. ATS Evaluation tab shows the **same number** (both read
     `atsProgressStore.compositeScore`).
   - Edit a bullet, wait 1500 ms. Score updates. To confirm parity: force-
     refresh `/tailor/analyze` (skips Redis) — both surfaces should now show
     equal scores ±0.5.

2. **Cache-hit flow.** With DevTools Network open, navigate from
   `/tailor/analyze` to the editor. Verify **no** `analyze-content` or
   `analyze-progressive` request fires on first paint of the ATS tab.

3. **Live scoring flow.** Edit one bullet. Verify exactly one
   `POST /analyze-content` after the debounce. Verify `ai_usage_logs` row
   created for endpoint `/ats/analyze-content` (CLAUDE.md rule 14). Verify
   `contentStale` flips to false post-response.

4. **Knockout rendering.** Use a known-knockout pair (e.g., "10+ years
   experience required" vs a 2-year resume). Critical banner with
   `risk_type`, `description`, `job_requires`, `user_has` appears above the
   composite breakdown.

5. **Regression.**
   - Workshop tailor editor still shows correct score (the `useScoreCalculation`
     drive-by fix).
   - Inline suggestion queue still auto-populates (it reads
     `keywordAnalysisResult`, which we still write via the transform).
   - Bullet AI re-score (`useBulletAnalysis:543`) still works (unchanged path).

6. **Backend tests.** `bun run test:e2e` (frontend) and
   `cd backend && poetry run pytest tests/api/test_ats_helpers.py
   tests/services/ats/test_keywords.py` (the regression tests added in
   commits a2a5e3a and c21519b) all pass.
