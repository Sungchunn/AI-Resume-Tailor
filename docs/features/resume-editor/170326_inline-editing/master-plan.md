# Real-Time Inline Editing for Resume Editors

## Overview

Add real-time inline editing to both resume editor pages (`/library/resumes/[id]/edit` and `/tailor/editor/[id]`), allowing users to edit text directly in the preview instead of the right panel forms.

**Scope:**

- All text content inline-editable (summary, bullets, job titles, company names, dates, skills, etc.)
- Keep right ControlPanel for formatting, ATS, AI chat, and section management
- Rich text formatting with TipTap-based editing and floating toolbar on text selection
- Works regardless of fit-to-one-page toggle state

---

## Architecture Approach

**Strategy: Single Floating Editor**

Instead of creating 50+ TipTap instances (one per editable field), use a **single TipTap editor** that "attaches" to the clicked element:

1. User clicks a text element in the preview
2. Element becomes editable with TipTap instance attached
3. Floating toolbar appears on text selection
4. On blur, changes commit to state and TipTap detaches
5. Only ONE editor is ever active at a time

**Key Benefits:**

- Minimal performance impact (single TipTap instance)
- Consistent editing experience across all fields
- Reuses existing TipTap extensions (StarterKit, Underline, Highlight)

---

## Phase Breakdown

| Phase | Description | Files |
| ----- | ----------- | ----- |
| [Phase 1](./phase-1-foundation.md) | Foundation - Core infrastructure | 7 new files, 3 modified |
| [Phase 2](./phase-2-contact-summary.md) | Contact & Summary Blocks | 2 block files modified |
| [Phase 3](./phase-3-experience-education.md) | Experience & Education Blocks | 2 block files modified |
| [Phase 4](./phase-4-remaining-blocks.md) | Remaining 12 Blocks | 12 block files modified |
| [Phase 5](./phase-5-polish-testing.md) | Polish & Testing | E2E tests, accessibility |

---

## Files Summary

### New Files (Phase 1)

```text
frontend/src/components/library/editor/inline/
├── InlineEditContext.tsx      # Context provider for inline editing state
├── InlineEditManager.tsx      # Manages single TipTap instance positioning
├── FloatingToolbar.tsx        # Floating formatting toolbar (bold, italic, etc.)
├── EditableText.tsx           # Wrapper for plain text fields
├── EditableRichText.tsx       # Wrapper for rich text fields
└── useInlineEdit.ts           # Hook for inline edit functionality
```

### Modified Files

| File | Phase | Changes |
| ---- | ----- | ------- |
| `BlockEditorContext.tsx` | 1 | Add inline editing state |
| `blockEditorReducer.ts` | 1 | Add inline edit actions |
| `elementPath.ts` | 1 | Add content path mapping functions |
| `PaginatedResumePreview.tsx` | 1 | Wrap in InlineEditContext |
| `EditorLayout.tsx` | 1 | Add InlineEditManager |
| `ContactPreview.tsx` | 2 | Editable text fields |
| `SummaryPreview.tsx` | 2 | Editable rich text |
| `ExperiencePreview.tsx` | 3 | Editable fields + bullets |
| `EducationPreview.tsx` | 3 | Editable fields + notes |
| `SkillsPreview.tsx` | 4 | Editable skill items |
| `ProjectsPreview.tsx` | 4 | Editable fields + bullets |
| 10 more block previews | 4 | Similar patterns |

---

## State Management

**New State in BlockEditorContext:**

```typescript
interface InlineEditState {
  editingElementId: string | null;  // e.g., "exp-1:entry-0:title"
  originalValue: string | null;     // For cancel/undo
  isEditDirty: boolean;             // Has unsaved inline changes
}
```

**New Actions:**

```typescript
type InlineEditAction =
  | { type: "START_INLINE_EDIT"; payload: { elementId: string; originalValue: string } }
  | { type: "COMMIT_INLINE_EDIT"; payload: { elementId: string; newValue: string } }
  | { type: "CANCEL_INLINE_EDIT" };
```

---

## Keyboard Behavior

| Key | Behavior |
| --- | -------- |
| Click | Focus element, start editing |
| Escape | Cancel edit, restore original value |
| Click outside | Commit changes, blur |
| Tab | Commit and focus next editable field |
| Enter (single-line) | Commit changes |
| Enter (bullets) | Create new bullet |
| Backspace (empty bullet) | Remove bullet |

---

## Fit-to-Page Integration

- **During editing:** Pause auto-fit adjustments to prevent layout shifts
- **On commit:** Re-trigger fit-to-page measurement (debounced 500ms)
- Existing `useAutoFitBlocks` hook supports pause via option

---

## Critical Files Reference

| File | Purpose |
| ---- | ------- |
| `BlockEditorProvider.tsx` | Central state management |
| `GranularElement.tsx` | Pattern for editable wrapper |
| `elementPath.ts` | Element ID encoding/decoding |
| `ResumeEditor.tsx` | TipTap setup to reuse |
| `EditorToolbar.tsx` | Toolbar reference |
