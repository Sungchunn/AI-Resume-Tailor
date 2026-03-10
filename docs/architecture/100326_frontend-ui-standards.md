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

## Key Principles

1. **Layer separation:** Each nested layer should be visibly distinct from its parent
2. **Brighter in dark mode:** Use explicit `dark:` classes to ensure adequate contrast
3. **Vibrant accents:** Primary/active states should "pop" - use `blue-400` instead of muted blues
4. **Consistent zinc scale:** Stick to the zinc grey palette for backgrounds (zinc-600 through zinc-800)
