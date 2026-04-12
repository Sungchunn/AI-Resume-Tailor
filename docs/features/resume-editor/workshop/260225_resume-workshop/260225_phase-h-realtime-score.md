# Phase H: Real-Time Score Updates

**Created**: February 25, 2026
**Status**: Ready for Implementation
**Dependencies**: Phase G (Style Controls Panel)
**Priority**: P1
**Next Phase**: Phase I (Step-by-Step Wizard)

---

## Overview

Update match score as resume content changes in real-time. This creates a feedback loop where users can see how their edits improve (or decrease) their match score, making the editing process more engaging and goal-oriented.

---

## Key Features

1. **Debounced Score Recalculation** - Score updates after content changes with debouncing to prevent API spam
2. **Visual Loading Indicator** - Clear feedback when score is being recalculated
3. **Score History/Comparison** - Show improvement or decline from previous score
4. **Optimistic UI** - Immediate visual feedback while waiting for API response

---

## Component Architecture

```text
frontend/src/components/workshop/
├── ScoreDisplay/
│   ├── ScoreDisplay.tsx         # Main score display component
│   ├── ScoreUpdateIndicator.tsx # Loading/updating state indicator
│   ├── ScoreComparison.tsx      # Before/after score comparison
│   └── index.ts                 # Exports
├── hooks/
│   └── useScoreCalculation.ts   # Debounced score calculation hook
```

---

## Interfaces

```typescript
// frontend/src/components/workshop/ScoreDisplay/types.ts

export interface ScoreDisplayProps {
  score: number;
  previousScore?: number;
  isUpdating: boolean;
  lastUpdated?: Date;
  className?: string;
}

export interface ScoreUpdateIndicatorProps {
  isUpdating: boolean;
  showPulse?: boolean;
}

export interface ScoreComparisonProps {
  currentScore: number;
  previousScore: number;
  showDelta?: boolean;
}

export type ScoreCalculationStatus =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "calculating" }
  | { state: "success"; score: number }
  | { state: "error"; message: string };

export interface UseScoreCalculationOptions {
  content: TailoredContent;
  jobDescription: string | null;
  resumeId: number;
  jobId: number | null;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseScoreCalculationResult {
  score: number;
  previousScore: number | null;
  status: ScoreCalculationStatus;
  isUpdating: boolean;
  lastUpdated: Date | null;
  triggerRecalculation: () => void;
}
```

---

## Implementation Details

### 1. useScoreCalculation.ts (Debounced Calculation Hook)

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import type { TailoredContent } from "@/lib/api/types";
import type {
  UseScoreCalculationOptions,
  UseScoreCalculationResult,
  ScoreCalculationStatus,
} from "./types";
import { apiClient } from "@/lib/api/client";

const DEFAULT_DEBOUNCE_MS = 1500;

