# True Inline Editing - Master Plan

## Problem Summary

The current editor uses a **floating overlay pattern** that causes:

1. **Popup-like behavior** - `InlineEditManager.tsx` renders a `position: fixed` overlay via `createPortal`
2. **`<p>` tag accumulation** - `EditableText.tsx:85` wraps value in `<p>` tags, causing nesting on repeated edits
3. **Skills per-item popups** - Each skill triggers a separate overlay

## Target Behavior

- Click on text → cursor appears directly in text (no overlay)
- Type changes apply immediately in place
- Skills section edits as a single comma-separated field

---

## Phase Overview

| Phase | Description | Document |
| ----- | ----- | ----- |
| 1 | Create new inline editor components | [phase-1-inline-components.md](./phase-1-inline-components.md) |
| 2 | Update preview components to use new editors | [phase-2-preview-updates.md](./phase-2-preview-updates.md) |
| 3 | Remove overlay system and simplify context | [phase-3-remove-overlay.md](./phase-3-remove-overlay.md) |
| 4 | Delete obsolete files and cleanup | [phase-4-cleanup.md](./phase-4-cleanup.md) |

---

## Files Summary

### New Files (Create)

- `InlinePlainText.tsx` - Native `contentEditable` for plain text
- `InlineRichText.tsx` - TipTap editor for rich text (direct render)
- `InlineSkillsList.tsx` - Single editor for comma-separated skills

### Files to Modify

- `SkillsPreview.tsx` - Use InlineSkillsList
- `ExperiencePreview.tsx` - Use new inline components
- `EducationPreview.tsx` - Use new inline components
- `SummaryPreview.tsx` - Use new inline components
- `InlineEditContext.tsx` - Simplify (remove shared editor)
- `PaginatedResumePreview.tsx` - Remove InlineEditManager

### Files to Delete

- `InlineEditManager.tsx` - Overlay system
- `EditableText.tsx` - Replaced by InlinePlainText
- `EditableRichText.tsx` - Replaced by InlineRichText
- `EditableBullet.tsx` - Replaced by InlineRichText with handlers

---

## Verification

See [phase-4-cleanup.md](./phase-4-cleanup.md) for full verification checklist.
