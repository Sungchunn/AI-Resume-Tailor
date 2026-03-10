# L-Shape Layout Implementation Plan

**Created:** 2026-03-10
**Status:** Planned

## Overview

Create a visual L-shape layout where the **Sidebar forms a distinct frame** and the **main content area appears inset/elevated**. This establishes clear visual hierarchy between navigation and workspace.

```text
┌─────────────────────────────────────────────────┐
│ [darker sidebar]    ╭─────────────────────────╮ │
│                     │                         │ │
│  RT Logo            │  [lighter content]      │ │
│  ─────              │                         │ │
│  Jobs               │  Main workspace area    │ │
│  Library            │  with rounded corner    │ │
│  Tailor             │  and subtle shadow      │ │
│                     │                         │ │
│  Theme Toggle       │                         │ │
│  User Menu          ╰─────────────────────────╯ │
└─────────────────────────────────────────────────┘
```

## Files to Modify

| File | Changes |
| ----- | ----- |
| `/frontend/src/app/globals.css` | Swap dark mode sidebar/background colors for proper contrast |
| `/frontend/src/app/(protected)/layout.tsx` | Add L-frame wrapper and inset content styling |
| `/frontend/src/components/layout/Sidebar.tsx` | Remove border-r (contrast handles separation) |

## Implementation Details

### 1. CSS Variable Changes (`globals.css`)

**Current Dark Mode Values:**

- `--color-background`: `oklch(0.188...)` (darker - zinc-900)
- `--color-sidebar`: `oklch(0.241...)` (lighter - zinc-800)

**New Dark Mode Values (swapped):**

- `--color-sidebar`: `oklch(0.188 0.006 264.5)` - darker frame
- `--color-background`: `oklch(0.241 0.008 264.5)` - lighter content

**Light Mode Values (minor adjustment):**

- `--color-sidebar`: `oklch(0.967 0.001 286.375)` - zinc-100 tinted
- `--color-background`: `oklch(1 0 0)` - pure white (keep as-is)

Also update the `@media (prefers-color-scheme: dark)` block with the same swapped values.

### 2. Protected Layout Changes (`layout.tsx`)

```tsx
<div className="min-h-screen bg-sidebar flex">
  <Sidebar />
  <main className="
    flex-1
    bg-background
    rounded-tl-2xl
    shadow-[inset_1px_1px_4px_rgba(0,0,0,0.03)]
    dark:shadow-[inset_2px_2px_8px_rgba(0,0,0,0.15)]
    pt-8 px-6 pb-6
  ">
    {children}
  </main>
</div>
```

Key changes:

- Outer container: `bg-sidebar` (the L-frame background)
- Main content: `bg-background` (lighter workspace)
- Rounded top-left corner: `rounded-tl-2xl`
- Subtle inner shadow for depth

### 3. Sidebar Component Changes (`Sidebar.tsx`)

Remove `border-r border-sidebar-border` from the aside element - the background contrast now provides visual separation.

## Color Reference

| Element | Light Mode | Dark Mode |
| ----- | ----- | ----- |
| L-Frame (Sidebar) | zinc-100 (`oklch(0.967...)`) | zinc-900 (`oklch(0.188...)`) |
| Content Area | white (`oklch(1 0 0)`) | zinc-800 (`oklch(0.241...)`) |

## Verification

1. Start the frontend dev server: `cd frontend && bun dev`
2. Log in and navigate to `/jobs`, `/library`, `/tailor`
3. Toggle between light/dark mode using sidebar theme button
4. Verify:
   - Sidebar appears as distinct darker frame in both modes
   - Content area has rounded top-left corner
   - Subtle inset shadow visible on content edge
   - No harsh border line between sidebar and content
   - Collapsed sidebar maintains visual treatment
