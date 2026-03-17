# Phase 5: Polish & Testing

## Overview

Final phase focusing on polish, accessibility, edge cases, and comprehensive testing.

---

## Prerequisites

- Phases 1-4 completed (all blocks converted)

---

## Polish Tasks

### 1. Keyboard Navigation

**Tab Order:**

Implement sequential Tab navigation through editable fields:

```typescript
// In InlineEditContext
const getNextEditableElement = (currentId: string): string | null => {
  const allElements = document.querySelectorAll('[data-element-id]');
  const ids = Array.from(allElements).map(el => el.getAttribute('data-element-id'));
  const currentIndex = ids.indexOf(currentId);
  return currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null;
};

const getPrevEditableElement = (currentId: string): string | null => {
  const allElements = document.querySelectorAll('[data-element-id]');
  const ids = Array.from(allElements).map(el => el.getAttribute('data-element-id'));
  const currentIndex = ids.indexOf(currentId);
  return currentIndex > 0 ? ids[currentIndex - 1] : null;
};
```

**Keyboard Handling:**

| Key | Action |
| --- | ------ |
| Tab | Commit current, focus next |
| Shift+Tab | Commit current, focus previous |
| Escape | Cancel current, blur |
| Enter (single-line) | Commit, blur |
| Enter (multi-line) | New line or new item |

### 2. Focus Management

**Auto-focus after operations:**

- After Enter creates new bullet → Focus new bullet
- After Backspace removes bullet → Focus previous bullet (or next if first)
- After Tab → Focus next editable element
- After click outside → Blur, no focus change

```typescript
// Focus helper
const focusElement = (elementId: string) => {
  const element = document.querySelector(`[data-element-id="${elementId}"]`);
  if (element instanceof HTMLElement) {
    element.click(); // Trigger edit mode
  }
};
```

### 3. Visual Feedback

**Hover States:**

```css
/* Add to global CSS or component styles */
[data-element-id]:not([data-editing="true"]):hover {
  background-color: rgba(59, 130, 246, 0.05); /* blue-500/5 */
  cursor: text;
}

[data-element-id][data-editing="true"] {
  background-color: rgba(59, 130, 246, 0.1); /* blue-500/10 */
  outline: 2px solid rgba(59, 130, 246, 0.5);
  outline-offset: 1px;
}
```

**Placeholder Styling:**

```css
[data-element-id]:empty::before,
[data-element-id][data-placeholder]::before {
  content: attr(data-placeholder);
  color: var(--muted-foreground);
  font-style: italic;
}
```

### 4. Accessibility

**ARIA Attributes:**

```typescript
<EditableText
  elementId={...}
  value={...}
  // Accessibility props
  aria-label="Job title"
  role="textbox"
  aria-describedby="edit-instructions"
/>

// Hidden instructions
<span id="edit-instructions" className="sr-only">
  Click to edit. Press Escape to cancel. Press Tab to move to next field.
</span>
```

**Screen Reader Announcements:**

```typescript
const announceToScreenReader = (message: string) => {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.className = 'sr-only';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
};

// Usage
announceToScreenReader('Editing job title');
announceToScreenReader('Changes saved');
announceToScreenReader('Edit cancelled');
```

---

## Edge Cases

### 1. Empty Content

**Scenario:** Field has no content.

**Solution:**

- Show placeholder text
- Placeholder disappears on focus
- Empty commit removes placeholder styling

### 2. Very Long Content

**Scenario:** User types very long text that exceeds container.

**Solution:**

- Text wraps naturally
- No horizontal scroll
- Fit-to-page may trigger font reduction

### 3. Rapid Clicks

**Scenario:** User clicks multiple elements quickly.

**Solution:**

- Debounce start edit calls (100ms)
- Commit pending edit before starting new one
- Don't lose uncommitted changes

