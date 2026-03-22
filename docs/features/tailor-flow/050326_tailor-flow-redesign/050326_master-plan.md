# Tailor Flow Redesign - Master Plan

**Created:** March 5, 2026
**Status:** Planning
**Priority:** High

---

## Executive Summary

Complete redesign of the resume tailoring user experience to fix three critical UX problems:

1. **Backwards flow** - Current page shows history before action ("Recent Tailored Resumes" appears before user does anything)
2. **Data credibility** - Showing 75% match with 0% keyword coverage simultaneously destroys user trust
3. **UUID names** - "Tailored Resume #69a69d0f..." destroys personalization

**Target:** Transform into a linear 3-step wizard flow with progressive ATS analysis visualization.

---

## Current Implementation Analysis

### Frontend Architecture

#### Entry Points

| Route | File | Purpose |
| ----- | ---- | ------- |
| `/tailor` | `app/(protected)/tailor/page.tsx` | Selection page (accepts `?job_listing_id=X`) |
| `/tailor/[id]` | `app/(protected)/tailor/[id]/page.tsx` | Detail view with scores + content |
| `/tailor/review/[id]` | `app/(protected)/tailor/review/[id]/page.tsx` | Side-by-side diff review (Phase 6) |
| `/tailor/editor/[id]` | `app/(protected)/tailor/editor/[id]/page.tsx` | Full editor with session handoff (Phase 6) |

#### Current Tailor Page Flow (`/tailor/page.tsx`)

**Step State Machine:** `"select" | "analyze" | "result"`

1. **Job Context Card** (Lines 201-261): When `job_listing_id` param present:
   - Primary border + checkmark icon
   - Company logo (or initial fallback)
   - Job title, company, location
   - Truncated description (150 chars)

2. **Resume Selection** (Lines 264-330):
   - Displays user's resumes as selectable cards
   - Border highlighting on selection
   - Shows title + creation date
   - "Add New" link to `/library/resumes/new`

3. **Recent Tailored Resumes** (Lines 582-622) - **THE PROBLEM**:

   ```tsx
   {step === "select" && tailoredResumes?.length > 0 && (
     // Shows "Tailored Resume #{tailored.id}" - DISPLAYS UUID
     // Shows up to 5 most recent
   )}
   ```

4. **CTA Flow**:
   - "Preview Match Analysis" → Quick match → Shows scores
   - "Generate Tailored Resume" → POST `/api/tailor` → Redirects to `/tailor/{id}`

#### Current Detail Page (`/tailor/[id]/page.tsx`)

**Title Display** (Line 134):

```tsx
<h1 className="text-2xl font-bold">Tailored Resume</h1>
// No job title, no company name - just generic header
```

**Score Dashboard** (Lines 243-276):

```tsx
<div className="grid md:grid-cols-4 gap-4">
  <MatchScore>{Math.round(tailored.match_score ?? 0)}%</MatchScore>
  <KeywordCoverage>{Math.round(tailored.keyword_coverage * 100)}%</KeywordCoverage>
  <SkillsMatched>{tailored.skill_matches?.length ?? 0}</SkillsMatched>
  <SkillsToAdd>{tailored.skill_gaps?.length ?? 0}</SkillsToAdd>
</div>
// Problem: Shows all scores simultaneously even if some are 0
```

**Action Buttons**:

- Edit → `/tailor/editor/{id}`
- Download (PDF/DOCX/TXT) via `/api/export/{id}?format={format}`
- Delete with confirmation

#### Existing Reusable Patterns

**Workshop Wizard** (`/components/workshop/wizard/`):

- `WizardContainer.tsx`: Step progression with localStorage persistence
- `WizardState`: `{ currentStep, completedSteps, selectedSections, isOpen, hasCompletedBefore }`
- Navigation: `goToStep()`, `nextStep()`, `prevStep()`
- Storage keys: `workshop_wizard_completed`, `workshop_wizard_progress`

**Version History Panel** (`/components/tailoring/VersionHistoryPanel.tsx`):

- Fetches via `useTailoredResumesByResume(resumeId)`
- Two display modes: sidebar (compact) and full (expanded)
- Shows: job_title, company_name, relative time, match score, status badge
- Color-coded scores: green ≥80%, amber ≥60%, red below

**Tailoring Context** (`/contexts/TailoringContext.tsx`):

- SessionStorage with 30-minute expiry
- Enables review → editor handoff
- Stores: session, diffs, diffSummary, history, job metadata

**useTailoringSession Hook** (`/hooks/useTailoringSession.ts`):

- Three-state model: original (read-only), ai_proposed (read-only), active_draft (mutable)
- Accept/reject at block, entry, bullet levels
- Undo history (max 50 states)

### Backend Architecture

#### Tailor API Endpoints (`/api/routes/tailor.py`)

