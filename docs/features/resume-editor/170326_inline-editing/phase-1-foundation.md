# Phase 1: Foundation

## Overview

Create the core infrastructure for inline editing: context provider, editor manager, floating toolbar, and reusable wrapper components.

---

## Files to Create

### 1. InlineEditContext.tsx

**Path:** `frontend/src/components/library/editor/inline/InlineEditContext.tsx`

**Purpose:** Context provider for inline editing state, separate from main BlockEditorContext to keep concerns isolated.

```typescript
interface InlineEditContextValue {
  // Currently editing element
  editingElementId: string | null;
  originalValue: string | null;

  // Actions
  startEdit: (elementId: string, initialValue: string) => void;
  commitEdit: (newValue: string) => void;
  cancelEdit: () => void;

  // Editor instance (shared across all editable elements)
  editor: Editor | null;

  // State
  isEditing: boolean;
  isDirty: boolean;
}
```

**Key Implementation Details:**

- Creates single TipTap editor instance on mount
- Provides context to all child editable components
- Coordinates with BlockEditorContext for state updates

---

### 2. InlineEditManager.tsx

**Path:** `frontend/src/components/library/editor/inline/InlineEditManager.tsx`

**Purpose:** Renders the floating TipTap editor at the position of the currently editing element.

**Key Features:**

- Listens to `editingElementId` from context
- Finds the DOM element by data attribute (`data-element-id`)
- Positions TipTap editor to overlay that element exactly
- Uses `createPortal` to render outside normal flow
- Handles click-outside to commit changes

```typescript
interface InlineEditManagerProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export function InlineEditManager({ containerRef }: InlineEditManagerProps) {
  const { editingElementId, editor, commitEdit, cancelEdit } = useInlineEdit();
  const [position, setPosition] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!editingElementId || !containerRef.current) return;

    const element = containerRef.current.querySelector(
      `[data-element-id="${editingElementId}"]`
    );
    if (element) {
      setPosition(element.getBoundingClientRect());
    }
  }, [editingElementId, containerRef]);

  // ... render positioned editor
}
```

---

### 3. FloatingToolbar.tsx

**Path:** `frontend/src/components/library/editor/inline/FloatingToolbar.tsx`

**Purpose:** Floating formatting toolbar that appears on text selection.

**Features:**

- Bold (Ctrl+B)
- Italic (Ctrl+I)
- Underline (Ctrl+U)
- Clear formatting
- AI Improve (optional, for longer selections)

**Implementation:**

- Use `@floating-ui/react` for smart positioning
- Listen to TipTap's `selectionUpdate` event
- Show when selection is non-empty, hide when collapsed
- Position above selection (flip below if not enough space)

```typescript
interface FloatingToolbarProps {
  editor: Editor;
  onAIRequest?: (instruction: SuggestionInstruction) => void;
}

export function FloatingToolbar({ editor, onAIRequest }: FloatingToolbarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updatePosition = () => {
      const { selection } = editor.state;
      if (selection.empty) {
        setIsVisible(false);
        return;
      }

      const { from, to } = selection;
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);

      setPosition({
        x: (start.left + end.left) / 2,
        y: start.top - 40, // Above selection
      });
      setIsVisible(true);
    };

    editor.on('selectionUpdate', updatePosition);
    return () => editor.off('selectionUpdate', updatePosition);
  }, [editor]);

  // ... render toolbar buttons
}
```

---

### 4. EditableText.tsx

**Path:** `frontend/src/components/library/editor/inline/EditableText.tsx`

**Purpose:** Wrapper for plain text fields (job titles, company names, dates, etc.).

**Behavior:**

- Renders as static text when not editing
- On click, signals InlineEditContext to start editing
- TipTap renders at this position via InlineEditManager
- No floating toolbar (plain text only)

```typescript
interface EditableTextProps {
  elementId: string;
  value: string;
  className?: string;
  placeholder?: string;
  onCommit: (newValue: string) => void;
}

export function EditableText({
  elementId,
  value,
  className,
  placeholder,
  onCommit,
}: EditableTextProps) {
  const { editingElementId, startEdit, isEditing } = useInlineEdit();
  const isCurrentlyEditing = editingElementId === elementId;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCurrentlyEditing) {
      startEdit(elementId, value);
    }
  };

  return (
    <span
      data-element-id={elementId}
      className={cn(
        "cursor-text hover:bg-blue-50 transition-colors",
        isCurrentlyEditing && "ring-2 ring-blue-500",
        className
      )}
      onClick={handleClick}
    >
      {value || placeholder}
    </span>
  );
}
```

---

### 5. EditableRichText.tsx

**Path:** `frontend/src/components/library/editor/inline/EditableRichText.tsx`

**Purpose:** Wrapper for rich text fields (summary, bullets) that need formatting.

**Behavior:**

- Renders HTML content when not editing
- On click, signals InlineEditContext to start editing
- Shows FloatingToolbar on text selection
- Supports bold, italic, underline

