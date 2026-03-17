# Phase 3: Experience & Education Blocks

## Overview

Convert the most complex entry-based blocks with arrays of items:

- **Experience:** Multiple entries with title, company, dates, and bullet arrays
- **Education:** Multiple entries with school, degree, dates, and notes arrays

These blocks require special handling for array operations (add/remove bullets).

---

## Prerequisites

- Phase 1 completed (foundation infrastructure)
- Phase 2 completed (Contact/Summary validate the approach)

---

## Files to Modify

### 1. ExperiencePreview.tsx

**Path:** `frontend/src/components/library/preview/blocks/ExperiencePreview.tsx`

**Current Structure:**

```typescript
export function ExperiencePreview({ content, style, blockId, ... }) {
  return (
    <div className="space-y-4">
      {content.map((entry, entryIndex) => (
        <div key={entryIndex}>
          <div className="flex justify-between">
            <span className="font-semibold">{entry.title}</span>
            <span>{entry.dateRange}</span>
          </div>
          <div className="flex justify-between">
            <span>{entry.company}</span>
            <span>{entry.location}</span>
          </div>
          <ul className="list-disc ml-4">
            {entry.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

**New Structure:**

```typescript
import { EditableText, EditableRichText } from '../editor/inline';
import { createFieldElementId, createIndexedElementId } from '@/lib/resume/elementPath';

