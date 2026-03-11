# Pagination Unification Master Plan

**Created:** 2026-03-11
**Status:** Planning

## Summary

Remove the heuristic-based `useBlockPageBreaks` hook and `PagedResumePreview` component. Unify the editor page to use `ResumePreview` directly with cosmetic page break rulers and overflow warnings.

### Problem Statement

Currently there are two rendering paths:
- **Preview page** uses `ResumePreview` - single container, browser handles layout
- **Editor page** uses `PagedResumePreview` + `useBlockPageBreaks` - estimates heights with hardcoded pixel guesses

The heuristic approach causes incorrect page splits. Content that fits on one page in preview is sometimes split across two pages in the editor because `estimateBlockHeight()` guesses wrong.

### Solution

Delete the heuristic system entirely. Use the same `ResumePreview` component for both pages. Add cosmetic visual guides (not affecting layout) to show page boundaries.

---

## Files to Delete

| File | Reason |
| ---- | ------ |
| `frontend/src/components/library/preview/useBlockPageBreaks.ts` | Contains `estimateBlockHeight()` with hardcoded pixel guesses |
| `frontend/src/components/library/preview/PagedResumePreview.tsx` | Heuristic-based multi-page split logic |

## Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/components/library/preview/ResumePreview.tsx` | Add `forwardRef`, interactive mode support |
| `frontend/src/components/library/preview/types.ts` | Extend `ResumePreviewProps` interface |
| `frontend/src/components/library/preview/index.ts` | Update exports |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Switch to `ResumePreview` |
| `frontend/src/components/export/ExportDialog.tsx` | Surface overflow warning |
| `frontend/src/lib/api/client.ts` | Parse `X-Overflows` header |

## New Files to Create

| File | Purpose |
| ---- | ------- |
| `frontend/src/components/library/preview/PageBreakRuler.tsx` | Cosmetic page break lines |
| `frontend/src/components/library/preview/useOverflowDetection.ts` | Debounced height measurement |
| `frontend/src/components/library/preview/OverflowWarning.tsx` | Warning banner component |

---

## Implementation Steps

### Step 1: Extend ResumePreview with Interactive Mode

**File:** `frontend/src/components/library/preview/types.ts`

Add new props to `ResumePreviewProps`:

```typescript
export interface ResumePreviewProps {
  // ...existing props...
  hoveredBlockId?: string | null;
  onBlockHover?: (blockId: string | null) => void;
  onMoveBlockUp?: (blockId: string) => void;
  onMoveBlockDown?: (blockId: string) => void;
  interactive?: boolean;
}
```

**File:** `frontend/src/components/library/preview/ResumePreview.tsx`

Changes:
- Convert to `forwardRef` to expose the page container for height measurement
- Add `interactive` prop handling
- When `interactive={true}`, use `InteractiveBlockRenderer` instead of `BlockRenderer`
- Add 32px left padding for interactive controls (matching PagedResumePreview)
- Add `useImperativeHandle` to expose the page ref

### Step 2: Create PageBreakRuler Component

**New file:** `frontend/src/components/library/preview/PageBreakRuler.tsx`

```typescript
interface PageBreakRulerProps {
  contentHeight: number;  // From scrollHeight
  scale: number;          // Preview scale factor
}
```

Renders absolutely positioned dashed lines every 1122px:
- Uses `pointer-events-none` so it doesn't interfere with clicks
- Amber/orange color with opacity for subtle appearance
- Badge showing "Page N starts here"
- `data-print-hidden="true"` attribute (excluded from WeasyPrint)

### Step 3: Create useOverflowDetection Hook

**New file:** `frontend/src/components/library/preview/useOverflowDetection.ts`

```typescript
interface UseOverflowDetectionOptions {
  containerRef: React.RefObject<HTMLElement>;
  debounceMs?: number;  // Default 500ms
}

interface OverflowDetectionResult {
  overflows: boolean;
  estimatedPageCount: number;
  contentHeight: number;
}
```

Uses `ResizeObserver` + `MutationObserver` with debouncing to detect:
- `scrollHeight > 1122px` = exceeds one page
- `scrollHeight > 2244px` = exceeds two pages

### Step 4: Create OverflowWarning Component

**New file:** `frontend/src/components/library/preview/OverflowWarning.tsx`

