# Library Editor Bullet Suggestions

## Context

The AI bullet suggestions feature (`BulletSuggestionsPanel`) currently only works in the tailor editor (`/tailor/editor/[id]`). It needs to also work on the library editor page (`/library/resumes/[id]/edit?jobListingId=X`) when a job is linked.

**Why it doesn't work today — two gates fail:**

1. `AIChatTab.tsx:299` checks `isTailorMode && tailoredResumeId` — both are false/null on the library editor
2. `useBulletAnalysis.ts:185` reads ATS context from `TailorEditorContext` — returns null on library editor
3. Backend endpoint `POST /api/tailor/{tailored_id}/analyze-bullets` requires a tailored resume ID

**Key insight:** `BulletAnalyzer.analyze_batch()` only needs bullet texts, a job description, and ATS keyword gaps. The `tailored_id` is just used for auth and job lookup — a routing artifact, not a data requirement.

---

## Approach

Make `BulletSuggestionsPanel` work without `TailorEditorContext`. Pass ATS data and job context via props, and add a new backend endpoint following the existing `resumeId + jobId/jobListingId` pattern from ATS routes. Do NOT wrap the library editor in `TailorEditorProvider` (semantically wrong).

---

## Step 1: Backend — New `/api/v1/ats/analyze-bullets` endpoint

**New file:** `backend/app/api/routes/ats/bullets.py`

Create endpoint following the `progressive.py` pattern:

```python
@router.post("/analyze-bullets")
async def analyze_bullets_for_resume(
    request: BulletAnalysisRequest,
    resume_id: str = Query(...),
    job_id: int | None = Query(None),
    job_listing_id: int | None = Query(None),
    ...
)
```

- Validate resume ownership (same pattern as `progressive.py:112-119`)
- Fetch job description from `job_id` or `job_listing_id` directly (no tailored resume lookup)
- Reuse `BulletAnalyzer.analyze_batch()` — same service, same schemas
- Log AI usage with `usage_tracker.log_generation()`
- Return `AnalyzeBulletsResponse` (same schema as tailor endpoint)

**Register in:** `backend/app/api/routes/ats/__init__.py` — add `router.include_router(bullets_router)`

**Reused from tailor endpoint:** `BulletAnalysisRequest`, `AnalyzeBulletsResponse`, `BulletAnalyzer`, `resolve_ai_model`, `get_ai_client_for_model`

---

## Step 2: Frontend API client — Add `atsApi.analyzeBullets`

**File:** `frontend/src/lib/api/client.ts`

Add method to `atsApi` object that calls `POST /api/v1/ats/analyze-bullets?resume_id=X&job_listing_id=Y` with `BulletAnalysisRequest` body.

---

## Step 3: Share ATS keyword results across tabs via store

**Problem:** `ATSEvaluationTab` stores its `ATSKeywordDetailedResponse` in local state (`useState`). `AIChatTab` can't access it.

**File:** `frontend/src/lib/stores/atsProgressStore.ts`

Add to the store:

- `keywordAnalysisResult: ATSKeywordDetailedResponse | null`
- `setKeywordAnalysisResult: (result) => void`

**File:** `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx`

In `onSuccess` callback (~line 407): call `setKeywordAnalysisResult(data)` to write the analysis result to the shared store.

---

## Step 4: Refactor `useBulletAnalysis` to support library mode

**File:** `frontend/src/hooks/useBulletAnalysis.ts`

Broaden the options interface:

```typescript
interface UseBulletAnalysisOptions {
  tailoredResumeId?: string;      // Tailor mode (existing)
  resumeId?: string;              // Library mode (new)
  jobId?: string | null;          // Library mode
  jobListingId?: number | null;   // Library mode
  atsData?: ATSKeywordDetailedResponse | null;  // Library mode
}
```

Changes to `analyze` callback:

- **ATS readiness:** Check `atsContext?.analysisComplete` (tailor) OR `atsData != null` (library)
- **ATS context construction:** For library mode, derive `keyword_gaps` from `atsData.all_keywords.filter(k => !k.found_in_resume)`. Pass empty arrays for `bullets_needing_metrics` / `bullets_with_weak_verbs` (acceptable — analyzer still works, just less targeted)
- **API call:** Tailor mode calls `tailorApi.analyzeBullets(tailoredResumeId, ...)`. Library mode calls `atsApi.analyzeBullets(resumeId, jobId, jobListingId, ...)`
- **Store binding:** Use `resumeId` instead of `tailoredResumeId` for `setSuggestions`

