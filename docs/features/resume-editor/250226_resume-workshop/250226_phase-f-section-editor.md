# Phase F: Section-Based Editor

**Status**: Ready for Implementation
**Next Phase**: Phase G (Style Controls Panel)

---

## Quick Start

Replace flat `ContentEditor` with collapsible, drag-to-reorder section editor.

**Dependencies installed**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

**No context changes needed** - uses existing `sectionOrder` and `SET_SECTION_ORDER`.

---

## Files to Create

```
frontend/src/components/workshop/panels/
├── EditorPanel.tsx         # Wrapper - connects useWorkshop, handles order changes
├── SectionList.tsx         # DnD container with expand/collapse all
├── SectionItem.tsx         # Collapsible sortable item with drag handle
├── SectionActions.tsx      # Menu: AI Enhance, Duplicate, Remove
├── AddSectionMenu.tsx      # "Add Section" dropdown
└── sections/
    ├── SummaryEditor.tsx   # Textarea + char count (100-400 recommended)
    ├── ExperienceEditor.tsx # Entries with title/company/dates/bullets
    ├── SkillsEditor.tsx    # Tag input with add/remove
    └── HighlightsEditor.tsx # Bullet list editor
```

---

## Context & Types Reference

### From WorkshopContext.tsx

```typescript
// State available via useWorkshop()
state.content: TailoredContent;
state.sectionOrder: string[];
state.activeSection: string | undefined;

// Actions to dispatch
dispatch({ type: "SET_CONTENT", payload: TailoredContent });
dispatch({ type: "SET_SECTION_ORDER", payload: string[] });
dispatch({ type: "SET_ACTIVE_SECTION", payload: string | undefined });
```

### From types.ts

```typescript
interface TailoredContent {
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    start_date: string;
    end_date: string;
    bullets: string[];
  }>;
  skills: string[];
  highlights: string[];
}
```

### Section Labels (reuse from ContentEditor.tsx)

```typescript
const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
  highlights: "Key Highlights",
};
```

---

## Component Specifications

### EditorPanel.tsx

Wrapper component that replaces `EditorTab` in WorkshopControlPanel.

```typescript
interface EditorPanelProps {}

export function EditorPanel() {
  const { state, dispatch } = useWorkshop();

  const handleOrderChange = (newOrder: string[]) => {
    dispatch({ type: "SET_SECTION_ORDER", payload: newOrder });
  };

  const handleContentChange = (content: TailoredContent) => {
    dispatch({ type: "SET_CONTENT", payload: content });
  };

  return (
    <SectionList
      content={state.content}
      sectionOrder={state.sectionOrder}
      activeSection={state.activeSection}
      onOrderChange={handleOrderChange}
      onContentChange={handleContentChange}
      onSectionFocus={(section) =>
        dispatch({ type: "SET_ACTIVE_SECTION", payload: section })
      }
    />
  );
}
```

### SectionList.tsx

DnD container with expand/collapse all functionality.

```typescript
interface SectionListProps {
  content: TailoredContent;
  sectionOrder: string[];
  activeSection?: string;
  onOrderChange: (order: string[]) => void;
  onContentChange: (content: TailoredContent) => void;
  onSectionFocus: (section: string) => void;
}
```

**Key Implementation**:
```typescript
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    const oldIndex = sectionOrder.indexOf(active.id as string);
    const newIndex = sectionOrder.indexOf(over.id as string);
    onOrderChange(arrayMove(sectionOrder, oldIndex, newIndex));
  }
}
```

**Expand/Collapse All Header**:
```
┌──────────────────────────────────────────────────────┐
│  Sections                    [Collapse All] [+ Add]  │
└──────────────────────────────────────────────────────┘
```

### SectionItem.tsx

Collapsible sortable item with drag handle.

```typescript
interface SectionItemProps {
  section: string;
  label: string;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  onFocus: () => void;
  children: React.ReactNode;
}
```

**Sortable Hook Usage**:
```typescript
const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section });

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
};
```

**Header Structure**:
```
┌─────────────────────────────────────────────────────┐
│ ≡  ▶  Section Name (count)              •••         │
└─────────────────────────────────────────────────────┘
  │   │                                    └─ SectionActions menu
  │   └─ Expand/collapse chevron
  └─ Drag handle (apply {...listeners} {...attributes})
```

### SectionActions.tsx

Dropdown menu for section operations.

```typescript
interface SectionActionsProps {
  section: string;
  onAIEnhance: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}
```

**Menu Items**:
- AI Enhance (sparkles icon)
- Duplicate (copy icon)
- Remove (trash icon, with confirm)

### AddSectionMenu.tsx

Dropdown to add new sections.

```typescript
interface AddSectionMenuProps {
  existingSections: string[];
  onAdd: (section: string) => void;
}
```

**Available sections** (filter out existing):
- education
- projects
- certifications
- awards

---

## Section Editors

