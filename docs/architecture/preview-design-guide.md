# Resume Preview Design Guide

This document describes how resumes visually appear in both editor systems — what a user sees, how each element is styled, and how interactive states look. It is a companion to `editor-guide.md`, which covers behavior, architecture, and state management. Read that first if you need context on how the two systems differ.

Two preview implementations are documented here:

- **Block Editor Preview** — used by the Resume Editor and Job-Linked Editor (`/library/resumes/[id]/edit`)
- **Workshop Editor Preview** — used by the Workshop Editor (`/workshop/[id]`)

Both render the same resume content using the same underlying CSS classes. The differences are narrow but meaningful and are called out explicitly throughout.

This is a **permanent reference**. Update this document whenever the visual design of either preview changes — new block types, modified interactive states, layout changes, or typography updates.

---

## 1. Shared Page Canvas

Both previews render pages at the same physical dimensions, using the same scaling approach.

### 1.1 Page Dimensions

| Format | Width | Height | Notes |
| ----- | ----- | ----- | ----- |
| US Letter | 816 px | 1056 px | 8.5 × 11 in at 96 DPI — used by both editors |
| A4 | 794 px | 1123 px | Workshop Editor only |

Defined as `PAGE_DIMENSIONS` in `components/library/preview/types.ts`.

### 1.2 Scale and Zoom

The page never renders larger than its natural size. The scale factor is:

```text
scale = Math.min(1, (containerWidth - 40) / 816)
```

Applied to the page wrapper as:

```css
transform: scale(${scale});
transform-origin: top center;
```

The 40 px subtraction provides 20 px breathing room on each side. At a container narrower than 856 px, the page shrinks proportionally. At any container wider than that, the page renders at 1:1.

### 1.3 Multi-page Layout

Pages are stacked vertically in a flex column with a 24 px gap between each page. The outer container `minHeight` is pre-calculated from `(scaledPageHeight × totalPages) + (24px × (totalPages − 1))` to prevent layout shift as pages load or pagination changes.

```text
┌────────────────────────┐  ← Page 1
│                        │
└────────────────────────┘
          ↕ 24 px
┌────────────────────────┐  ← Page 2
│                        │
└────────────────────────┘
```

Blocks never split across page boundaries. If a block does not fit on the current page, it starts a new page entirely.

---

## 2. Block Editor Preview

**Used by:** Resume Editor and Job-Linked Editor.

**Primary source:** `components/library/preview/PaginatedResumePreview.tsx`, `components/library/editor/blocks/`.

### 2.1 Page Container

```text
┌────────────────────────────────────────────────┐  816 px wide
│                                                │  1056 px tall (fixed, overflow: hidden)
│  padding-top:    marginTop × 96     (48 px)    │
│  padding-bottom: marginBottom × 96  (48 px)    │  bg-white
│  padding-left:   marginLeft × 96   (48 px)     │  shadow-lg
│  padding-right:  marginRight × 96  (48 px)     │  rounded-sm
│                                                │  border border-border
│           [ resume content ]                   │
│                                                │
│                         ┌─────────────────┐    │
│                         │  1 / 3          │    │  absolute top-2 right-2
│                         └─────────────────┘    │  bg-zinc-700 text-zinc-100
└────────────────────────────────────────────────┘  hidden in PDF export
```

All four margins are stored in the `BlockEditorStyle` object as inches and converted to pixels by multiplying by 96. The default margin of 0.5 in produces 48 px of padding on each side.

`overflow: hidden` clips content at exactly 1056 px. An amber warning bar overlays the bottom of the page when a block is taller than one full page:

```text
absolute bottom-0 left-0 right-0
bg-amber-100 border-t border-amber-300 text-amber-800 text-xs px-2 py-1
```

**Loading skeleton:** Same 816 × 1056 px dimensions, `bg-white` with optional `shadow-lg rounded-sm border border-border`, content replaced with `animate-pulse` placeholder bars.

### 2.2 Typography System

