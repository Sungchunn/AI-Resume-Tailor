# Apple-esque Highlighting for Resume Editor

## Overview

Replace the current blue focus rings on inline editing components with a cleaner "Apple-esque" editing experience:

- **No highlight when idle** - Clean, distraction-free view
- **Cursor change on hover** - Subtle indication of editability
- **Cursor only on click** - No blue ring, just the blinking text cursor

## Problem Statement

The current implementation uses `focus-visible:ring-2 focus-visible:ring-blue-500` on inline text fields. This creates a glowing blue box around text when editing, which:

1. Covers the text and cursor, making editing clunky
2. Feels visually heavy compared to modern editors
3. Is unnecessary since users know they're editing (they just clicked)

## Solution

Remove the focus ring styling from inline editing components while preserving:

- `outline-none` to prevent browser default outlines
- `cursor-text` for hover indication
- All editing functionality unchanged

## Files to Modify

| File | Line | Change |
| ---- | ---- | ------ |
| `frontend/src/components/library/editor/inline/InlinePlainText.tsx` | 106 | Remove `focus-visible:ring-*` classes |
| `frontend/src/components/library/editor/inline/InlineRichText.tsx` | 128-131 | Remove `focus-visible:ring-*` classes |
| `frontend/src/components/library/editor/inline/InlineSkillsList.tsx` | 102 | Remove `focus-visible:ring-*` classes |

## Implementation Details

### InlinePlainText.tsx

**Before:**

```tsx
className={cn(
  "cursor-text outline-none rounded-sm transition-colors",
  "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
  !value && "text-muted-foreground",
  className
)}
```

**After:**

```tsx
className={cn(
  "cursor-text outline-none rounded-sm transition-colors",
  !value && "text-muted-foreground",
  className
)}
```

### InlineRichText.tsx

**Before:**

```tsx
class: cn(
  "outline-none min-h-[1em]",
  "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded-sm"
),
```

**After:**

```tsx
class: cn(
  "outline-none min-h-[1em] rounded-sm"
),
```

### InlineSkillsList.tsx

**Before:**

```tsx
"focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
```

**After:** Remove the line entirely.

## Verification

1. Navigate to `/library/resumes/[id]/edit`
2. Hover over editable text fields - should see cursor change to text cursor
3. Click to edit - should see blinking text cursor only (no blue ring)
4. Type and edit - verify text is visible and cursor is trackable
5. Repeat tests on `/tailor/editor/[id]`

## Existing Infrastructure

The codebase already has hover underline styling in `frontend/src/app/globals.css`:

```css
.granular-hover-inline {
  @apply underline decoration-blue-400/50 decoration-1 underline-offset-2 cursor-pointer;
}
```

This provides a subtle hover effect via the `GranularElement` wrapper. The inline editing components naturally show a text cursor on hover via `cursor-text`.

## Pages Affected

- `/library/resumes/[id]/edit` - Main resume editor
- `/tailor/editor/[id]` - Tailor flow editor