export function useScoreCalculation({
  content,
  jobDescription,
  resumeId,
  jobId,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseScoreCalculationOptions): UseScoreCalculationResult {
  const [score, setScore] = useState<number>(0);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [status, setStatus] = useState<ScoreCalculationStatus>({ state: "idle" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track content hash to detect changes
  const contentHashRef = useRef<string>("");
  const initialLoadRef = useRef(true);

  const calculateScore = useCallback(async () => {
    if (!jobId || !enabled) return;

    setStatus({ state: "calculating" });

    try {
      const response = await apiClient.post("/tailor/quick-match", {
        resume_id: resumeId,
        job_id: jobId,
        // Could pass content for real-time analysis if API supports it
      });

      const newScore = response.data.match_score;

      // Track previous score for comparison
      if (!initialLoadRef.current) {
        setPreviousScore(score);
      }
      initialLoadRef.current = false;

      setScore(newScore);
      setStatus({ state: "success", score: newScore });
      setLastUpdated(new Date());
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Failed to calculate score",
      });
    }
  }, [resumeId, jobId, enabled, score]);

  // Debounced calculation
  const debouncedCalculate = useDebouncedCallback(
    calculateScore,
    debounceMs
  );

  // Generate content hash for change detection
  const getContentHash = useCallback((c: TailoredContent): string => {
    return JSON.stringify({
      summary: c.summary,
      experience: c.experience.map((e) => ({
        title: e.title,
        bullets: e.bullets,
      })),
      skills: c.skills,
      highlights: c.highlights,
    });
  }, []);

  // Watch for content changes
  useEffect(() => {
    const newHash = getContentHash(content);

    if (newHash !== contentHashRef.current) {
      contentHashRef.current = newHash;

      // Skip debounce on initial load
      if (status.state === "idle" && initialLoadRef.current) {
        calculateScore();
      } else {
        setStatus({ state: "pending" });
        debouncedCalculate();
      }
    }
  }, [content, getContentHash, debouncedCalculate, calculateScore, status.state]);

  const triggerRecalculation = useCallback(() => {
    debouncedCalculate.cancel();
    calculateScore();
  }, [debouncedCalculate, calculateScore]);

  return {
    score,
    previousScore,
    status,
    isUpdating: status.state === "pending" || status.state === "calculating",
    lastUpdated,
    triggerRecalculation,
  };
}
```

### 2. ScoreDisplay.tsx (Main Component)

```typescript
"use client";

import { ScoreUpdateIndicator } from "./ScoreUpdateIndicator";
import { ScoreComparison } from "./ScoreComparison";
import type { ScoreDisplayProps } from "./types";

export function ScoreDisplay({
  score,
  previousScore,
  isUpdating,
  lastUpdated,
  className = "",
}: ScoreDisplayProps) {
  const scoreColor = score >= 80 ? "text-green-600" :
                     score >= 60 ? "text-yellow-600" : "text-red-600";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Main Score */}
      <div className="relative">
        <div className={`text-3xl font-bold ${scoreColor} transition-colors`}>
          {score}
          <span className="text-lg text-gray-400">%</span>
        </div>

        {/* Updating Indicator */}
        <ScoreUpdateIndicator isUpdating={isUpdating} />
      </div>

      {/* Score Comparison */}
      {previousScore !== undefined && previousScore !== null && (
        <ScoreComparison
          currentScore={score}
          previousScore={previousScore}
          showDelta
        />
      )}

      {/* Last Updated */}
      {lastUpdated && !isUpdating && (
        <span className="text-xs text-gray-400">
          Updated {formatTimeAgo(lastUpdated)}
        </span>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
```

### 3. ScoreUpdateIndicator.tsx

```typescript
"use client";

import type { ScoreUpdateIndicatorProps } from "./types";

export function ScoreUpdateIndicator({
  isUpdating,
  showPulse = true,
}: ScoreUpdateIndicatorProps) {
  if (!isUpdating) return null;

  return (
    <div className="absolute -top-1 -right-1">
      {showPulse && (
        <span className="flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
        </span>
      )}
    </div>
  );
}
```

### 4. ScoreComparison.tsx

```typescript
"use client";

import type { ScoreComparisonProps } from "./types";

export function ScoreComparison({
  currentScore,
  previousScore,
  showDelta = false,
}: ScoreComparisonProps) {
  const delta = currentScore - previousScore;
  const isImproved = delta > 0;
  const isDeclined = delta < 0;
  const isUnchanged = delta === 0;

  if (isUnchanged) return null;

  return (
    <div className="flex items-center gap-1">
      {/* Arrow Indicator */}
      {isImproved ? (
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      )}

      {/* Delta Value */}
      {showDelta && (
        <span className={`text-sm font-medium ${isImproved ? "text-green-600" : "text-red-600"}`}>
          {isImproved ? "+" : ""}{delta}
        </span>
      )}

      {/* Previous Score (smaller) */}
      <span className="text-xs text-gray-400">
        from {previousScore}%
      </span>
    </div>
  );
}
```

---

## Integration Points

### 1. WorkshopContext.tsx - Add Score State

```typescript
// Add to WorkshopState
export interface WorkshopState {
  // ... existing state
  matchScore: number;
  previousMatchScore: number | null;
  scoreLastUpdated: Date | null;
  isScoreUpdating: boolean;
}

// Add actions
export type WorkshopAction =
  // ... existing actions
  | { type: "SET_MATCH_SCORE"; payload: { score: number; previous?: number } }
  | { type: "SET_SCORE_UPDATING"; payload: boolean };
```

### 2. WorkshopHeader.tsx - Display Score

The score display should be integrated into the workshop header alongside the job title and save button:

```typescript
// In WorkshopHeader.tsx
import { ScoreDisplay } from "./ScoreDisplay";

export function WorkshopHeader() {
  const { state } = useWorkshop();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b">
      {/* Left: Job Info */}
      <div>...</div>

      {/* Center: Score Display */}
      <ScoreDisplay
        score={state.matchScore}
        previousScore={state.previousMatchScore}
        isUpdating={state.isScoreUpdating}
        lastUpdated={state.scoreLastUpdated}
      />

      {/* Right: Actions */}
      <div>...</div>
    </header>
  );
}
```

### 3. WorkshopProvider.tsx - Hook Integration

```typescript
// In WorkshopProvider
const { score, previousScore, isUpdating, lastUpdated } = useScoreCalculation({
  content: state.content,
  jobDescription: state.jobDescription,
  resumeId: state.tailoredResume?.resume_id ?? 0,
  jobId: state.tailoredResume?.job_id ?? null,
  enabled: !!state.tailoredResume?.job_id,
});

// Sync to state
useEffect(() => {
  dispatch({
    type: "SET_MATCH_SCORE",
    payload: { score, previous: previousScore ?? undefined },
  });
}, [score, previousScore]);

useEffect(() => {
  dispatch({ type: "SET_SCORE_UPDATING", payload: isUpdating });
}, [isUpdating]);
```

---

## API Considerations

### Existing Endpoint: POST /api/tailor/quick-match

Current signature:
```typescript
interface QuickMatchRequest {
  resume_id: number;
  job_id: number;
}

interface QuickMatchResponse {
  match_score: number;
  keyword_coverage: number;
  skill_matches: string[];
  skill_gaps: string[];
}
```

### Option A: Use Existing Endpoint (Simpler)

- Calculate score based on resume_id and job_id
- Backend re-fetches tailored content from database
- Requires saving content first for score to update
- **Pros**: No API changes needed
- **Cons**: Score reflects saved state, not live edits

### Option B: Enhanced Endpoint (Recommended for Phase H)

Add optional `content` parameter for real-time scoring:

```typescript
interface QuickMatchRequest {
  resume_id: number;
  job_id: number;
  content?: TailoredContent; // Optional: score this content instead of saved
}
```

- If `content` is provided, score against that content
- If not, use saved tailored resume content
- **Pros**: True real-time scoring without saving
- **Cons**: Larger request payload, more API processing

**Recommendation**: Start with Option A for initial implementation. If latency or UX issues arise, implement Option B.

---

## Performance Considerations

### Debounce Strategy

| Scenario | Debounce Time |
|----------|---------------|
| Typing in text field | 1500ms |
| Skill toggle (add/remove) | 500ms |
| Bullet reorder | 0ms (immediate) |
| Section reorder | 0ms (immediate) |

### Rate Limiting

- Maximum 1 API call per second
- Queue requests if rate limited
- Show "Rate limited, retrying..." status

### Caching

- Cache last known score for each content hash
- Show cached score immediately while recalculating
- Invalidate cache on job description change

---

## Edge Cases

| Edge Case | Solution |
|-----------|----------|
| No job_id (standalone resume) | Hide score display entirely |
| API timeout | Show "Calculating..." with timeout message |
| Network offline | Show cached score with "Offline" indicator |
| Rapid edits during calculation | Cancel in-flight request, restart timer |
| Score drops significantly | Animate change, maybe show undo suggestion |
| Initial load | Show skeleton/loading state |
| Content unchanged | Skip API call, keep current score |

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/useScoreCalculation.spec.ts

describe("useScoreCalculation", () => {
  test("debounces rapid content changes", async () => {
    const { result } = renderHook(() => useScoreCalculation({...}));

    // Trigger 5 rapid content changes
    for (let i = 0; i < 5; i++) {
      act(() => result.current.updateContent({...}));
    }

    await waitFor(() => {
      // Only 1 API call should be made
      expect(mockApiCall).toHaveBeenCalledTimes(1);
    });
  });

  test("tracks previous score correctly", async () => {
    const { result } = renderHook(() => useScoreCalculation({...}));

    // Initial score
    mockApiCall.mockResolvedValueOnce({ match_score: 75 });
    await act(() => result.current.triggerRecalculation());

    expect(result.current.previousScore).toBeNull();
    expect(result.current.score).toBe(75);

    // Updated score
    mockApiCall.mockResolvedValueOnce({ match_score: 82 });
    await act(() => result.current.triggerRecalculation());

    expect(result.current.previousScore).toBe(75);
    expect(result.current.score).toBe(82);
  });

  test("handles API errors gracefully", async () => {
    mockApiCall.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useScoreCalculation({...}));

    await act(() => result.current.triggerRecalculation());

    expect(result.current.status.state).toBe("error");
    expect(result.current.score).toBe(0); // Keeps previous score
  });
});
```

### Component Tests

```typescript
// tests/components/ScoreDisplay.spec.tsx

test("shows improvement indicator when score increases", () => {
  render(<ScoreDisplay score={85} previousScore={75} isUpdating={false} />);

  expect(screen.getByText("+10")).toBeInTheDocument();
  expect(screen.getByText("from 75%")).toBeInTheDocument();
});

test("shows updating indicator when calculating", () => {
  render(<ScoreDisplay score={75} isUpdating={true} />);

  expect(screen.getByRole("status")).toHaveClass("animate-ping");
});

test("shows appropriate color based on score", () => {
  const { rerender } = render(<ScoreDisplay score={85} isUpdating={false} />);
  expect(screen.getByText("85")).toHaveClass("text-green-600");

  rerender(<ScoreDisplay score={65} isUpdating={false} />);
  expect(screen.getByText("65")).toHaveClass("text-yellow-600");

  rerender(<ScoreDisplay score={45} isUpdating={false} />);
  expect(screen.getByText("45")).toHaveClass("text-red-600");
});
```

---

## Dependencies

### New Package Required

```bash
bun add use-debounce
```

### Existing Dependencies Used
- React hooks (useState, useEffect, useCallback, useRef)
- Existing API client
- Tailwind CSS for styling

---

## Acceptance Criteria

- [ ] Score updates within 1.5s of content change (debounced)
- [ ] Visual indicator shows when score is recalculating
- [ ] Previous score comparison shows delta (e.g., "+5 from 75%")
- [ ] Score color reflects quality (green/yellow/red thresholds)
- [ ] No score shown when no job is associated
- [ ] API calls are debounced (no spam)
- [ ] Error states handled gracefully
- [ ] Loading state on initial load
- [ ] Score persists across tab switches within workshop

---

## Handoff Notes

**Files to reference:**
- `WorkshopContext.tsx` at `/frontend/src/components/workshop/WorkshopContext.tsx` - state management
- `WorkshopProvider.tsx` - context provider (create if not exists)
- API client at `/frontend/src/lib/api/client.ts`

**Context patterns:**
```typescript
const { state, dispatch } = useWorkshop();
dispatch({ type: "SET_MATCH_SCORE", payload: { score: 85, previous: 75 } });
```

**API endpoint:**
```typescript
const response = await apiClient.post("/tailor/quick-match", {
  resume_id: 123,
  job_id: 456,
});
// Returns: { match_score: number, keyword_coverage: number, ... }
```

---

## Phase Order Reference

A (PDF Preview) → B (Layout) → C-D (Score + Tabs) ✓ → E (AI Rewrite) ✓ → F (Editor) → G (Style) → **H (Score Updates)** → I (Wizard) → J (Polish)
