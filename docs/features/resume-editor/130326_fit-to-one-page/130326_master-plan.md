# Fit-to-One-Page: Master Plan

**Created:** 2026-03-13
**Status:** Implemented

## Overview

Add automatic content scaling so resumes always fit on one page across all three pages:

- `/library/resumes/[id]` (view)
- `/library/resumes/[id]/edit` (edit)
- `/tailor/editor/[id]` (tailor)

Changes will persist so the adjusted styles are saved to the database.

---

## Requirements

| Requirement | Decision |
| ----------- | -------- |
| Fit behavior | Auto-scale content (reduce font sizes, spacing, margins automatically) |
| Target pages | All three pages (view, edit, tailor) |
| Persistence | Save adjusted styles to database |
| Trigger mode | Automatic always (no overflow ever shown) |

---

## Current State

### Existing Infrastructure

| Component | Location | Status |
| --------- | -------- | ------ |
| `useAutoFitBlocks` | `/frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Exists - uses estimation |
| `useOverflowDetection` | `/frontend/src/components/library/preview/useOverflowDetection.tsx` | Exists - DOM-based |
| `BlockEditorContext` | `/frontend/src/components/library/editor/BlockEditorContext.tsx` | Exposes `fitToOnePage` state |
| `ResumePreview` | `/frontend/src/components/library/preview/ResumePreview.tsx` | Exposes `getPageElement()` via ref |

### Progressive Reduction Algorithm

The existing `useAutoFitBlocks` reduces styles in this order (least impact first):

1. **Section spacing** (min: 6px)
2. **Entry spacing** (min: 4px)
3. **Line spacing** (min: 1.05)
4. **Body font size** (min: 8pt) - also scales heading/subheading proportionally

**Current Complexity:** O(n) linear iteration - reduces by 5% per step until fit.

### Gap

The `useAutoFitBlocks` hook uses `estimateContentHeight()` which calculates height mathematically. This is imprecise because:

- Cannot account for exact text wrapping
- Line heights vary by font
- Complex nested content has unpredictable heights

The `useOverflowDetection` hook already does DOM measurement but only for **detection**, not for driving auto-fit.

### Algorithm Improvement: Binary Search (O(log n))

**Problem with linear approach:** Each 5% reduction requires a measurement. Worst case = 25 iterations.

**Solution:** Use binary search with a unified "compactness scale" to achieve O(log n) complexity.

#### Compactness Scale Design

Map all style properties to a single 0-100 scale where:

- **Level 0** = Original styles (most spacious)
- **Level 100** = All minimums (most compact)

The scale preserves the "least impactful first" ordering:

| Level Range | Property Reduced | Interpolation |
| ----------- | ---------------- | ------------- |
| 0-25 | sectionSpacing | max → min |
| 25-50 | entrySpacing | max → min |
| 50-75 | lineSpacing | max → min |
| 75-100 | fontSizeBody | max → min (+ proportional heading/subheading) |

#### Binary Search Algorithm

```typescript
function findOptimalCompactness(
  measureFn: () => number,
  targetHeight: number,
  originalStyle: BlockEditorStyle
): number {
  let low = 0;
  let high = 100;
  let result = 100; // Default to maximum compactness

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const testStyle = compactnessToStyle(mid, originalStyle);

    // Apply style and measure
    applyStyle(testStyle);
    const height = measureFn();

    if (height <= targetHeight) {
      result = mid; // This level fits, try less compact
      high = mid - 1;
    } else {
      low = mid + 1; // Too tall, need more compact
    }
  }

  return result;
}
```

#### Complexity Analysis

| Approach | Best Case | Worst Case | Typical |
| -------- | --------- | ---------- | ------- |
| Linear (current) | O(1) fits immediately | O(n) ~25 iterations | O(n) |
| Binary Search | O(1) fits immediately | O(log 100) = 7 iterations | O(log n) |

**Tradeoff:** Binary search requires applying styles and measuring at each step, but max 7 iterations vs 25 is a significant improvement for DOM-based measurement where each iteration forces a reflow.

See [Tradeoff 1: Accuracy vs. Performance](./130326_tradeoff-1-accuracy-vs-performance.md) for the mathematical proof of binary search feasibility based on the monotonicity of the height function.

---

## Implementation Plan

### Step 1: Implement Compactness Scale and Binary Search

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

#### 1a. Add Compactness Scale Utilities

```typescript
// Style property ranges (original values → minimums)
const STYLE_RANGES = {
  sectionSpacing: { max: 24, min: 6 },   // Levels 0-25
  entrySpacing: { max: 16, min: 4 },     // Levels 25-50
  lineSpacing: { max: 1.5, min: 1.05 },  // Levels 50-75
  fontSizeBody: { max: 12, min: 8 },     // Levels 75-100
} as const;