| Method | Endpoint | Purpose | Response Fields |
| ------ | -------- | ------- | --------------- |
| POST | `/api/tailor` | Create tailored resume | `id, match_score, skill_matches, skill_gaps, keyword_coverage, job_title, company_name` |
| POST | `/api/tailor/quick-match` | Fast preview | `match_score, keyword_coverage, skill_matches, skill_gaps` |
| GET | `/api/tailor/{id}` | Get tailored resume | Full `TailorResponse` |
| GET | `/api/tailor/{id}/compare` | Get original + tailored for diff | `original, tailored, status, match_score` |
| POST | `/api/tailor/{id}/finalize` | Save user-approved version | Updated `TailorResponse` |
| GET | `/api/tailor` | List with filters | Array of tailored resumes |

**Two Copies Architecture:**

- `tailored_data`: Complete AI-generated resume (immutable after creation)
- `finalized_data`: User's approved version after accept/reject (set once)

#### ATS Analysis Endpoints (`/api/routes/ats.py`)

**5-Stage Progressive Analysis:**

| Stage | Name | Weight | Key Metrics |
| ----- | ---- | ------ | ----------- |
| 0 | Knockout Check | N/A | `passes_all_checks`, `risks[]` (critical/warning/info) |
| 1 | Structure Analysis | 15% | `format_score` (0-100), `section_order_score` |
| 2 | Enhanced Keywords | 40% | `keyword_score`, coverage by importance tier |
| 3 | Content Quality | 25% | `content_quality_score`, block type ratio, quantification density |
| 4 | Role Proximity | 20% | `role_proximity_score`, title match, trajectory type |

**SSE Streaming** (`POST /v1/ats/analyze-progressive`):

Event Types:

- `stage_start`: `{stage, stage_name, status: "running"}`
- `stage_complete`: `{stage, stage_name, status: "completed", result, elapsed_ms}`
- `stage_error`: `{stage, stage_name, status: "failed", error}`
- `complete`: `{stage: 5, composite_score: {final_score, stage_breakdown, weights_used}}`

**Graceful Degradation:** If stage fails, weights renormalize across remaining stages.

#### Caching (`/services/core/cache.py`)

| Cache Type | TTL | Key Pattern | Status |
| ---------- | --- | ----------- | ------ |
| Parsed Resume | 24h | `resume_parsed:{sha256[:16]}` | ✅ Implemented |
| Parsed Job | 24h | `job_parsed:{sha256[:16]}` | ✅ Implemented |
| Tailored Result | 7d | `tailored:{resume_id}:{job_id}:{hashes}` | ✅ Implemented |
| ATS Composite | - | - | ❌ **Not implemented** |

### Database Schema

#### PostgreSQL

**`resumes` table:**

```sql
id              INTEGER PRIMARY KEY
owner_id        INTEGER REFERENCES users(id) NOT NULL
title           VARCHAR(255) NOT NULL
raw_content     TEXT NOT NULL
html_content    TEXT
parsed_content  JSON
style           JSON
-- File storage
original_file_key   VARCHAR(512)
original_filename   VARCHAR(255)
file_type           VARCHAR(10)  -- "pdf" | "docx"
file_size_bytes     INTEGER
-- Timestamps
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE

-- MISSING: is_master BOOLEAN (to be added in Phase 1)
```

**`tailored_resumes` table:**

```sql
id              INTEGER PRIMARY KEY
resume_id       INTEGER REFERENCES resumes(id) NOT NULL
job_id          INTEGER REFERENCES job_descriptions(id)  -- mutually exclusive
job_listing_id  INTEGER REFERENCES job_listings(id)      -- mutually exclusive
tailored_content TEXT NOT NULL
suggestions     JSON
match_score     FLOAT
style_settings  JSONB DEFAULT '{}'
section_order   VARCHAR[] DEFAULT ARRAY['summary','experience','skills','education','projects']
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE

-- CHECK constraint ensures exactly one job source
CONSTRAINT ck_tailored_resume_one_job_source CHECK (
  (job_id IS NOT NULL AND job_listing_id IS NULL) OR
  (job_id IS NULL AND job_listing_id IS NOT NULL)
)
```

#### MongoDB

**`resumes` collection:**

```typescript
{
  _id: ObjectId,
  user_id: number,          // FK to Postgres
  title: string,
  raw_content: string,
  html_content: string | null,
  parsed: {
    contact: { name, email, phone, location, linkedin, github, website },
    summary: string | null,
    experience: [{ id, title, company, location, start_date, end_date, bullets[] }],
    education: [{ id, degree, institution, location, graduation_date, gpa, honors[] }],
    skills: string[],
    certifications: string[],
    projects: [{ id, name, description, technologies[], url }]
  },
  style: { font_family, font_size, margins, line_height },
  created_at: DateTime,
  updated_at: DateTime
}
```

**`tailored_resumes` collection:**