```typescript
interface EditableRichTextProps {
  elementId: string;
  value: string; // HTML string
  className?: string;
  placeholder?: string;
  onCommit: (newHtml: string) => void;
  showToolbar?: boolean;
}

export function EditableRichText({
  elementId,
  value,
  className,
  placeholder,
  onCommit,
  showToolbar = true,
}: EditableRichTextProps) {
  const { editingElementId, startEdit } = useInlineEdit();
  const isCurrentlyEditing = editingElementId === elementId;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCurrentlyEditing) {
      startEdit(elementId, value);
    }
  };

  return (
    <div
      data-element-id={elementId}
      className={cn(
        "cursor-text hover:bg-blue-50 transition-colors",
        isCurrentlyEditing && "ring-2 ring-blue-500",
        className
      )}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: value || `<p>${placeholder}</p>` }}
    />
  );
}
```

---

### 6. useInlineEdit.ts

**Path:** `frontend/src/components/library/editor/inline/useInlineEdit.ts`

**Purpose:** Hook to access inline editing context from any component.

```typescript
export function useInlineEdit() {
  const context = useContext(InlineEditContext);
  if (!context) {
    throw new Error('useInlineEdit must be used within InlineEditProvider');
  }
  return context;
}
```

---

### 7. index.ts

**Path:** `frontend/src/components/library/editor/inline/index.ts`

**Purpose:** Barrel export for all inline editing components.

```typescript
export { InlineEditProvider, useInlineEdit } from './InlineEditContext';
export { InlineEditManager } from './InlineEditManager';
export { FloatingToolbar } from './FloatingToolbar';
export { EditableText } from './EditableText';
export { EditableRichText } from './EditableRichText';
```

---

## Files to Modify

### 1. elementPath.ts

**Path:** `frontend/src/lib/resume/elementPath.ts`

**Add Functions:**

```typescript
/**
 * Get content value from blocks by element path
 */
export function getContentByElementPath(
  blocks: AnyResumeBlock[],
  elementId: string
): string | undefined {
  const path = decodeElementPath(elementId);
  const block = blocks.find(b => b.id === path.blockId);
  if (!block) return undefined;

  // Handle different block types and paths
  // e.g., "exp-1:entry-0:title" -> blocks[exp-1].content[0].title
  // e.g., "summary-1::content" -> blocks[summary-1].content
  // ... implementation details
}

/**
 * Set content value in blocks by element path
 * Returns new blocks array (immutable update)
 */
export function setContentByElementPath(
  blocks: AnyResumeBlock[],
  elementId: string,
  value: string
): AnyResumeBlock[] {
  const path = decodeElementPath(elementId);
  return blocks.map(block => {
    if (block.id !== path.blockId) return block;
    // ... immutable update logic
  });
}
```

---

### 2. BlockEditorContext.tsx

**Path:** `frontend/src/components/library/editor/BlockEditorContext.tsx`

**Add to Context:**

```typescript
interface BlockEditorContextValue {
  // ... existing fields

  // Inline editing state
  inlineEdit: {
    editingElementId: string | null;
    setEditingElementId: (id: string | null) => void;
  };

  // Update content by element path
  updateContentByPath: (elementId: string, value: string) => void;
}
```

---

### 3. PaginatedResumePreview.tsx

**Path:** `frontend/src/components/library/preview/PaginatedResumePreview.tsx`

**Changes:**

- Wrap content in `InlineEditProvider`
- Pass `updateContentByPath` to context
- Add `InlineEditManager` for rendering floating editor

```typescript
export function PaginatedResumePreview({ ... }) {
  // ... existing logic

  return (
    <InlineEditProvider
      onCommit={(elementId, value) => {
        // Update block content
        updateContentByPath(elementId, value);
      }}
    >
      <div ref={containerRef} className="...">
        {/* ... existing preview content */}
      </div>
      <InlineEditManager containerRef={containerRef} />
    </InlineEditProvider>
  );
}
```

---

### 4. EditorLayout.tsx

**Path:** `frontend/src/components/library/editor/EditorLayout.tsx`

**Changes:**

- Add keyboard handler for Escape (cancel inline edit)
- Pause auto-fit during inline editing
- Re-trigger measurement on commit

---

## Verification

### Manual Testing

1. Create a test page that renders `InlineEditProvider` with mock data
2. Verify clicking an `EditableText` starts edit mode
3. Verify floating toolbar appears on text selection in `EditableRichText`
4. Verify Escape cancels, click outside commits
5. Verify Tab moves to next editable field

### Unit Tests

```text
frontend/src/components/library/editor/inline/__tests__/
├── InlineEditContext.test.tsx
├── EditableText.test.tsx
├── EditableRichText.test.tsx
└── FloatingToolbar.test.tsx
```

---

## Dependencies

```bash
bun add @floating-ui/react
```
