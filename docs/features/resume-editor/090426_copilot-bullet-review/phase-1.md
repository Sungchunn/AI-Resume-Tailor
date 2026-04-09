# Phase 1: Extend Store with Copilot Mode State

**Goal:** Add copilot navigation state to the existing `bulletSuggestionsStore` so the UI can track which suggestion is currently active and drive sequential review.

---

## 1.1 New State Fields

**File:** `frontend/src/lib/stores/bulletSuggestionsStore.ts`

Add to `BulletSuggestionsState`:

```typescript
// Copilot mode
copilotActive: boolean;           // true when in sequential review mode
copilotIndex: number;             // index into the ordered suggestion list
copilotComplete: boolean;         // true when all suggestions have been reviewed
preAnalysisScore: number | null;  // ATS score captured before analysis (for delta display)
```

---

## 1.2 New Actions

Add to `BulletSuggestionsActions`:

```typescript
startCopilot: () => void;                   // Enter copilot mode (set index to 0)
exitCopilot: () => void;                    // Leave copilot mode, keep suggestions as cards
advanceNext: () => void;                    // Move copilotIndex forward past reviewed items
setPreAnalysisScore: (score: number) => void;
```

### Action Implementations

```typescript
startCopilot: () => set({
  copilotActive: true,
  copilotIndex: 0,
  copilotComplete: false,
}),

exitCopilot: () => set({
  copilotActive: false,
  copilotIndex: 0,
  copilotComplete: false,
}),

advanceNext: () => {
  const { suggestions, copilotIndex } = get();
  const pending = suggestions.filter(s => s.status === "pending");

  if (copilotIndex >= pending.length - 1) {
    // All reviewed
    set({ copilotComplete: true, copilotActive: false });
  } else {
    set({ copilotIndex: copilotIndex + 1 });
  }
},

setPreAnalysisScore: (score) => set({ preAnalysisScore: score }),
```

**Key behavior:** `advanceNext` checks remaining pending suggestions. When the current index reaches the end of the pending list, it sets `copilotComplete = true` and exits copilot mode.

---

## 1.3 New Selectors

```typescript
/**
 * Get the current suggestion in copilot mode.
 * Returns null when copilot is inactive or all suggestions reviewed.
 */
export const useCurrentCopilotSuggestion = () =>
  useBulletSuggestionsStore((state) => {
    if (!state.copilotActive) return null;
    const pending = state.suggestions.filter(s => s.status === "pending");
    return pending[state.copilotIndex] ?? null;
  });

/**
 * Get copilot progress: { current, total, acceptedCount, rejectedCount }
 */
export const useCopilotProgress = () =>
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

Modify `setSuggestions` to auto-enter copilot mode when suggestions arrive:

```typescript
setSuggestions: (suggestions, resumeId) =>
  set({
    suggestions,
    lastAnalyzedAt: new Date(),
    boundResumeId: resumeId,
    error: null,
    isAnalyzing: false,
    // Auto-enter copilot mode if there are suggestions
    copilotActive: suggestions.length > 0,
    copilotIndex: 0,
    copilotComplete: false,
  }),
```

Modify `clearSuggestions` to also reset copilot state:

```typescript
clearSuggestions: () =>
  set({
    suggestions: [],
    lastAnalyzedAt: null,
    error: null,
    copilotActive: false,
    copilotIndex: 0,
    copilotComplete: false,
    preAnalysisScore: null,
  }),
```

---

## 1.5 Initial State Defaults

```typescript
// Add to initial state:
copilotActive: false,
copilotIndex: 0,
copilotComplete: false,
preAnalysisScore: null,
```

---

## Verification

- [ ] Store creates with copilot fields defaulted to inactive
- [ ] `startCopilot()` sets `copilotActive = true`, `copilotIndex = 0`
- [ ] `exitCopilot()` resets copilot state but keeps suggestions
- [ ] `advanceNext()` increments index and sets `copilotComplete` at end
- [ ] `setSuggestions()` auto-enters copilot mode when suggestions > 0
- [ ] `useCurrentCopilotSuggestion` returns correct pending suggestion at index
- [ ] `useCopilotProgress` returns accurate counts
- [ ] TypeScript compiles: `cd frontend && bun run typecheck`
