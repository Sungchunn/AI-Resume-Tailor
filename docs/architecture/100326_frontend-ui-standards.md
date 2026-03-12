# Frontend UI/UX Standards

This document defines the visual design standards for the frontend application.

---

## Dark Mode Color Scheme

**Golden Standard:** The `/library?tab=resumes` page serves as the reference implementation.

### Background Hierarchy

Use zinc greys to create clear visual separation between layers:

| Layer | Light Mode | Dark Mode | Usage |
| ----- | ----- | ----- | ----- |
| Page background | `bg-background` | (inherits) | Base page |
| Card/Container | `bg-card` | `dark:bg-zinc-800` | Elevated containers |
| Container border | `border-border` | `dark:border-zinc-600` | Container outlines |
| List item | `bg-muted/50` | `dark:bg-zinc-700` | Items within cards |
| List item hover | `hover:bg-muted` | `dark:hover:bg-zinc-600` | Interactive states |

### Text Hierarchy

| Element | Light Mode | Dark Mode | Usage |
| ----- | ----- | ----- | ----- |
| Page title | `text-foreground` | `dark:text-white` | Primary headings |
| Description | `text-muted-foreground` | `dark:text-zinc-300` | Secondary text |
| Labels | `text-muted-foreground` | (inherits) | Form labels, hints |

### Accent Colors

| Element | Light Mode | Dark Mode | Usage |
| ----- | ----- | ----- | ----- |
| Active tab text | `text-primary` | `dark:text-blue-400` | Selected state |
| Active tab border | `border-primary` | `dark:border-blue-400` | Tab indicator |
| Active tab badge | `bg-primary/20 text-primary` | `dark:bg-blue-400/20 dark:text-blue-400` | Count badges |

---

## Implementation Example

```tsx
// Container with proper dark mode separation
<div className="bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-lg p-6">

  {/* List items with hover state */}
  <div className="bg-muted/50 dark:bg-zinc-700 rounded-lg hover:bg-muted dark:hover:bg-zinc-600 transition-colors">
    {/* content */}
  </div>

</div>

// Page header with visible text
<h1 className="text-2xl font-bold text-foreground dark:text-white">Title</h1>
<p className="text-muted-foreground dark:text-zinc-300">Description</p>

// Tab with vibrant active state
<button className={activeTab === id
  ? "border-primary text-primary dark:border-blue-400 dark:text-blue-400"
  : "border-transparent text-muted-foreground"
}>
```

---

## Buttons

**CRITICAL:** Never hardcode `text-white` on primary buttons. In dark mode, `bg-primary` becomes white, causing invisible white-on-white text.

### Use Utility Classes (Preferred)

The codebase provides pre-styled button classes in `globals.css`. Always use these:

```tsx
// PRIMARY - Main actions (submit, save, confirm)
<button className="btn-primary">Save Changes</button>

// SECONDARY - Secondary actions (cancel, back)
<button className="btn-secondary">Cancel</button>

// GHOST - Minimal/subtle actions
<button className="btn-ghost">Options</button>

// DESTRUCTIVE - Dangerous actions (delete, remove)
<button className="btn-destructive">Delete</button>
```

### Manual Styling (When Necessary)

If you must style buttons manually, **always** use semantic color tokens:

| Element | Correct | Wrong |
| ----- | ----- | ----- |
| Primary button text | `text-primary-foreground` | `text-white` |
| Primary button bg | `bg-primary` | `bg-black` |
| Secondary button | `bg-secondary text-secondary-foreground` | `bg-gray-200 text-gray-800` |

```tsx
// CORRECT - Uses semantic tokens that adapt to light/dark mode
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Save Changes
</button>

// WRONG - Hardcoded colors break in dark mode
<button className="bg-primary text-white hover:bg-primary/90">
  Save Changes  {/* White text on white bg in dark mode! */}
</button>
```

### Special Buttons (Amber, Red, Green)

For semantic colors like warnings or success states, pair them correctly:

```tsx
// Warning/Amber button
<button className="bg-amber-600 text-white hover:bg-amber-700">
  Warning Action
</button>

// Success/Green button
<button className="bg-green-600 text-white hover:bg-green-700">
  Confirm
</button>

// Danger/Red button (or use btn-destructive)
<button className="bg-red-600 text-white hover:bg-red-700">
  Delete
</button>
```

These explicit color pairs (e.g., `bg-amber-600 text-white`) are safe because the background is a fixed color, not a semantic token that changes between modes.

---

## Toggle Switches

**CRITICAL:** Never use `bg-white` for toggle thumbs when the track uses `bg-primary`. In dark mode, `bg-primary` becomes white, causing an invisible white-on-white thumb.

### The Problem

Toggle switches typically have:
- **Track:** The background pill that indicates ON/OFF state
- **Thumb:** The circular knob that slides left/right

Common (broken) implementation:

```tsx
// WRONG - White thumb becomes invisible on white track in dark mode
<button className={`... ${isActive ? "bg-primary" : "bg-muted"}`}>
  <span className="... bg-white" />  {/* Always white thumb */}
</button>
```

In dark mode:
- `bg-primary` = white (track when ON)
- `bg-white` = white (thumb)
- Result: Invisible thumb!

### Correct Implementation

Use `bg-primary-foreground` for the thumb, which adapts to contrast with the track:

```tsx
// CORRECT - Thumb color adapts to contrast with track
<button
  type="button"
  onClick={handleToggle}
  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
    isActive ? "bg-primary" : "bg-muted"
  }`}
>
  <span className="sr-only">Toggle setting</span>
  <span
    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
      isActive
        ? "translate-x-5 bg-primary-foreground"  // ON: contrasts with bg-primary
        : "translate-x-0 bg-background"          // OFF: contrasts with bg-muted
    }`}
  />
</button>
```

### Color Behavior

| Mode | Track (ON) | Thumb (ON) | Track (OFF) | Thumb (OFF) |
| ----- | ----- | ----- | ----- | ----- |
| Light | `bg-primary` (dark) | `bg-primary-foreground` (white) | `bg-muted` (gray) | `bg-background` (white) |
| Dark | `bg-primary` (white) | `bg-primary-foreground` (black) | `bg-muted` (dark gray) | `bg-background` (dark) |

This ensures the thumb is always visible against the track in both modes.

---

## Key Principles

1. **Layer separation:** Each nested layer should be visibly distinct from its parent
2. **Brighter in dark mode:** Use explicit `dark:` classes to ensure adequate contrast
3. **Vibrant accents:** Primary/active states should "pop" - use `blue-400` instead of muted blues
4. **Consistent zinc scale:** Stick to the zinc grey palette for backgrounds (zinc-600 through zinc-800)
5. **Never hardcode `text-white` with `bg-primary`:** Use `text-primary-foreground` for proper dark mode contrast
