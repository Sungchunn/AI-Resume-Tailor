# Fix Fit-to-One-Page: Render and Toggle Bugs

**Created:** March 15, 2026

## Summary

Two bugs in the fit-to-one-page feature:

1. **Content doesn't render** when text can't fit even at minimum settings
2. **Disabling toggle shows nothing** - requires page refresh to restore content

## Root Cause Analysis

### Issue 1: Nothing renders at minimum settings

There's a **double-reduction problem**:

1. `useAutoFit.ts` in StylePanel progressively reduces styles and dispatches them to `state.styleSettings`
2. `ResumePreview.tsx` ALSO calls `calculateFitToPageStyles()` when `fitToOnePage && exceedsOnePage`

When content is extremely large:

- `useAutoFit` hits minimums (body font = 10pt) and sets `minimum_reached` status
- But `exceedsOnePage` is still true in `usePageBreaks`
- `ResumePreview` then calls `calculateFitToPageStyles` with DIFFERENT minimums (body font = 8pt)
- This double-reduction on already-minimum styles causes issues

**Key insight:** `ResumePreview` should NOT perform its own reduction when `useAutoFit` is active.

### Issue 2: Disabling toggle doesn't restore original styles

The flow when toggling ON:

1. `useAutoFit` reduces styles progressively
2. Calls `onStyleChange(workingStyle)` which dispatches `SET_STYLE`
3. `state.styleSettings` is OVERWRITTEN with adjusted values
4. Original style is lost

When toggling OFF (`useAutoFit.ts:169-176`):

```typescript
if (!enabled) {
  setAdjustedStyle(style);  // <-- style IS the adjusted style!
  return;
}
```

**Key insight:** The original pre-fit style must be preserved before any adjustments.

## Implementation Plan

### Phase 1: Preserve Original Style in Context

**File:** `frontend/src/components/workshop/WorkshopContext.tsx`

1. Add `preAutoFitStyle` field to `WorkshopState` (line ~69):

```typescript
fitToOnePage: boolean;
preAutoFitStyle: ResumeStyle | null;  // NEW
```

1. Initialize to `null` in `initialState` (line ~182):

```typescript
fitToOnePage: false,
preAutoFitStyle: null,
```

1. Modify `SET_FIT_TO_ONE_PAGE` reducer case (line ~317):

```typescript
case "SET_FIT_TO_ONE_PAGE":
  if (action.payload && !state.fitToOnePage) {
    // Enabling: capture current style BEFORE any adjustments
    return {
      ...state,
      fitToOnePage: true,
      preAutoFitStyle: { ...state.styleSettings },
    };
  } else if (!action.payload && state.fitToOnePage) {
    // Disabling: restore original style
    return {
      ...state,
      fitToOnePage: false,
      styleSettings: state.preAutoFitStyle ?? state.styleSettings,
      preAutoFitStyle: null,
      hasChanges: true,
    };
  }
  return { ...state, fitToOnePage: action.payload };
```

1. Clear `preAutoFitStyle` in `INIT_DATA` and `RESET_CHANGES` cases.

### Phase 2: Fix Double-Reduction in ResumePreview

**File:** `frontend/src/components/workshop/ResumePreview/ResumePreview.tsx`

The current logic (lines 59-62):

```typescript
const adjustedStyles =
  fitToOnePage && exceedsOnePage
    ? calculateFitToPageStyles(style, currentContentHeight)
    : computedStyles;
```

Change to:

```typescript
// When fitToOnePage is enabled, useAutoFit has already adjusted the style.
// We only need to compute CSS values, NOT reduce further.
const adjustedStyles = computePreviewStyles(style);
```

**Rationale:** `useAutoFit` in `StylePanel` already handles all style reductions. The `style` prop passed to `ResumePreview` is already adjusted. Calling `calculateFitToPageStyles` again causes double-reduction.

### Phase 3: Remove Conflicting Style Revert in useAutoFit

**File:** `frontend/src/components/workshop/panels/style/useAutoFit.ts`

The current disable logic (lines 169-176) tries to revert style, but uses the already-adjusted style:

```typescript
if (!enabled) {
  setStatus({ state: "idle" });
  setReductions([]);
  setAdjustedStyle(style);  // style is already adjusted!
  setServerPageCount(null);
  return;
}
```

No code change needed here - the context reducer now handles restoration. The hook just resets local state.

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/components/workshop/WorkshopContext.tsx` | Add `preAutoFitStyle` state and update `SET_FIT_TO_ONE_PAGE` reducer |
| `frontend/src/components/workshop/ResumePreview/ResumePreview.tsx` | Remove double-reduction by always using `computePreviewStyles` |

## Verification

### Manual Testing

1. **Test Issue 1 Fix:**
   - Load a resume with extensive content (5+ experience entries with multiple bullets)
   - Enable "Fit to One Page"
   - Verify content renders at reduced sizes (not blank)
   - Check that `minimum_reached` warning appears if content still exceeds

2. **Test Issue 2 Fix:**
   - Note original body font size (default: 11pt)
   - Enable "Fit to One Page"
   - Verify styles are reduced
   - Disable "Fit to One Page"
   - Verify styles return to original 11pt (no page refresh needed)

3. **Edge Cases:**
   - Enable then save then refresh - verify saved styles persist
   - Enable then change content then disable - verify original style restored, content changes kept
   - Enable when content already fits - verify no reduction applied
