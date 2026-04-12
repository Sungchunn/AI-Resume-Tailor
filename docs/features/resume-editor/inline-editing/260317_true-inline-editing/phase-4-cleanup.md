# Phase 4: Cleanup and Verification

## Overview

Delete obsolete files, update exports, and verify the implementation.

---

## Step 4.1: Delete Obsolete Files

### Files to Delete

| File | Reason |
| ----- | ----- |
| `EditableText.tsx` | Replaced by `InlinePlainText.tsx` |
| `EditableRichText.tsx` | Replaced by `InlineRichText.tsx` |
| `EditableBullet.tsx` | Replaced by `InlineRichText.tsx` with handlers |
| `InlineEditManager.tsx` | Overlay system removed |

**Directory**: `/frontend/src/components/library/editor/inline/`

---

## Step 4.2: Update Index Exports

**File**: `/frontend/src/components/library/editor/inline/index.ts`

```ts
// New exports
export { InlinePlainText } from "./InlinePlainText";
export { InlineRichText } from "./InlineRichText";
export { InlineSkillsList } from "./InlineSkillsList";
export { FloatingToolbar } from "./FloatingToolbar";

// Context
export {
  InlineEditProvider,
  useInlineEdit,
  useInlineEditOptional,
} from "./InlineEditContext";

// Remove old exports
// - EditableText
// - EditableRichText
// - EditableBullet
// - InlineEditManager
```

---

## Step 4.3: Fix Any Import Errors

Search codebase for imports of deleted components:

```bash
grep -r "EditableText\|EditableRichText\|EditableBullet\|InlineEditManager" frontend/src/
```

Update all found imports to use new components.

---

## Step 4.4: Update E2E Tests

**Directory**: `/frontend/e2e/inline-editing/`

Tests may need updates for:

- Different element selectors (if data-testid changed)
- Different behavior expectations (no overlay)
- Skills test should test comma-separated editing

---

## Verification Checklist

### Functional Tests

- [ ] **Library Editor** (`/library/resumes/[id]/edit`)
  - [ ] Click on job title → cursor appears in-place (no popup)
  - [ ] Type changes → text updates immediately
  - [ ] Click outside → changes commit and save

- [ ] **Tailor Editor** (`/tailor/editor/[id]`)
  - [ ] Same inline editing behavior
  - [ ] No overlay popups

- [ ] **Skills Section**
  - [ ] Click on skills → single cursor for entire list
  - [ ] Type "NewSkill, AnotherSkill" → skills array updates
  - [ ] No per-skill popups

- [ ] **Rich Text (Summary/Bullets)**
  - [ ] Click on summary → editor activates in-place
  - [ ] Select text → FloatingToolbar appears
  - [ ] Bold/Italic/Underline work
  - [ ] Click outside → changes commit

- [ ] **Bullets (Experience)**
  - [ ] Press Enter on bullet → new bullet created
  - [ ] Press Backspace on empty bullet → bullet removed
  - [ ] Formatting toolbar works

### Regression Tests

- [ ] **`<p>` Tag Accumulation**
  - [ ] Edit same field 5+ times
  - [ ] Inspect saved content in database/network
  - [ ] Should NOT have nested `<p>` tags

- [ ] **Undo/Redo**
  - [ ] Make edit, press Ctrl+Z → reverts
  - [ ] Press Ctrl+Shift+Z → redoes

- [ ] **Auto-save**
  - [ ] Edit field, wait
  - [ ] Verify save indicator shows
  - [ ] Refresh page → changes persisted

- [ ] **E2E Tests**
  - [ ] Run `bun run test:e2e e2e/inline-editing/`
  - [ ] All tests pass or update as needed

### Performance Check

- [ ] Open resume with many blocks (10+ experience entries)
- [ ] No lag when scrolling
- [ ] No lag when clicking to edit
- [ ] Memory usage stable (no leaks from editor instances)

---

## Completion Criteria

- [ ] All obsolete files deleted
- [ ] Exports updated
- [ ] No import errors
- [ ] All functional tests pass
- [ ] No `<p>` tag accumulation
- [ ] E2E tests pass
- [ ] Performance acceptable