| `BlockEditorStyle` Property | Default | CSS Expression | Applied To |
| ----- | ----- | ----- | ----- |
| `fontFamily` | Inter | CSS variable stack (see below) | Entire page container |
| `fontSizeBody` | 10 pt | `${fontSizeBody}pt` | Body text, bullets, skills, summary, interests |
| `fontSizeHeading` | 14 pt | `${fontSizeHeading}pt` | Contact name only |
| `fontSizeSubheading` | 11 pt | `${fontSizeSubheading}pt` | Section header labels |
| Secondary text | — | `calc(${fontSizeBody} - 1pt)` | Dates, locations, contact detail icons row |
| `lineSpacing` | 1.15 | unitless CSS `line-height` | Body text and bullets |

**Font family CSS stacks:**

| Preset | CSS `font-family` value |
| ----- | ----- |
| Inter | `var(--font-inter), ui-sans-serif, system-ui, sans-serif` |
| Roboto | `var(--font-roboto), ui-sans-serif, system-ui, sans-serif` |
| Open Sans | `var(--font-open-sans), ui-sans-serif, system-ui, sans-serif` |
| Lato | `var(--font-lato), ui-sans-serif, system-ui, sans-serif` |
| Arial | `Arial, Helvetica, ui-sans-serif, sans-serif` |
| Georgia | `Georgia, 'Times New Roman', ui-serif, serif` |
| Times New Roman | `'Times New Roman', Times, ui-serif, serif` |

### 2.3 Spacing System

| Property | Default | Effect |
| ----- | ----- | ----- |
| `sectionSpacing` | 12 px | `margin-bottom` on each block wrapper — the gap between sections |
| `entrySpacing` | 8 px | `gap` on the entry list inside multi-entry blocks |
| Bullet indent | — | `ml-4` (16 px left margin), `space-y-0.5` (2 px) between bullets |
| Section header bottom gap | — | `pb-1` (4 px) padding + `mb-2` (8 px) margin below the divider line |

### 2.4 Section Header

Every block except Contact renders a section header as its first element:

```text
WORK EXPERIENCE ──────────────────────────────────────────────────
```

| Property | Value |
| ----- | ----- |
| Classes | `font-semibold uppercase tracking-wide border-b border-input pb-1 mb-2` |
| Font size | `fontSizeSubheading` (11 pt default) |
| Color | Default foreground |
| Border | Bottom border, `border-input` color |

### 2.5 Block Wrapper and Interactive States

Each block is wrapped in a `div` with base classes:

```text
preview-block transition-all duration-200 rounded-sm p-2 -mx-2
```

The `p-2 -mx-2` pattern adds 8 px of inner padding on all sides while extending the click/hover target 8 px wider than the content on each horizontal side.

| State | Additional Classes |
| ----- | ----- |
| Default | (none) |
| Hovered | `ring-2 ring-dashed ring-primary/50` |
| Active (clicked) | `ring-2 ring-primary` |

Move-up and move-down arrow buttons appear on block hover, positioned at the top-right of the wrapper. They carry `data-print-hidden="true"` and are excluded from PDF export.

### 2.6 Block-by-Block Visual Breakdown

#### Contact

```text
                     John Doe
          ──────────────────────────────────────
  📧 john@example.com  📞 555-1234  📍 San Francisco  🔗 linkedin
```

The name renders with `font-bold tracking-tight` at `fontSizeHeading`. Below it is a `border-b border-input` separator, then a single flex row of contact details:

```text
flex flex-wrap justify-center gap-x-4 gap-y-1
text-muted-foreground, calc(fontSizeBody - 1pt)
```

Each field shows a 12 px icon in `text-muted-foreground/60` followed by the value text. Optional fields (phone, linkedin, website, github) only render when their content is non-empty. Email always renders.

---

#### Summary

A single block of HTML rich text. No section header, no border.

```text
font-size: fontSizeBody
line-height: lineSpacing
```

Uses `InlineRichText` when the block editor is interactive.

---

#### Experience (also Leadership and Volunteer — structurally identical)

```text
Software Engineer                              Jan 2022 – Present
────────────────────────────────────────────────────────────────
Acme Corp                                          San Francisco
  • Led migration to microservices, reducing p99 latency by 40%
  • Managed a team of 5 engineers across two product squads
```