export function ExperiencePreview({ content, style, blockId, onContentChange, ... }) {
  const updateEntry = (entryIndex: number, field: string, value: string) => {
    const newContent = content.map((entry, i) =>
      i === entryIndex ? { ...entry, [field]: value } : entry
    );
    onContentChange(newContent);
  };

  const updateBullet = (entryIndex: number, bulletIndex: number, value: string) => {
    const newContent = content.map((entry, i) => {
      if (i !== entryIndex) return entry;
      const newBullets = entry.bullets.map((b, j) =>
        j === bulletIndex ? value : b
      );
      return { ...entry, bullets: newBullets };
    });
    onContentChange(newContent);
  };

  const addBullet = (entryIndex: number, afterIndex: number) => {
    const newContent = content.map((entry, i) => {
      if (i !== entryIndex) return entry;
      const newBullets = [...entry.bullets];
      newBullets.splice(afterIndex + 1, 0, '');
      return { ...entry, bullets: newBullets };
    });
    onContentChange(newContent);
  };

  const removeBullet = (entryIndex: number, bulletIndex: number) => {
    const newContent = content.map((entry, i) => {
      if (i !== entryIndex) return entry;
      const newBullets = entry.bullets.filter((_, j) => j !== bulletIndex);
      return { ...entry, bullets: newBullets };
    });
    onContentChange(newContent);
  };

  return (
    <div className="space-y-4">
      {content.map((entry, entryIndex) => {
        const entryId = `entry-${entryIndex}`;

        return (
          <div key={entryIndex}>
            {/* Header row: Title + Date Range */}
            <div className="flex justify-between">
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'title')}
                value={entry.title}
                className="font-semibold"
                placeholder="Job Title"
                onCommit={(v) => updateEntry(entryIndex, 'title', v)}
              />
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'dateRange')}
                value={entry.dateRange}
                placeholder="Jan 2020 - Present"
                onCommit={(v) => updateEntry(entryIndex, 'dateRange', v)}
              />
            </div>

            {/* Sub-header row: Company + Location */}
            <div className="flex justify-between text-sm text-muted-foreground">
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'company')}
                value={entry.company}
                placeholder="Company Name"
                onCommit={(v) => updateEntry(entryIndex, 'company', v)}
              />
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'location')}
                value={entry.location || ''}
                placeholder="City, State"
                onCommit={(v) => updateEntry(entryIndex, 'location', v)}
              />
            </div>

            {/* Bullets */}
            <ul className="list-disc ml-4 mt-2">
              {entry.bullets.map((bullet, bulletIndex) => (
                <li key={bulletIndex}>
                  <EditableBullet
                    elementId={createIndexedElementId(blockId, entryId, 'bullets', bulletIndex)}
                    value={bullet}
                    onCommit={(v) => updateBullet(entryIndex, bulletIndex, v)}
                    onEnter={() => addBullet(entryIndex, bulletIndex)}
                    onBackspaceEmpty={() => removeBullet(entryIndex, bulletIndex)}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
```

**Element IDs Generated:**

- `exp-1:entry-0:title`
- `exp-1:entry-0:dateRange`
- `exp-1:entry-0:company`
- `exp-1:entry-0:location`
- `exp-1:entry-0:bullets:0`
- `exp-1:entry-0:bullets:1`
- `exp-1:entry-0:bullets:2`
- `exp-1:entry-1:title` (second entry)
- ... and so on

---

### 2. EditableBullet Component

**Path:** `frontend/src/components/library/editor/inline/EditableBullet.tsx`

**Purpose:** Special wrapper for bullet points with Enter/Backspace handling.

```typescript
interface EditableBulletProps {
  elementId: string;
  value: string;
  onCommit: (value: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
}

export function EditableBullet({
  elementId,
  value,
  onCommit,
  onEnter,
  onBackspaceEmpty,
}: EditableBulletProps) {
  const { editingElementId, startEdit, editor } = useInlineEdit();
  const isCurrentlyEditing = editingElementId === elementId;

  // Handle special keys when editing this bullet
  useEffect(() => {
    if (!isCurrentlyEditing || !editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        // Commit current content and create new bullet
        onCommit(editor.getText());
        onEnter();
        // Focus will move to new bullet via Tab behavior
      }

      if (event.key === 'Backspace') {
        const text = editor.getText();
        const { from, to } = editor.state.selection;
        // If cursor at start of empty bullet, remove it
        if (text === '' || (from === 1 && to === 1 && text.length === 0)) {
          event.preventDefault();
          onBackspaceEmpty();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCurrentlyEditing, editor, onCommit, onEnter, onBackspaceEmpty]);

  return (
    <EditableRichText
      elementId={elementId}
      value={value}
      className="inline"
      placeholder="Add accomplishment..."
      onCommit={onCommit}
      showToolbar={true}
    />
  );
}
```

---

### 3. EducationPreview.tsx

**Path:** `frontend/src/components/library/preview/blocks/EducationPreview.tsx`

**Structure:** Similar to Experience, with entries containing:

- `school` (text)
- `degree` (text)
- `field` (text)
- `location` (text)
- `dateRange` (text)
- `notes` (array of strings, like bullets)

```typescript
export function EducationPreview({ content, style, blockId, onContentChange, ... }) {
  // Similar implementation to ExperiencePreview
  // Use EditableText for text fields
  // Use EditableBullet for notes array

  return (
    <div className="space-y-4">
      {content.map((entry, entryIndex) => {
        const entryId = `entry-${entryIndex}`;

        return (
          <div key={entryIndex}>
            <div className="flex justify-between">
              <div>
                <EditableText
                  elementId={createFieldElementId(blockId, entryId, 'degree')}
                  value={entry.degree}
                  className="font-semibold"
                  placeholder="Degree"
                  onCommit={(v) => updateEntry(entryIndex, 'degree', v)}
                />
                {' in '}
                <EditableText
                  elementId={createFieldElementId(blockId, entryId, 'field')}
                  value={entry.field || ''}
                  placeholder="Field of Study"
                  onCommit={(v) => updateEntry(entryIndex, 'field', v)}
                />
              </div>
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'dateRange')}
                value={entry.dateRange}
                placeholder="2018 - 2022"
                onCommit={(v) => updateEntry(entryIndex, 'dateRange', v)}
              />
            </div>

            <div className="flex justify-between text-sm">
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'school')}
                value={entry.school}
                placeholder="University Name"
                onCommit={(v) => updateEntry(entryIndex, 'school', v)}
              />
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'location')}
                value={entry.location || ''}
                placeholder="City, State"
                onCommit={(v) => updateEntry(entryIndex, 'location', v)}
              />
            </div>

            {/* Notes (like bullets) */}
            {entry.notes && entry.notes.length > 0 && (
              <ul className="list-disc ml-4 mt-1">
                {entry.notes.map((note, noteIndex) => (
                  <li key={noteIndex}>
                    <EditableBullet
                      elementId={createIndexedElementId(blockId, entryId, 'notes', noteIndex)}
                      value={note}
                      onCommit={(v) => updateNote(entryIndex, noteIndex, v)}
                      onEnter={() => addNote(entryIndex, noteIndex)}
                      onBackspaceEmpty={() => removeNote(entryIndex, noteIndex)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## Array Mutation Helpers

Add utility functions for immutable array operations:

**Path:** `frontend/src/lib/resume/arrayHelpers.ts`

```typescript
/**
 * Update item at index in nested array
 */
export function updateNestedArrayItem<T>(
  array: T[],
  index: number,
  updater: (item: T) => T
): T[] {
  return array.map((item, i) => (i === index ? updater(item) : item));
}

/**
 * Insert item after index in array
 */
export function insertAfter<T>(array: T[], index: number, item: T): T[] {
  const result = [...array];
  result.splice(index + 1, 0, item);
  return result;
}

/**
 * Remove item at index from array
 */
export function removeAt<T>(array: T[], index: number): T[] {
  return array.filter((_, i) => i !== index);
}
```

---

## Verification

### Manual Testing Checklist

**Experience Block:**

- [ ] Click job title -> Edit -> Save works
- [ ] Click company name -> Edit -> Save works
- [ ] Click date range -> Edit -> Save works
- [ ] Click location -> Edit -> Save works
- [ ] Click bullet -> Edit -> Save works
- [ ] Select text in bullet -> Bold toolbar works
- [ ] Press Enter at end of bullet -> New bullet created
- [ ] Press Backspace in empty bullet -> Bullet removed
- [ ] Tab navigates between fields in order
- [ ] Multiple entries all editable independently

**Education Block:**

- [ ] All text fields editable (school, degree, field, dates, location)
- [ ] Notes array editable with Enter/Backspace behavior
- [ ] Formatting in notes works

**Performance:**

- [ ] Experience with 5 entries renders smoothly
- [ ] No lag when clicking to edit
- [ ] Rapid edits across multiple bullets work

### E2E Tests

**Path:** `frontend/e2e/inline-editing/experience-education.spec.ts`

```typescript
test.describe('Experience Block Inline Editing', () => {
  test('can edit job title', async ({ page }) => {
    // ... test implementation
  });

  test('Enter creates new bullet', async ({ page }) => {
    await page.goto('/library/resumes/test-id/edit');

    // Click last bullet in first experience entry
    const bullet = page.locator('[data-element-id="exp-1:entry-0:bullets:0"]');
    await bullet.click();

    // Press Enter
    await page.keyboard.press('Enter');

    // Verify new bullet created
    const newBullet = page.locator('[data-element-id="exp-1:entry-0:bullets:1"]');
    await expect(newBullet).toBeVisible();
  });

  test('Backspace removes empty bullet', async ({ page }) => {
    // ... test implementation
  });
});
```

---

## Edge Cases

1. **Empty bullets array:** Show "Add bullet" placeholder, click creates first bullet
2. **Single bullet:** Backspace on empty removes it, shows "Add bullet"
3. **Focus after Enter:** New bullet should auto-focus
4. **Focus after Backspace:** Previous bullet should focus
5. **Very long bullets:** Text wraps, no horizontal scroll
6. **Multiple entries:** Each entry is independent, no cross-entry interference