```typescript
const startEdit = useDebouncedCallback((elementId: string, value: string) => {
  // Commit current edit first
  if (editingElementId && editingElementId !== elementId) {
    commitEdit(editor?.getHTML() || '');
  }
  // Start new edit
  setEditingElementId(elementId);
  setOriginalValue(value);
  editor?.commands.setContent(value);
}, 100);
```

### 4. Concurrent Edits (Multi-tab)

**Scenario:** User edits in one tab while another tab saves.

**Solution:**

- Existing OCC (Optimistic Concurrency Control) handles this
- Show conflict warning before committing
- Option to reload or force save

### 5. Paste Handling

**Plain Text Fields:**

```typescript
editor.commands.insertContent({
  type: 'text',
  text: clipboardText.replace(/\n/g, ' ').trim()
});
```

**Rich Text Fields:**

- Preserve formatting from paste
- Strip potentially dangerous HTML (scripts, styles)
- Use TipTap's built-in paste handling

### 6. Undo/Redo Integration

**Requirement:** Ctrl+Z should undo inline edits.

**Implementation:**

- Each commit creates an undo point in BlockEditorProvider
- Undo reverts to previous block state
- Inline editor's internal undo (during edit) is separate

```typescript
const commitEdit = (newValue: string) => {
  // Create undo point
  dispatch({ type: 'PUSH_UNDO_POINT' });

  // Update content
  dispatch({
    type: 'UPDATE_BLOCK_CONTENT_BY_PATH',
    payload: { elementId: editingElementId, value: newValue }
  });

  // Clear edit state
  setEditingElementId(null);
  setOriginalValue(null);
};
```

---

## Performance Optimization

### 1. Memoization

```typescript
// Memoize editable components
const MemoizedEditableText = memo(EditableText, (prev, next) => {
  return (
    prev.elementId === next.elementId &&
    prev.value === next.value &&
    prev.className === next.className
  );
});
```

### 2. Lazy Editor Initialization

Don't create TipTap editor until first edit:

```typescript
const [editor, setEditor] = useState<Editor | null>(null);

const ensureEditor = () => {
  if (!editor) {
    const newEditor = new Editor({
      extensions: [StarterKit, Underline, Highlight],
      content: '',
    });
    setEditor(newEditor);
    return newEditor;
  }
  return editor;
};
```

### 3. Batch Updates

When editing multiple fields rapidly, batch state updates:

```typescript
const pendingUpdates = useRef<Map<string, string>>(new Map());

const queueUpdate = (elementId: string, value: string) => {
  pendingUpdates.current.set(elementId, value);
  flushUpdates();
};

const flushUpdates = useDebouncedCallback(() => {
  const updates = Array.from(pendingUpdates.current.entries());
  pendingUpdates.current.clear();

  dispatch({
    type: 'BATCH_UPDATE_CONTENT',
    payload: updates
  });
}, 50);
```

---

## Testing

### Unit Tests

**Path:** `frontend/src/components/library/editor/inline/__tests__/`

```text
├── InlineEditContext.test.tsx    # Context provider tests
├── EditableText.test.tsx         # Plain text wrapper tests
├── EditableRichText.test.tsx     # Rich text wrapper tests
├── EditableBullet.test.tsx       # Bullet behavior tests
├── EditableSkill.test.tsx        # Skill behavior tests
├── FloatingToolbar.test.tsx      # Toolbar tests
└── keyboard.test.tsx             # Keyboard navigation tests
```

**Example Test:**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableText } from '../EditableText';
import { InlineEditProvider } from '../InlineEditContext';

