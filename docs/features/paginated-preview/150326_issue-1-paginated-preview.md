# Issue 1: Paginated Editor Preview

## Problem

The current resume editor uses a single continuous container with a cosmetic "wiggle line" (`PageBreakRuler`) showing "Page X starts here". This indicator:

- Is only cosmetic - doesn't reflect actual page breaks
- Uses `minHeight` not fixed height - content flows beyond page boundaries
- Causes WYSIWYG violation - what users see doesn't match what they get in PDF

**Current Implementation:**

```text
┌─────────────────────┐
│  Single container   │
│  (minHeight: 1056)  │
│                     │
│  - - Page 2 - -     │  ← Cosmetic dashed line only
│                     │
│  Content continues  │
│  beyond the line    │
└─────────────────────┘
```

## Solution

Render **multiple distinct page containers** (each exactly 1056px tall) with visual gaps between them.

```text
┌─────────────────────┐
│      Page 1         │
│   (height: 1056)    │
│                     │
└─────────────────────┘
        ↕ 24px gap
┌─────────────────────┐
│      Page 2         │
│   (height: 1056)    │
│                     │
└─────────────────────┘
```

---

## Implementation Phases

### Phase 1: Block Height Measurement Infrastructure

**Goal:** Create the hidden measurement system that calculates real block heights.

#### Step 1.1: Create `useBlockMeasurement.ts` Hook

**File:** `frontend/src/components/library/preview/useBlockMeasurement.ts`

This hook measures rendered block heights in a hidden DOM container.

```typescript
interface BlockMeasurement {
  blockId: string;
  height: number;       // offsetHeight in pixels
  marginBottom: number; // sectionGap from style
}

interface UseMeasurementResult {
  measurements: Map<string, BlockMeasurement>;
  isReady: boolean;
  measurementContainerRef: RefObject<HTMLDivElement>;
}

function useBlockMeasurement(
  blocks: AnyResumeBlock[],
  style: BlockEditorStyle
): UseMeasurementResult;
```

**Implementation details:**

1. Create a hidden `div` with `visibility: hidden; position: absolute; top: -9999px`
2. Apply the same width (816px) and padding as the actual preview
3. Render all blocks using `BlockRenderer` (non-interactive) into this container
4. After render (via `useLayoutEffect`), measure each block's `offsetHeight`
5. Store measurements in a `Map<blockId, BlockMeasurement>`
6. Set `isReady: true` when all measurements complete
7. Re-measure when `blocks` or `style` change (debounce 100ms)

**Edge cases to handle:**

- Empty blocks array → return empty map, `isReady: true`
- Hidden blocks (`isHidden: true`) → exclude from measurement
- Style changes (font size, spacing) → trigger re-measurement

#### Step 1.2: Create Measurement Container Component

**File:** `frontend/src/components/library/preview/MeasurementContainer.tsx`

A hidden container that renders blocks for measurement purposes only.

```typescript
interface MeasurementContainerProps {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  onMeasurementsReady: (measurements: Map<string, BlockMeasurement>) => void;
}
```

**Implementation details:**

1. Render with `position: absolute`, off-screen (`left: -9999px`)
2. Must match exact page width (816px) and padding from `computePreviewStyles`
3. Each block wrapped in a `div` with `data-block-id={block.id}` for querying
4. Use `useLayoutEffect` to measure after paint, before browser display

---

### Phase 2: Page Assignment Algorithm

**Goal:** Implement the algorithm that assigns blocks to pages based on measurements.

#### Step 2.1: Create `useBlockPagination.ts` Hook

**File:** `frontend/src/components/library/preview/useBlockPagination.ts`

```typescript
interface PageAssignment {
  pageNumber: number;      // 1-indexed
  blocks: AnyResumeBlock[];
  usedHeight: number;      // Total height used on this page
  remainingHeight: number; // Space left on page
}

interface PaginationResult {
  pages: PageAssignment[];
  totalPages: number;
  isReady: boolean;
  oversizedBlocks: string[]; // Block IDs that exceed page height
}

function useBlockPagination(
  blocks: AnyResumeBlock[],
  style: BlockEditorStyle,
  measurements: Map<string, BlockMeasurement>,
  measurementsReady: boolean
): PaginationResult;
```

#### Step 2.2: Implement Keep-Together Algorithm

**Algorithm pseudocode:**

