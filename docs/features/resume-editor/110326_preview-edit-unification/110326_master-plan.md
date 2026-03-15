# Preview/Edit Page Rendering Unification

## Problem Summary

The Preview page (`/library/resumes/[id]`) and Edit page (`/library/resumes/[id]/edit`) render the same resume differently:

- **Preview**: Uses `ResumePreview` - single container, browser computes actual layout, fits correctly
- **Edit**: Uses `PagedResumePreview` with `useBlockPageBreaks` - estimates heights with hardcoded heuristics, overestimates, incorrectly splits content across 2 pages

## Architecture Analysis

### Approach A: DOM-Based Height Measurement

Replace estimated heights with actual DOM measurements via refs.

| Factor | Assessment |
| ------ | ---------- |
| Accuracy | High - measures actual rendered heights |
| Performance | Poor - double-render cycle; every edit triggers remeasurement |
| AI integration | Problematic - inline suggestions trigger measurement cascades |
| Complexity | High - hidden measurement container, sync issues, race conditions |
| UX | Potential layout jank during measurement |

### Approach B: Single-Page Unified Renderer (Recommended)

Make Edit page use the same `ResumePreview` as Preview page.

| Factor | Assessment |
| ------ | ---------- |
| Accuracy | Perfect - identical rendering guarantees identical output |
| Performance | Excellent - no estimation overhead; direct React rendering |
| AI integration | Straightforward - changes render immediately |
| Complexity | Low - removes code rather than adding |
| UX | True WYSIWYG - what you edit IS what you preview |

## Recommendation: Approach B

**Rationale:**

1. **Accuracy is non-negotiable** - Users need confidence preview matches final output
2. **Real-time editing demands low latency** - No estimation overhead
3. **AI integration requires simplicity** - Direct render path for inline suggestions
4. **Code reduction** - Simplifies codebase by removing estimation logic
5. **Industry precedent** - Google Docs, Notion use single-page editing with overflow indicators

## Implementation Plan

### Phase 1: Extend ResumePreview with Interactive Features

**File:** `frontend/src/components/library/preview/ResumePreview.tsx`

Add props that `PagedResumePreview` currently has:

```typescript
interface ResumePreviewProps {
  // ...existing props...
  hoveredBlockId?: string | null;
  onBlockHover?: (blockId: string | null) => void;
  onMoveBlockUp?: (blockId: string) => void;
  onMoveBlockDown?: (blockId: string) => void;
  interactive?: boolean;
}
```

Update render loop to conditionally use `InteractiveBlockRenderer` when `interactive={true}`.

### Phase 2: Update Types

**File:** `frontend/src/components/library/preview/types.ts`

Add new optional props to `ResumePreviewProps` interface.

### Phase 3: Create Page Overflow Indicator

**New File:** `frontend/src/components/library/preview/PageOverflowIndicator.tsx`

Component that:

- Measures actual content height via ref
- Compares against available page height (1056px minus margins)
- Shows visual indicator (dashed line + badge) when content exceeds one page
- Updates on content changes via `useLayoutEffect`

### Phase 4: Modify EditorLayout

**File:** `frontend/src/components/library/editor/EditorLayout.tsx`

Changes:

- Line 8: Change import from `PagedResumePreview` to `ResumePreview`
- Lines 167-178: Replace `PagedResumePreview` with `ResumePreview`
- Add `showOverflowIndicator={true}` prop

### Phase 5: Update Preview Index Exports

**File:** `frontend/src/components/library/preview/index.ts`

Export `PageOverflowIndicator` component.

### Phase 6: Deprecate PagedResumePreview (Optional Cleanup)

After verification, consider removing:

- `PagedResumePreview.tsx` - no longer needed for edit view
- `useBlockPageBreaks.ts` - estimation logic obsolete

Keep if needed for future print preview with explicit page boundaries.

## Critical Files

| File | Action |
| ---- | ------ |
| `frontend/src/components/library/preview/ResumePreview.tsx` | Extend with interactive features |
| `frontend/src/components/library/preview/types.ts` | Add new props to interface |
| `frontend/src/components/library/preview/PageOverflowIndicator.tsx` | Create new component |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Swap PagedResumePreview for ResumePreview |
| `frontend/src/components/library/preview/InteractiveBlockRenderer.tsx` | Reference for interactive pattern |

## Future Compatibility

### Real-Time Editing

With unified renderer:

1. User edits content in control panel
2. `BlockEditorContext` updates state
3. `ResumePreview` re-renders with new content
4. `PageOverflowIndicator` updates automatically

No page break recalculation needed.

### AI Inline Suggestions

- Suggestions render as inline spans with special styling
- Browser handles positioning automatically
- Overflow indicator updates if content length changes
- Zero estimation overhead

## Verification Steps

1. **Visual Comparison**: Open same resume in Preview and Edit pages, verify pixel-identical rendering

2. **Overflow Indicator**: Add content to exceed one page, verify indicator appears at correct position

3. **Interactive Features**: Test block hover, move up/down controls, click-to-select

4. **Performance**: Rapidly edit content, verify no lag or jank

5. **Export Consistency**: Export PDF from both pages, verify identical output