describe('EditableText', () => {
  it('starts edit mode on click', async () => {
    const onCommit = jest.fn();
    render(
      <InlineEditProvider>
        <EditableText
          elementId="test-1"
          value="Initial"
          onCommit={onCommit}
        />
      </InlineEditProvider>
    );

    fireEvent.click(screen.getByText('Initial'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('commits on blur', async () => {
    const onCommit = jest.fn();
    // ... test implementation
  });

  it('cancels on Escape', async () => {
    // ... test implementation
  });
});
```

### E2E Tests

**Path:** `frontend/e2e/inline-editing/`

```text
├── basic-editing.spec.ts         # Click, edit, save flow
├── keyboard-navigation.spec.ts   # Tab, Escape, Enter behavior
├── formatting.spec.ts            # Bold, italic, toolbar
├── bullets.spec.ts               # Enter/Backspace in lists
├── skills.spec.ts                # Comma/Enter in skills
├── fit-to-page.spec.ts           # Integration with auto-fit
├── undo-redo.spec.ts             # Undo/redo after inline edit
└── concurrent-edits.spec.ts      # Multi-tab conflict handling
```

**Example E2E Test:**

```typescript
import { test, expect } from '@playwright/test';
import { EditorPage } from '../fixtures/page-objects/EditorPage';

test.describe('Inline Editing - Keyboard Navigation', () => {
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    editorPage = new EditorPage(page);
    await editorPage.goto('test-resume-id');
  });

  test('Tab navigates to next field', async ({ page }) => {
    // Click first editable field (name)
    await editorPage.clickEditableField('contact-1::fullName');

    // Type and Tab
    await page.keyboard.type('John Doe');
    await page.keyboard.press('Tab');

    // Verify next field is focused (email)
    const activeElement = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-element-id')
    );
    expect(activeElement).toBe('contact-1::email');
  });

  test('Escape cancels edit', async ({ page }) => {
    await editorPage.clickEditableField('contact-1::fullName');

    // Clear and type new value
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('New Name');

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify original value restored
    const nameField = page.locator('[data-element-id="contact-1::fullName"]');
    await expect(nameField).not.toHaveText('New Name');
  });
});
```

### Integration Tests

**Fit-to-Page Integration:**

```typescript
test('fit-to-page adjusts after inline edit', async ({ page }) => {
  // Enable fit-to-page
  await page.click('[data-testid="fit-to-page-toggle"]');

  // Add long content to summary
  await page.click('[data-element-id="summary-1::content"]');
  await page.keyboard.type('A'.repeat(500)); // Long text
  await page.keyboard.press('Tab');

  // Wait for fit-to-page to re-measure
  await page.waitForSelector('[data-testid="auto-fit-status"][data-status="fitted"]');

  // Verify font size was reduced
  const fontSize = await page.evaluate(() => {
    const summary = document.querySelector('[data-element-id="summary-1::content"]');
    return window.getComputedStyle(summary!).fontSize;
  });
  expect(parseFloat(fontSize)).toBeLessThan(12); // Below default
});
```

---

## Documentation

### Update Existing Docs

- `frontend/README.md` - Add inline editing section
- Component JSDoc comments for all new components

### Create User Guide

**Path:** `/docs/features/resume-editor/170326_inline-editing/user-guide.md`

```markdown
# Inline Editing User Guide

## How to Edit

1. Click any text in the resume preview
2. Type to edit
3. Click outside or press Tab to save
4. Press Escape to cancel

## Keyboard Shortcuts

- **Tab**: Save and move to next field
- **Shift+Tab**: Save and move to previous field
- **Escape**: Cancel edit
- **Enter**: In bullets, creates new bullet
- **Backspace**: In empty bullet, removes it
- **Ctrl+B**: Bold selected text
- **Ctrl+I**: Italic selected text
- **Ctrl+U**: Underline selected text

## Tips

- Select text to see formatting toolbar
- Comma in skills creates new skill
- Changes auto-save when you click away
```

---

## Rollout Checklist

### Pre-Release

- [ ] All unit tests passing
- [ ] All E2E tests passing
- [ ] Performance benchmarks acceptable (< 16ms per edit)
- [ ] Accessibility audit passed (axe-core)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile/tablet testing (touch interactions)

### Release

- [ ] Feature flag enabled for beta users
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] A/B test engagement metrics

### Post-Release

- [ ] Remove feature flag after stable period
- [ ] Update marketing/documentation
- [ ] Close related issues/tickets
