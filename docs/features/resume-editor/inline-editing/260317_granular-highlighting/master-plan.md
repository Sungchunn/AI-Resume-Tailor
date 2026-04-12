# Granular Highlighting for Resume Editors

Enable sub-section highlighting (titles, dates, bullets, skills) in both editor pages:

- `/library/resumes/[id]/edit`
- `/tailor/editor/[id]`

## Current State

- Highlighting works at **block level only** via `activeBlockId` and `hoveredBlockId`
- CSS: `ring-2 ring-primary` (active), `ring-2 ring-dashed ring-primary/50` (hover)
- `InteractiveBlockRenderer` wraps entire blocks with click/hover handlers
- Preview components (`ExperiencePreview`, etc.) have no interaction awareness

## Implementation Plan

### Phase 1: State Foundation

**File:** `frontend/src/lib/resume/types.ts`

Add new state fields to `BlockEditorState`:

```typescript
export interface BlockEditorState {
  // ... existing fields
  activeElementId: string | null;   // Compound ID: "blockId:entryId:field:index"
  hoveredElementId: string | null;
}
```

Add new actions to `BlockEditorAction`:

```typescript
| { type: "SET_ACTIVE_ELEMENT"; payload: string | null }
| { type: "SET_HOVERED_ELEMENT"; payload: string | null }
```

### Phase 2: Element Path Utilities

**New file:** `frontend/src/lib/resume/elementPath.ts`

```typescript
export interface ElementPath {
  blockId: string;
  entryId?: string;     // For array entries (experience, education)
  field?: string;       // Field name (title, company, bullets)
  index?: number;       // For array fields (bullets[2])
}

export function encodeElementPath(path: ElementPath): string;
export function decodeElementPath(encoded: string): ElementPath;
export function getBlockId(elementId: string): string;
export function isChildOf(child: string, parent: string): boolean;
```

**Examples:**

| Target | Encoded ID |
| ------ | ---------- |
| Experience block | `exp-1` |
| First entry | `exp-1:entry-0` |
| Job title | `exp-1:entry-0:title` |
| Third bullet | `exp-1:entry-0:bullets:2` |
| Fifth skill | `skills-1::skills:4` |

### Phase 3: Reducer Updates

**File:** `frontend/src/components/library/editor/blockEditorReducer.ts`

Handle new actions:

```typescript
case "SET_ACTIVE_ELEMENT": {
  const elementId = action.payload;
  const blockId = elementId ? getBlockId(elementId) : null;
  return {
    ...state,
    activeElementId: elementId,
    activeBlockId: blockId,  // Keep block-level state in sync
  };
}
case "SET_HOVERED_ELEMENT": {
  const elementId = action.payload;
  const blockId = elementId ? getBlockId(elementId) : null;
  return {
    ...state,
    hoveredElementId: elementId,
    hoveredBlockId: blockId,
  };
}
```

### Phase 4: Context Updates

**File:** `frontend/src/components/library/editor/BlockEditorContext.tsx`

Add new methods:

```typescript
setActiveElement: (elementId: string | null) => void;
setHoveredElement: (elementId: string | null) => void;
```

### Phase 5: Preview Types Extension

**File:** `frontend/src/components/library/preview/types.ts`

Extend `BaseBlockPreviewProps`:

```typescript
export interface GranularInteractionProps {
  blockId: string;
  activeElementId?: string | null;
  hoveredElementId?: string | null;
  onElementClick?: (elementId: string) => void;
  onElementHover?: (elementId: string | null) => void;
}

export interface BaseBlockPreviewProps<T> extends GranularInteractionProps {
  content: T;
  style: ComputedPreviewStyle;
}
```

### Phase 6: CSS Classes

**File:** `frontend/src/app/globals.css`

```css
/* Inline field highlight (titles, dates, companies) */
.granular-active-inline {
  @apply bg-primary/20 rounded-sm px-0.5 -mx-0.5;
}
.granular-hover-inline {
  @apply bg-primary/10 cursor-pointer;
}

/* List item highlight (bullets, skills) */
.granular-active-item {
  @apply bg-primary/10 ring-1 ring-primary rounded px-1 -mx-1;
}
.granular-hover-item {
  @apply bg-primary/5 ring-1 ring-primary/30 rounded cursor-pointer;
}

/* Entry-level highlight (entire experience entry) */
.granular-active-entry {
  @apply ring-2 ring-primary/70 ring-offset-2 rounded bg-primary/5;
}
.granular-hover-entry {
  @apply ring-1 ring-dashed ring-primary/40 rounded bg-primary/5;
}
```