```typescript
{
  _id: ObjectId,
  resume_id: ObjectId,      // FK to MongoDB resumes
  user_id: number,          // FK to Postgres (denormalized)
  job_source: { type: "user_created" | "job_listing", id: number },

  // Two Copies Architecture
  tailored_data: ParsedContent,     // AI-generated (immutable)
  finalized_data: ParsedContent | null,  // User-approved (set once)

  status: "pending" | "finalized" | "archived",
  section_order: string[],
  match_score: number | null,
  ats_keywords: { matched: string[], missing: string[], score: number } | null,
  job_title: string | null,         // Denormalized for display
  company_name: string | null,      // Denormalized for display
  style_settings: object,
  created_at: DateTime,
  updated_at: DateTime,
  finalized_at: DateTime | null
}
```

### Summary of Gaps

| Issue | Current State | Required Change |
| ----- | ------------- | --------------- |
| UUID Display | "Tailored Resume #{uuid}" | Format as "{Job Title} @ {Company} — {Date}" |
| Generic Title | "Tailored Resume" on detail page | Show job context in header |
| History Placement | On selection screen (Step 1) | Move to detail page sidebar (Step 3) |
| Score Credibility | Shows all scores simultaneously | Gate display until all stages complete |
| Master Resume | No designation exists | Add `is_master` boolean with unique constraint |
| ATS Caching | Not implemented | Add Redis cache with content hash key |
| **Resume Integrity** | AI fills ALL keyword gaps blindly | User selects which vault-backed keywords to use |

---

## Target UX: 3-Step Wizard Flow

