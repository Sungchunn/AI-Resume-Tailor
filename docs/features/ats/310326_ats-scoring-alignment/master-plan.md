# ATS Scoring Alignment: Editor Page to Tailor/Analyze Page

## Problem Summary

The editor page (`/library/resumes/[id]/edit`) uses **two separate ATS evaluation systems** with different scoring logic:

| Component | Data Source | Scoring Logic |
| --------- | ----------- | ------------- |
| ATSScoreSummary, StageBreakdown | `/api/v1/ats/analyze-progressive` Stage 2 | Enhanced 4-layer weighted scoring |
| KeywordAnalysis (keyword lists) | `/api/v1/ats/keywords/detailed` | Simple binary matching |

**Result:** The keyword coverage shown in `KeywordAnalysis` differs from the keyword score in `StageBreakdown`, causing inconsistent metrics.

### Key Differences in Scoring

| Aspect | `/keywords/detailed` (Current) | `/keywords/enhanced` (Tailor Flow) |
| ------ | ------------------------------ | ---------------------------------- |
| Importance tiers | 3 levels | 4 levels (adds "strongly_preferred") |
| Placement weighting | None | Yes (0.3x-1.0x by section) |
| Density scoring | None | Yes (logarithmic 1.0x-2.0x) |
| Recency weighting | None | Yes (2.0x recent to 0.6x old) |
| Cross-section bonus | None | Yes (1.15x) |

## Solution

**Populate `atsAnalysis` from the progressive endpoint's Stage 2 results** instead of calling `/keywords/detailed` separately.

The progressive endpoint already returns detailed keyword data in Stage 2. We need to:

1. Transform the enhanced keyword analysis response format to match what `KeywordAnalysis` component expects
2. Populate `atsAnalysis` from Stage 2 results instead of a separate API call
3. Remove the redundant `/keywords/detailed` call from `WorkshopProvider`

## Implementation Steps

### Step 1: Update `useATSProgressiveAnalysis` Hook

**File:** `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts`

Modify the `stage_complete` handler for Stage 2 to dispatch the keyword analysis data to `atsAnalysis` state:

```typescript
case "stage_complete": {
  const result = data.result as SSEStageCompleteEvent;
  dispatch({
    type: "ATS_STAGE_COMPLETE",
    payload: { ... },
  });

  // NEW: If Stage 2 (Keyword Matching), also populate atsAnalysis
  if (result.stage === 2 && result.details) {
    dispatch({
      type: "SET_ATS_ANALYSIS",
      payload: transformEnhancedToDetailedFormat(result.details),
    });
  }
  break;
}
```

### Step 2: Create Transform Function

**File:** `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts`

Add a function to transform the enhanced keyword analysis response to the format expected by `KeywordAnalysis` component:

```typescript
function transformEnhancedToDetailedFormat(
  enhanced: EnhancedKeywordAnalysis
): ATSKeywordDetailedResponse {
  return {
    coverage_score: enhanced.raw_coverage / 100, // Convert 0-100 to 0-1
    required_matched: enhanced.required_matched ?? [],
    required_missing: enhanced.required_missing ?? [],
    preferred_matched: [
      ...(enhanced.strongly_preferred_matched ?? []),
      ...(enhanced.preferred_matched ?? []),
    ],
    preferred_missing: [
      ...(enhanced.strongly_preferred_missing ?? []),
      ...(enhanced.preferred_missing ?? []),
    ],
    nice_to_have_matched: enhanced.nice_to_have_matched ?? [],
    nice_to_have_missing: enhanced.nice_to_have_missing ?? [],
    missing_available_in_vault: enhanced.missing_available_in_vault ?? [],
    missing_not_in_vault: enhanced.missing_not_in_vault ?? [],
    all_keywords: enhanced.all_keywords ?? [],
  };
}
```

### Step 3: Handle Cache Hit Event

**File:** `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts`

When receiving a `cache_hit` event, also extract Stage 2 results and populate `atsAnalysis`:

```typescript
case "cache_hit": {
  const payload = data as SSECacheHitEvent;
  // ... existing dispatch ...

  // NEW: Extract keyword analysis from cached stage results
  const keywordStage = payload.stage_results?.["Keyword Matching"];
  if (keywordStage?.details) {
    dispatch({
      type: "SET_ATS_ANALYSIS",
      payload: transformEnhancedToDetailedFormat(keywordStage.details),
    });
  }
  break;
}
```

### Step 4: Remove Redundant API Call

**File:** `frontend/src/components/workshop/WorkshopProvider.tsx`

Remove or comment out the `fetchATSAnalysis` function and its invocation since keyword data will now come from the progressive analysis:

```typescript
// REMOVE these lines (around line 47 and 235-246):
// const atsAnalysisMutation = useATSKeywordAnalysis();
// ...
// const fetchATSAnalysis = useCallback(async () => { ... }, [...]);
```

### Step 5: Add Type Definition for Enhanced Response

**File:** `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts`

Add interface matching the backend `EnhancedKeywordAnalysis` dataclass from `backend/app/services/job/ats/models/keywords.py`:

```typescript
interface EnhancedKeywordDetail {
  keyword: string;
  importance: string;
  found_in_resume: boolean;
  found_in_vault: boolean;
  frequency_in_job: number;
  context: string | null;
  occurrence_count: number;
  base_score: number;
  placement_score: number;
  density_score: number;
  recency_score: number;
  importance_weight: number;
  weighted_score: number;
}

interface EnhancedKeywordAnalysis {
  // Overall scores (0-100)
  keyword_score: number;
  raw_coverage: number;

  // Coverage by tier (0-1)
  required_coverage: number;
  strongly_preferred_coverage: number;
  preferred_coverage: number;
  nice_to_have_coverage: number;

  // Score contributions
  placement_contribution: number;
  density_contribution: number;
  recency_contribution: number;

  // Grouped keywords
  required_matched: string[];
  required_missing: string[];
  strongly_preferred_matched: string[];
  strongly_preferred_missing: string[];
  preferred_matched: string[];
  preferred_missing: string[];
  nice_to_have_matched: string[];
  nice_to_have_missing: string[];

  // Vault availability
  missing_available_in_vault: string[];
  missing_not_in_vault: string[];

  // Gap analysis
  gap_list: Array<{ keyword: string; importance: string; in_vault: boolean }>;

  // Detailed keywords
  all_keywords: EnhancedKeywordDetail[];

  // Suggestions
  suggestions: string[];
  warnings: string[];
}
```

### Step 6: Update Transform Function for Type Compatibility

The transform must convert enhanced format to the simpler `ATSKeywordDetailedResponse` expected by `KeywordAnalysis`:

```typescript
function transformEnhancedToDetailedFormat(
  enhanced: EnhancedKeywordAnalysis
): ATSKeywordDetailedResponse {
  // Merge strongly_preferred into preferred (frontend type has 3 tiers, backend has 4)
  const preferredMatched = [
    ...(enhanced.strongly_preferred_matched ?? []),
    ...(enhanced.preferred_matched ?? []),
  ];
  const preferredMissing = [
    ...(enhanced.strongly_preferred_missing ?? []),
    ...(enhanced.preferred_missing ?? []),
  ];

  // Convert EnhancedKeywordDetail to simpler KeywordDetail
  const allKeywords = (enhanced.all_keywords ?? []).map((kw) => ({
    keyword: kw.keyword,
    importance: kw.importance === "strongly_preferred" ? "preferred" : kw.importance,
    found_in_resume: kw.found_in_resume,
    found_in_vault: kw.found_in_vault,
    frequency_in_job: kw.frequency_in_job,
    context: kw.context,
  }));

  return {
    coverage_score: enhanced.raw_coverage / 100, // Convert 0-100 to 0-1
    required_coverage: enhanced.required_coverage,
    preferred_coverage: Math.max(
      enhanced.strongly_preferred_coverage ?? 0,
      enhanced.preferred_coverage ?? 0
    ),
    required_matched: enhanced.required_matched ?? [],
    required_missing: enhanced.required_missing ?? [],
    preferred_matched: preferredMatched,
    preferred_missing: preferredMissing,
    nice_to_have_matched: enhanced.nice_to_have_matched ?? [],
    nice_to_have_missing: enhanced.nice_to_have_missing ?? [],
    missing_available_in_vault: enhanced.missing_available_in_vault ?? [],
    missing_not_in_vault: enhanced.missing_not_in_vault ?? [],
    all_keywords: allKeywords,
  };
}
```

## Files to Modify

1. `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts` - Main changes
2. `frontend/src/components/workshop/WorkshopProvider.tsx` - Remove redundant API call

## Verification

1. **Run the editor page** with a job listing linked
2. **Trigger ATS analysis** via the "Analyze Resume" button
3. **Verify consistency:**
   - The keyword score in `StageBreakdown` (Stage 2) should align with the coverage shown in `KeywordAnalysis`
   - The keyword lists (required/preferred/nice-to-have matched/missing) should come from enhanced analysis
4. **Test cache hit scenario:**
   - Refresh page or re-analyze
   - Verify cached results populate `KeywordAnalysis` correctly
5. **Compare with tailor/analyze page:**
   - Navigate to `/tailor/analyze?resume_id=X&job_listing_id=Y`
   - Verify both pages show the same keyword evaluation metrics
