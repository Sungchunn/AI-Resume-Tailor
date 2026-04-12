# Phase 1: Extend Store with AI Review Mode State

**Goal:** Add AI review navigation state to the existing `bulletSuggestionsStore` so the UI can track which suggestion is currently active and drive sequential review.

---

## 1.1 New State Fields

**File:** `frontend/src/lib/stores/bulletSuggestionsStore.ts`

Add to `BulletSuggestionsState`:

```typescript
// AI review mode
aiReviewActive: boolean;           // true when in sequential review mode
aiReviewIndex: number;             // index into the ordered suggestion list
aiReviewComplete: boolean;         // true when all suggestions have been reviewed
preAnalysisScore: number | null;   // ATS score captured before analysis (for delta display)
```

---

## 1.2 New Actions

Add to `BulletSuggestionsActions`:

```typescript
startAiReview: () => void;                   // Enter AI review mode (set index to 0)
exitAiReview: () => void;                    // Leave AI review mode, keep suggestions as cards
advanceNext: () => void;                     // Move aiReviewIndex forward past reviewed items
setPreAnalysisScore: (score: number) => void;
```

### Action Implementations

```typescript
startAiReview: () => set({
  aiReviewActive: true,
  aiReviewIndex: 0,
  aiReviewComplete: false,
}),

exitAiReview: () => set({
  aiReviewActive: false,
  aiReviewIndex: 0,
  aiReviewComplete: false,
}),

advanceNext: () => {
  const { suggestions, aiReviewIndex } = get();
  const pending = suggestions.filter(s => s.status === "pending");

  if (aiReviewIndex >= pending.length - 1) {
    // All reviewed
    set({ aiReviewComplete: true, aiReviewActive: false });
  } else {
    set({ aiReviewIndex: aiReviewIndex + 1 });
  }
},

setPreAnalysisScore: (score) => set({ preAnalysisScore: score }),
```

**Key behavior:** `advanceNext` checks remaining pending suggestions. When the current index reaches the end of the pending list, it sets `aiReviewComplete = true` and exits AI review mode.

---

## 1.3 New Selectors

```typescript
/**
 * Get the current suggestion in AI review mode.
 * Returns null when AI review is inactive or all suggestions reviewed.
 */
export const useCurrentAiReviewSuggestion = () =>
  useBulletSuggestionsStore((state) => {
    if (!state.aiReviewActive) return null;
    const pending = state.suggestions.filter(s => s.status === "pending");
    return pending[state.aiReviewIndex] ?? null;
  });

/**
 * Get AI review progress: { current, total, acceptedCount, rejectedCount }
 */
export const useAiReviewProgress = () =>
  useBulletSuggestionsStore((state) => {
    const total = state.suggestions.length;
    const accepted = state.suggestions.filter(s => s.status === "accepted").length;
    const rejected = state.suggestions.filter(s => s.status === "rejected").length;
    const reviewed = accepted + rejected;

    return {
      current: reviewed + 1,
      total,
      acceptedCount: accepted,
      rejectedCount: rejected,
      reviewed,
    };
  });
```

---

## 1.4 Integrate with Existing Actions

Modify `setSuggestions` to auto-enter AI review mode when suggestions arrive:

```typescript
setSuggestions: (suggestions, resumeId) =>
  set({
    suggestions,
    lastAnalyzedAt: new Date(),
    boundResumeId: resumeId,
    error: null,
    isAnalyzing: false,
    // Auto-enter AI review mode if there are suggestions
    aiReviewActive: suggestions.length > 0,
    aiReviewIndex: 0,
    aiReviewComplete: false,
  }),
```

Modify `clearSuggestions` to also reset AI review state:

```typescript
clearSuggestions: () =>
  set({
    suggestions: [],
    lastAnalyzedAt: null,
    error: null,
    aiReviewActive: false,
    aiReviewIndex: 0,
    aiReviewComplete: false,
    preAnalysisScore: null,
  }),
```

---

## 1.5 Initial State Defaults

```typescript
// Add to initial state:
aiReviewActive: false,
aiReviewIndex: 0,
aiReviewComplete: false,
preAnalysisScore: null,
```

---

## Verification

- [x] Store creates with AI review fields defaulted to inactive
- [x] `startAiReview()` sets `aiReviewActive = true`, `aiReviewIndex = 0`
- [x] `exitAiReview()` resets AI review state but keeps suggestions
- [x] `advanceNext()` increments index and sets `aiReviewComplete` at end
- [x] `setSuggestions()` auto-enters AI review mode when suggestions > 0
- [x] `useCurrentAiReviewSuggestion` returns correct pending suggestion at index
- [x] `useAiReviewProgress` returns accurate counts
- [x] TypeScript compiles: `cd frontend && bun run typecheck`