```text
Job Detail Page
       │
       │ Click "Optimize Resume for This Job"
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Select Resume                                      │
│  /tailor?job_listing_id=X                                   │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │ Job Context Card    │  │ Resume Selector             │   │
│  │ (pre-selected)      │  │ ○ Master Resume ★           │   │
│  │                     │  │ ○ Other Resume 1            │   │
│  │ Software Engineer   │  │ ○ Other Resume 2            │   │
│  │ @ Tenstorrent       │  │                             │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
│                                                             │
│  ❌ NO "Recent Tailored Resumes" section                    │
│                                                             │
│                        [Analyze Match →]                    │
└─────────────────────────────────────────────────────────────┘
       │
       │ Navigate to Step 2
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Review Match Analysis                              │
│  /tailor/analyze?resume_id=X&job_listing_id=Y               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ATS Progress Stepper                                │    │
│  │                                                     │    │
│  │ [✓] Stage 1: Structure Analysis         0.8s        │    │
│  │ [✓] Stage 2: Keyword Matching           1.2s        │    │
│  │ [✓] Stage 3: Content Quality            0.9s        │    │
│  │ [✓] Stage 4: Role Proximity             1.1s        │    │
│  │ [✓] Stage 5: Final Score                0.3s        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Skills You Have (from your Vault)                   │    │
│  │ Select which to emphasize in your tailored resume:  │    │
│  │                                                     │    │
│  │ ☑ React         (used at Acme Corp, 2024)          │    │
│  │ ☑ TypeScript    (used in 3 projects)               │    │
│  │ ☐ GraphQL       (mentioned in Portfolio)           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Skills You Don't Have (not in Vault)                │    │
│  │ AI will NOT add these — you'd be lying:             │    │
│  │                                                     │    │
│  │ ⚠ Kubernetes    [+ Add to Vault]                   │    │
│  │ ⚠ AWS Lambda    [+ Add to Vault]                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Selected: 2 of 3 available skills                          │
│                                                             │
│                 [Generate Tailored Resume →]                │
└─────────────────────────────────────────────────────────────┘
       │
       │ POST /api/tailor → redirect to Step 3
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Tailored Resume Detail                             │
│  /tailor/[id]                                               │
│                                                             │
│  Software Engineer @ Tenstorrent — Mar 5                    │
│  ──────────────────────────────────────────────────────     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Score Dashboard                                     │    │
│  │ Match: 78%  |  Keywords: 65%  |  Skills: 8  |  +4   │    │
│  │                                                     │    │
│  │ Cached as of Mar 5 at 2:30 PM    [Re-analyze]       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌───────────────────────────────┐ ┌───────────────────┐    │
│  │ Main Content                  │ │ Version History   │    │
│  │ (Tailored Content Tab)        │ │ (Sidebar)         │    │
│  │                               │ │                   │    │
│  │ Skills Analysis               │ │ ▸ This Job (3)    │    │
│  │ Resume Sections               │ │   • Mar 5 - 78%   │    │
│  │                               │ │   • Mar 3 - 72%   │    │
│  │                               │ │   • Mar 1 - 65%   │    │
│  │                               │ │                   │    │
│  │ [Edit] [Download ▾] [Delete]  │ │ ▸ Other Jobs (7)  │    │
│  └───────────────────────────────┘ └───────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Decisions Finalized

### 1. Master Resume Designation

**Decision:** Library page with star/"Set as Master" badge UI

- Users set master directly in Resume Library (where they manage resumes)
- Visual indicator (star icon or filled badge) on library listing
- Tailor flow pre-selects master resume but allows switching
- Avoids silent assumptions that confuse users uploading second resume

**Implementation:**

- Add `is_master: boolean` to `resumes` table
- Unique partial index: `CREATE UNIQUE INDEX ON resumes (owner_id) WHERE is_master = true`
- API: `PATCH /api/resumes/{id}/set-master` toggles designation

### 2. Version History Scope

**Decision:** Show ALL versions, grouped by job

- Complete history for a resume organized by job title
- Sort versions within each job by date (newest first)
- Collapsible accordion UI: expand current job by default, others collapsed

**Implementation:**

- Frontend groups by `job_title + company_name` combination
- Backend filter: `GET /api/tailor?resume_id=X&job_listing_id=Y`

### 3. ATS Re-run Behavior

**Decision:** Allow manual re-run but cache results aggressively

- "Re-analyze" button on detail page action bar
- Default to cached results with "Cached as of {timestamp}" display
- Show "Outdated" badge if resume content changed since analysis
- Re-run streams new SSE analysis and updates scores in-place

**Implementation:**

- Cache key: `ats:{resume_content_hash[:16]}:{job_id}`
- TTL: 24 hours
- Store `content_hash_at_analysis` to detect staleness

### 4. ATS Error Handling

**Decision:** Skip to AI generation if ATS partially fails

- ATS is optional preview, not a blocker
- Show which stages completed with warning: "Some analysis stages didn't complete"
- User can still proceed to "Generate Tailored Resume"
- Display only successfully-completed stage results

**Implementation:**

- Track `completed_stages: string[]` in state
- Show warning banner instead of blocking progression

### 5. User-in-the-Loop Keyword Selection (Resume Integrity)

**Decision:** User must explicitly select which keywords to optimize for

**Problem:** If AI blindly fills in keyword gaps, users end up with resumes claiming skills they don't have — essentially lying.

**Solution:** Step 2 becomes interactive, not just a loading screen:

1. **Vault-backed skills** (user HAS but didn't include): Shown as checkboxes, user selects which to emphasize
2. **Non-vault skills** (user DOESN'T HAVE): Grayed out, cannot be selected, shown with "Add to Vault" option
3. **AI only optimizes for user-selected, verified skills**

**Backend Data (Already Available):**

```python
# From ATS enhanced keyword analysis
missing_available_in_vault: list[str]  # Safe to add - user has evidence
missing_not_in_vault: list[str]        # NOT safe - would be lying
```

**Implementation:**

- Add `focus_keywords: list[str] | None` to `TailorRequest` schema
- Frontend passes user's selected keywords to `/api/tailor`
- Tailoring service uses only selected keywords in AI prompt
- If `focus_keywords` is empty/None, AI uses all vault-backed keywords by default

---

## Implementation Phases

### Phase 1: Quick Wins

**Goal:** Immediate UX improvements without breaking existing flow

**Duration:** 1-2 days

#### Phase 1 Changes

1. **Human-Readable Version Names**
   - Backend: Add `formatted_name` property to TailoredResume model
   - Format: `{job_title} @ {company_name} — {created_at.strftime('%b %-d')}`
   - Example: "Software Engineer @ Tenstorrent — Mar 5"
   - Frontend: Update VersionHistoryPanel and detail page header

2. **Remove "Recent Tailored Resumes" from Selection Screen**
   - Delete lines 582-622 in `/tailor/page.tsx`
   - History moves to detail page sidebar (Phase 4)

3. **Add Master Resume Designation**
   - Backend: Add `is_master` boolean + unique partial index
   - Frontend: Add star button to library resume cards
   - API: New `PATCH /api/resumes/{id}/set-master` endpoint

#### Phase 1 Files to Create

```text
/backend/alembic/versions/20260305_0001_add_master_resume_flag.py
```

#### Phase 1 Files to Modify

```text
Backend:
  /backend/app/models/resume.py                    - Add is_master field
  /backend/app/api/routes/resumes.py               - Add set-master endpoint, return is_master
  /backend/app/schemas/resume.py                   - Add is_master to response schema
  /backend/app/models/tailored_resume.py           - Add formatted_name property
  /backend/app/api/routes/tailor.py                - Include formatted_name in responses

Frontend:
  /frontend/src/app/(protected)/tailor/page.tsx    - Remove recent history section
  /frontend/src/app/(protected)/tailor/[id]/page.tsx - Use formatted_name in header
  /frontend/src/app/(protected)/library/page.tsx   - Add "Set as Master" button
  /frontend/src/components/tailoring/VersionHistoryPanel.tsx - Display formatted names
  /frontend/src/lib/api/hooks.ts                   - Add useSetMasterResume mutation, update types