/**
 * Convert compactness level (0-100) to style values
 * Level 0 = most spacious, Level 100 = most compact
 */
function compactnessToStyle(
  level: number,
  originalStyle: BlockEditorStyle
): BlockEditorStyle {
  const style = { ...originalStyle };

  // Phase 1: sectionSpacing (levels 0-25)
  if (level > 0) {
    const phaseProgress = Math.min(level / 25, 1);
    const range = originalStyle.sectionSpacing - STYLE_RANGES.sectionSpacing.min;
    style.sectionSpacing = originalStyle.sectionSpacing - range * phaseProgress;
  }

  // Phase 2: entrySpacing (levels 25-50)
  if (level > 25) {
    const phaseProgress = Math.min((level - 25) / 25, 1);
    const range = originalStyle.entrySpacing - STYLE_RANGES.entrySpacing.min;
    style.entrySpacing = originalStyle.entrySpacing - range * phaseProgress;
  }

  // Phase 3: lineSpacing (levels 50-75)
  if (level > 50) {
    const phaseProgress = Math.min((level - 50) / 25, 1);
    const range = originalStyle.lineSpacing - STYLE_RANGES.lineSpacing.min;
    style.lineSpacing = originalStyle.lineSpacing - range * phaseProgress;
  }

  // Phase 4: fontSizeBody (levels 75-100) + proportional heading/subheading
  if (level > 75) {
    const phaseProgress = Math.min((level - 75) / 25, 1);
    const bodyRange = originalStyle.fontSizeBody - STYLE_RANGES.fontSizeBody.min;
    const newBody = originalStyle.fontSizeBody - bodyRange * phaseProgress;
    const ratio = newBody / originalStyle.fontSizeBody;

    style.fontSizeBody = newBody;
    style.fontSizeHeading = Math.max(12, originalStyle.fontSizeHeading * ratio);
    style.fontSizeSubheading = Math.max(9, originalStyle.fontSizeSubheading * ratio);
  }

  return style;
}
```

#### 1b. Add Binary Search Algorithm

```typescript
interface UseAutoFitBlocksOptions {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  enabled: boolean;
  onStyleChange: (style: Partial<BlockEditorStyle>) => void;
  measureFn?: () => number;  // Optional DOM-based measurement
}

/**
 * Binary search to find minimum compactness level that fits
 * Complexity: O(log n) where n = 100 levels = max 7 iterations
 */