---

## Step 5: Refactor `BulletSuggestionsPanel` props

**File:** `frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx`

Broaden props:

```typescript
interface BulletSuggestionsPanelProps {
  tailoredResumeId?: string;
  resumeId?: string;
  jobId?: string | null;
  jobListingId?: number | null;
  atsReady?: boolean;
  atsData?: ATSKeywordDetailedResponse | null;
}
```

- ATS readiness: use `props.atsReady` if provided, otherwise fall back to `useATSReadiness()` from context
- Forward new props to `useBulletAnalysis`

---

## Step 6: Thread `resumeId` through component chain and wire up rendering

**Files:**

- `EditorLayout.tsx` — already has `resumeId`, pass it to `ControlPanel`
- `ControlPanel.tsx` — add `resumeId` prop, forward to `AIChatTab`
- `AIChatTab.tsx` — add `resumeId` prop

**Rendering change in `AIChatTab.tsx` (~line 299):**

```tsx
{/* Tailor mode (existing) */}
{isTailorMode && tailoredResumeId && (
  <BulletSuggestionsPanel tailoredResumeId={tailoredResumeId} />
  <SkillSuggestionsPanel />
)}

{/* Library mode with job + ATS complete (new) */}
{!isTailorMode && hasJobContext && atsKeywordResult && (
  <BulletSuggestionsPanel
    resumeId={resumeId}
    jobId={jobId}
    jobListingId={jobListingId}
    atsReady={true}
    atsData={atsKeywordResult}
  />
)}
```

Where `atsKeywordResult` is read from `useATSProgressStore(s => s.keywordAnalysisResult)`.

---

## Implementation Order

1. **Backend** (Step 1) — new endpoint, independently testable
2. **Frontend API client** (Step 2) — add `atsApi.analyzeBullets`
3. **ATS store extension** (Step 3) — add `keywordAnalysisResult` field + ATSEvaluationTab writes to it
4. **useBulletAnalysis refactor** (Step 4) — dual-mode support
5. **BulletSuggestionsPanel refactor** (Step 5) — accept props for library mode
6. **Component wiring** (Step 6) — thread `resumeId`, update rendering conditions

---

## Known Trade-offs

- **Content quality hints missing in library mode:** Library editor only runs keyword analysis, not the full progressive pipeline. `bullets_needing_metrics` and `bullets_with_weak_verbs` will be empty arrays. Suggestions are slightly less targeted but still fully functional. Can be enhanced later.
- **ATS re-score after accepting suggestions:** In library mode, the user can manually re-run ATS analysis from the ATS tab. Skip auto-rescore in library mode for simplicity.

---

## Critical Files

| File | Change |
| ----- | ----- |
| `backend/app/api/routes/ats/bullets.py` | **New** — analyze-bullets endpoint |
| `backend/app/api/routes/ats/__init__.py` | Register bullets router |
| `frontend/src/lib/api/client.ts` | Add `atsApi.analyzeBullets` method |
| `frontend/src/lib/stores/atsProgressStore.ts` | Add `keywordAnalysisResult` state |
| `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx` | Write result to store |
| `frontend/src/hooks/useBulletAnalysis.ts` | Dual-mode support |
| `frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx` | Broader props interface |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Pass `resumeId` to ControlPanel |
| `frontend/src/components/library/editor/ControlPanel.tsx` | Add + forward `resumeId` prop |
| `frontend/src/components/library/editor/tabs/AIChatTab.tsx` | Add `resumeId` prop, render panel in library mode |

---

## Verification

1. **Backend:** `curl` or Swagger — `POST /api/v1/ats/analyze-bullets?resume_id=X&job_listing_id=Y` with bullet + ATS context payload returns suggestions
2. **Frontend integration:** Open library editor with `?jobListingId=X`, go to ATS tab, run keyword analysis, switch to AI tab — `BulletSuggestionsPanel` should appear with "Analyze Bullets" button
3. **Accept/reject:** Accept a suggestion — bullet text updates in editor and auto-saves
4. **Tailor editor regression:** Verify tailor editor bullet suggestions still work unchanged