```

---

### Phase 2: ATS Stepper Component

**Goal:** Build self-contained ATS progress visualization component

**Duration:** 2-3 days

#### Phase 2 Features

- 5-stage vertical progress display with icons
- Real-time SSE connection to `/v1/ats/analyze-progressive`
- Stage states: pending (gray), running (blue spinner), complete (green check), error (red x)
- Elapsed time display per completed stage
- Stage-specific result summaries (e.g., "78% keyword coverage")
- Retry button on error
- Responsive: stacked on mobile, side labels on desktop

#### Phase 2 SSE Integration

```typescript
// useATSProgressStream.ts
interface ATSStageState {
  stage: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: ATSStageResult;
  error?: string;
  elapsed_ms?: number;
}

interface UseATSProgressResult {
  stages: ATSStageState[];
  compositeScore: ATSCompositeScore | null;
  isComplete: boolean;
  hasError: boolean;
  completedStages: number[];
  start: (resumeId: string, jobId: number) => void;
  retry: () => void;
  abort: () => void;
}
```

#### Phase 2 Files to Create

```text
/frontend/src/components/tailoring/ATSProgressStepper.tsx   - Main stepper component
/frontend/src/components/tailoring/ATSStageCard.tsx         - Individual stage card
/frontend/src/hooks/useATSProgressStream.ts                 - SSE stream hook with state management
```

#### Phase 2 Files to Modify

```text
/frontend/src/lib/api/hooks.ts    - Add ATS types: ATSStageResult, ATSCompositeScore
```

---

### Phase 3: Analysis Page (Step 2) + Backend API Update

**Goal:** Create interactive analysis step with user-in-the-loop keyword selection

**Duration:** 3-4 days

**Route:** `/tailor/analyze?resume_id=X&job_listing_id=Y`

#### Phase 3 Features

- Job context card (reuse from Step 1)
- Selected resume summary card
- ATS Progress Stepper (from Phase 2)
- **Interactive Keyword Selection UI** (core feature):
  - "Skills You Have" section: checkboxes for vault-backed keywords
  - "Skills You Don't Have" section: grayed out with "Add to Vault" links
  - Selection counter: "Selected: 2 of 3 available skills"
- CTA: "Generate Tailored Resume →" (triggers `/api/tailor` POST with selected keywords)
- Loading overlay during AI generation
- Back button to Step 1
- Error handling with retry

#### Phase 3 Backend API Change

**Modified TailorRequest Schema:**

```python
# /backend/app/schemas/tailor.py
class TailorRequest(BaseModel):
    resume_id: str
    job_id: int | None = None
    job_listing_id: int | None = None
    focus_keywords: list[str] | None = None  # NEW: User-selected keywords to emphasize

    @model_validator(mode="after")
    def validate_job_source(self) -> "TailorRequest":
        # Existing validation: exactly one job source
        ...
```

**Tailoring Service Update:**

```python
# /backend/app/services/resume/tailor.py
async def tailor(..., focus_keywords: list[str] | None = None) -> TailoringResult:
    # If focus_keywords provided, AI prompt includes:
    # "Emphasize these skills the user has verified: {focus_keywords}"
    # "Do NOT add skills not in this list"
```

#### Phase 3 Navigation Flow

```typescript
// Step 1: User clicks "Analyze Match"
router.push(`/tailor/analyze?resume_id=${selectedResumeId}&job_listing_id=${jobListingId}`);

// Step 2: After ATS completes and user selects keywords
const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

// User clicks "Generate Tailored Resume"
const { mutateAsync: tailorResume } = useTailorResume();
const result = await tailorResume({
  resume_id,
  job_listing_id,
  focus_keywords: selectedKeywords,  // NEW: Pass user's selection
});
router.push(`/tailor/${result.id}`);
```

#### Phase 3 Files to Create

```text
/frontend/src/app/(protected)/tailor/analyze/page.tsx           - Analysis step page
/frontend/src/components/tailoring/KeywordSelectionPanel.tsx    - Interactive keyword selection UI
/frontend/src/components/tailoring/VaultBackedSkillItem.tsx     - Checkbox item for vault skills
/frontend/src/components/tailoring/MissingSkillItem.tsx         - Grayed item with "Add to Vault"
/frontend/src/components/tailoring/SelectedResumeCard.tsx       - Compact resume preview
```

#### Phase 3 Files to Modify

```text
Frontend:
  /frontend/src/app/(protected)/tailor/page.tsx   - Change CTA to navigate to /analyze
  /frontend/src/lib/api/hooks.ts                  - Update useTailorResume to accept focus_keywords

Backend:
  /backend/app/schemas/tailor.py                  - Add focus_keywords to TailorRequest
  /backend/app/api/routes/tailor.py               - Pass focus_keywords to service
  /backend/app/services/resume/tailor.py          - Use focus_keywords in AI prompt
