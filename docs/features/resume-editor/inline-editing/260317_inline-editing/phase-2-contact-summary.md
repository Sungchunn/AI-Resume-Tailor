# Phase 2: Contact & Summary Blocks

## Overview

Convert the two simplest blocks to use inline editing:

- **Contact:** All plain text fields (name, email, phone, etc.)
- **Summary:** Single rich text field

These blocks serve as the validation that Phase 1 infrastructure works correctly.

---

## Prerequisites

- Phase 1 completed (InlineEditContext, EditableText, EditableRichText)

---

## Files to Modify

### 1. ContactPreview.tsx

**Path:** `frontend/src/components/library/preview/blocks/ContactPreview.tsx`

**Current Structure:**

```typescript
export function ContactPreview({ content, style, blockId, ... }) {
  return (
    <div>
      <h1 className="...">{content.fullName}</h1>
      <div className="...">
        {content.email && <span>{content.email}</span>}
        {content.phone && <span>{content.phone}</span>}
        {content.location && <span>{content.location}</span>}
        {content.linkedin && <span>{content.linkedin}</span>}
        {content.github && <span>{content.github}</span>}
      </div>
    </div>
  );
}
```

**New Structure:**

```typescript
import { EditableText } from '../editor/inline';
import { createFieldElementId } from '@/lib/resume/elementPath';

export function ContactPreview({ content, style, blockId, onContentChange, ... }) {
  const handleChange = (field: string) => (value: string) => {
    onContentChange({ ...content, [field]: value });
  };

  return (
    <div>
      <EditableText
        elementId={createFieldElementId(blockId, undefined, 'fullName')}
        value={content.fullName}
        className="text-2xl font-bold"
        placeholder="Your Name"
        onCommit={handleChange('fullName')}
      />
      <div className="flex gap-2 text-sm">
        {content.email !== undefined && (
          <EditableText
            elementId={createFieldElementId(blockId, undefined, 'email')}
            value={content.email}
            placeholder="email@example.com"
            onCommit={handleChange('email')}
          />
        )}
        {content.phone !== undefined && (
          <EditableText
            elementId={createFieldElementId(blockId, undefined, 'phone')}
            value={content.phone}
            placeholder="(555) 123-4567"
            onCommit={handleChange('phone')}
          />
        )}
        {content.location !== undefined && (
          <EditableText
            elementId={createFieldElementId(blockId, undefined, 'location')}
            value={content.location}
            placeholder="City, State"
            onCommit={handleChange('location')}
          />
        )}
        {content.linkedin !== undefined && (
          <EditableText
            elementId={createFieldElementId(blockId, undefined, 'linkedin')}
            value={content.linkedin}
            placeholder="linkedin.com/in/username"
            onCommit={handleChange('linkedin')}
          />
        )}
        {content.github !== undefined && (
          <EditableText
            elementId={createFieldElementId(blockId, undefined, 'github')}
            value={content.github}
            placeholder="github.com/username"
            onCommit={handleChange('github')}
          />
        )}
      </div>
    </div>
  );
}
```

**Element IDs Generated:**

- `contact-1::fullName`
- `contact-1::email`
- `contact-1::phone`
- `contact-1::location`
- `contact-1::linkedin`
- `contact-1::github`

---

### 2. SummaryPreview.tsx

**Path:** `frontend/src/components/library/preview/blocks/SummaryPreview.tsx`

**Current Structure:**

```typescript
export function SummaryPreview({ content, style, blockId, ... }) {
  return (
    <div
      className="..."
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
```

**New Structure:**

```typescript
import { EditableRichText } from '../editor/inline';
import { createFieldElementId } from '@/lib/resume/elementPath';

export function SummaryPreview({ content, style, blockId, onContentChange, ... }) {
  return (
    <EditableRichText
      elementId={createFieldElementId(blockId, undefined, 'content')}
      value={content}
      className="text-sm leading-relaxed"
      placeholder="Write a brief professional summary..."
      onCommit={onContentChange}
      showToolbar={true}
    />
  );
}
```

**Element IDs Generated:**

- `summary-1::content`

---

## Props Changes

Both preview components need a new prop to handle content changes:

```typescript
interface PreviewBlockProps {
  // ... existing props

  /** Callback when content is edited inline */
  onContentChange: (newContent: BlockContent) => void;
}
```

This callback is wired up through `BlockRenderer.tsx` which calls `updateBlock` from the BlockEditorContext.

---

## BlockRenderer.tsx Changes

**Path:** `frontend/src/components/library/preview/BlockRenderer.tsx`

**Add content change handling:**

```typescript
export function BlockRenderer({ block, style, ... }) {
  const { updateBlock } = useBlockEditor();

  const handleContentChange = useCallback((newContent: unknown) => {
    updateBlock(block.id, { content: newContent });
  }, [block.id, updateBlock]);

  // Pass to preview components
  switch (block.type) {
    case 'contact':
      return (
        <ContactPreview
          content={block.content}
          style={style}
          blockId={block.id}
          onContentChange={handleContentChange}
          {...granularProps}
        />
      );
    case 'summary':
      return (
        <SummaryPreview
          content={block.content}
          style={style}
          blockId={block.id}
          onContentChange={handleContentChange}
          {...granularProps}
        />
      );
    // ... other cases
  }
}
```

---

## Verification

### Manual Testing Checklist

**Contact Block:**

- [ ] Click name field -> Cursor appears, can type
- [ ] Type new name -> Click away -> Name updates in preview
- [ ] Press Escape during edit -> Original name restored
- [ ] Tab from name -> Focus moves to email
- [ ] Edit email -> Save works correctly
- [ ] Empty field shows placeholder text
- [ ] Styles match original preview exactly

**Summary Block:**

- [ ] Click summary text -> Cursor appears
- [ ] Type new content -> Click away -> Summary updates
- [ ] Select text -> Floating toolbar appears
- [ ] Click Bold -> Selected text becomes bold
- [ ] Ctrl+B keyboard shortcut works
- [ ] Ctrl+I for italic works
- [ ] Escape cancels edit
- [ ] Rich text formatting preserved on save

**Integration:**

- [ ] Edit name -> Fit-to-page re-measures if content longer
- [ ] Edit while fit-to-page enabled -> No jarring layout shifts
- [ ] Undo (Ctrl+Z) reverts inline edit
- [ ] Save button shows dirty state after edit
- [ ] Navigate away -> Unsaved changes warning appears

### E2E Tests

**Path:** `frontend/e2e/inline-editing/contact-summary.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Contact Block Inline Editing', () => {
  test('can edit name field', async ({ page }) => {
    await page.goto('/library/resumes/test-id/edit');

    // Click name field
    const nameField = page.locator('[data-element-id*="fullName"]');
    await nameField.click();

    // Type new name
    await page.keyboard.type('John Doe');

    // Click outside to commit
    await page.locator('body').click();

    // Verify name updated
    await expect(nameField).toHaveText('John Doe');
  });

  test('escape cancels edit', async ({ page }) => {
    // ... test implementation
  });
});

test.describe('Summary Block Inline Editing', () => {
  test('can edit summary with rich text', async ({ page }) => {
    // ... test implementation
  });

  test('floating toolbar appears on selection', async ({ page }) => {
    // ... test implementation
  });
});
```

---

## Edge Cases

1. **Empty content:** Show placeholder, allow typing
2. **Very long content:** No truncation, scroll within element if needed
3. **Special characters:** Properly escape HTML in EditableText
4. **Paste with formatting:** Strip formatting in EditableText, preserve in EditableRichText
5. **Concurrent edits:** If another tab saves, show conflict warning before committing