| Element | Classes / Size |
| ----- | ----- |
| Title | `font-semibold`, `fontSizeBody` |
| Date range | right-aligned, `calc(fontSizeBody - 1pt)`, `text-muted-foreground` |
| Company/location row | `flex justify-between`, `text-foreground/80`, `fontSizeBody` |
| Bullet list | `list-disc ml-4 mt-1 space-y-0.5` |
| Bullet text | `fontSizeBody`, `lineSpacing` |

Each `<li>` element carries a `data-bullet-element-id` attribute used by the bullet suggestion system to position the dropdown.

---

#### Education

```text
B.S. Computer Science                                  May 2022
────────────────────────────────────────────────────────────────
Stanford University                                   California
GPA: 3.9  ·  Honors: Magna Cum Laude
  • CS229: Machine Learning
  • CS224N: NLP with Deep Learning
```

| Element | Classes / Size |
| ----- | ----- |
| Degree | `font-semibold`, `fontSizeBody` |
| Graduation date | right-aligned, `calc(fontSizeBody - 1pt)`, `text-muted-foreground` |
| Institution/location | `flex justify-between`, `text-foreground/80` |
| GPA/Honors row | `flex flex-wrap gap-x-2 mt-0.5`, `calc(fontSizeBody - 1pt)`, `text-muted-foreground` |
| Relevant courses | `list-disc ml-4 mt-0.5 space-y-0.5`, `calc(fontSizeBody - 1pt)` |

GPA and Honors are optional — the row only renders when at least one is present. Relevant courses are an optional bullet list at the smaller font size.

---

#### Skills

```text
Python  ·  TypeScript  ·  React  ·  PostgreSQL  ·  Docker  ·  Kubernetes
```

`list-none p-0 m-0` — a single line of comma-separated skill text at `fontSizeBody`. No bullets, no sub-labels. When interactive, uses `InlineSkillsList` which shows each skill as a removable chip; in read-only/static mode it renders as plain text.

---

#### Projects

```text
Resume Builder  (github.com/user/resume-builder)       Jan – Mar 2024
──────────────────────────────────────────────────────────────────────
AI-powered tool for resume customization and tailoring
Technologies: Python, FastAPI, Next.js, PostgreSQL
  • Built semantic matching engine achieving 94% keyword recall
  • Reduced time-to-tailor from 2 hours to 15 minutes
```

| Element | Classes / Size |
| ----- | ----- |
| Project name | `font-semibold`, `fontSizeBody` |
| URL | inline after name, `text-muted-foreground font-normal ml-2`, in parentheses |
| Date range | right-aligned, `calc(fontSizeBody - 1pt)`, `text-muted-foreground` |
| Description | `text-foreground/80 mt-0.5` |
| Technologies label | `font-medium`, `text-muted-foreground mt-1` |
| Bullets | `list-disc ml-4 mt-1 space-y-0.5`, `fontSizeBody` |

URL only renders when non-empty. Bullets are optional.

---

#### Certifications

```text
AWS Solutions Architect – Associate                       Oct 2023
──────────────────────────────────────────────────────────────────
Amazon Web Services
Credential ID: AWS-SAA-C03-12345
```

| Element | Classes / Size |
| ----- | ----- |
| Name | `font-semibold`, `fontSizeBody` |
| Date | right-aligned, `calc(fontSizeBody - 1pt)`, `text-muted-foreground` |
| Issuer | `text-foreground/80` |
| Credential ID | `text-muted-foreground`, `calc(fontSizeBody - 1pt)` |

---

#### Languages

```text
English (Native)   ·   French (Professional)   ·   Spanish (Intermediate)
```

`flex flex-wrap gap-x-4 gap-y-1`. Language name is `font-medium`. Proficiency is `text-muted-foreground` in parentheses.

---

#### Awards, Publications, Courses, Memberships, References

All five blocks follow the same two-row stacked pattern as Certifications:

- **Row 1:** Primary label (`font-semibold`) + date right-aligned (`text-muted-foreground`, smaller font)
- **Row 2:** Secondary detail (organization, publisher, provider, company) in `text-foreground/80`
- **Row 3 (optional):** Tertiary detail (credential ID, URL, description) in `text-muted-foreground` at smaller font size

---

#### Interests

A single block of HTML rich text, visually identical to Summary. No section header rendered at the block level (just the section header line above it). Uses `InlineRichText` when interactive.

---

### 2.7 Inline Editing Appearance

