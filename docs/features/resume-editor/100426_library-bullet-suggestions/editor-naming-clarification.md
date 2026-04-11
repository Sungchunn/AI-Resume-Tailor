# Editor Architecture & Naming Clarification

## Three Editor Contexts

The app has one editor component (`EditorLayout`) serving three distinct user journeys. Two of them are functionally identical; one is fundamentally different.

---

### Resume Editor (no job context)

- **Route:** `/library/resumes/[id]/edit` (no query params)
- **Entry points:**
  - Profile/library resume list (`ResumeTimeline.tsx:227, 313`) — "Edit" icon button
  - Resume detail page (`/library/resumes/[id]/page.tsx:217, 343`) — "Edit" / "Open Editor" button
  - Resume verify page (`/library/resumes/[id]/verify/page.tsx:281`) — "Open Editor" button
- **Purpose:** Verify and clean up an uploaded resume — check parsing accuracy, fix formatting, reorder sections
- **Job context:** None
- **Enabled features:** Basic editing, formatting, section drag-and-drop
- **Disabled features:** ATS tab (already gated), AI bullet suggestions, AI model selector — no job to analyze against

---

### Job-Linked Editor (job context via query param)

- **Route:** `/library/resumes/[id]/edit?jobListingId=X` or `/library/resumes/[id]/edit?jobId=X`
- **Entry points:**
  - Tailor keywords review page (`/tailor/keywords/[id]/page.tsx:112`) — after confirming keywords, navigates to `/library/resumes/{resumeId}/edit?jobListingId={id}`
  - Tailor analyze page for user-created jobs (`/tailor/analyze/page.tsx:145`) — navigates to `/library/resumes/{resumeId}/edit?jobId={jobId}`
- **Purpose:** Edit a resume with full AI assistance targeted at a specific job posting
- **Job context:** Yes — `jobListingId` (scraped, integer) or `jobId` (user-created, UUID) in query params
- **Enabled features:** Everything — ATS scoring, AI bullet suggestions, AI model selector, keyword analysis

---

### Tailor Editor (tailored resume copy)

- **Route:** `/tailor/editor/[id]`
- **Entry points:**
  - Tailored resume summary page (`/tailor/[id]/page.tsx:233`) — "Edit" button navigates to `/tailor/verify/{id}` which redirects to `/tailor/editor/{id}`
  - Deprecated `/tailor/verify/[id]` and `/tailor/review/[id]` pages — both redirect to `/tailor/editor/{id}`
- **Purpose:** Edit a tailored copy of a resume with full AI assistance
- **Job context:** Yes — embedded in the tailored resume MongoDB document (via `job_source`)
- **Enabled features:** Everything — ATS scoring, AI bullet suggestions, skill suggestions, AI model selector

---

## Key Principle

**The Job-Linked Editor and the Tailor Editor are the same experience.** Both have a job context and should offer the identical AI-assisted editing suite. The only difference is the data source: one edits the original resume with a job linked via query param, the other edits a tailored copy with the job embedded in the document.

**The Resume Editor is a fundamentally different use case.** It has no job context. ATS, bullet suggestions, and the AI model selector should be disabled — they have nothing to operate on.

---

## Naming in Code and Docs

| User Journey | Name | Has Job | Route |
| ----- | ----- | ----- | ----- |
| From library/profile | **Resume Editor** | No | `/library/resumes/[id]/edit` |
| From job listing flow | **Job-Linked Editor** | Yes | `/library/resumes/[id]/edit?jobListingId=X` |
| From tailor flow | **Tailor Editor** | Yes | `/tailor/editor/[id]` |

When referencing these in code comments, commit messages, and docs, use these names to avoid ambiguity. "Library editor" is ambiguous — it could mean either the Resume Editor or the Job-Linked Editor.

---

## Correct Feature Gating Behavior

### Resume Editor (no job)

- [x] ATS tab disabled (already gated by `hasJobContext` in `ControlPanel.tsx:48`)
- [ ] AI bullet suggestions panel must NOT render (currently gated by `atsKeywordResult` which is null, but should be explicitly gated by `hasJobContext`)
- [ ] AI model selector should be hidden (no AI features to configure)
- [ ] AI chat job context indicator hidden (already conditional on `jobListing` data)

### Job-Linked Editor and Tailor Editor (has job)

- [x] ATS tab enabled
- [x] AI bullet suggestions panel renders after ATS keyword analysis completes
- [x] AI model selector visible
- [x] AI chat has job context indicator

---

## AI Model Selector Status

The AI model selector (`AIModelSelector.tsx`) is unconditionally rendered in `EditorHeader.tsx:106`. It exists on all three editors today. If it appears missing on a page:

- **Not a code removal** — the component is present with no conditional rendering
- **Likely cause:** Permanent "Loading..." state when `/api/v1/profile/ai-preferences` API call fails or returns no data (see `AIModelSelector.tsx:37-43`)
- **Debug:** Check browser network tab for a failing `ai-preferences` request
- **Intended behavior:** Should be hidden in the Resume Editor (no job context) and visible in the Job-Linked Editor and Tailor Editor
