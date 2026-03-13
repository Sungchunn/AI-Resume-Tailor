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

### Additional Consideration: Undo Support

For future enhancement, consider storing style history:

```typescript
interface StyleHistory {
  timestamp: number;
  style: BlockEditorStyle;
  trigger: 'manual' | 'auto-fit';
}
```

This would allow users to revert unwanted auto-fit changes.