Inline editors activate when a user clicks an element in the preview. Their visual signature is intentionally minimal — the editing surface blends into the document.

**InlinePlainText** (titles, company names, dates, contact fields):

- Renders as a `<span contentEditable>`
- Classes: `cursor-text outline-none rounded-sm transition-colors`
- Empty state: `text-muted-foreground` placeholder color
- No border, background, or ring on focus — the field is visually invisible until typed into

**InlineRichText** (summary body, bullet text, interests body):

- TipTap `EditorContent` renders directly into the document flow
- Visually indistinguishable from static text in all states
- Bold, italic, and underline formatting are reflected live in the rendered HTML
- Enter key creates a new bullet below; Backspace on an empty bullet deletes it

**InlineSkillsList** (skills block only):

- Inactive: comma-separated plain text, indistinguishable from static rendering
- Active (when the skills block is selected): each skill becomes a removable chip with a delete button

---

### 2.8 FloatingToolbar

Appears floating above selected text within any `InlineRichText` field. Portaled to `document.body`.

```text
       ┌──────────────────────────────┐
       │  B  I  U  │  Clear ✕         │
       └──────────────────────────────┘
            ↑ 8 px above selection
```

| Element | Classes |
| ----- | ----- |
| Container | `bg-zinc-900 rounded-md shadow-lg p-1 flex items-center gap-0.5` |
| Inactive button | `text-zinc-300 hover:bg-zinc-800 hover:text-white p-1.5 rounded` |
| Active button (format applied) | `bg-blue-600 text-white p-1.5 rounded` |
| Separator | `w-px h-5 bg-zinc-700 mx-1` |
| Icons | `w-4 h-4` |
| z-index | `z-[60]` |

Positioned by `@floating-ui/react` with `offset(8)`, `flip()`, and `shift({ padding: 8 })` to keep it on-screen at all times.

---

### 2.9 Bullet Suggestion Dropdown

Renders via portal (`SuggestionPortalLayer`) as an absolute-positioned sibling of the scaled page wrapper — positioned outside the page's CSS transform context. Position is calculated from `getBoundingClientRect()` on the target `<li>` element, then corrected for the scale transform.

```text
┌──────────────────────────────────────────────────────────────┐
│  AI Suggestion                              [High Impact]    │  header: bg-zinc-700/50
├──────────────────────────────────────────────────────────────┤
│  • Led cross-functional migration to microservices,          │  typewriter animation
│    improving p99 latency by 40% and saving $200K/yr          │
├──────────────────────────────────────────────────────────────┤
│  Adds specific metrics and quantifies business impact        │  fades in after text reveals
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Tab to accept  ·  Esc to skip  ·  ↑↓ to navigate            │  footer: bg-zinc-700/30
└──────────────────────────────────────────────────────────────┘
min-width: max(320px, target bullet width)    z-index: 50
```

| Element | Classes |
| ----- | ----- |
| Container | `bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl` |
| Header | `px-3 py-1.5 bg-zinc-700/50 border-b border-zinc-600` |
| Content area | `px-3 py-2` |
| Reason text | `px-3 pb-2 text-sm text-muted-foreground` |
| Footer | `px-3 py-1.5 bg-zinc-700/30 border-t border-zinc-600` |

**Impact badges:**

| Level | Classes |
| ----- | ----- |
| High | `bg-red-500/10 text-red-400 border border-red-500/30 rounded` |
| Medium | `bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded` |
| Low | `bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded` |

**Visibility transitions:** `transition-all duration-200`. When visible: `opacity-100 translate-y-0`. When hidden (scrolling or dismissed): `opacity-0 -translate-y-1`.

The dropdown carries `data-print-hidden="true"` and `data-no-export="true"` — it is excluded from PDF export. Scroll events on the preview container hide the dropdown; it repositions after 200 ms of scroll idle.

---

### 2.10 Multi-page Page Number Badge

Each page renders a position-absolute badge in its top-right corner:

```text
absolute top-2 right-2
bg-zinc-700 text-zinc-100 border border-zinc-600
px-2 py-1 rounded-md shadow-sm text-xs
```

Text format: `{pageNumber} / {totalPages}` (e.g., `2 / 3`). Hidden in PDF export via `data-print-hidden="true"`.