async function findOptimalCompactness(
  measureHeight: () => Promise<number>,
  applyStyle: (style: BlockEditorStyle) => void,
  targetHeight: number,
  originalStyle: BlockEditorStyle
): Promise<{ level: number; style: BlockEditorStyle }> {
  let low = 0;
  let high = 100;
  let result = 0;

  // First check: does original style fit?
  applyStyle(originalStyle);
  const originalHeight = await measureHeight();
  if (originalHeight <= targetHeight) {
    return { level: 0, style: originalStyle };
  }

  // Binary search for minimum compactness
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const testStyle = compactnessToStyle(mid, originalStyle);

    applyStyle(testStyle);
    const height = await measureHeight();

    if (height <= targetHeight) {
      result = mid;
      high = mid - 1; // Try less compact
    } else {
      low = mid + 1; // Need more compact
    }
  }

  return {
    level: result,
    style: compactnessToStyle(result, originalStyle),
  };
}
```

#### 1c. Add RAF-wrapped Measurement

```typescript
const measureWithRAF = (measureFn: () => number): Promise<number> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve(measureFn());
      });
    });
  });
};
```

### Step 2: Create DOM Bridge Hook

**New File:** `frontend/src/components/library/editor/style/useFitToPageWithDOM.ts`

This hook bridges `ResumePreview`'s ref with `useAutoFitBlocks`:

```typescript
interface UseFitToPageWithDOMOptions {
  previewRef: React.RefObject<{ getPageElement: () => HTMLElement | null }>;
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  enabled: boolean;
  onStyleChange: (style: Partial<BlockEditorStyle>) => void;
}

export function useFitToPageWithDOM(options: UseFitToPageWithDOMOptions) {
  const measureFn = useCallback(() => {
    const pageElement = options.previewRef.current?.getPageElement();
    return pageElement?.scrollHeight ?? 0;
  }, [options.previewRef]);

  return useAutoFitBlocks({
    ...options,
    measureFn,
  });
}
```

### Step 3: Change Default to Auto-Fit Enabled

**File:** `frontend/src/lib/resume/defaults.ts`

```diff
export function createEmptyState(): BlockEditorState {
  return {
    blocks: [],
    activeBlockId: null,
    hoveredBlockId: null,
    style: { ...DEFAULT_STYLE },
    isDirty: false,
    isLoading: false,
    error: null,
-   fitToOnePage: false,
+   fitToOnePage: true,
  };
}

export function createInitialState(): BlockEditorState {
  return {
    blocks: createStarterBlocks(),
    activeBlockId: null,
    hoveredBlockId: null,
    style: { ...DEFAULT_STYLE },
    isDirty: false,
    isLoading: false,
    error: null,
-   fitToOnePage: false,
+   fitToOnePage: true,
  };
}
```

### Step 4: Integrate DOM Measurement in EditorLayout

**File:** `frontend/src/components/library/editor/EditorLayout.tsx`

**Changes:**

1. Import and use `useFitToPageWithDOM` hook
2. Pass `previewRef` to the hook
3. Remove overflow warning when `fitToOnePage` is enabled (content always fits)
4. Show minimum-reached warning instead if content can't fit

```typescript
const { status, reductions } = useFitToPageWithDOM({
  previewRef,
  blocks: state.blocks,
  style: state.style,
  enabled: state.fitToOnePage,
  onStyleChange: updateStyle,
});

// Only show overflow warning if fitToOnePage is disabled
{!state.fitToOnePage && overflows && (
  <OverflowWarning estimatedPageCount={estimatedPageCount} />
)}

// Show minimum-reached warning
{status.state === "minimum_reached" && (
  <MinimumReachedWarning message={status.message} />
)}
```

### Step 5: Add Save Coordination with Data Integrity

**File:** `frontend/src/hooks/useSaveCoordinator.ts` **(NEW)**

Extract save coordination into a dedicated hook that handles debouncing, locks, AI streaming awareness, and cross-tab data integrity:

```typescript
// Handles Debounce, Locks, AI Streaming, and Data Clobbering (OCC/Broadcast)

