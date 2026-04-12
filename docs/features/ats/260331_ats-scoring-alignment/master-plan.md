# ATS Scoring Consistency: Stepper & Editor Alignment

## Problem

- **Stepper** uses `/ats/analyze-progressive` (5-stage weighted scoring with SSE)
- **Editor** uses `/tailor/quick-match` (simple keyword overlap, different algorithm)
- Editor can't score live edits (requires `resume_id`, fetches saved state from DB)

**Result:** Inconsistent scores between stepper and editor.

## Solution

Create `POST /ats/analyze-content` endpoint that:

- Accepts raw resume content (no DB lookup)
- Uses same 5-stage scoring as stepper
- Returns composite score synchronously (no SSE)
- Enables live scoring of unsaved edits

## Implementation

### Phase 1: Backend - New Endpoint

**File:** `backend/app/api/routes/ats/content.py` (new)

```python
from app.services.ai import get_usage_tracker
from app.services.ai.response import AccumulatedMetrics

@router.post("/analyze-content")
async def analyze_content(
    request: ATSContentAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """
    Same scoring as /analyze-progressive but:
    - Synchronous (no SSE)
    - Accepts raw content (no DB lookup)
    """
    # Track AI usage across all stages
    accumulated_metrics = AccumulatedMetrics()

    # Reuse existing helpers from helpers.py
    stage_results = {}

    stage_results["structure"] = await execute_structure_analysis(...)

    result, ai_metrics = await execute_keyword_analysis(..., return_metrics=True)
    stage_results["keywords-enhanced"] = result
    if ai_metrics:
        accumulated_metrics.add(ai_metrics)

    stage_results["content-quality"] = await execute_content_quality(...)
    stage_results["role-proximity"] = await execute_role_proximity(...)

    # Log AI usage to /admin/ai-usage dashboard
    if accumulated_metrics.call_count > 0:
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=db,
            user_id=current_user_id,
            endpoint="/ats/analyze-content",
            response=accumulated_metrics,
        )
        await db.commit()

    # Same composite calculation as progressive
    return calculate_composite_score(stage_results, failed_stages)
```

**Request Schema:**

```python
class ATSContentAnalysisRequest(BaseModel):
    resume_content: dict          # Parsed resume (TailoredContent structure)
    job_description: str          # Raw job description text
    job_content: dict | None      # Optional parsed job for role proximity
    skip_stages: list[int] | None # Optional: skip stages for faster scoring
```

**Response Schema:**

```python
class ATSContentAnalysisResponse(BaseModel):
    final_score: float
    stage_scores: dict[str, float]
    stage_breakdown: dict[str, float]
    weights_used: dict[str, float]
    failed_stages: list[str]
    knockout_risks: list[dict]
    keyword_analysis: EnhancedKeywordAnalysis | None  # For KeywordAnalysis panel
```

### Phase 2: Backend - Wire Up

1. Add schemas to `backend/app/schemas/ats/progressive.py`
2. Register router in `backend/app/api/routes/ats/__init__.py`
3. Reuse helper functions from `backend/app/api/routes/ats/helpers.py`

### Phase 3: Frontend - API Client

**File:** `frontend/src/lib/api/client.ts`

```typescript
atsApi: {
  analyzeContent: async (request: ATSContentAnalysisRequest) => {
    return apiFetch<ATSContentAnalysisResponse>("/api/v1/ats/analyze-content", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },
}
```

**File:** `frontend/src/lib/api/types.ts`

```typescript
interface ATSContentAnalysisRequest {
  resume_content: TailoredContent;
  job_description: string;
  job_content?: Record<string, unknown>;
  skip_stages?: number[];
}

interface ATSContentAnalysisResponse {
  final_score: number;
  stage_scores: Record<string, number>;
  stage_breakdown: Record<string, number>;
  weights_used: Record<string, number>;
  failed_stages: string[];
  knockout_risks: KnockoutRisk[];
  keyword_analysis?: EnhancedKeywordAnalysis;
}
```

### Phase 4: Frontend - Update Score Calculation Hook

**File:** `frontend/src/components/workshop/hooks/useScoreCalculation.ts`

**Changes:**