---

## 3. Workshop Editor Preview

**Used by:** Workshop Editor only.

**Primary source:** `components/workshop/`.

### 3.1 Page Layout

**Desktop (> 768 px):**

```text
┌───────────────────────────────────────────────────────────────────┐
│  WorkshopHeader  h-14  ←  title · match score · save · export     │
├─────────────────────────────────┬─────────────────────────────────┤
│                                 │                                 │
│  Resume Preview                 │  Control Panel                  │
│  55% default (40–70% range)     │  45% default (30–60% range)     │
│                                 │                                 │
│  bg-muted, p-6                  │  bg-card                        │
│  centered, scrollable           │  tabbed, scrollable             │
│                                 │                                 │
└─────────────────────────────────┴─────────────────────────────────┘
                   ↑
          w-1.5 bg-muted hover:bg-blue-300 cursor-col-resize
```

**Mobile (≤ 768 px):**

Preview fills the full screen below the header. A collapsed bottom sheet handle sits at the bottom edge:

```text
h-12 bg-card border-t flex items-center justify-center
```

Tapping expands the control panel as a bottom sheet covering 70vh:

```text
fixed bottom-0 left-0 right-0  bg-card rounded-t-xl shadow-xl z-50
```

A drag handle bar at the top of the sheet (small centered bar, `h-6`) and a dark backdrop (`bg-black/30`) behind it.

---

### 3.2 Preview Pane Differences

The workshop preview renders the same page canvas (816 × 1056 px, same CSS transform scale formula) with a few visual differences from the block editor:

| Aspect | Block Editor | Workshop Editor |
| ----- | ----- | ----- |
| Page background | `bg-white` | `bg-card` |
| Active section ring | `ring-2 ring-primary` | `ring-2 ring-blue-400 ring-offset-2 bg-blue-50/30` |
| Section hover | `ring-2 ring-dashed ring-primary/50` | `hover:bg-accent/50 cursor-pointer` |
| Inline WYSIWYG editing | Yes | No — click opens form in control panel |

All block rendering (section headers, typography, entry layout, bullet styling, spacing) is identical to the block editor. The workshop uses the same CSS classes for the resume content itself.

**Pagination controls** (rendered below the page when the resume spans multiple pages):

```text
         ◀    1 / 2    ▶

bg-card rounded-lg shadow px-3 py-2 flex items-center gap-2
```

Prev/next buttons: `p-1 rounded hover:bg-accent disabled:opacity-50`. These are explicit navigation buttons — unlike the block editor, there is no continuous scroll through all pages.

---

### 3.3 Match Score Display

**Header badge (always visible, compact):**

```text
[ 84% Match ]
```

`inline-flex items-center font-medium rounded-full border`

| Score | Background | Text | Border |
| ----- | ----- | ----- | ----- |
| ≥ 80% | `bg-green-100` | `text-green-800` | `border-green-200` |
| ≥ 60% | `bg-yellow-100` | `text-yellow-800` | `border-yellow-200` |
| < 60% | `bg-red-100` | `text-red-800` | `border-red-200` |

Size variants: `sm` (`text-xs px-1.5 py-0.5`), `md` (`text-sm px-2 py-1`), `lg` (`text-base px-3 py-1.5`).

**Full score display (shown in header when space allows):**

```text
  84 %
  ──────────────────────────────
  Updated 2m ago
  text-xs text-muted-foreground/60
```

The number renders as `text-3xl font-bold` in the same green/yellow/red color. Score changes animate with `transition-colors`.

**Circular SVG gauge:**

- Background circle: stroke `#e5e7eb` (gray-200)
- Progress arc: same color as badge, animated via `stroke-dashoffset 0.5s ease-in-out`
- Center text: bold, color-coded
- Sizes: 48 px (sm), 80 px (md), 112 px (lg)

---

### 3.4 Control Panel Tab Bar

```text
┌──────────────────────────────────────────────────────┐
│  AI Rewrite ①  |  Editor  |  Style  |  ATS Score ②  │
└──────────────────────────────────────────────────────┘
```

- Tab bar: `flex border-b px-2`
- Each tab: `flex-1 py-3 text-sm font-medium transition-colors`
- Active: `text-blue-600 border-b-2 border-blue-600`
- Inactive: `text-muted-foreground hover:text-foreground/80`
- Inline badges (suggestion count, ATS score): small colored `rounded-full` chips

