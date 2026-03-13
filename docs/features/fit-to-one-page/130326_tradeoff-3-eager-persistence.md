# Tradeoff 3: Eager Persistence vs. On-Demand Save

**Created:** 2026-03-13
**Status:** Analysis
**Risk Level:** Medium

---

## Context

When auto-fit adjusts styles (font sizes, spacing), should those changes:

1. **Persist automatically** (eager) - Save to database without user action
2. **Wait for explicit save** (on-demand) - Only persist when user clicks Save

---

## Proposed Approach: Eager Persistence

```typescript
// In BlockEditorProvider
const lastSavedStyleRef = useRef<string>(JSON.stringify(state.style));

useEffect(() => {
  if (!state.fitToOnePage || !state.isDirty) return;

  const currentStyleHash = JSON.stringify(state.style);
  if (currentStyleHash === lastSavedStyleRef.current) return;

  const timer = setTimeout(() => {
    save();
    lastSavedStyleRef.current = currentStyleHash;
  }, 2000); // 2-second debounce

  return () => clearTimeout(timer);
}, [state.style, state.fitToOnePage, state.isDirty, save]);
```

---

## Pros

| Benefit | Explanation |
| ------- | ----------- |
| No lost adjustments | User refreshes or navigates away → styles preserved |
| View page consistency | `/library/resumes/[id]` always shows fitted content |
| Invisible to user | Auto-fit "just works" without manual save steps |
| PDF export accuracy | Exported PDF matches auto-fitted preview |

---

## Cons

| Drawback | Impact |
| -------- | ------ |
| Additional API calls | Each style adjustment triggers a save (mitigated by debounce) |
| Implicit saves | User may not realize styles are being persisted |
| No undo path | Auto-saved styles can't be easily reverted |
| Save conflicts | May race with manual save operations |

---

## Risk Analysis: Race Conditions

### Scenario 1: Debounce Timer vs Manual Save

```text
T=0:    User adds content
T=100:  Auto-fit adjusts styles
T=100:  Debounce timer starts (2000ms)
T=500:  User clicks "Save" button
T=500:  Manual save sends current styles to API
T=2100: Debounce timer fires
T=2100: Auto-save sends same styles to API (duplicate)
```

**Impact:** Wasted API call, but no data corruption.

**Mitigation:** Hash comparison prevents save if styles unchanged:

```typescript
if (currentStyleHash === lastSavedStyleRef.current) return;
```

### Scenario 2: Rapid Content Changes

```text
T=0:    User types "A"
T=100:  Auto-fit adjusts to level 30
T=500:  User types "B"
T=600:  Auto-fit adjusts to level 35
T=1000: User types "C"
T=1100: Auto-fit adjusts to level 40
...
```

**Impact:** Multiple pending debounce timers, potential API spam.

**Mitigation:** Each new change clears previous timer (cleanup function).

### Scenario 3: Manual Save During Auto-Fit

```text
T=0:    User adds large content block
T=100:  Auto-fit starts binary search
T=150:  Auto-fit at iteration 3 (style = level 50)
T=200:  User clicks "Save" immediately
T=200:  Manual save persists level 50 styles
T=400:  Auto-fit completes at level 35 (optimal)
T=400:  Debounce starts for level 35
T=2400: Auto-save persists level 35
```

**Impact:** Intermediate state (level 50) briefly saved, then corrected.

**Mitigation:** Consider blocking manual save during `fitting` state.

---

## Alternative: On-Demand Save Only

```typescript
// No automatic persistence
// User must click Save to persist auto-fitted styles
```

### Problems with On-Demand

| Issue | User Impact |
| ----- | ----------- |
| Easy to lose work | User adds content, auto-fit adjusts, user navigates away → lost |
| View page mismatch | View page shows old styles, edit page shows new |
| PDF export wrong | Export uses persisted styles, not current auto-fit |
| Extra cognitive load | User must remember to save after auto-fit |

---

## Hybrid Alternative: Save on Navigation

```typescript
// Persist only when leaving the page
useEffect(() => {
  const handleBeforeUnload = () => {
    if (state.isDirty && hasAutoFitChanges) {
      navigator.sendBeacon('/api/resumes/style', JSON.stringify(state.style));
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [state]);
```

### Problems

| Issue | Explanation |
| ----- | ----------- |
| Browser kills tab | `sendBeacon` may not complete |
| SPA navigation | `beforeunload` doesn't fire on client-side routing |
| Complexity | Must also handle `routeChangeStart` for Next.js |

---

## Recommendation

**Use eager persistence with safeguards.**

The user expectation is that auto-fit "just works." Requiring manual save breaks this mental model.

### Safeguards to Implement

| Safeguard | Purpose |
| --------- | ------- |
| 2-second debounce | Prevents API spam during typing |
| Hash comparison | Skips save if styles unchanged |
| `isProcessingRef` | Prevents saves during active auto-fit |
| Optimistic UI | Show "Saving..." indicator during auto-save |
| **Save operation lock** | Prevents concurrent save requests (see below) |

---

## Critical: Race Condition Mitigation

### The Problem

Hash comparison alone is insufficient. Consider this timeline:

```text
T=0:     User edits content
T=100:   Auto-fit adjusts styles (hash = "abc123")
T=100:   Debounce timer starts (2000ms)
T=1900:  User clicks "Save" button
T=1900:  Manual save request starts (in-flight)
T=2100:  Debounce timer fires
T=2100:  Auto-save sees hash matches, but manual save is STILL IN FLIGHT
T=2100:  Auto-save sends request anyway (race condition!)
T=2150:  Manual save completes
T=2200:  Auto-save completes (duplicate write, potential overwrite)
```