```text
CONSTANTS:
  PAGE_HEIGHT = 1056px
  CONTENT_HEIGHT = PAGE_HEIGHT - paddingTop - paddingBottom

FUNCTION assignBlocksToPages(blocks, measurements):
  pages = []
  currentPage = { pageNumber: 1, blocks: [], usedHeight: 0 }
  oversizedBlocks = []

  FOR each block in sortedBlocks:
    IF block.isHidden:
      CONTINUE

    blockHeight = measurements.get(block.id).height

    // Case 1: Block fits on current page
    IF currentPage.usedHeight + blockHeight <= CONTENT_HEIGHT:
      currentPage.blocks.push(block)
      currentPage.usedHeight += blockHeight

    // Case 2: Block doesn't fit but page has content → start new page
    ELSE IF currentPage.blocks.length > 0:
      pages.push(currentPage)
      currentPage = { pageNumber: pages.length + 1, blocks: [block], usedHeight: blockHeight }

      IF blockHeight > CONTENT_HEIGHT:
        oversizedBlocks.push(block.id)

    // Case 3: Block doesn't fit and page is empty → oversized block
    ELSE:
      currentPage.blocks.push(block)
      currentPage.usedHeight = blockHeight
      oversizedBlocks.push(block.id)

  // Don't forget the last page
  IF currentPage.blocks.length > 0:
    pages.push(currentPage)

  RETURN { pages, oversizedBlocks }
```

#### Step 2.3: Handle Edge Cases

| Scenario | Behavior |
| -------- | -------- |
| Empty blocks array | Return 1 empty page |
| All blocks hidden | Return 1 empty page with "All sections hidden" message |
| Single oversized block | Place on its own page, add to `oversizedBlocks` |
| Multiple consecutive oversized blocks | Each gets its own page |
| Block exactly fits remaining space | Add to current page |
| First block is oversized | Place on page 1, mark as oversized |

---

### Phase 3: Page Container Component

**Goal:** Create the visual page container with fixed height and proper styling.

#### Step 3.1: Create `PreviewPage.tsx`

**File:** `frontend/src/components/library/preview/PreviewPage.tsx`

```typescript
interface PreviewPageProps {
  pageNumber: number;
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  computedStyles: ComputedPreviewStyle;
  isOversized?: boolean;
  // Interactive props
  activeBlockId?: string | null;
  hoveredBlockId?: string | null;
  onBlockClick?: (blockId: string) => void;
  onBlockHover?: (blockId: string | null) => void;
  onMoveBlockUp?: (blockId: string) => void;
  onMoveBlockDown?: (blockId: string) => void;
  interactive?: boolean;
  // Movement constraints (across all pages)
  canMoveUp: (blockId: string) => boolean;
  canMoveDown: (blockId: string) => boolean;
}

const PreviewPage = forwardRef<HTMLDivElement, PreviewPageProps>(...);
```

**Implementation details:**

1. Fixed container dimensions:

   ```css
   width: 816px;
   height: 1056px;  /* NOT minHeight */
   overflow: hidden;
   ```

2. Page number indicator (hidden during export):

   ```tsx
   <div data-print-hidden="true" className="absolute top-2 right-2 text-xs text-muted-foreground">
     Page {pageNumber}
   </div>
   ```

3. Oversized warning indicator:

   ```tsx
   {isOversized && (
     <div data-print-hidden="true" className="absolute bottom-0 left-0 right-0 bg-amber-100 border-t border-amber-300 text-amber-800 text-xs px-2 py-1">
       ⚠️ Content exceeds page height
     </div>
   )}
   ```

4. Block rendering with interactive support:
   - Reuse existing `InteractiveBlockRenderer` and `BlockRenderer`
   - Pass through all interactive props

#### Step 3.2: Page Styling Specifications

```typescript
const pageStyles = {
  // Container
  container: {
    width: PAGE_DIMENSIONS.WIDTH,
    height: PAGE_DIMENSIONS.HEIGHT,
    backgroundColor: 'white',
    position: 'relative' as const,
    overflow: 'hidden',
  },

  // Visual treatment
  visual: {
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    borderRadius: '2px',
    border: '1px solid hsl(var(--border))',
  },

  // Content area (accounts for padding)
  content: {
    paddingTop: computedStyles.paddingTop,
    paddingBottom: computedStyles.paddingBottom,
    paddingLeft: computedStyles.paddingLeft,
    paddingRight: computedStyles.paddingRight,
    fontFamily: computedStyles.fontFamily,
  },
};
```

---

### Phase 4: Paginated Preview Component

**Goal:** Create the main component that orchestrates measurement, pagination, and rendering.

#### Step 4.1: Create `PaginatedResumePreview.tsx`

