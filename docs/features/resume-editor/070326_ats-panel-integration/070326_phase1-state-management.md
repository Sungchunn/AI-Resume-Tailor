# Phase 1: State Foundation

**Parent Document:** `070326_master-plan.md`
**Status:** Planning

---

## Overview

Extend `WorkshopContext` with ATS-specific state fields, actions, and reducer logic. Create hooks for SSE progressive analysis and staleness detection.

---

## WorkshopState Extensions

Add to `WorkshopState` interface in `WorkshopContext.tsx`:

```typescript
// ATS Progressive Analysis State
atsCompositeScore: ATSCompositeScore | null;
atsStageResults: Record<string, ATSStageResult>;
atsKnockoutRisks: KnockoutRisk[];
atsIsAnalyzing: boolean;
atsCurrentStage: number;
atsOverallProgress: number;  // 0-100 across all stages
atsIsStale: boolean;
atsLastAnalyzedAt: Date | null;
atsContentHash: string | null;
atsFatalError: string | null;
```

### Type Definitions

```typescript
interface ATSCompositeScore {
  final_score: number;
  stage_breakdown: {
    structure: number;
    keywords: number;
    content_quality: number;
    role_proximity: number;
  };
  weights_used: {
    structure: number;      // 0.15
    keywords: number;       // 0.40
    content_quality: number; // 0.25
    role_proximity: number;  // 0.20
  };
  normalization_applied: boolean;
  failed_stages: string[];
}

interface ATSStageResult {
  stage: number;
  name: string;
  score: number;
  details: Record<string, unknown>;
  elapsed_ms: number;
}

interface KnockoutRisk {
  category: "experience" | "education" | "certification" | "location";
  severity: "hard" | "soft";
  message: string;
  job_requirement: string;
  resume_value: string;
}
```

---

## Initial State Additions

```typescript
export const initialState: WorkshopState = {
  // ... existing fields ...

  // ATS Progressive Analysis
  atsCompositeScore: null,
  atsStageResults: {},
  atsKnockoutRisks: [],
  atsIsAnalyzing: false,
  atsCurrentStage: -1,
  atsOverallProgress: 0,
  atsIsStale: false,
  atsLastAnalyzedAt: null,
  atsContentHash: null,
  atsFatalError: null,
};
```

---

## New Actions

Add to `WorkshopAction` type union:

```typescript
// ATS Analysis Actions
| { type: "ATS_ANALYSIS_START" }
| { type: "ATS_STAGE_START"; payload: { stage: number; name: string } }
| { type: "ATS_STAGE_COMPLETE"; payload: ATSStageResult }
| { type: "ATS_STAGE_ERROR"; payload: { stage: number; error: string } }
| { type: "ATS_ANALYSIS_COMPLETE"; payload: {
    score: ATSCompositeScore;
    knockouts: KnockoutRisk[];
    hash: string;
    timestamp: Date;
  }}
| { type: "ATS_ANALYSIS_ERROR"; payload: string }
| { type: "MARK_ATS_STALE" }
| { type: "ATS_CACHE_HIT"; payload: {
    score: ATSCompositeScore;
    stageResults: Record<string, ATSStageResult>;
    knockouts: KnockoutRisk[];
    cachedAt: Date;
    hash: string;
  }}
```

---

## Reducer Cases

### ATS Analysis Flow

```typescript
case "ATS_ANALYSIS_START":
  return {
    ...state,
    atsIsAnalyzing: true,
    atsCurrentStage: 0,
    atsOverallProgress: 0,
    atsStageResults: {},
    atsFatalError: null,
  };

case "ATS_STAGE_START":
  return {
    ...state,
    atsCurrentStage: action.payload.stage,
    // Progress: each of 5 stages = 20%
    atsOverallProgress: action.payload.stage * 20,
  };

case "ATS_STAGE_COMPLETE":
  return {
    ...state,
    atsStageResults: {
      ...state.atsStageResults,
      [action.payload.name]: action.payload,
    },
    atsOverallProgress: (action.payload.stage + 1) * 20,
  };

case "ATS_STAGE_ERROR":
  return {
    ...state,
    atsStageResults: {
      ...state.atsStageResults,
      [`stage_${action.payload.stage}_error`]: {
        stage: action.payload.stage,
        name: "error",
        score: 0,
        details: { error: action.payload.error },
        elapsed_ms: 0,
      },
    },
  };

case "ATS_ANALYSIS_COMPLETE":
  return {
    ...state,
    atsIsAnalyzing: false,
    atsCompositeScore: action.payload.score,
    atsKnockoutRisks: action.payload.knockouts,
    atsContentHash: action.payload.hash,
    atsLastAnalyzedAt: action.payload.timestamp,
    atsIsStale: false,
    atsCurrentStage: -1,
    atsOverallProgress: 100,
  };

case "ATS_ANALYSIS_ERROR":
  return {
    ...state,
    atsIsAnalyzing: false,
    atsFatalError: action.payload,
    atsCurrentStage: -1,
  };

case "ATS_CACHE_HIT":
  return {
    ...state,
    atsCompositeScore: action.payload.score,
    atsStageResults: action.payload.stageResults,
    atsKnockoutRisks: action.payload.knockouts,
    atsContentHash: action.payload.hash,
    atsLastAnalyzedAt: action.payload.cachedAt,
    atsIsStale: false,
    atsIsAnalyzing: false,
  };
```

### Staleness Tracking

Modify existing reducer cases to mark ATS stale:

```typescript
case "SET_CONTENT":
  return {
    ...state,
    content: action.payload,
    hasChanges: true,
    atsIsStale: state.atsCompositeScore !== null,  // Only mark stale if we have a score
  };

case "ACCEPT_SUGGESTION": {
  const { index, suggestion } = action.payload;
  const updatedContent = applySuggestionToContent(state.content, suggestion);
  const updatedSuggestions = state.suggestions.filter((_, i) => i !== index);
  return {
    ...state,
    content: updatedContent,
    suggestions: updatedSuggestions,
    hasChanges: true,
    atsIsStale: state.atsCompositeScore !== null,
  };
}

case "SET_SECTION_ORDER":
  return {
    ...state,
    sectionOrder: action.payload,
    hasChanges: true,
    atsIsStale: state.atsCompositeScore !== null,
  };

case "MARK_ATS_STALE":
  return {
    ...state,
    atsIsStale: true,
  };
```

---

## useATSProgressiveAnalysis Hook

Create `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts`:

```typescript
import { useCallback, useRef } from "react";
import { useWorkshop } from "../WorkshopContext";

interface UseATSProgressiveAnalysisOptions {
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useATSProgressiveAnalysis(options?: UseATSProgressiveAnalysisOptions) {
  const { state, dispatch } = useWorkshop();
  const eventSourceRef = useRef<EventSource | null>(null);

  const analyze = useCallback(async () => {
    if (!state.tailoredId || !state.tailoredResume?.job_id) {
      console.error("Missing resume or job ID");
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    dispatch({ type: "ATS_ANALYSIS_START" });

    const url = new URL("/api/v1/ats/analyze-progressive", window.location.origin);
    url.searchParams.set("resume_id", state.tailoredId);
    url.searchParams.set("job_id", state.tailoredResume.job_id.toString());

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "cache_hit":
          dispatch({
            type: "ATS_CACHE_HIT",
            payload: {
              score: data.composite_score,
              stageResults: data.stage_results,
              knockouts: data.knockout_risks ?? [],
              cachedAt: new Date(data.cached_at),
              hash: data.content_hash,
            },
          });
          eventSource.close();
          options?.onComplete?.();
          break;

        case "stage_start":
          dispatch({
            type: "ATS_STAGE_START",
            payload: { stage: data.stage, name: data.name },
          });
          break;

        case "stage_complete":
          dispatch({
            type: "ATS_STAGE_COMPLETE",
            payload: data.result,
          });
          break;

        case "stage_error":
          dispatch({
            type: "ATS_STAGE_ERROR",
            payload: { stage: data.stage, error: data.error },
          });
          break;

        case "complete":
          dispatch({
            type: "ATS_ANALYSIS_COMPLETE",
            payload: {
              score: data.composite_score,
              knockouts: data.knockout_risks ?? [],
              hash: data.content_hash,
              timestamp: new Date(),
            },
          });
          eventSource.close();
          options?.onComplete?.();
          break;
      }
    };

    eventSource.onerror = () => {
      dispatch({ type: "ATS_ANALYSIS_ERROR", payload: "Connection failed" });
      eventSource.close();
      options?.onError?.("Connection failed");
    };
  }, [state.tailoredId, state.tailoredResume?.job_id, dispatch, options]);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return {
    analyze,
    cancel,
    isAnalyzing: state.atsIsAnalyzing,
    currentStage: state.atsCurrentStage,
    progress: state.atsOverallProgress,
  };
}
```

---

## useATSStaleness Hook

Create `frontend/src/components/workshop/hooks/useATSStaleness.ts`:

```typescript
import { useMemo } from "react";
import { useWorkshop } from "../WorkshopContext";
import { formatDistanceToNow } from "date-fns";

export function useATSStaleness() {
  const { state } = useWorkshop();

  const staleness = useMemo(() => {
    const hasScore = state.atsCompositeScore !== null;
    const isStale = state.atsIsStale;
    const lastAnalyzed = state.atsLastAnalyzedAt;

    let staleSince: string | null = null;
    if (lastAnalyzed) {
      staleSince = formatDistanceToNow(lastAnalyzed, { addSuffix: true });
    }

    return {
      hasScore,
      isStale,
      lastAnalyzed,
      staleSince,
      score: state.atsCompositeScore?.final_score ?? null,
      hasKnockouts: state.atsKnockoutRisks.length > 0,
      knockoutCount: state.atsKnockoutRisks.length,
    };
  }, [
    state.atsCompositeScore,
    state.atsIsStale,
    state.atsLastAnalyzedAt,
    state.atsKnockoutRisks,
  ]);

  return staleness;
}
```

---

## WorkshopTab Type Update

Update the `WorkshopTab` type:

```typescript
export type WorkshopTab = "ai-rewrite" | "editor" | "style" | "ats";
```

---

## Files to Create/Modify

| File | Action |
| ---- | ------ |
| `WorkshopContext.tsx` | **EDIT** - Add types, state, actions, reducer |
| `hooks/useATSProgressiveAnalysis.ts` | **CREATE** |
| `hooks/useATSStaleness.ts` | **CREATE** |

---

## Verification

- [ ] New state fields initialize correctly
- [ ] `ATS_ANALYSIS_START` clears previous results
- [ ] Stage events dispatch correctly
- [ ] `ATS_ANALYSIS_COMPLETE` sets all fields
- [ ] `SET_CONTENT` marks ATS stale
- [ ] `ACCEPT_SUGGESTION` marks ATS stale
- [ ] `SET_STYLE` does NOT mark ATS stale
- [ ] SSE hook connects and dispatches events
- [ ] SSE handles cache hits correctly
- [ ] Staleness hook returns correct values