The hash comparison checks `lastSavedStyleRef.current`, but this ref is only updated **after** the save completes. During the network request, both operations think they need to save.

### Solution: Save Operation Lock with Auto-Save Cancellation

```typescript
// In BlockEditorProvider
const lastSavedStyleRef = useRef<string>(JSON.stringify(state.style));
const pendingAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const saveInProgressRef = useRef<boolean>(false);

// Cancel any pending auto-save
const cancelPendingAutoSave = useCallback(() => {
  if (pendingAutoSaveRef.current) {
    clearTimeout(pendingAutoSaveRef.current);
    pendingAutoSaveRef.current = null;
  }
}, []);

// Manual save handler - cancels auto-save and acquires lock
const handleManualSave = useCallback(async () => {
  // 1. Cancel any pending auto-save immediately
  cancelPendingAutoSave();

  // 2. If save already in progress, queue this request or skip
  if (saveInProgressRef.current) {
    console.warn('Save already in progress, skipping duplicate');
    return;
  }

  // 3. Acquire lock
  saveInProgressRef.current = true;

  try {
    await save();
    lastSavedStyleRef.current = JSON.stringify(state.style);
  } finally {
    // 4. Release lock
    saveInProgressRef.current = false;
  }
}, [save, state.style, cancelPendingAutoSave]);

// Auto-save effect with lock awareness
useEffect(() => {
  if (!state.fitToOnePage || !state.isDirty) return;

  const currentStyleHash = JSON.stringify(state.style);
  if (currentStyleHash === lastSavedStyleRef.current) return;

  // Clear any existing timer (debounce reset)
  cancelPendingAutoSave();

  pendingAutoSaveRef.current = setTimeout(async () => {
    // Check lock before attempting save
    if (saveInProgressRef.current) {
      // Manual save in progress - abort auto-save entirely
      // The manual save will persist the current state
      return;
    }

    // Re-check hash (state may have changed during debounce)
    const latestHash = JSON.stringify(state.style);
    if (latestHash === lastSavedStyleRef.current) return;

    // Acquire lock
    saveInProgressRef.current = true;

    try {
      await save();
      lastSavedStyleRef.current = latestHash;
    } finally {
      saveInProgressRef.current = false;
      pendingAutoSaveRef.current = null;
    }
  }, 2000);

  return () => cancelPendingAutoSave();
}, [state.style, state.fitToOnePage, state.isDirty, save, cancelPendingAutoSave]);
```

### Lock Behavior Summary

| Event | Action |
| ----- | ------ |
| Manual save triggered | Cancel pending auto-save, acquire lock, save |
| Auto-save timer fires | Check lock; if locked, abort silently |
| Save completes | Release lock, update hash ref |
| New content change | Reset debounce timer (existing behavior) |

### Why This Works

1. **Manual save always wins:** Clicking "Save" immediately cancels pending auto-saves
2. **No duplicate requests:** Lock prevents concurrent API calls
3. **No lost updates:** Manual save persists current state; auto-save was going to save the same thing anyway
4. **No wasted API calls:** Auto-save checks lock and aborts if manual save is handling it

---

## Future Consideration: LLM Line-by-Line Suggestions

This architecture becomes critical when LLM suggestions are implemented. Consider:

```text
T=0:     User requests LLM suggestion for bullet point
T=100:   LLM streams partial suggestion (state update 1)
T=200:   LLM streams more (state update 2)
T=300:   LLM streams more (state update 3)
...
T=2000:  LLM completes
T=2100:  User reviews and clicks "Accept"
T=2100:  Auto-save timer from T=100 fires (2000ms)
T=2100:  Race condition with acceptance save!
```

### LLM Suggestion Safeguards

| Safeguard | Implementation |
| --------- | -------------- |
| Suspend auto-save during streaming | Set `isStreamingRef.current = true` during LLM response |
| Reset debounce on stream complete | Clear timers when `isStreaming` transitions to false |
| Accept/Reject as manual save | User action triggers `handleManualSave`, not auto-save |
| Optimistic lock during review | `isReviewingRef` prevents saves while user reviews suggestions |

```typescript
// Extended for LLM suggestions
const isStreamingRef = useRef<boolean>(false);
const isReviewingRef = useRef<boolean>(false);

// In auto-save effect
if (saveInProgressRef.current || isStreamingRef.current || isReviewingRef.current) {
  return; // Don't auto-save during LLM operations
}
```

### State Machine for Save Operations

```text
                    ┌─────────────┐
                    │    IDLE     │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  DEBOUNCING │ │   SAVING    │ │  STREAMING  │
    │ (auto-save) │ │  (locked)   │ │    (LLM)    │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           │               │               ▼
           │               │        ┌─────────────┐
           │               │        │  REVIEWING  │
           │               │        │    (LLM)    │
           │               │        └──────┬──────┘
           │               │               │
           └───────────────┴───────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    IDLE     │
                    └─────────────┘
```

**Transitions:**

- IDLE → DEBOUNCING: Content change detected
- DEBOUNCING → SAVING: Timer expires, lock acquired
- DEBOUNCING → IDLE: Manual save cancels timer
- IDLE → SAVING: Manual save triggered
- SAVING → IDLE: API call completes
- IDLE → STREAMING: LLM request starts
- STREAMING → REVIEWING: LLM completes
- REVIEWING → SAVING: User accepts suggestion
- REVIEWING → IDLE: User rejects suggestion

---

### Additional Consideration: Undo Support

For future enhancement, consider storing style history:

```typescript
interface StyleHistory {
  timestamp: number;
  style: BlockEditorStyle;
  trigger: 'manual' | 'auto-fit' | 'llm-accept';
}
```

This would allow users to revert unwanted auto-fit or LLM changes.