### Phase 7: Helper Component

**New file:** `frontend/src/components/library/preview/GranularElement.tsx`

Reusable wrapper for interactive elements:

```typescript
interface GranularElementProps {
  elementId: string;
  activeElementId?: string | null;
  hoveredElementId?: string | null;
  onElementClick?: (id: string) => void;
  onElementHover?: (id: string | null) => void;
  variant: "inline" | "item" | "entry";
  children: React.ReactNode;
  as?: "span" | "div" | "li";
}
```

### Phase 8: Update Preview Components

Update in order of complexity:

1. **SkillsPreview** - Simple array, each skill highlightable
2. **ExperiencePreview** - Title, company, dates, and each bullet
3. **EducationPreview** - Degree, institution, dates, GPA
4. **ProjectsPreview** - Name, description, tech items, bullets
5. **Remaining blocks** - Follow same pattern

**Example for ExperiencePreview:**

```tsx
function ExperienceEntryPreview({ entry, style, blockId, ...props }: Props) {
  return (
    <div>
      <div className="flex justify-between">
        <GranularElement
          elementId={`${blockId}:${entry.id}:title`}
          variant="inline"
          {...props}
        >
          <span className="font-semibold">{entry.title}</span>
        </GranularElement>
        <GranularElement
          elementId={`${blockId}:${entry.id}:dates`}
          variant="inline"
          {...props}
        >
          <span>{dateRange}</span>
        </GranularElement>
      </div>
      {/* Company, location, bullets similarly */}
    </div>
  );
}
```

### Phase 9: Wire Through Components

**Files to update:**

1. `InteractiveBlockRenderer.tsx` - Pass granular props to BlockRenderer
2. `BlockRenderer.tsx` - Forward props to preview components
3. `PreviewPage.tsx` - Pass element state from context
4. `EditorLayout.tsx` - Handle element-level click/hover events

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/lib/resume/types.ts` | Add state fields and actions |
| `frontend/src/components/library/editor/blockEditorReducer.ts` | Handle new actions |
| `frontend/src/components/library/editor/BlockEditorContext.tsx` | Add context methods |
| `frontend/src/components/library/editor/BlockEditorProvider.tsx` | Initialize new state |
| `frontend/src/components/library/preview/types.ts` | Add `GranularInteractionProps` |
| `frontend/src/components/library/preview/BlockRenderer.tsx` | Forward granular props |
| `frontend/src/components/library/preview/InteractiveBlockRenderer.tsx` | Pass props down |
| `frontend/src/components/library/preview/blocks/ExperiencePreview.tsx` | Add granular interaction |
| `frontend/src/components/library/preview/blocks/SkillsPreview.tsx` | Add granular interaction |
| `frontend/src/components/library/preview/blocks/EducationPreview.tsx` | Add granular interaction |
| `frontend/src/components/library/preview/blocks/ProjectsPreview.tsx` | Add granular interaction |
| `frontend/src/app/globals.css` | Add granular CSS classes |

## New Files

| File | Purpose |
| ---- | ------- |
| `frontend/src/lib/resume/elementPath.ts` | Path encode/decode utilities |
| `frontend/src/components/library/preview/GranularElement.tsx` | Reusable highlight wrapper |

## Verification

1. **Visual testing:**
   - Navigate to `/library/resumes/[id]/edit`
   - Click on a job title - should highlight just the title
   - Click on a bullet point - should highlight just that bullet
   - Hover over different elements - should show hover state
   - Verify block-level highlight still shows when any child is selected

2. **Both pages:**
   - Test same behavior in `/tailor/editor/[id]`
   - Ensure identical highlighting behavior

3. **Regression:**
   - Verify block-level selection still works (via Section Dragger tab)
   - Verify PDF export does not include highlights
   - Verify no performance degradation with many entries