```

---

### Phase 4: Detail Page Refactor (Step 3)

**Goal:** Clean up detail page with proper data gating, version history, and re-analysis

**Duration:** 2-3 days

#### Phase 4 Score Rendering Logic

- **Gate display:** Only show scores when all ATS stages complete
- **Loading state:** Skeleton cards while data processing
- **Consistency check:** Never show 0% keyword coverage with non-zero match score
- **Cache info:** "Cached as of Mar 5 at 2:30 PM" timestamp
- **Staleness indicator:** "Outdated" badge if resume content changed

#### Phase 4 Version History Sidebar

- Collapsible sidebar on right (desktop) / bottom sheet (mobile)
- Toggle button in action bar
- Group versions by job (accordion style)
- Current job expanded by default
- Each version shows: date, match score, status badge
- Click to navigate to that version

#### Phase 4 Re-Analysis Feature

- "Re-analyze" button in action bar
- Opens modal with ATSProgressStepper
- Streams new analysis
- Updates scores in-place when complete
- Respects cache (shows cached by default)

#### Phase 4 Files to Create

```text
/frontend/src/components/tailoring/VersionHistorySidebar.tsx  - Sidebar wrapper with toggle
/frontend/src/components/tailoring/ScoreLoadingState.tsx      - Loading skeleton for scores
/frontend/src/components/tailoring/ScoreCacheInfo.tsx         - Cache timestamp + outdated badge
/frontend/src/components/tailoring/ATSReanalyzeModal.tsx      - Modal with stepper for re-analysis
```

#### Phase 4 Files to Modify

```text
/frontend/src/app/(protected)/tailor/[id]/page.tsx            - Major refactor
/frontend/src/components/tailoring/VersionHistoryPanel.tsx    - Add job grouping, filtering
/frontend/src/lib/api/hooks.ts                                - Add useATSReanalyze, job-scoped queries
```

---

### Phase 5: Backend Enhancements

**Goal:** Add ATS caching and improve data consistency

**Duration:** 2 days

#### Phase 5 ATS Result Caching

```python
# Cache key structure
key = f"ats:{resume_content_hash[:16]}:{job_id}"

# Cached data
{
    "composite_score": { "final_score": 78, "stage_breakdown": {...} },
    "stage_results": { "structure": {...}, "keywords": {...}, ... },
    "cached_at": "2026-03-05T14:30:00Z",
    "resume_content_hash": "abc123..."
}

# TTL: 24 hours
```

#### Phase 5 Cache-Aware Analysis Endpoint

```python
@router.post("/v1/ats/analyze-progressive")
async def analyze_progressive(request: ATSRequest):
    cache_key = f"ats:{hash_content(request.resume_content)[:16]}:{request.job_id}"

    cached = await cache.get(cache_key)
    if cached:
        # Stream cached results as SSE (fast playback)
        yield SSEEvent("cache_hit", cached)
        return

    # Run full analysis with SSE streaming
    async for event in run_progressive_analysis(request):
        yield event

    # Cache complete results
    if all_stages_completed:
        await cache.set(cache_key, results, ttl=86400)
