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

## Solution: State-Driven Measurement Readiness

Don't run the auto-fit algorithm until measurements are complete. Use React's natural reactivity via a callback prop instead of polling.

The auto-fit hook already handles `measureFn` being `null` (falls back to estimation mode), so we just need to set it only when ready.

### Files to Modify

| File | Change |
| ---- | ------ |
| `PaginatedResumePreview.tsx` | Add `onReady` callback prop |
| `EditorLayout.tsx` | Track measurement readiness state, conditionally set `measureFn` |

### Why This Approach

| Approach | Pros | Cons |
| -------- | ---- | ---- |
| Return `Infinity` | Single effect | Special-case handling in binary search, mixes concerns |
| `setInterval` polling | Simple | Not idiomatic React, wastes cycles |
| **State-driven** | Clean separation, testable, no polling | Requires callback prop |

### Implementation

**Step 1:** Add `onReady` callback prop to `PaginatedResumePreview`:

```typescript
// PaginatedResumePreview.tsx
export interface PaginatedResumePreviewProps extends ResumePreviewProps {
  pageGap?: number;
  onReady?: () => void;  // Add this
}

// Inside component, after isReady becomes true:
useEffect(() => {
  if (isReady) {
    onReady?.();
  }
}, [isReady, onReady]);
```

**Step 2:** Track readiness in `EditorLayout.tsx`:

```typescript
// EditorLayout.tsx
const [isMeasurementReady, setIsMeasurementReady] = useState(false);

// Callback for when measurements complete
const handleMeasurementsReady = useCallback(() => {
  setIsMeasurementReady(true);
}, []);

// Reset when blocks/style change (measurements will re-run)
useEffect(() => {
  setIsMeasurementReady(false);
}, [blocks, style]);

// Only provide measureFn when ready
useEffect(() => {
  if (!isMeasurementReady) {
    setAutoFitMeasureFn(null);
    return;
  }

  const measureFn = () => {
    return previewRef.current!.getPageCount() * PAGE_DIMENSIONS.HEIGHT;
  };
  setAutoFitMeasureFn(measureFn);
}, [isMeasurementReady, setAutoFitMeasureFn]);
```

**Step 3:** Pass callback to preview:

```tsx
<PaginatedResumePreview
  ref={previewRef}
  blocks={blocks}
  style={style}
  onReady={handleMeasurementsReady}  // Add this
  // ...other props
/>
```

**Step 4:** In `useAutoFitBlocks.ts`, handle null gracefully (already does):

```typescript
// Line 544 - existing code handles this correctly
if (measureFn) {
  runBinarySearchAutoFit(measureFn, targetHeight, style);
} else {
  // Falls back to estimation-based algorithm
  runLinearAutoFit(targetHeight, style);
}
```

### Key Benefits

1. **No polling** - Uses React's effect system naturally
2. **Clean separation** - EditorLayout controls when measurement is available
3. **Testable** - Can mock callback timing in tests
4. **No magic values** - No `Infinity` or other sentinel values

## Verification

1. Load a resume with 2+ pages of content
2. Click "Fit to One Page" toggle
3. **Expected:** See "Fitting..." status briefly, then style adjustments apply and content shrinks
4. **Actual before fix:** Nothing happens, status may show "Fitted" incorrectly
5. Toggle off and on again - should work consistently