**File:** `frontend/src/components/library/preview/PaginatedResumePreview.tsx`

```typescript
export interface PaginatedResumePreviewHandle {
  /** Get all page elements for PDF export */
  getPageElements: () => HTMLDivElement[];
  /** Get current scale factor */
  getScale: () => number;
  /** Get total page count */
  getPageCount: () => number;
}

interface PaginatedResumePreviewProps extends ResumePreviewProps {
  /** Gap between pages in pixels (default: 24) */
  pageGap?: number;
}

const PaginatedResumePreview = forwardRef<
  PaginatedResumePreviewHandle,
  PaginatedResumePreviewProps
>(...);
```

#### Step 4.2: Component Structure

```tsx
function PaginatedResumePreview({
  blocks,
  style,
  pageGap = 24,
  // ... other props
}, ref) {
  // 1. Compute styles
  const computedStyles = useMemo(() => computePreviewStyles(style), [style]);

  // 2. Sort and filter blocks
  const sortedBlocks = useMemo(() =>
    [...blocks].filter(b => !b.isHidden).sort((a, b) => a.order - b.order),
    [blocks]
  );

  // 3. Measure blocks
  const { measurements, isReady: measurementsReady, measurementContainerRef } =
    useBlockMeasurement(sortedBlocks, style);

  // 4. Calculate pagination
  const { pages, totalPages, isReady, oversizedBlocks } =
    useBlockPagination(sortedBlocks, style, measurements, measurementsReady);

  // 5. Manage page refs for export
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // 6. Auto-scale calculation
  const [autoScale, setAutoScale] = useState(1);
  // ... resize observer logic

  // 7. Expose handle via useImperativeHandle
  useImperativeHandle(ref, () => ({
    getPageElements: () => Array.from(pageRefs.current.values()),
    getScale: () => scale,
    getPageCount: () => totalPages,
  }));

  // 8. Render
  return (
    <div className="paginated-preview-container">
      {/* Hidden measurement container */}
      <div ref={measurementContainerRef} />

      {/* Loading state while measuring */}
      {!isReady && <PageSkeleton />}

      {/* Render pages with gaps */}
      {isReady && pages.map((page, index) => (
        <Fragment key={page.pageNumber}>
          <PreviewPage
            ref={(el) => el && pageRefs.current.set(page.pageNumber, el)}
            pageNumber={page.pageNumber}
            blocks={page.blocks}
            isOversized={page.blocks.some(b => oversizedBlocks.includes(b.id))}
            // ... other props
          />
          {index < pages.length - 1 && (
            <div style={{ height: pageGap }} className="page-gap" />
          )}
        </Fragment>
      ))}
    </div>
  );
}
```

#### Step 4.3: Loading/Skeleton State

While measuring blocks (first render), show a skeleton:

```tsx
function PageSkeleton() {
  return (
    <div
      className="bg-white shadow-lg rounded-sm border border-border animate-pulse"
      style={{ width: PAGE_DIMENSIONS.WIDTH, height: PAGE_DIMENSIONS.HEIGHT }}
    >
      <div className="p-8 space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/6" />
      </div>
    </div>
  );
}
```

---

### Phase 5: EditorLayout Integration

**Goal:** Replace `ResumePreview` with `PaginatedResumePreview` in the editor.

#### Step 5.1: Update Imports in `EditorLayout.tsx`

```diff
- import {
-   ResumePreview,
-   PageBreakRuler,
-   OverflowWarning,
-   MinimumReachedWarning,
-   useOverflowDetection,
- } from "../preview";
- import type { ResumePreviewHandle } from "../preview/ResumePreview";

+ import {
+   PaginatedResumePreview,
+   OverflowWarning,
+   MinimumReachedWarning,
+ } from "../preview";
+ import type { PaginatedResumePreviewHandle } from "../preview/PaginatedResumePreview";
```

#### Step 5.2: Update Ref Type

```diff
- const previewRef = useRef<ResumePreviewHandle>(null);
+ const previewRef = useRef<PaginatedResumePreviewHandle>(null);
```

#### Step 5.3: Remove `useOverflowDetection` Usage

The paginated preview handles overflow visually (via separate pages), so the overflow warning system changes:

```diff
- // Overflow detection for multi-page warning
- const { overflows, estimatedPageCount, contentHeight } = useOverflowDetection({
-   containerRef: pageContainerRef,
-   debounceMs: 500,
- });

+ // Page count from paginated preview
+ const pageCount = previewRef.current?.getPageCount() ?? 1;
```

