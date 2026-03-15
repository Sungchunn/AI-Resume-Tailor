# Fix: Fit-to-One-Page Button Not Loading

**Date:** March 15, 2026
**Status:** Plan

## Problem Summary

When clicking the "Fit to One Page" toggle, the feature doesn't appear to work because the auto-fit algorithm runs **before measurements are ready**.

## Root Cause

**Timing mismatch between measurement and auto-fit:**

1. `useBlockPagination.ts:69-76` returns `totalPages: 0` when `measurementsReady` is false:

   ```typescript
   if (!measurementsReady) {
     return {
       pages: [],
       totalPages: 0,  // Returns 0 during loading
       isReady: false,
       ...
     };
   }
   ```

2. `EditorLayout.tsx:83-84` uses `?? 1` fallback when `getPageCount()` returns 0:

   ```typescript
   const currentPageCount = previewRef.current?.getPageCount() ?? 1;
   return currentPageCount * PAGE_DIMENSIONS.HEIGHT;  // Returns 1056px
   ```

3. Auto-fit binary search (`useAutoFitBlocks.ts:567-568`) measures during this state:

   - `measureFn()` returns `1 * 1056 = 1056px` (because `totalPages` is 0, fallback 1)
   - `targetHeight` is also ~1056px (page height minus margins)
   - Algorithm concludes "it fits!" at level 0
   - **No adjustments are made**

## Solution

Pass `measurementsReady` status to the auto-fit hook and **don't run the algorithm until measurements are complete**.

### Files to Modify

| File | Change |
| ---- | ------ |
| `PaginatedResumePreview.tsx` | Expose `isReady` in ref handle |
| `EditorLayout.tsx` | Track measurement readiness, pass to context |
| `BlockEditorContext.tsx` | Accept and expose measurement ready state |
| `useAutoFitBlocks.ts` | Add `measurementsReady` dependency, skip when false |

### Implementation Steps

**Step 1:** Update `PaginatedResumePreviewHandle` to expose `isReady`:

```typescript
// PaginatedResumePreview.tsx
export interface PaginatedResumePreviewHandle {
  getPageElements: () => HTMLDivElement[];
  getScale: () => number;
  getPageCount: () => number;
  isReady: () => boolean;  // Add this
}

useImperativeHandle(ref, () => ({
  // ...existing
  isReady: () => isReady,  // Add this
}));
```

**Step 2:** In `EditorLayout.tsx`, poll/track readiness:

```typescript
// Option A: Check readiness in measureFn
const measureFn = () => {
  if (!previewRef.current?.isReady()) {
    return Infinity;  // Signal "not ready yet" - algorithm will retry
  }
  const currentPageCount = previewRef.current.getPageCount();
  return currentPageCount * PAGE_DIMENSIONS.HEIGHT;
};
```

**Step 3:** In `useAutoFitBlocks.ts`, handle "not ready" case:

```typescript
// In binary search, if measureFn returns Infinity, wait and retry
const measureHeight = async (testStyle: BlockEditorStyle): Promise<number> => {
  onStyleChange(testStyle);
  const height = await measureWithRAF(measure);

  // If not ready, wait a bit and retry (up to N attempts)
  if (height === Infinity) {
    // Poll until ready or timeout
  }

  return height;
};
```

## Alternative (Simpler) Approach

Instead of complex polling, simply **don't enable auto-fit until ready**:

In `EditorLayout.tsx`:

```typescript
useEffect(() => {
  const checkReadyAndSetMeasure = () => {
    if (previewRef.current?.isReady()) {
      const measureFn = () => {
        return previewRef.current!.getPageCount() * PAGE_DIMENSIONS.HEIGHT;
      };
      setAutoFitMeasureFn(measureFn);
    } else {
      // Not ready - clear function to prevent auto-fit from running
      setAutoFitMeasureFn(null);
    }
  };

  // Check immediately and on interval until ready
  checkReadyAndSetMeasure();
  const interval = setInterval(checkReadyAndSetMeasure, 100);

  return () => clearInterval(interval);
}, [setAutoFitMeasureFn]);
```

In `useAutoFitBlocks.ts` (line 544):

```typescript
if (measureFn) {
  // Has measureFn means measurements are ready
  runBinarySearchAutoFit(measureFn, targetHeight, style);
} else {
  // No measureFn - either not provided or not ready yet
  // Set status to "fitting" to show user we're waiting
  setStatus({ state: "fitting" });
}
```

## Verification

1. Load a resume with 2+ pages of content
2. Click "Fit to One Page" toggle
3. **Expected:** See "Fitting..." status briefly, then style adjustments apply and content shrinks
4. **Actual before fix:** Nothing happens, status may show "Fitted" incorrectly
5. Toggle off and on again - should work consistently