Renders an informational banner when content overflows:
- Amber background, non-blocking
- Shows estimated page count
- Different message for export overflow vs live detection

### Step 5: Update EditorLayout

**File:** `frontend/src/components/library/editor/EditorLayout.tsx`

Changes:

1. Replace import from `PagedResumePreview` to `ResumePreview`
2. Add imports for new components
3. Add `useRef` for the preview container
4. Add `useOverflowDetection` hook call
5. Wrap `ResumePreview` in relative container
6. Add `PageBreakRuler` as sibling overlay
7. Add `OverflowWarning` banner above preview

```tsx
<div className="relative">
  {overflows && <OverflowWarning ... />}
  <div className="relative">
    <ResumePreview
      ref={previewRef}
      interactive={true}
      // ...other existing props
    />
    <PageBreakRuler contentHeight={contentHeight} scale={scale} />
  </div>
</div>
```

### Step 6: Surface Export Overflow Warning

**File:** `frontend/src/lib/api/client.ts`

Modify the resume export function to return headers:

```typescript
export: async (...) => Promise<{
  blob: Blob;
  pageCount: number;
  overflows: boolean;
}>
```

Parse `X-Page-Count` and `X-Overflows` response headers.

**File:** `frontend/src/components/export/ExportDialog.tsx`

After successful export:
- Check if `overflows === true`
- Show warning: "Your resume is {page_count} pages. Consider enabling Fit to One Page or shortening your content."

### Step 7: Update Index Exports

**File:** `frontend/src/components/library/preview/index.ts`

- Remove exports for `PagedResumePreview` and `useBlockPageBreaks`
- Add exports for new components

### Step 8: Delete Deprecated Files

Delete:
- `frontend/src/components/library/preview/useBlockPageBreaks.ts`
- `frontend/src/components/library/preview/PagedResumePreview.tsx`

---

## Constraints

### Do NOT Touch

- **Section reordering logic** - preserved via existing `InteractiveBlockRenderer`
- **AI suggestion panel**
- **ATS scoring tab**
- **Format/Font/Spacing panel**
- **Any backend files**

### Cosmetic Ruler Requirements

- Must NOT appear in HTML passed to WeasyPrint
- Uses absolute positioning (not in DOM flow)
- `data-print-hidden="true"` attribute for exclusion
- `pointer-events: none` to not block interactions

### Overflow Warning Requirements

- Informational only - does NOT block editing or export
- Debounced at 500ms to avoid performance issues

---

## Key Implementation Details

### Page Break Ruler Positioning

```tsx
<div className="page-break-ruler pointer-events-none absolute inset-0">
  {breakPositions.map((position, index) => (
    <div
      key={index}
      className="absolute left-0 right-0"
      style={{ top: position * scale }}
    >
      <div className="border-t-2 border-dashed border-amber-500/60" />
      <div className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
        Page {index + 2} starts here
      </div>
    </div>
  ))}
</div>
```

### Overflow Detection Thresholds

| scrollHeight | Warning Message |
| ------------ | --------------- |
| > 1122px | "Your resume may exceed one page" |
| > 2244px | "Your resume may exceed two pages" |

### Interactive Mode

The existing `InteractiveBlockRenderer` handles:
- Dashed selection box on hover
- Up/down move arrows on left edge
- Click-to-select functionality

Just need to wire it into `ResumePreview` when `interactive={true}`.

---

## Verification Steps

1. **Visual parity test:** Open same resume on preview page vs edit page, verify identical rendering
2. **Page break ruler test:** Add content > 1122px, verify dashed line appears
3. **Overflow warning test:** Add content, wait 500ms, verify warning banner
4. **Interactive test:** Hover blocks, verify selection box and move arrows work
5. **Export test:** Export multi-page resume, verify warning surfaces
6. **Print exclusion test:** Inspect PageBreakRuler element has `data-print-hidden="true"`

---

## Documentation Updates

After implementation, update:

1. `/docs/architecture/system-architecture.md` - Update Frontend Component Hierarchy section
2. Create `/docs/features/pagination-unification/110326_decision-record.md` documenting:
   - Decision to remove heuristic-based pagination
   - Why single continuous renderer is better
   - Cosmetic ruler approach vs DOM-based page splitting