```

#### Phase 5 Staleness Detection

- Store `resume_content_hash` with each tailored resume
- On GET `/api/tailor/{id}`, compare current resume hash with stored hash
- Return `is_outdated: boolean` in response

#### Phase 5 Files to Modify

```text
/backend/app/services/core/cache.py       - Add ATS cache methods
/backend/app/api/routes/ats.py            - Add cache lookup before analysis
/backend/app/api/routes/tailor.py         - Add is_outdated, cached_at to responses
/backend/app/schemas/tailor.py            - Update response schema
```

---

### Phase 6: Testing & Polish

**Goal:** End-to-end testing, bug fixes, documentation

**Duration:** 1-2 days

#### Phase 6 Test Scenarios

1. **Happy Path:** Job Detail → Step 1 → Step 2 → Step 3 → Edit
2. **Error States:** API failures, SSE disconnects, partial ATS failures
3. **Edge Cases:** No resumes, no master resume, cache hits vs misses
4. **Version History:** Job grouping, comparison navigation
5. **Master Resume:** Set/unset, pre-selection in flow
6. **Performance:** ATS streaming latency, cache hit rate

#### Phase 6 Documentation Updates

```text
/docs/api/tailor-match.md                 - Document new 3-step flow
/docs/api/ats.md                          - Document caching behavior
/docs/architecture/system-architecture.md - Update tailor flow diagram
```

---

## Critical Files Inventory

### Files to Create (15 total)

| Phase | File | Purpose |
| ----- | ---- | ------- |
| 1 | `/backend/alembic/versions/20260305_0001_add_master_resume_flag.py` | Database migration |
| 2 | `/frontend/src/components/tailoring/ATSProgressStepper.tsx` | Main stepper component |
| 2 | `/frontend/src/components/tailoring/ATSStageCard.tsx` | Individual stage display |
| 2 | `/frontend/src/hooks/useATSProgressStream.ts` | SSE stream hook |
| 3 | `/frontend/src/app/(protected)/tailor/analyze/page.tsx` | Step 2 analysis page |
| 3 | `/frontend/src/components/tailoring/KeywordSelectionPanel.tsx` | Interactive keyword selection UI |
| 3 | `/frontend/src/components/tailoring/VaultBackedSkillItem.tsx` | Checkbox item for vault skills |
| 3 | `/frontend/src/components/tailoring/MissingSkillItem.tsx` | Grayed item with "Add to Vault" |
| 3 | `/frontend/src/components/tailoring/SelectedResumeCard.tsx` | Compact resume preview |
| 4 | `/frontend/src/components/tailoring/VersionHistorySidebar.tsx` | Sidebar wrapper |
| 4 | `/frontend/src/components/tailoring/ScoreLoadingState.tsx` | Loading skeleton |
| 4 | `/frontend/src/components/tailoring/ScoreCacheInfo.tsx` | Cache info display |
| 4 | `/frontend/src/components/tailoring/ATSReanalyzeModal.tsx` | Re-analysis modal |

### Files to Modify (20 total)

| Phase | File | Change Summary |
| ----- | ---- | -------------- |
| 1 | `/backend/app/models/resume.py` | Add `is_master` boolean field |
| 1 | `/backend/app/api/routes/resumes.py` | Add set-master endpoint |
| 1 | `/backend/app/schemas/resume.py` | Add `is_master` to response |
| 1 | `/backend/app/models/tailored_resume.py` | Add `formatted_name` property |
| 1 | `/backend/app/api/routes/tailor.py` | Include `formatted_name` in responses |
| 1 | `/frontend/src/app/(protected)/tailor/page.tsx` | Remove recent history section |
| 1 | `/frontend/src/app/(protected)/tailor/[id]/page.tsx` | Use formatted name in header |
| 1 | `/frontend/src/app/(protected)/library/page.tsx` | Add "Set as Master" button |
| 1 | `/frontend/src/components/tailoring/VersionHistoryPanel.tsx` | Display formatted names |
| 1 | `/frontend/src/lib/api/hooks.ts` | Add `useSetMasterResume` mutation |
| 3 | `/frontend/src/app/(protected)/tailor/page.tsx` | Update CTA navigation |
| 3 | `/frontend/src/lib/api/hooks.ts` | Update `useTailorResume` to accept `focus_keywords` |
| 3 | `/backend/app/schemas/tailor.py` | Add `focus_keywords` to TailorRequest |
| 3 | `/backend/app/api/routes/tailor.py` | Pass `focus_keywords` to service |
| 3 | `/backend/app/services/resume/tailor.py` | Use `focus_keywords` in AI prompt |
| 4 | `/frontend/src/app/(protected)/tailor/[id]/page.tsx` | Major refactor (scores, sidebar) |
| 4 | `/frontend/src/components/tailoring/VersionHistoryPanel.tsx` | Add job grouping |
| 4 | `/frontend/src/lib/api/hooks.ts` | Add `useATSReanalyze` hook |
| 5 | `/backend/app/services/core/cache.py` | Add ATS cache methods |
| 5 | `/backend/app/api/routes/ats.py` | Add cache lookup |

---

## Schema Changes

### PostgreSQL Migration

```sql
-- Migration: 20260305_0001_add_master_resume_flag

-- Add is_master column
ALTER TABLE resumes
ADD COLUMN is_master BOOLEAN NOT NULL DEFAULT false;

-- Create unique partial index (only one master per user)
CREATE UNIQUE INDEX ix_resumes_master_per_user
ON resumes (owner_id)
WHERE is_master = true;

-- Set most recent resume as master for existing users
WITH ranked_resumes AS (
  SELECT id, owner_id,
         ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at DESC) as rn
  FROM resumes
)
UPDATE resumes
SET is_master = true
WHERE id IN (SELECT id FROM ranked_resumes WHERE rn = 1);

COMMENT ON COLUMN resumes.is_master IS 'Designates default resume for tailoring flows';
```

### MongoDB Changes

No schema changes required - existing structure supports new flow.

---

## API Changes

### New Endpoint

```text
PATCH /api/resumes/{id}/set-master

Sets the specified resume as the master resume for the current user.
Automatically unsets any previous master.

Response: ResumeResponse (with is_master: true)
```

### Modified Request Schemas

```typescript
// TailorRequest - add focus_keywords (Phase 3)
interface TailorRequest {
  resume_id: string;
  job_id?: number;
  job_listing_id?: number;
  focus_keywords?: string[];  // NEW: User-selected keywords to emphasize
}
```

**Behavior:**

- If `focus_keywords` is provided: AI only emphasizes these specific skills
- If `focus_keywords` is `null`/`undefined`: AI uses all vault-backed keywords by default
- AI prompt is updated to explicitly NOT add skills outside the focus list

### Modified Response Schemas

```typescript
// ResumeResponse - add field
interface ResumeResponse {
  // ... existing fields ...
  is_master: boolean;  // NEW
}

