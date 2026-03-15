# Fix Fit-to-One-Page Bugs - Library Editor

**Created:** 2026-03-15
**Status:** Implemented

## Summary

Two bugs in the fit-to-one-page feature in the **tailor editor** (`/tailor/editor/[id]`):

1. **Content doesn't render** when text can't fit even at minimum settings
2. **Disabling toggle shows nothing** - requires page refresh to restore content

## Critical Finding

**The previous fix modified the WRONG files!**

The tailor editor uses:

```typescript
import { BlockEditorProvider, EditorLayout } from "@/components/library/editor";
```

It does NOT use the workshop components (`WorkshopContext`, `workshop/ResumePreview`).

### Architecture Mapping

| Page | Components Used |
| ---- | --------------- |
| `/tailor/editor/[id]` | `BlockEditorProvider`, `EditorLayout`, `PaginatedResumePreview`, `useAutoFitBlocks.ts` |
| `/library/resumes/[id]/edit` | Same as above |
| `/tailor/verify/[id]` | `WorkshopContext`, `workshop/ResumePreview`, `useAutoFit.ts` |

---

## Root Cause Analysis

### Issue 1: Content doesn't render at minimum settings

Looking at `useAutoFitBlocks.ts`:

- Lines 593-605: When binary search completes, `result.style` IS applied via `setAdjustedStyle()` and `onStyleChange()`
- When `result.fits === false`, status is set to `minimum_reached`
- **The minimum style (level 100) SHOULD be applied**

**Potential causes:**

1. Timing bug documented in `150326_fit-to-one-page-not-loading-fix.md` - measurements may not be ready when algorithm runs
2. The measurement function may return incorrect values initially

### Issue 2: Toggle OFF shows nothing

The reducer (`blockEditorReducer.ts:173-177`) has a simple implementation:

```typescript
case "SET_FIT_TO_ONE_PAGE":
  return {
    ...state,
    fitToOnePage: action.payload,
  };
```

**Problem:** When toggling OFF:

1. `fitToOnePage` changes to `false`
2. But `state.style` is still the REDUCED style from auto-fit
3. `useAutoFitBlocks` returns `style` prop as `adjustedStyle` when disabled (line 743)
4. But the reducer's `state.style` has already been modified by `onStyleChange` calls

**There's no preservation of the original style before auto-fit adjustments.**

---

## Implementation Plan

### Step 1: Add `preAutoFitStyle` to State

**File:** `frontend/src/lib/resume/types.ts`

Add to `BlockEditorState` interface:

```typescript
preAutoFitStyle: BlockEditorStyle | null;
```

**File:** `frontend/src/lib/resume/defaults.ts`

Add to `createEmptyState()`:

```typescript
preAutoFitStyle: null,
```

### Step 2: Update Reducer for Style Preservation

**File:** `frontend/src/components/library/editor/blockEditorReducer.ts`

Change `SET_FIT_TO_ONE_PAGE` case (lines 173-177):

```typescript
case "SET_FIT_TO_ONE_PAGE": {
  const enabled = action.payload;
  if (enabled && !state.fitToOnePage) {
    // Enabling: capture current style BEFORE any adjustments
    return {
      ...state,
      fitToOnePage: true,
      preAutoFitStyle: { ...state.style },
    };
  } else if (!enabled && state.fitToOnePage) {
    // Disabling: restore original style
    return {
      ...state,
      fitToOnePage: false,
      style: state.preAutoFitStyle ?? state.style,
      preAutoFitStyle: null,
      isDirty: true,
    };
  }
  return { ...state, fitToOnePage: enabled };
}
```

Also clear `preAutoFitStyle` in `RESET` case:

```typescript
case "RESET":
  return {
    ...action.payload,
    preAutoFitStyle: null,
  };
```

### Step 3: Verify Minimum Styles Are Applied

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

The existing code at lines 593-621 should already apply minimum styles. However, verify that:

1. When `result.fits === false`, `result.level` is 100
2. `compactnessToStyle(100, originalStyle)` returns correct minimum values
3. `onStyleChange(result.style)` is being called

If needed, add explicit logging:

```typescript
if (!result.fits) {
  console.log('[Auto-fit] Minimum reached at level', result.level, 'with style:', result.style);
}
```

### Step 4: (Optional) Revert Workshop Changes

The previous fix modified workshop files that may still be needed for `/tailor/verify/[id]`. Either:

- **Keep them:** The changes are valid for the workshop system
- **Revert them:** If they cause issues in the verify page

Check git history:

- `WorkshopContext.tsx` - Added `preAutoFitStyle` pattern (keep if workshop uses fit-to-page)
- `workshop/ResumePreview/ResumePreview.tsx` - Simplified `adjustedStyles` (verify this doesn't break verify page)

---

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/lib/resume/types.ts` | Add `preAutoFitStyle` to `BlockEditorState` |
| `frontend/src/lib/resume/defaults.ts` | Initialize `preAutoFitStyle: null` |
| `frontend/src/components/library/editor/blockEditorReducer.ts` | Update `SET_FIT_TO_ONE_PAGE` for style preservation |
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Verify minimum styles are applied (may not need changes) |

---

## Verification

### Test Case 1: Fit to One Page - Content Fits

1. Load a resume that can fit on one page
2. Enable "Fit to One Page"
3. **Expected:** Styles reduce, content shows on one page, status shows "Fitted"

### Test Case 2: Fit to One Page - Minimum Reached

1. Load a resume with excessive content (5+ experience entries with multiple bullets each)
2. Enable "Fit to One Page"
3. **Expected:**
   - Styles reduce to minimum values
   - Content renders at minimum font size (7pt body)
   - Content spans multiple pages (pagination shows "Page 1 of 2")
   - "Minimum reached" warning appears with message

### Test Case 3: Toggle Off Restores Style

1. Note the original body font size (e.g., 11pt)
2. Enable fit-to-one-page (styles reduce to e.g., 8pt)
3. Disable fit-to-one-page
4. **Expected:** Body font size returns to original 11pt (no refresh needed)

### Test Case 4: Toggle Off After Minimum Reached

1. With excessive content, enable fit-to-one-page (hits minimum)
2. Disable fit-to-one-page
3. **Expected:** Original styles restore, content renders at original sizes across multiple pages

---

## Related Documents

- `150326_fix-render-and-toggle-bugs.md` - Previous (incorrect) plan targeting workshop components
- `150326_fit-to-one-page-not-loading-fix.md` - Timing bug fix for measurement readiness
- `130326_master-plan.md` - Original fit-to-one-page feature plan
