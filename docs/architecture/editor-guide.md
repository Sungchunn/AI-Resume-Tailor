# Editor Architecture Guide

The app has one shared editor component (`EditorLayout`) serving three distinct user journeys. Two of them are functionally identical (both have job context); one is fundamentally different (no job context).

This is a **permanent reference**. Update this document whenever editor routes, feature gating, entry points, or new editor contexts change.

---

## Resume Editor

**Purpose:** Verify and clean up an uploaded resume — check parsing accuracy, fix formatting, reorder sections. No AI-assisted editing.

**Route:** `/library/resumes/[id]/edit` (no query params)

**Entry Points:**

| Source Page | Action | Navigation |
| ----- | ----- | ----- |
| Library resume list (`ResumeTimeline.tsx`) | "Edit" icon button | `/library/resumes/[id]/edit` |
| Resume detail (`/library/resumes/[id]`) | "Edit" / "Open Editor" button | `/library/resumes/[id]/edit` |
| Resume verify (`/library/resumes/[id]/verify`) | "Open Editor" button | `/library/resumes/[id]/edit` |

**Job Context:** None

**Enabled Features:**

- Block-based WYSIWYG A4 preview editing
- Section drag-and-drop reordering
- Formatting controls (font, spacing, margins, auto-fit)
- Undo/redo history
- Auto-save with conflict detection

**Disabled Features:**

- ATS tab (gated by `hasJobContext`)
- AI bullet suggestions panel (no job to analyze against)
- AI model selector (no AI features to configure)
- AI chat job context indicator

---

## Job-Linked Editor

**Purpose:** Edit the original resume with full AI assistance targeted at a specific job posting. The job is linked via query parameter, not embedded in the document.

**Route:** `/library/resumes/[id]/edit?jobListingId=X` or `/library/resumes/[id]/edit?jobId=X`

**Entry Points:**

| Source Page | Action | Navigation |
| ----- | ----- | ----- |
| Tailor keywords review (`/tailor/keywords/[id]`) | "Edit Resume" after confirming keywords | `/library/resumes/[resumeId]/edit?jobListingId=[id]` |
| Tailor analyze (`/tailor/analyze`) | "Continue" for user-created jobs | `/library/resumes/[resumeId]/edit?jobId=[jobId]` |

**Job Context:** Yes — `jobListingId` (scraped job, integer) or `jobId` (user-created job, UUID) passed as query params.

**Enabled Features:**

- Everything from Resume Editor, plus:
- ATS scoring and keyword analysis tab
- AI bullet suggestions panel (after ATS keyword analysis completes)
- AI model selector
- AI chat with job context indicator

---

## Tailor Editor

**Purpose:** Edit a tailored copy of a resume with full AI assistance. The job context is embedded in the tailored resume's MongoDB document, not passed via query params.

**Route:** `/tailor/editor/[id]`

**Entry Points:**

| Source Page | Action | Navigation |
| ----- | ----- | ----- |
| Tailored resume summary (`/tailor/[id]`) | "Edit" button | `/tailor/verify/[id]` (redirects to `/tailor/editor/[id]`) |
| Deprecated `/tailor/verify/[id]` | Auto-redirect | `/tailor/editor/[id]` |
| Deprecated `/tailor/review/[id]` | Auto-redirect | `/tailor/editor/[id]` |

**Job Context:** Yes — embedded in the tailored resume MongoDB document via `job_source` field. Resolved from either `job_listing_id` (scraped) or `job_id` (user-created).

**Enabled Features:**

- Everything from Job-Linked Editor, plus:
- Skill suggestions panel (missing keywords from job posting)
- `TailorFlowStepper` progress indicator in header
- ATS composite score display in header

**Data Handling:**

- On load: converts `TailoredContent` (tailored_data/finalized_data) to `ParsedContent` for the block editor
- On save: converts `ParsedContent` back to `TailoredContent` for storage

---

## Shared Architecture

All three editors share the same core component stack:

| Component | Responsibility |
| ----- | ----- |
| `BlockEditorProvider` | State management for blocks, styles, undo/redo, save coordination |
| `EditorLayout` | Split-screen layout: left A4 preview panel + right control panel (resizable) |
| `ControlPanel` | Tabbed interface: AI Chat, ATS Evaluation, Formatting, Sections |
| `EditorHeader` | Top bar with resume title, save status, and action buttons |

The Tailor Editor wraps this stack in an additional `TailorEditorProvider` that injects job context (ID, description, title, company) and ATS analysis results from `useATSProgressStore`.

---

## Naming Conventions

Use these canonical names in code comments, commit messages, and documentation to avoid ambiguity:

| User Journey | Canonical Name | Has Job | Route |
| ----- | ----- | ----- | ----- |
| From library/profile | **Resume Editor** | No | `/library/resumes/[id]/edit` |
| From job listing flow | **Job-Linked Editor** | Yes | `/library/resumes/[id]/edit?jobListingId=X` |
| From tailor flow | **Tailor Editor** | Yes | `/tailor/editor/[id]` |

**Do not use** "Library editor" — it is ambiguous (could mean Resume Editor or Job-Linked Editor).

---

## Feature Gating Rules

The `hasJobContext` flag is the primary gate. It is `true` when a `jobListingId`, `jobId`, or embedded job source is present.

| Feature | Resume Editor | Job-Linked Editor | Tailor Editor |
| ----- | ----- | ----- | ----- |
| Block editing / formatting | Yes | Yes | Yes |
| Section drag-and-drop | Yes | Yes | Yes |
| Undo/redo | Yes | Yes | Yes |
| Auto-save | Yes | Yes | Yes |
| ATS tab | No | Yes | Yes |
| AI bullet suggestions | No | Yes | Yes |
| AI model selector | No | Yes | Yes |
| AI chat job indicator | No | Yes | Yes |
| Skill suggestions panel | No | No | Yes |
| Tailor flow stepper | No | No | Yes |
| ATS score in header | No | No | Yes |