export function useSaveCoordinator({ state, saveToApi, broadcastChannel, isStreaming }) {
  const lastSavedStyleRef = useRef<string>(JSON.stringify(state.style));
  const pendingAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef<boolean>(false);

  // Core execution logic with OCC and Broadcasting
  const executeSave = useCallback(async () => {
    if (saveInProgressRef.current) return;

    saveInProgressRef.current = true;
    try {
      // 1. Pass the current version for Optimistic Concurrency Control
      const newVersion = await saveToApi(state, state.version);

      // 2. Update local hash only on success
      lastSavedStyleRef.current = JSON.stringify(state.style);

      // 3. Notify other tabs in same browser
      broadcastChannel.postMessage({ type: 'SAVED', version: newVersion });

    } catch (error) {
      if (error.status === 409) {
        // Version mismatch - UI will handle conflict resolution
        console.error("Data clobbering prevented.");
      }
    } finally {
      saveInProgressRef.current = false;
    }
  }, [state, saveToApi, broadcastChannel]);

  // Manual save handler
  const handleManualSave = useCallback(async () => {
    if (pendingAutoSaveRef.current) {
      clearTimeout(pendingAutoSaveRef.current);
      pendingAutoSaveRef.current = null;
    }
    await executeSave();
  }, [executeSave]);

  // Auto-save effect
  useEffect(() => {
    if (isStreaming || !state.fitToOnePage || !state.isDirty) return;

    const currentStyleHash = JSON.stringify(state.style);
    if (currentStyleHash === lastSavedStyleRef.current) return;

    if (pendingAutoSaveRef.current) clearTimeout(pendingAutoSaveRef.current);

    pendingAutoSaveRef.current = setTimeout(() => {
      if (!saveInProgressRef.current && !isStreaming) {
        executeSave();
      }
      pendingAutoSaveRef.current = null;
    }, 2000);

    return () => {
      if (pendingAutoSaveRef.current) clearTimeout(pendingAutoSaveRef.current);
    };
  }, [state.style, state.fitToOnePage, state.isDirty, isStreaming, executeSave]);

  return { handleManualSave };
}
```

**Key Features:**

| Concern | Solution |
| ------- | -------- |
| Debounce management | Single timer ref with proper cleanup |
| Save operation lock | Prevents concurrent API calls within a tab |
| AI streaming awareness | Suspends auto-save during LLM operations |
| Optimistic Concurrency Control | Passes `version` to API; 409 on mismatch |
| BroadcastChannel | Notifies other tabs when save completes |

See [Tradeoff 3: Eager Persistence](./130326_tradeoff-3-eager-persistence.md) for detailed race condition scenarios and the full solution.

### Step 6: View Page Compatibility

**File:** `frontend/src/app/(protected)/library/resumes/[id]/page.tsx`

No changes required. The view page uses saved styles directly:

```tsx
const style = useMemo(() => {
  if (!resume?.style) return DEFAULT_STYLE;
  return apiStyleToEditorStyle(resume.style as Record<string, unknown>);
}, [resume?.style]);
```

Since edit/tailor pages persist the auto-fitted styles, the view page will display correctly.

---

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Replace linear algorithm with binary search + compactness scale, add `measureFn` parameter |
| `frontend/src/components/library/editor/style/useFitToPageWithDOM.ts` | **NEW** - DOM bridge hook |
| `frontend/src/hooks/useSaveCoordinator.ts` | **NEW** - Save coordination with OCC and BroadcastChannel |
| `frontend/src/lib/resume/defaults.ts` | Change `fitToOnePage` default to `true` |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Integrate DOM-based auto-fit, update warnings |
| `frontend/src/components/library/editor/BlockEditorProvider.tsx` | Use `useSaveCoordinator` hook |

---

## Loop Safety Measures

| Protection | Description |
| ---------- | ----------- |
| `isProcessingRef` | Prevents re-entrancy during a single adjustment cycle |
| Double RAF | Ensures DOM has settled before measuring |
| Binary search bounds | Guaranteed max 7 iterations (log₂ 100) vs previous 25 |
| Early exit | Skip search entirely if original style fits |
| Debounced observers | 500ms debounce on ResizeObserver/MutationObserver |
| Hash comparison | Only persist if style actually changed |
| Save operation lock | Prevents concurrent save requests (manual save cancels pending auto-save) |
| Optimistic Concurrency Control | Version check prevents cross-tab/device data clobbering (409 on mismatch) |
| BroadcastChannel | Notifies other tabs in same browser when save completes |

See [Tradeoff 3: Eager Persistence](./130326_tradeoff-3-eager-persistence.md) for detailed race condition analysis and data integrity architecture.

---

## Edge Cases

### Content Cannot Fit at Minimum Sizes

When content exceeds one page even at minimum style settings:

- Status becomes `"minimum_reached"`
- Display warning: "Content exceeds one page at minimum settings. Consider removing or condensing content."
- Content renders at minimum sizes (will overflow but as compact as possible)

### Rapid Content Changes

- ResizeObserver and MutationObserver are debounced at 500ms
- Style persistence is debounced at 2000ms
- Prevents excessive API calls during typing

---

## Verification Plan

### Test Case 1: Edit Page Auto-Fit

1. Navigate to `/library/resumes/[id]/edit`
2. Add content that would normally exceed one page
3. **Expected:** Styles automatically reduce, no page break rulers appear
4. **Verify:** Check network tab for style save request

### Test Case 2: View Page Reflects Saved Styles

1. After Test Case 1, navigate to `/library/resumes/[id]`
2. **Expected:** Content displays with auto-fitted styles
3. **Verify:** No overflow visible, styles match edit page

### Test Case 3: Tailor Editor Auto-Fit

1. Navigate to `/tailor/editor/[id]`
2. Make changes that increase content length
3. **Expected:** Same auto-fit behavior as edit page
4. **Verify:** Styles persist when navigating away

### Test Case 4: Minimum Reached Warning

1. Add excessive content (e.g., 20+ experience entries)
2. **Expected:** Warning appears indicating minimum reached
3. **Verify:** Content renders at minimum sizes, user prompted to reduce content

---

## Testing Strategy

### Why Unit Tests Are Insufficient

DOM-based measurement cannot be validated with JSDOM or mocked refs because:

- JSDOM does not compute `scrollHeight`, `offsetHeight`, or layout properties
- Mocked measurements don't verify that CSS produces the expected overflow
- Font rendering and line breaks depend on actual browser font metrics

See [Tradeoff 2: Coupling Preview to Auto-Fit](./130326_tradeoff-2-coupling-preview-to-autofit.md) for detailed analysis.

### Playwright Integration Tests (Required)

| Scenario | Validation |
| -------- | ---------- |
| Content fits on one page | No scaling applied, contentHeight ≤ pageHeight |
| Slight overflow (1-10%) | Binary search finds minimal scale reduction |
| Moderate overflow (10-50%) | Scaling converges without excessive iterations |
| Severe overflow (>50%) | Falls back to minimum threshold |
| Dynamic content changes | Re-triggers auto-fit when blocks added/removed |

**Test suite location:** `frontend/e2e/fit-to-page.spec.ts` (to be created)

---

## Related Documents

| Document | Purpose |
| -------- | ------- |
| [Tradeoffs Summary](./130326_tradeoffs-summary.md) | Index of all engineering tradeoffs |
| [Tradeoff 1: Accuracy vs. Performance](./130326_tradeoff-1-accuracy-vs-performance.md) | Binary search proof, DOM measurement cost |
| [Tradeoff 2: Coupling Preview to Auto-Fit](./130326_tradeoff-2-coupling-preview-to-autofit.md) | Ref pattern justification, testing strategy |
| [Tradeoff 3: Eager Persistence](./130326_tradeoff-3-eager-persistence.md) | Race condition mitigation, LLM integration |
| [Tradeoff 4: Default-On vs. Opt-In](./130326_tradeoff-4-default-on-vs-optin.md) | Migration strategy for existing resumes |
| [Tradeoff 5: Synchronous Measurement](./130326_tradeoff-5-synchronous-measurement.md) | Double RAF timing, React concurrent mode |