#### Step 5.4: Update Preview Rendering

```diff
- {/* Preview with page break rulers */}
- <div className="relative flex flex-col items-center">
-   <ResumePreview
-     ref={previewRef}
-     blocks={blocks}
-     style={style}
-     activeBlockId={activeBlockId}
-     hoveredBlockId={hoveredBlockId}
-     onBlockClick={handlePreviewBlockClick}
-     onBlockHover={handlePreviewBlockHover}
-     onMoveBlockUp={handleMoveBlockUp}
-     onMoveBlockDown={handleMoveBlockDown}
-     interactive={true}
-     showPageBorder={true}
-   />
-   <PageBreakRuler
-     contentHeight={contentHeight}
-     scale={currentScale}
-   />
- </div>

+ {/* Paginated preview */}
+ <PaginatedResumePreview
+   ref={previewRef}
+   blocks={blocks}
+   style={style}
+   activeBlockId={activeBlockId}
+   hoveredBlockId={hoveredBlockId}
+   onBlockClick={handlePreviewBlockClick}
+   onBlockHover={handlePreviewBlockHover}
+   onMoveBlockUp={handleMoveBlockUp}
+   onMoveBlockDown={handleMoveBlockDown}
+   interactive={true}
+   showPageBorder={true}
+   pageGap={24}
+ />
```

#### Step 5.5: Update Export Dialog Integration

```diff
  {showExportDialog && (
    <ExportDialog
      resumeTitle={title}
      onClose={() => setShowExportDialog(false)}
-     previewElement={previewRef.current?.getPageElement()}
+     pageElements={previewRef.current?.getPageElements()}
    />
  )}
```

**Note:** This requires updating `ExportDialog` to accept an array of page elements. See Issue 2 (PDF White Borders) for export changes.

#### Step 5.6: Update Auto-Fit Measurement Function

```diff
  useEffect(() => {
    const measureFn = () => {
-     const pageElement = previewRef.current?.getPageElement();
-     return pageElement?.scrollHeight ?? 0;
+     // With paginated preview, total height = pageCount * PAGE_HEIGHT
+     const pageCount = previewRef.current?.getPageCount() ?? 1;
+     return pageCount * PAGE_DIMENSIONS.HEIGHT;
    };

    setAutoFitMeasureFn(measureFn);
    // ...
  }, [setAutoFitMeasureFn]);
```

---

### Phase 6: Cleanup and Deprecation

**Goal:** Remove obsolete code and update exports.

#### Step 6.1: Deprecate `PageBreakRuler.tsx`

Option A (Immediate removal):

```bash
rm frontend/src/components/library/preview/PageBreakRuler.tsx
```

Option B (Soft deprecation for gradual migration):

```typescript
/**
 * @deprecated Use PaginatedResumePreview instead, which renders separate page containers.
 * This component will be removed in a future release.
 */
export function PageBreakRuler(...) { ... }
```

#### Step 6.2: Update `preview/index.ts` Exports

```diff
  export { ResumePreview, ResumePreviewStandalone } from "./ResumePreview";
+ export { PaginatedResumePreview } from "./PaginatedResumePreview";
+ export type { PaginatedResumePreviewHandle } from "./PaginatedResumePreview";
  export { BlockRenderer } from "./BlockRenderer";
  export { InteractiveBlockRenderer } from "./InteractiveBlockRenderer";
- export { PageBreakRuler } from "./PageBreakRuler";
  export { OverflowWarning } from "./OverflowWarning";
  export { MinimumReachedWarning } from "./MinimumReachedWarning";
  export { useOverflowDetection } from "./useOverflowDetection";
+ export { PreviewPage } from "./PreviewPage";
```

#### Step 6.3: Keep `ResumePreview` for Non-Editor Uses

The original `ResumePreview` component may still be used in:

- Static preview pages (`/library/resumes/[id]`)
- Print preview dialogs
- Thumbnail generation

Keep it available but consider adding a deprecation notice if full migration is planned.

---

## File Summary

| File | Action | Phase |
| ---- | ------ | ----- |
| `frontend/src/components/library/preview/useBlockMeasurement.ts` | Create | 1 |
| `frontend/src/components/library/preview/MeasurementContainer.tsx` | Create | 1 |
| `frontend/src/components/library/preview/useBlockPagination.ts` | Create | 2 |
| `frontend/src/components/library/preview/PreviewPage.tsx` | Create | 3 |
| `frontend/src/components/library/preview/PaginatedResumePreview.tsx` | Create | 4 |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Modify | 5 |
| `frontend/src/components/library/preview/index.ts` | Modify | 6 |
| `frontend/src/components/library/preview/PageBreakRuler.tsx` | Delete | 6 |

