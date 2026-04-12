# Cursor-Only Selection Design

**Status:** Implemented
**Created:** 2026-03-22
**Pages:** `/library/resumes/[id]/edit`, `/tailor/editor/[id]`

## Overview

Redesign the editor selection/highlight system to use cursor-only feedback instead of layered highlight styles.

## Design Decisions

| Decision | Choice |
| -------- | ------ |
| Active highlights | **Remove** - cursor only |
| Hover feedback | **Subtle** - light underline or opacity |
| Block selection | **Remove** - no whitespace click handling |
| Keyboard focus | **Visible** - focus ring for Tab navigation |

---

## Current State

The editor uses layered CSS highlights:

| Level | Current Style | Applied To |
| ----- | ------------- | ---------- |
| Block | `ring-2 ring-blue-400 ring-offset-2 bg-blue-50/30` | Entire sections |
| Entry | `ring-2 ring-blue-500/70 ring-offset-2 bg-blue-500/5` | Experience/education items |
| Inline | `bg-blue-500/20 rounded-sm` | Titles, dates, companies |
| Item | `ring-1 ring-blue-500 bg-blue-500/10` | Bullets, skills |

**Problem:** Visual noise from layered highlights. Goal is a cleaner Google Docs-like experience.

---

## Implementation Plan

### 1. Remove Active Highlight Styles

**File:** `frontend/src/app/globals.css` (lines 477-499)

**Before:**

```css
.granular-active-inline {
  @apply bg-blue-500/20 rounded-sm px-0.5 -mx-0.5;
}
.granular-hover-inline {
  @apply bg-blue-500/10 cursor-pointer rounded-sm;
}

.granular-active-item {
  @apply bg-blue-500/10 ring-1 ring-blue-500 rounded px-1 -mx-1;
}
.granular-hover-item {
  @apply bg-blue-500/5 ring-1 ring-blue-500/30 rounded cursor-pointer;
}

.granular-active-entry {
  @apply ring-2 ring-blue-500/70 ring-offset-2 rounded bg-blue-500/5;
}
.granular-hover-entry {
  @apply ring-1 ring-blue-500/40 rounded bg-blue-500/5 cursor-pointer;
  border-style: dashed;
}
```

**After:**

```css
/* No active styles - rely on cursor only */

/* Subtle hover feedback for discoverability */
.granular-hover-inline {
  @apply underline decoration-blue-400/50 decoration-1 underline-offset-2 cursor-pointer;
}
.granular-hover-item {
  @apply underline decoration-blue-400/50 decoration-1 underline-offset-2 cursor-pointer;
}
.granular-hover-entry {
  @apply opacity-80 cursor-pointer;
}
```

---

### 2. Update GranularElement Component

**File:** `frontend/src/components/library/preview/GranularElement.tsx`

**Changes to `getStateClasses` function (lines 111-138):**

```typescript
function getStateClasses(
  variant: GranularElementVariant,
  isActive: boolean,
  isHovered: boolean
): string {
  // No active state styling - cursor only

  if (isHovered) {
    switch (variant) {
      case "inline":
        return "granular-hover-inline";
      case "item":
        return "granular-hover-item";
      case "entry":
        return "granular-hover-entry";
    }
  }

  return "";
}
```

---

### 3. Remove Block-Level Selection

**File:** `frontend/src/components/library/preview/BlockRenderer.tsx` (lines 112-120)

**Changes to `getBlockWrapperClasses` function:**

```typescript
function getBlockWrapperClasses(isActive: boolean, onClick?: () => void): string {
  // Remove all active/hover styling for blocks
  return "preview-block transition-all duration-200 rounded-sm p-2 -mx-2";
}
```

**Also:** Remove or make optional the `onClick` handler passed to BlockRenderer from parent components to disable block selection entirely.

---

### 4. Keep Focus Ring for Keyboard Accessibility

**Files:**

- `frontend/src/components/library/editor/inline/InlinePlainText.tsx` (line 96)
- `frontend/src/components/library/editor/inline/InlineRichText.tsx` (line 130)
- `frontend/src/components/library/editor/inline/InlineSkillsList.tsx` (line 102)

**Change:** Update `focus:ring-*` to `focus-visible:ring-*`

This shows focus ring only for keyboard navigation (Tab), not mouse clicks.

```typescript
// Before
"focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"

// After
"focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
```

---

## Files Summary

| File | Change |
| ---- | ------ |
| `frontend/src/app/globals.css` | Remove active classes, simplify hover to underline |
| `frontend/src/components/library/preview/GranularElement.tsx` | Remove active state in `getStateClasses` |
| `frontend/src/components/library/preview/BlockRenderer.tsx` | Remove block active/hover styling |
| `frontend/src/components/library/editor/inline/InlinePlainText.tsx` | Change `focus:` to `focus-visible:` |
| `frontend/src/components/library/editor/inline/InlineRichText.tsx` | Change `focus:` to `focus-visible:` |
| `frontend/src/components/library/editor/inline/InlineSkillsList.tsx` | Change `focus:` to `focus-visible:` |

---

## Verification

1. Open `http://localhost:3000/library/resumes/[id]/edit`
2. Click on job title, company, date fields
   - Verify: No blue background/ring appears
   - Verify: Cursor blinks in the field
3. Hover over editable elements
   - Verify: Subtle underline appears
4. Press Tab to navigate between fields
   - Verify: Focus ring appears on keyboard focus
5. Click whitespace in a section
   - Verify: Nothing happens (no block selection)
6. Repeat all tests on `/tailor/editor/[id]`
