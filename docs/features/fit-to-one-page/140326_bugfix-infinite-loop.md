# Bugfix: Fit-to-Page Infinite Loop on Large Content

**Date:** March 14, 2026
**Status:** Planned
**Related:** 130326_master-plan.md

---

## Problem Statement

When uploading a large PDF resume that cannot fit on one page even at maximum compactness, the "Fitting..." state never completes and the algorithm runs in an infinite loop.

---

## Root Cause Analysis

Based on console output, the issue is an **infinite re-triggering loop**, not a missing error handler.

### Console Evidence

```text
[Auto-fit] Binary search completed in 7 iterations. Level: 100, Fits: false
[AutoSaveStyles] Auto-fit in progress, suspending auto-save
[AutoSaveStyles] Auto-fit in progress, suspending auto-save
...
[Auto-fit] Binary search completed in 7 iterations. Level: 100, Fits: false
(repeats forever)
```

The algorithm **completes successfully** but keeps re-running in a loop.

### The Infinite Loop

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

**Flow:**

1. Binary search completes: `Level: 100, Fits: false`
2. Algorithm calls `onStyleChange(result.style)` at line 562
3. Parent component updates its `style` state
4. Parent passes new `style` prop back to the hook
5. The effect depends on `style` (line 529), so it re-runs
6. `isProcessingRef.current` is `false` (reset in finally block)
7. Algorithm starts again with the updated style
8. Gets same result (`Level: 100, Fits: false`)
9. Calls `onStyleChange` again → triggers re-render → loop repeats

**Root Cause:** The effect re-runs when `style` changes, but after reaching `minimum_reached`, no further progress is possible. The algorithm should NOT re-run when it has already determined content cannot fit.

### Why PDF Uploads Trigger This

- Large PDFs contain more content than manually-entered resumes
- Content exceeds one page even at maximum compactness (Level 100)
- The `Fits: false` result triggers the loop because the algorithm keeps trying

---

## Fix Plan

### Step 1: Track Previous Run Result to Prevent Re-triggering

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

Add a ref to track the last result and skip re-runs when status is `minimum_reached`:

```typescript
// Add ref to track if we've already determined content can't fit
const minimumReachedRef = useRef(false);

// In the effect, add early exit:
useEffect(() => {
  if (!enabled) {
    minimumReachedRef.current = false;  // Reset when disabled
    setStatus({ state: "idle" });
    // ... existing code ...
    return;
  }

  // Skip if we already know content can't fit (prevents infinite loop)
  if (minimumReachedRef.current) {
    return;
  }

  // ... rest of existing effect code ...
}, [enabled, blocks, style, getTargetHeight, measureFn]);
```

### Step 2: Set Flag When Minimum Reached

In `runBinarySearchAutoFit`, set the flag when `minimum_reached`:

```typescript
if (result.fits) {
  minimumReachedRef.current = false;  // Reset on successful fit
  setStatus({
    state: "fitted",
    reductions: appliedReductions.map((r) => r.label),
    compactnessLevel: result.level,
  });
} else {
  minimumReachedRef.current = true;  // Set flag to prevent re-runs
  setStatus({
    state: "minimum_reached",
    message: "Content still exceeds one page at minimum settings...",
    compactnessLevel: result.level,
  });
}
```

### Step 3: Reset Flag When Blocks Change

Add a separate effect to reset the flag when blocks change (so we retry fitting with new content):

```typescript
// Reset minimum_reached when blocks change (user edited content)
const blocksHash = useMemo(() => JSON.stringify(blocks.map(b => b.id)), [blocks]);

useEffect(() => {
  minimumReachedRef.current = false;
}, [blocksHash]);
```

### Step 4: Skip Redundant onStyleChange Calls

Add style comparison before calling `onStyleChange` to avoid triggering unnecessary re-renders:

```typescript
// Only call onStyleChange if style actually changed
if (result.level > 0) {
  const currentStyleHash = JSON.stringify(currentStyle);
  const resultStyleHash = JSON.stringify(result.style);

  if (currentStyleHash !== resultStyleHash) {
    onStyleChange(result.style);
  }
}
```

---

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Add `minimumReachedRef`, early exit logic, and style comparison |

---

## Verification

### Manual Test - Large PDF

- Upload a large PDF resume (one that exceeds one page even at max compression)
- Navigate to edit page (`/library/resumes/{id}/edit`)
- Verify "Fitting..." transitions to "minimum_reached" warning (NOT stuck forever)
- Verify console shows only ONE `Binary search completed` log (not repeated)
- Verify `[AutoSaveStyles] Auto-fit in progress` stops appearing

### Manual Test - Normal PDF

- Upload a smaller PDF that CAN fit on one page
- Verify it transitions to "fitted" state correctly
- Verify styles are applied and content fits

### Manual Test - Content Edit

- After reaching "minimum_reached", delete some content blocks
- Verify fitting re-runs and can now achieve "fitted" state

### Existing E2E Tests

```bash
cd frontend && bun run test:e2e e2e/fit-to-page
```

All tests should pass.