---

## Design Decisions

### Block Distribution: Keep-Together

If a block would be split across pages, move the entire block to the next page:

- Prevents blocks from being cut mid-content
- May leave whitespace at bottom of pages (acceptable)
- Matches typical word processor behavior

### Oversized Blocks

If a single block exceeds 1056px (e.g., very long experience section):

- Place on its own page with `overflow: visible` (content extends into gap)
- Show warning indicator to user
- In PDF export: may require special handling (split or scale)

### Interactive Editing

Block selection/hover works across page boundaries:

- `activeBlockId` and `hoveredBlockId` managed at EditorLayout level
- Each page passes these to its block renderers
- Visual feedback applies regardless of which page block is on

### Move Controls Across Pages

When a block is on page 2 and user clicks "move up":

- Block moves to page 1 (if it fits) or stays at top of page 2
- `canMoveUp` considers global block order, not per-page position

---

## Performance Considerations

### Measurement Debouncing

Re-measure blocks only when necessary:

- Debounce 100ms after style changes
- Skip measurement if blocks haven't changed (referential equality)
- Use `useMemo` for sorted/filtered block arrays

### Ref Management

Page refs are stored in a `Map` to support dynamic page counts:

```typescript
const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

// Cleanup stale refs when page count decreases
useEffect(() => {
  const currentCount = pages.length;
  for (const [pageNum] of pageRefs.current) {
    if (pageNum > currentCount) {
      pageRefs.current.delete(pageNum);
    }
  }
}, [pages.length]);
```

### Virtualization (Future)

For resumes with many pages (10+), consider virtualization:

- Only render visible pages
- Use `IntersectionObserver` to detect viewport
- Not needed for typical 1-3 page resumes

---

## Testing Strategy

### Unit Tests

| Test | File | Coverage |
| ---- | ---- | -------- |
| Block measurement hook | `useBlockMeasurement.test.ts` | Measurement accuracy |
| Pagination algorithm | `useBlockPagination.test.ts` | Edge cases, oversized blocks |
| Page assignment logic | `useBlockPagination.test.ts` | Keep-together behavior |

### Integration Tests

| Test | Scenario |
| ---- | -------- |
| 1-page resume | Single page renders without gaps |
| 2-page resume | Gap appears between pages |
| Block reorder | Pages re-paginate on move |
| Add content | New page appears when needed |
| Remove content | Pages consolidate when possible |
| Style change | Re-pagination on font size change |

### E2E Tests (Playwright)

| Test | Verification |
| ---- | ------------ |
| Visual page separation | Pages have visible gaps |
| PDF export multi-page | Each page exports correctly |
| Interactive controls | Move up/down works across pages |

---

## Verification Checklist

**Phase 1 Complete:**

- [ ] Hidden measurement container renders off-screen
- [ ] Block heights measured accurately
- [ ] Measurements update on style change

**Phase 2 Complete:**

- [ ] Blocks assigned to correct pages
- [ ] Keep-together logic prevents mid-block splits
- [ ] Oversized blocks detected and flagged

**Phase 3 Complete:**

- [ ] Page container has fixed 1056px height
- [ ] Page number indicator visible (hidden on print)
- [ ] Oversized warning displays correctly

**Phase 4 Complete:**

- [ ] Multiple pages render with gaps
- [ ] Loading skeleton shows during measurement
- [ ] Page refs accessible for export

**Phase 5 Complete:**

- [ ] EditorLayout uses PaginatedResumePreview
- [ ] Interactive editing works across pages
- [ ] Export dialog receives page elements array

**Phase 6 Complete:**

- [ ] PageBreakRuler removed
- [ ] Exports updated in index.ts
- [ ] No runtime errors or console warnings

---

## Rollback Plan

If issues arise after deployment:

1. Revert `EditorLayout.tsx` to use `ResumePreview` + `PageBreakRuler`
2. Keep new components in codebase but unused
3. Investigate and fix issues
4. Re-deploy with fixes

The feature flag approach (if needed):

```typescript
const ENABLE_PAGINATED_PREVIEW = process.env.NEXT_PUBLIC_PAGINATED_PREVIEW === 'true';

// In EditorLayout
{ENABLE_PAGINATED_PREVIEW ? (
  <PaginatedResumePreview ... />
) : (
  <>
    <ResumePreview ... />
    <PageBreakRuler ... />
  </>
)}
```