1. Accept `jobDescription` as input (needed for content-based scoring)
2. Replace `useQuickMatch` with new `analyzeContent` endpoint
3. Transform `TailoredContent` to match backend's expected format
4. Update `atsAnalysis` state with keyword details from response

```typescript
interface UseScoreCalculationOptions {
  content: TailoredContent;
  jobDescription: string;       // NEW: Required
  jobId?: number;
  jobListingId?: number;
  enabled?: boolean;
  debounceMs?: number;
}
```

### Phase 5: Frontend - Update WorkshopProvider

**File:** `frontend/src/components/workshop/WorkshopProvider.tsx`

1. Pass `jobDescription` to `useScoreCalculation`
2. Update `atsAnalysis` from score calculation response (keyword details)

## Files to Modify

| File | Change |
| ---- | ------ |
| `backend/app/api/routes/ats/content.py` | New endpoint |
| `backend/app/api/routes/ats/__init__.py` | Register router |
| `backend/app/schemas/ats/progressive.py` | Add request/response schemas |
| `frontend/src/lib/api/client.ts` | Add API method |
| `frontend/src/lib/api/types.ts` | Add TypeScript types |
| `frontend/src/components/workshop/hooks/useScoreCalculation.ts` | Use new endpoint |
| `frontend/src/components/workshop/WorkshopProvider.tsx` | Pass jobDescription |

## Consistency Guarantee

Both stepper and editor will use:

- Same helper functions (`execute_*`, `calculate_composite_score`)
- Same weights: structure 15%, keywords 40%, content 25%, role 20%
- Same 4-layer keyword scoring (placement, density, recency, importance)

## AI Usage Tracking

**Requirement:** All AI calls must be logged to `/admin/ai-usage` for cost monitoring.

**Implementation Pattern:**

```python
from app.services.ai import get_usage_tracker
from app.services.ai.response import AccumulatedMetrics

# 1. Create accumulator at start of request
accumulated_metrics = AccumulatedMetrics()

# 2. Collect metrics from each AI-calling stage
result, ai_metrics = await execute_keyword_analysis(..., return_metrics=True)
if ai_metrics:
    accumulated_metrics.add(ai_metrics)

# 3. Log aggregated metrics at end of request
if accumulated_metrics.call_count > 0:
    usage_tracker = get_usage_tracker()
    await usage_tracker.log_generation(
        db=db,
        user_id=current_user_id,
        endpoint="/ats/analyze-content",
        response=accumulated_metrics,
    )
    await db.commit()
```

**Stages with AI calls:**

| Stage | AI Calls | Tracking |
| ----- | -------- | -------- |
| Knockout (0) | ResumeParser, JobAnalyzer | ✅ Accumulated |
| Structure (1) | None | N/A |
| Keywords (2) | KeywordExtractor (if enhanced) | ✅ Accumulated |
| Content Quality (3) | None | N/A |
| Role Proximity (4) | JobAnalyzer (if not cached) | ✅ Accumulated |

**Consistency with stepper:** Both `/analyze-progressive` and `/analyze-content` use the same `AccumulatedMetrics` pattern to aggregate AI usage across stages, logging a single consolidated entry per request.

## Design Decisions

- **All 5 stages:** Run full pipeline (knockout, structure, keywords, content quality, role proximity) for complete consistency with stepper
- **Cost trade-off accepted:** ~4-5 AI calls per recalculation for accuracy
- **Debounce:** Keep 1500ms debounce to limit API calls during rapid edits
- **AI usage tracking:** Use `AccumulatedMetrics` pattern matching stepper implementation

## Verification

1. **Backend:** Test new endpoint with raw content matches progressive output

   ```bash
   # Compare scores between endpoints with same input
   curl -X POST /ats/analyze-content -d '{"resume_content": {...}, "job_description": "..."}'
   ```

2. **Frontend:** Verify editor score updates on live edits
   - Edit experience bullet
   - Confirm score recalculates within debounce window (1500ms)
   - Compare with stepper score for same content

3. **Consistency check:**
   - Run stepper analysis on a resume
   - Open editor, make no changes
   - Verify editor shows same score as stepper

4. **AI usage tracking verification:**
   - Make an edit in the editor
   - Go to `/admin/ai-usage` dashboard
   - Verify entry appears with endpoint `/ats/analyze-content`
   - Confirm token counts and cost are recorded