// TailoredResumeResponse - add fields
interface TailoredResumeResponse {
  // ... existing fields ...
  formatted_name: string;      // NEW: "Software Engineer @ Tenstorrent — Mar 5"
  cached_at: string | null;    // NEW: ISO timestamp of last ATS analysis
  is_outdated: boolean;        // NEW: true if resume changed since analysis
  focus_keywords_used: string[] | null;  // NEW: Keywords that were used in tailoring
}
```

### Cache Behavior

```text
ATS Analysis Cache:
  Key: ats:{resume_content_hash[:16]}:{job_id}
  TTL: 24 hours

  On cache hit: Stream cached results as SSE events (fast playback)
  On cache miss: Run full 5-stage analysis with real-time streaming

  Invalidation: When resume content changes (detected via content hash)
```

---

## Risk Assessment

### High Risk

| Risk | Mitigation | Test Strategy |
| ---- | ---------- | ------------- |
| Breaking Phase 6 features (review, editor) | Preserve existing routes and handoff logic | E2E test: tailor → review → editor flow |
| SSE connection stability | Implement reconnect logic with exponential backoff | Simulate network interruptions |

### Medium Risk

| Risk | Mitigation | Test Strategy |
| ---- | ---------- | ------------- |
| Version history performance | Paginate if >50 versions; add DB index on job_listing_id | Load test with 100+ versions |
| Master resume race conditions | Unique partial index at DB level | Concurrent update test |

### Low Risk

| Risk | Mitigation | Test Strategy |
| ---- | ---------- | ------------- |
| ATS cache invalidation | Conservative 24h TTL; content hash comparison | Cache hit/miss scenarios |

---

## Success Metrics

### User Experience

- [ ] "Recent Tailored Resumes" removed from selection screen
- [ ] Human-readable version names (no UUIDs visible)
- [ ] No "0% Keyword Coverage" displayed with non-zero match score
- [ ] Progressive ATS visualization (not instant result)
- [ ] Master resume pre-selected in Step 1
- [ ] User explicitly selects keywords before AI generation (resume integrity)
- [ ] Non-vault skills clearly marked as "cannot add" (prevents lying)

### Technical

- [ ] ATS cache hit rate >70% after warmup period
- [ ] SSE stream completes without errors >95% of time
- [ ] No breaking changes to Phase 6 features
- [ ] All existing tests pass

### Performance

- [ ] Step 1 page load: <500ms
- [ ] Step 2 ATS analysis: 6-8 seconds (inherent latency)
- [ ] Step 3 page load: <800ms
- [ ] Cache hit response: <200ms

---

## Implementation Order

**Recommended sequence to minimize risk:**

1. **Phase 1 (Quick Wins)** - Safe, additive changes; no new pages
2. **Phase 2 (ATS Stepper)** - Self-contained component; test in isolation
3. **Phase 5 (Backend Caching)** - Backend-only; no frontend dependencies
4. **Phase 3 (Analysis Page)** - New page; wire up navigation
5. **Phase 4 (Detail Refactor)** - **Highest risk**; touch existing pages last
6. **Phase 6 (Testing)** - End-to-end validation

---

## Verification Plan

### After Each Phase

1. Run existing test suite (`bun test`, `pytest`)
2. Manual smoke test of affected flows
3. Check that Phase 6 features (review, editor) still work

### End-to-End Test Script

```bash
# 1. Create test user and resume
# 2. Add skills to user's Vault (for keyword selection test)
# 3. Navigate to job listing
# 4. Click "Optimize Resume for This Job"
# 5. Verify Step 1: Master resume pre-selected, no history section
# 6. Click "Analyze Match" → verify redirect to /tailor/analyze
# 7. Verify Step 2: ATS stepper progresses through 5 stages
# 8. Verify keyword selection panel appears:
#    - "Skills You Have" shows vault-backed skills as checkboxes
#    - "Skills You Don't Have" shows non-vault skills grayed out
# 9. Select/deselect some keywords, verify counter updates
# 10. Click "Generate Tailored Resume" → verify redirect to /tailor/{id}
# 11. Verify Step 3: Formatted name in header, scores displayed
# 12. Verify tailored resume only includes selected keywords (not lying)
# 13. Click "Edit" → verify handoff to editor page
# 14. Click "Re-analyze" → verify modal with stepper, scores update
```

---

## Next Steps

Create detailed phase-specific plans as implementation begins:

1. `050326_phase-1-quick-wins.md` - Migration SQL, API changes, frontend updates
2. `050326_phase-2-ats-stepper.md` - Component design, SSE protocol, state machine
3. `050326_phase-3-analysis-page.md` - Page layout, navigation flow, error handling
4. `050326_phase-4-detail-refactor.md` - Score gating logic, sidebar implementation
5. `050326_phase-5-backend-enhancements.md` - Cache implementation, staleness detection
6. `050326_phase-6-testing-polish.md` - Test scenarios, documentation updates

---

## End of Master Plan
