# Fit-to-One-Page: Master Plan

**Created:** 2026-03-13
**Status:** Planning

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

### Gap

The `useAutoFitBlocks` hook uses `estimateContentHeight()` which calculates height mathematically. This is imprecise because:

- Cannot account for exact text wrapping
- Line heights vary by font
- Complex nested content has unpredictable heights

The `useOverflowDetection` hook already does DOM measurement but only for **detection**, not for driving auto-fit.

---

## Implementation Plan

### Step 1: Enhance `useAutoFitBlocks` with DOM Measurement

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

Add optional `measureFn` parameter to the options interface:

```typescript
interface UseAutoFitBlocksOptions {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  enabled: boolean;
  onStyleChange: (style: Partial<BlockEditorStyle>) => void;
  measureFn?: () => number;  // NEW: Optional DOM-based measurement
}
```

**Modifications:**

1. When `measureFn` is provided, use it instead of `estimateContentHeight()`
2. Add double `requestAnimationFrame` wrapper to ensure DOM has settled before measuring
3. Add stability check: stop iteration if height change < 2px between measurements

**Key code pattern:**

```typescript
const measureWithRAF = (): Promise<number> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve(measureFn ? measureFn() : estimateContentHeight(blocks, workingStyle));
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

### Step 5: Add Debounced Style Persistence

**File:** `frontend/src/components/library/editor/BlockEditorProvider.tsx`

Add effect to persist style changes when auto-fit adjusts them:

```typescript
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
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Add `measureFn` parameter, RAF wrapper, stability check |
| `frontend/src/components/library/editor/style/useFitToPageWithDOM.ts` | **NEW** - DOM bridge hook |
| `frontend/src/lib/resume/defaults.ts` | Change `fitToOnePage` default to `true` |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Integrate DOM-based auto-fit, update warnings |
| `frontend/src/components/library/editor/BlockEditorProvider.tsx` | Add debounced style persistence |

---

## Loop Safety Measures

| Protection | Description |
| ---------- | ----------- |
| `isProcessingRef` | Prevents re-entrancy during a single adjustment cycle |
| Double RAF | Ensures DOM has settled before measuring |
| Stability threshold | Stop iteration if height change < 2px |
| Max iterations | Hard limit of 25 iterations (existing) |
| Debounced observers | 500ms debounce on ResizeObserver/MutationObserver |
| Hash comparison | Only persist if style actually changed |

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