Tab content enters with a `motion.div` animation: `opacity 0 → 1` + `x: 8 → 0` over 0.2 s easeOut. Disabled when `prefers-reduced-motion` is set.

---

### 3.5 Editor Tab — Section Forms

A scrollable list of section items, each collapsible:

```text
┌──────────────────────────────────────────────────────────┐
│  ⠿  Work Experience  (3)  ▼                     [⋮]      │  border-2 (default: border-border)
├──────────────────────────────────────────────────────────┤  (active: border-primary-300)
│                                                          │  (dragging: border-primary-400
│  [form fields for this section]                          │           shadow-lg opacity-90)
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Element | Classes |
| ----- | ----- |
| Drag handle | `p-1 text-muted-foreground/60 cursor-grab active:cursor-grabbing` |
| Expand chevron | `transition-transform` rotation (0° collapsed, 180° expanded) |
| Entry count badge | `ml-2 text-xs text-muted-foreground/60` |
| Form text inputs | `w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring` |
| Sliders | `w-full accent-primary` |
| Field labels | `block text-xs text-muted-foreground mb-1` |

---

### 3.6 AI Rewrite Tab

Suggestion cards, collapsed by default, expand on click:

```text
┌──────────────────────────────────────────────────────────┐
│  Experience                [High Impact]        ▼        │  bg-muted, hover:bg-accent
├──────────────────────────────────────────────────────────┤
│  ~~Led a team of engineers on backend projects~~         │  bg-red-50 border-red-100
│                                                          │  line-through text
│  Led a 6-person engineering team delivering 3 backend    │  bg-green-50 border-green-100
│  services serving 500K MAU                               │
│                                                          │
│  Adds headcount specifics and scale metrics              │  text-sm text-muted-foreground
│                                                          │
│  [ Accept ✓ ]                        [ Reject ✗ ]        │
└──────────────────────────────────────────────────────────┘
```

Accept button: `flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md`
Reject button: `flex-1 px-3 py-1.5 text-sm font-medium text-foreground/80 bg-muted hover:bg-accent rounded-md`

Impact badge colors match the block editor: High = red, Medium = yellow/amber, Low = muted.

---

### 3.7 Style Tab

```text
  Template Presets                     ← thumbnail grid selector
  ───────────────────────────────────
  Auto-Fit to One Page  [toggle]       ← checkbox-style switch + status text
  ───────────────────────────────────
  Font Family           [Inter     ▼]  ← select dropdown
  Body Font Size        ──●────────    ← range slider
  Line Spacing          ──────●───     ← range slider
  ───────────────────────────────────
  ▸ Advanced Settings                  ← accordion (collapsed by default)
    Heading size    [14]  Subheading size  [11]
    Section spacing [12]  Entry spacing    [8]
    Margins: T[0.5] R[0.5] B[0.5] L[0.5]
    [ Reset to Default ]
```

All controls map to the same `BlockEditorStyle` properties as the block editor (same `DEFAULT_STYLE` defaults, same `STYLE_PRESETS`). When auto-fit is enabled and the minimum is reached, an amber warning shows: `text-xs text-amber-600 bg-amber-50 p-2 rounded`.

---

### 3.8 ATS Score Tab

```text
  72                               ← text-3xl font-bold (red, score < 80)
  ─────────────────────────────────
  ⚠ Content has changed — Re-analyze    ← amber stale indicator

  Stage Breakdown:
  Parsing            ████████░░   82%
  Parsing Quality    ██████░░░░   63%
  Matching           █████░░░░░   54%
  Role Proximity     ████████░░   79%

  Keywords:
  [Python ✓] [FastAPI ✓] [React ✓]  [Docker ✗] [Kubernetes ✗]

  ⚠ Knockout Risks:
  Missing required: 5+ years experience