### SummaryEditor.tsx

```typescript
interface SummaryEditorProps {
  value: string;
  onChange: (value: string) => void;
}
```

Features:
- Textarea with min-height 100px
- Character count indicator
- Recommended range hint: "100-400 characters recommended"
- Warning color when outside range

### ExperienceEditor.tsx

```typescript
interface ExperienceEditorProps {
  entries: TailoredContent["experience"];
  onChange: (entries: TailoredContent["experience"]) => void;
}
```

**Migrate from ContentEditor.tsx lines 198-302**:
- Grid layout for title/company/location/dates
- Bullet list with add/remove
- "Add Experience" button at bottom

### SkillsEditor.tsx

```typescript
interface SkillsEditorProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}
```

**Migrate from ContentEditor.tsx lines 304-377**:
- Tag pills with X buttons
- Input + "Add" button
- Prevent duplicates

### HighlightsEditor.tsx

```typescript
interface HighlightsEditorProps {
  highlights: string[];
  onChange: (highlights: string[]) => void;
}
```

**Migrate from ContentEditor.tsx lines 147-196**:
- Bullet points with inline editing
- Add/remove buttons

---

## Integration Point

**File**: `WorkshopControlPanel.tsx`

**Current** (line 12-38):
```typescript
function EditorTab() {
  // ... ContentEditor wrapper
}
```

**Replace with**:
```typescript
import { EditorPanel } from "./panels/EditorPanel";

// In renderTabContent():
case "editor":
  return <EditorPanel />;
```

**Also remove**:
- `ContentEditor` import (line 7)
- `EditorTab` function (lines 12-38)

---

## State Management

### Expand/Collapse State

Use local `useState` in SectionList:
```typescript
const [expandedSections, setExpandedSections] = useState<Set<string>>(
  new Set(sectionOrder) // all expanded by default
);
```

### Count Indicators

Calculate counts for section headers:
```typescript
function getSectionCount(section: string, content: TailoredContent): number | null {
  switch (section) {
    case "experience": return content.experience.length;
    case "skills": return content.skills.length;
    case "highlights": return content.highlights.length;
    default: return null;
  }
}
```

---

## Migration Path

1. **Create files** in order: SectionItem, SectionActions, section editors, SectionList, EditorPanel
2. **Test independently** before integrating
3. **Replace EditorTab** with EditorPanel import
4. **Keep ContentEditor.tsx** for potential reuse elsewhere (don't delete)

---

## Acceptance Criteria

- [ ] Sections collapse/expand individually
- [ ] Expand All / Collapse All works
- [ ] Drag-to-reorder updates `sectionOrder` state
- [ ] Inline editing updates `content` state
- [ ] Add section dropdown works
- [ ] Remove section works with confirmation
- [ ] Changes sync with preview via context
- [ ] Active section highlighting works
- [ ] Keyboard accessibility maintained

---

## Handoff Notes

**Files to reference**:
- `ContentEditor.tsx` at `/frontend/src/components/editor/ContentEditor.tsx` - contains editing logic to migrate
- `WorkshopControlPanel.tsx` at `/frontend/src/components/workshop/WorkshopControlPanel.tsx` - integration point
- `WorkshopContext.tsx` at `/frontend/src/components/workshop/WorkshopContext.tsx` - state/actions reference

**Context patterns** (from existing WorkshopControlPanel EditorTab):
```typescript
const { state, dispatch } = useWorkshop();
dispatch({ type: "SET_CONTENT", payload: content });
dispatch({ type: "SET_SECTION_ORDER", payload: order });
dispatch({ type: "SET_ACTIVE_SECTION", payload: section });
```

**Existing panels** for reference patterns:
- `AIRewritePanel.tsx`
- `SuggestionCard.tsx`

---

## Evaluation Notes

Per `250226_resume-editor-recommendation-evaluation.md`:

### Why TipTap (Not Raw contentEditable)

The Section Editor should use TipTap for inline bullet/text editing because:
1. **AI Suggestion Highlighting**: Our core feature shows suggested text changes with accept/reject
2. **Keyword Highlighting**: ATS keyword visualization needs mark/highlight support
3. **Browser Quirks**: `contentEditable` has notorious cross-browser inconsistencies
4. **Accessibility**: TipTap includes ARIA attributes and keyboard navigation

### Data Model

Continue using existing `TailoredContentSchema` with typed per-section schemas:
- `summary: string`
- `experience: list[ExperienceItemSchema]`
- `skills: list[str]`
- `highlights: list[str]`

This is more type-safe than the recommended polymorphic `items: list[dict]` approach.

### Upcoming Integrations (Phase G/J)

The Section Editor will integrate with:
- **Progressive Auto-Fit** (Phase G): Font/spacing reduction when content exceeds one page
- **Undo/Redo** (Phase J): History stack for content changes - uses `UNDO`/`REDO` actions already defined in WorkshopContext