```

| Element | Classes |
| ----- | ----- |
| Progress bars | `rounded-full bg-gray-200` background with color fill |
| Found keyword chip | `bg-green-100 text-green-800 rounded-full px-2 py-1 text-xs` |
| Missing keyword chip | `bg-red-100 text-red-800 rounded-full px-2 py-1 text-xs` |
| Knockout alert block | `bg-red-50 border border-red-200 rounded` |
| Stale indicator | `bg-amber-100 text-amber-800` |

---

## 4. Side-by-Side Comparison

| Visual Aspect | Block Editor Preview | Workshop Editor Preview |
| ----- | ----- | ----- |
| Page background | `bg-white` | `bg-card` |
| Active section ring | `ring-2 ring-primary` (solid) | `ring-2 ring-blue-400 ring-offset-2 bg-blue-50/30` |
| Section hover | `ring-2 ring-dashed ring-primary/50` | `hover:bg-accent/50 cursor-pointer` (no ring) |
| Inline text editing | Yes — invisible edit surfaces in preview | No — click opens form in control panel |
| Bullet suggestion dropdown | Yes — portal below target bullet | No |
| Page number display | Overlaid badge, top-right of each page | Dedicated prev/next navigation below page |
| Match score | Not shown | Always visible in header (badge + full display) |
| Mobile layout | Single-pane, no mobile-specific adaptation | Full-screen preview + collapsible bottom sheet |
| PDF export | Yes | No |
| Supported page formats | US Letter only | US Letter and A4 |
| Preview background (outside page) | Left panel background (varies by layout) | `bg-muted` with `p-6` |

---

## 5. Style Presets Reference

Each font preset ships with different defaults, optimized for that font's metrics:

| Preset | Body | Heading | Subheading | Margins | Line Spacing | Section Gap | Entry Gap |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Inter | 10 pt | 14 pt | 11 pt | 0.5 in | 1.15 | 12 px | 8 px |
| Roboto | 10 pt | 14 pt | 11 pt | 0.5 in | 1.15 | 12 px | 8 px |
| Lato | 10 pt | 13 pt | 11 pt | 0.5 in | 1.15 | 11 px | 7 px |
| Arial | 10 pt | 13 pt | 11 pt | 0.5 in | 1.15 | 12 px | 8 px |
| Open Sans | 10 pt | 12 pt | 10 pt | 0.4 in | 1.1 | 10 px | 6 px |
| Georgia | 11 pt | 16 pt | 13 pt | 0.75 in | 1.3 | 16 px | 10 px |
| Times New Roman | 11 pt | 14 pt | 12 pt | 0.75 in | 1.15 | 14 px | 10 px |

Defined in `STYLE_PRESETS` at `lib/resume/defaults.ts`.

---

## 6. Source File Reference

| File | Purpose |
| ----- | ----- |
| `components/library/preview/PaginatedResumePreview.tsx` | Block editor page container, scale transform, portal layer |
| `components/library/editor/blocks/` | One renderer component per block type |
| `components/library/editor/inline/InlinePlainText.tsx` | Plain-text edit surface (`<span contentEditable>`) |
| `components/library/editor/inline/InlineRichText.tsx` | TipTap rich-text edit surface |
| `components/library/editor/inline/InlineSkillsList.tsx` | Tag-based skills editor |
| `components/library/editor/inline/FloatingToolbar.tsx` | Bold / italic / underline floating toolbar |
| `components/library/preview/BulletSuggestionDropdown.tsx` | Inline suggestion dropdown via portal |
| `components/library/preview/SuggestionPortalLayer.tsx` | Export-safe portal mount point |
| `lib/resume/defaults.ts` | `DEFAULT_STYLE`, `STYLE_PRESETS`, `FONT_PROFILES`, `FONT_FAMILIES` |
| `lib/resume/types.ts` | `BlockEditorStyle` type definition |
| `components/workshop/WorkshopLayout.tsx` | Workshop split-panel layout |
| `components/workshop/WorkshopHeader.tsx` | Workshop header with score display |
| `components/workshop/ResumePreview/` | Workshop preview pane components |
| `components/workshop/panels/style/StylePanel.tsx` | Workshop style controls |
| `components/workshop/panels/ats/ATSPanel.tsx` | ATS score display panel |
| `components/workshop/ScoreDisplay.tsx` | Circular SVG score gauge |
| `components/workshop/MatchScoreBadge.tsx` | Compact header score badge |
| `components/workshop/MobileControlSheet.tsx` | Mobile bottom sheet control panel |
