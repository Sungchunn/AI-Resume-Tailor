# Claude Code Prompt: Implement "Two Copies" Resume Tailoring Architecture

## Context

This is an AI Resume Tailor web application built with:

- **Backend**: FastAPI + Python, PostgreSQL (via SQLAlchemy + Alembic), Redis
- **Frontend**: Next.js 15 + React + TypeScript + Tailwind CSS
- **Existing patterns**: Pydantic BaseModels for data validation, service layer architecture, Docker orchestration

The application lets users upload resumes, paste job descriptions, and get AI-tailored resume versions. We are implementing **Option 2: "Two Copies"** — where the AI outputs a complete rewritten resume JSON object (not patches/diffs), and the frontend handles visual diffing and partial approvals by comparing the original and tailored documents.

---

## Architecture Overview

### Core Principle

The database stores **complete, immutable resume snapshots**. The AI always outputs a full resume object. The frontend maintains **three documents in state**: the read-only original, the read-only AI proposal, and a mutable active draft that the user builds up by accepting/rejecting individual changes. The backend only ever receives and validates complete documents.

### Data Flow

```text
1. User uploads resume → parsed into structured JSON → stored as "original"
2. User selects a job description → AI generates a complete tailored resume JSON
3. Backend validates the AI output against the same Pydantic schema → stores as "tailored" copy
4. Frontend fetches both original + tailored
5. Frontend initializes active_draft as a deep clone of original
6. Frontend diffs original vs tailored section-by-section, renders diff UI
7. User clicks "Accept" on a section → active_draft[section] = tailored[section]
8. User clicks "Reject" on a section → active_draft[section] = original[section] (restore)
9. User clicks "Finalize" → frontend POSTs active_draft → backend validates and stores
```

### The Three-State Model

```text
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ original_resume  │   │ ai_proposed      │   │ active_draft     │
│ (read-only)      │   │ (read-only)      │   │ (mutable)        │
│                  │   │                  │   │                  │
│ Source of truth   │   │ AI's suggestion  │   │ What the user    │
│ for "Reject"     │   │ for "Accept"     │   │ is building      │
│ operations       │   │ operations       │   │                  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
       │                       │                      ▲
       │    on "Reject"        │    on "Accept"       │
       └───────────────────────┴──────────────────────┘
                    direct field overwrite
```

---

## Part 1: Database & Backend

### 1.1 New Database Table (Alembic Migration)

Create a `tailored_resumes` table (or extend the existing one if it already exists). The key design: each tailored resume is a **full snapshot** linked to both the original resume and the job listing.

```sql
CREATE TABLE tailored_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    original_resume_id UUID NOT NULL REFERENCES resumes(id),
    job_listing_id UUID REFERENCES job_listings(id),
    
    -- The complete tailored resume as JSONB (same schema as original)
    tailored_data JSONB NOT NULL,
    
    -- The user's final approved version (assembled from partial approvals)
    -- NULL until the user finalizes
    finalized_data JSONB,
    
    -- Track approval state
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | finalized | archived
    
    -- Metadata
    ai_model VARCHAR(100),          -- which model generated this
    job_title VARCHAR(255),         -- denormalized for quick display
    company_name VARCHAR(255),      -- denormalized for quick display
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    finalized_at TIMESTAMPTZ
);

CREATE INDEX idx_tailored_resumes_user ON tailored_resumes(user_id);
CREATE INDEX idx_tailored_resumes_original ON tailored_resumes(original_resume_id);
CREATE INDEX idx_tailored_resumes_status ON tailored_resumes(status);
```

**Important**: Check if a `tailored_resumes` table already exists in the codebase. If so, adapt this migration to add the missing columns (`finalized_data`, `status`, etc.) rather than creating a new table. Follow the existing Alembic migration patterns in the project.

### 1.2 Pydantic Models

The tailored resume MUST use the exact same Pydantic schema as the original resume. This is critical — it means the AI output, the original, and the finalized version are all validated identically.

```python
# schemas/tailored_resume.py

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from enum import Enum

class TailoredResumeStatus(str, Enum):
    PENDING = "pending"
    FINALIZED = "finalized"
    ARCHIVED = "archived"

class TailoredResumeCreate(BaseModel):
    original_resume_id: UUID
    job_listing_id: UUID | None = None
    tailored_data: dict  # Validated against ResumeDocument schema before storage
    ai_model: str | None = None
    job_title: str | None = None
    company_name: str | None = None

class TailoredResumeFinalize(BaseModel):
    """The merged document the frontend sends after partial approval."""
    finalized_data: dict  # Validated against ResumeDocument schema

class TailoredResumeResponse(BaseModel):
    id: UUID
    original_resume_id: UUID
    job_listing_id: UUID | None
    tailored_data: dict
    finalized_data: dict | None
    status: TailoredResumeStatus
    ai_model: str | None
    job_title: str | None
    company_name: str | None
    created_at: datetime
    updated_at: datetime
    finalized_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
```

**Important**: Check the existing resume Pydantic models (likely in `schemas/` or `models/`). The `tailored_data` and `finalized_data` fields should be validated against the SAME ResumeDocument model used for original resumes. Reuse, don't duplicate.

### 1.3 API Endpoints

Follow the existing router/service patterns in the project.

```text
POST   /api/v1/tailored-resumes/generate
       - Input: { original_resume_id, job_listing_id }
       - Calls AI service to generate tailored resume
       - Validates AI output against ResumeDocument schema
       - Stores in tailored_resumes table
       - Returns: TailoredResumeResponse

GET    /api/v1/tailored-resumes/{id}
       - Returns both tailored_data and original resume data (via join or separate query)
       - Frontend needs BOTH to do the diff

GET    /api/v1/tailored-resumes/{id}/compare
       - Returns: { original: ResumeDocument, tailored: ResumeDocument }
       - This is the endpoint the diff UI calls

POST   /api/v1/tailored-resumes/{id}/finalize
       - Input: TailoredResumeFinalize (the merged document from frontend)
       - Validates finalized_data against ResumeDocument schema
       - Updates status to "finalized", sets finalized_at
       - Returns: TailoredResumeResponse

GET    /api/v1/tailored-resumes/
       - List all tailored resumes for the current user
       - Filterable by status, original_resume_id, job_listing_id
```

### 1.4 AI Service Integration

The AI service should:

1. Take the original resume JSON + job description text as input
2. Use a system prompt that instructs the LLM to output a COMPLETE resume JSON matching the exact schema
3. Parse and validate the output against the ResumeDocument Pydantic model
4. Return the validated object

```python
# Pseudocode for the AI tailoring service
async def generate_tailored_resume(
    original_resume: ResumeDocument,
    job_description: str,
) -> ResumeDocument:
    prompt = f"""
    You are a resume tailoring expert. Given the original resume and job description,
    output a COMPLETE tailored resume as a JSON object matching this exact schema:
    {ResumeDocument.model_json_schema()}
    
    Rules:
    - Output the ENTIRE resume, not just changed sections
    - Keep all fields that don't need changing identical to the original
    - Tailor summary, experience bullets, and skills to match the job description
    - Do NOT invent experience or credentials that don't exist in the original
    - Preserve all IDs from the original (section IDs, bullet IDs, etc.)
    
    Original Resume:
    {original_resume.model_dump_json()}
    
    Job Description:
    {job_description}
    """
    
    response = await call_llm(prompt)
    tailored = ResumeDocument.model_validate_json(response)
    return tailored
```

**Critical**: The prompt MUST instruct the LLM to preserve IDs. If the original resume has `experience[0].id = "exp-abc123"`, the tailored version must keep that same ID. This is what makes section-by-section diffing possible on the frontend — you match by ID, not by array index.

---

## Part 2: Frontend — Three-State Active Draft with Section-Level Diffing

This is the solution to the "Complex Partial Approvals" problem. Instead of a declarative approval map that assembles a document at finalization time, we maintain a **mutable active draft** that gets directly mutated as the user accepts or rejects changes. This is simpler, more aligned with the future drag-and-drop editor, and eliminates the need for a complex merge function.

### 2.1 Core Concept: Three Documents in State

The frontend holds three versions of the resume at all times:

```typescript
// types/tailoring.ts

interface TailoringSession {
  // READ-ONLY: The user's original resume, never mutated.
  // Used as the source for "Reject" operations (restoring original values).
  originalResume: ResumeDocument;

  // READ-ONLY: The AI's complete proposed resume, never mutated.
  // Used as the source for "Accept" operations.
  aiProposedResume: ResumeDocument;

  // MUTABLE: The working document the user is building.
  // Starts as a deep clone of originalResume.
  // Every "Accept" overwrites a field from aiProposedResume.
  // Every "Reject" overwrites a field from originalResume.
  // This is what gets POSTed to the backend on "Finalize".
  activeDraft: ResumeDocument;

  // Tracks which sections/bullets have been modified from original.
  // Used for UI state (highlight accepted sections, enable "Reject" button).
  // Simple Set — not a full approval map.
  acceptedChanges: Set<string>;  // e.g., "summary", "exp-section-1", "exp-section-1.bullet-5"
}
```

**Why `acceptedChanges` as a Set?** You need to know which sections the user has accepted so the UI can: (a) visually indicate accepted vs. pending sections, (b) enable the "Reject" button only on sections that have been accepted, and (c) power "Accept All" / "Reject All" buttons. A `Set<string>` is the lightest-weight way to track this — no complex state shape, just add/delete string keys.

### 2.2 Initialization

When the compare endpoint returns both documents:

```typescript
// hooks/useTailoringSession.ts

function initializeTailoringSession(
  original: ResumeDocument,
  aiProposed: ResumeDocument,
): TailoringSession {
  return {
    originalResume: Object.freeze(original),       // Freeze to prevent accidental mutation
    aiProposedResume: Object.freeze(aiProposed),   // Freeze to prevent accidental mutation
    activeDraft: structuredClone(original),         // Deep clone — this is what we mutate
    acceptedChanges: new Set(),
  };
}
```

### 2.3 Accept and Reject Operations

These are simple overwrites — no merge logic, no assembly function.

```typescript
// utils/draftOperations.ts

// --- Section-level operations ---

function acceptSection(
  session: TailoringSession,
  sectionId: string,
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);

  // Handle top-level fields
  if (sectionId === "summary") {
    draft.summary = session.aiProposedResume.summary;
    accepted.add("summary");
    return { ...session, activeDraft: draft, acceptedChanges: accepted };
  }

  if (sectionId === "personal_info") {
    draft.personal_info = structuredClone(session.aiProposedResume.personal_info);
    accepted.add("personal_info");
    return { ...session, activeDraft: draft, acceptedChanges: accepted };
  }

  // Handle sections array — find by ID, wholesale replace
  const aiSection = session.aiProposedResume.sections.find(s => s.id === sectionId);
  const draftIndex = draft.sections.findIndex(s => s.id === sectionId);

  if (aiSection && draftIndex !== -1) {
    draft.sections[draftIndex] = structuredClone(aiSection);
    accepted.add(sectionId);

    // Also mark all bullets within this section as accepted
    // (so individual bullet rejects still work after a section-level accept)
    if (aiSection.items) {
      for (const item of aiSection.items) {
        if (item.bullets) {
          for (const bullet of item.bullets) {
            accepted.add(`${sectionId}.${item.id}.${bullet.id}`);
          }
        }
      }
    }
  }

  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

function rejectSection(
  session: TailoringSession,
  sectionId: string,
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);

  // Restore from original
  if (sectionId === "summary") {
    draft.summary = session.originalResume.summary;
    accepted.delete("summary");
    return { ...session, activeDraft: draft, acceptedChanges: accepted };
  }

  if (sectionId === "personal_info") {
    draft.personal_info = structuredClone(session.originalResume.personal_info);
    accepted.delete("personal_info");
    return { ...session, activeDraft: draft, acceptedChanges: accepted };
  }

  const originalSection = session.originalResume.sections.find(s => s.id === sectionId);
  const draftIndex = draft.sections.findIndex(s => s.id === sectionId);

  if (originalSection && draftIndex !== -1) {
    draft.sections[draftIndex] = structuredClone(originalSection);
    accepted.delete(sectionId);

    // Remove all bullet-level acceptances within this section
    for (const key of accepted) {
      if (key.startsWith(`${sectionId}.`)) {
        accepted.delete(key);
      }
    }
  }

  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

// --- Bullet-level operations (granular control within a section) ---

function acceptBullet(
  session: TailoringSession,
  sectionId: string,
  itemId: string,
  bulletId: string,
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);
  const bulletKey = `${sectionId}.${itemId}.${bulletId}`;

  // Find the specific bullet in the AI proposal
  const aiSection = session.aiProposedResume.sections.find(s => s.id === sectionId);
  const aiItem = aiSection?.items?.find(i => i.id === itemId);
  const aiBullet = aiItem?.bullets?.find(b => b.id === bulletId);

  if (!aiBullet) return session;

  // Find the corresponding location in the draft
  const draftSection = draft.sections.find(s => s.id === sectionId);
  const draftItem = draftSection?.items?.find(i => i.id === itemId);

  if (!draftItem) return session;

  // Check if this bullet exists in the draft (original had it)
  const draftBulletIndex = draftItem.bullets?.findIndex(b => b.id === bulletId) ?? -1;

  if (draftBulletIndex !== -1) {
    // Replace existing bullet
    draftItem.bullets[draftBulletIndex] = structuredClone(aiBullet);
  } else {
    // New bullet added by AI — append it
    if (!draftItem.bullets) draftItem.bullets = [];
    draftItem.bullets.push(structuredClone(aiBullet));
  }

  accepted.add(bulletKey);
  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

function rejectBullet(
  session: TailoringSession,
  sectionId: string,
  itemId: string,
  bulletId: string,
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);
  const bulletKey = `${sectionId}.${itemId}.${bulletId}`;

  // Find the original bullet
  const originalSection = session.originalResume.sections.find(s => s.id === sectionId);
  const originalItem = originalSection?.items?.find(i => i.id === itemId);
  const originalBullet = originalItem?.bullets?.find(b => b.id === bulletId);

  const draftSection = draft.sections.find(s => s.id === sectionId);
  const draftItem = draftSection?.items?.find(i => i.id === itemId);

  if (!draftItem) return session;

  if (originalBullet) {
    // Bullet existed in original — restore it
    const draftBulletIndex = draftItem.bullets?.findIndex(b => b.id === bulletId) ?? -1;
    if (draftBulletIndex !== -1) {
      draftItem.bullets[draftBulletIndex] = structuredClone(originalBullet);
    }
  } else {
    // Bullet was added by AI and doesn't exist in original — remove it from draft
    draftItem.bullets = draftItem.bullets?.filter(b => b.id !== bulletId) ?? [];
  }

  accepted.delete(bulletKey);
  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

// --- Bulk operations ---

function acceptAll(session: TailoringSession, diffs: SectionDiff[]): TailoringSession {
  let updated = session;
  for (const diff of diffs) {
    if (diff.hasChanges) {
      updated = acceptSection(updated, diff.sectionId);
    }
  }
  return updated;
}

function rejectAll(session: TailoringSession): TailoringSession {
  return {
    ...session,
    activeDraft: structuredClone(session.originalResume),
    acceptedChanges: new Set(),
  };
}
```

**Key design choice**: Each operation does a `structuredClone` of the draft before mutating. This ensures React detects state changes (reference inequality) and re-renders. It also means every state update is a new snapshot, which sets you up for undo/redo later — you just keep an array of past `activeDraft` snapshots.

### 2.4 Diff Detection

The diff utility compares original vs. AI proposal to determine what changed. This is computed once on load and is read-only — it drives the UI rendering, not the state mutations.

```typescript
// utils/resumeDiff.ts

interface SectionDiff {
  sectionId: string;
  sectionType: string;
  hasChanges: boolean;

  // For sections with items (experience, projects, education)
  itemDiffs?: {
    itemId: string;
    hasChanges: boolean;
    changedFields: string[];  // e.g., ["title", "bullets"]
    bulletDiffs?: {
      bulletId: string;
      originalText: string;
      tailoredText: string;
      isNew: boolean;      // bullet exists only in AI proposal
      isRemoved: boolean;  // bullet exists only in original
    }[];
  }[];

  // For simple sections (summary, skills)
  originalValue?: any;
  tailoredValue?: any;
}

function computeDiff(
  original: ResumeDocument,
  aiProposed: ResumeDocument,
): SectionDiff[] {
  const diffs: SectionDiff[] = [];

  // Compare summary
  if (original.summary !== aiProposed.summary) {
    diffs.push({
      sectionId: "summary",
      sectionType: "summary",
      hasChanges: true,
      originalValue: original.summary,
      tailoredValue: aiProposed.summary,
    });
  }

  // Compare each section by matching on section ID
  for (const aiSection of aiProposed.sections) {
    const originalSection = original.sections.find(s => s.id === aiSection.id);

    if (!originalSection) {
      // New section added by AI
      diffs.push({
        sectionId: aiSection.id,
        sectionType: aiSection.type,
        hasChanges: true,
        tailoredValue: aiSection,
      });
      continue;
    }

    // Deep compare items within the section
    // Match items by ID, then compare fields
    // For experience/project items, compare bullets by ID
    // Build itemDiffs array with bulletDiffs for each changed item
    // ... (implement deep comparison logic matching your ResumeDocument schema)
  }

  // Check for sections removed by AI (exist in original but not in aiProposed)
  for (const originalSection of original.sections) {
    const existsInAi = aiProposed.sections.some(s => s.id === originalSection.id);
    if (!existsInAi) {
      diffs.push({
        sectionId: originalSection.id,
        sectionType: originalSection.type,
        hasChanges: true,
        originalValue: originalSection,
      });
    }
  }

  return diffs;
}
```

**Key principle**: Always match by ID, never by array position. The AI might reorder items, and index-based matching would produce incorrect diffs.

### 2.5 Diff Review UI Component

```typescript
// components/tailoring/DiffReviewPanel.tsx

// Each section component receives the relevant chunk of BOTH the original
// and AI proposal, plus whether it's been accepted in the active draft.

// UI structure:
// ┌─────────────────────────────────────────────────────────┐
// │ Summary                         [Accept ✓] [Reject ✗]   │
// │ ┌─ Original ──────────────────────────────────────────┐ │
// │ │ "Experienced software engineer..."                  │ │
// │ └───────────────────────────────────────────-─────────┘ │
// │ ┌─ AI Proposed (highlighted word-level changes) ─────-┐ │
// │ │ "Full-stack developer with..."                      │ │
// │ └───────────────────────────────────────────────────-─┘ │
// ├─────────────────────────────────────────────────────────┤
// │ Experience — FitSloth             [Accept All] [Reject] │
// │   • Bullet 1 (changed)           [Accept ✓] [Reject ✗]  │
// │   • Bullet 2 (unchanged)         ── no action ──        │
// │   • Bullet 3 (changed)           [Accept ✓] [Reject ✗]  │
// │   • Bullet 4 (NEW — AI added)    [Accept ✓] [Dismiss]   │
// ├─────────────────────────────────────────────────────────┤
// │ Skills                            [Accept ✓] [Reject ✗] │
// │ ┌─ Changes ──────────────────────────────────────────┐  │
// │ │ Added: "FastAPI", "Pydantic"                       │  │
// │ │ Removed: "Express.js"                              │  │
// │ └────────────────────────────────────────────────────┘  │
// ├─────────────────────────────────────────────────────────┤
// │ Education (no changes)            ── unchanged ──       │
// └─────────────────────────────────────────────────────────┘
//
//     [ Accept All ]  [ Reject All ]  [ Finalize → ]

interface DiffReviewPanelProps {
  session: TailoringSession;
  diffs: SectionDiff[];
  onAcceptSection: (sectionId: string) => void;
  onRejectSection: (sectionId: string) => void;
  onAcceptBullet: (sectionId: string, itemId: string, bulletId: string) => void;
  onRejectBullet: (sectionId: string, itemId: string, bulletId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onFinalize: () => void;
}

// Each section renders:
// 1. Visual diff (original vs AI proposed) using jsdiff for text highlighting
// 2. Accept/Reject buttons
// 3. Visual indicator of current state (accepted = green border, pending = neutral)
//
// The `acceptedChanges` Set from the session determines button states:
// - If sectionId is in acceptedChanges → show "Reject" as primary action
// - If sectionId is NOT in acceptedChanges → show "Accept" as primary action
// - Unchanged sections get no buttons, just a "no changes" label
```

### 2.6 Text Diffing Library

For highlighting specific word-level changes within a text field (e.g., showing exactly which words changed in a summary or bullet):

```bash
bun add diff
```

```typescript
// utils/textDiff.ts
import { diffWords } from 'diff';

function getWordDiff(original: string, tailored: string) {
  return diffWords(original, tailored);
  // Returns array of { value: string, added?: boolean, removed?: boolean }
  // Render: green background for added, red strikethrough for removed, plain for unchanged
}
```

### 2.7 State Management

Use whatever state management pattern the project already uses. If no library exists, a custom hook with `useState` is enough since the operation functions are pure:

```typescript
// hooks/useTailoringSession.ts

import { useState, useMemo, useCallback } from 'react';

function useTailoringSession(original: ResumeDocument, aiProposed: ResumeDocument) {
  const [session, setSession] = useState<TailoringSession>(() =>
    initializeTailoringSession(original, aiProposed)
  );

  // Compute diffs once (original vs AI — these don't change)
  const diffs = useMemo(
    () => computeDiff(original, aiProposed),
    [original, aiProposed]
  );

  // Track modification status from original for the "changed" indicator
  const modifiedSections = useMemo(() => session.acceptedChanges, [session.acceptedChanges]);

  // --- Undo support (simple history stack) ---
  const [history, setHistory] = useState<ResumeDocument[]>([]);

  const pushHistory = useCallback((currentDraft: ResumeDocument) => {
    setHistory(prev => [...prev, structuredClone(currentDraft)]);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setSession(prev => ({ ...prev, activeDraft: previous }));
  }, [history]);

  // --- Operations (each pushes current state to history before mutating) ---

  const handleAcceptSection = useCallback((sectionId: string) => {
    setSession(prev => {
      pushHistory(prev.activeDraft);
      return acceptSection(prev, sectionId);
    });
  }, [pushHistory]);

  const handleRejectSection = useCallback((sectionId: string) => {
    setSession(prev => {
      pushHistory(prev.activeDraft);
      return rejectSection(prev, sectionId);
    });
  }, [pushHistory]);

  const handleAcceptBullet = useCallback((sectionId: string, itemId: string, bulletId: string) => {
    setSession(prev => {
      pushHistory(prev.activeDraft);
      return acceptBullet(prev, sectionId, itemId, bulletId);
    });
  }, [pushHistory]);

  const handleRejectBullet = useCallback((sectionId: string, itemId: string, bulletId: string) => {
    setSession(prev => {
      pushHistory(prev.activeDraft);
      return rejectBullet(prev, sectionId, itemId, bulletId);
    });
  }, [pushHistory]);

  const handleAcceptAll = useCallback(() => {
    setSession(prev => {
      pushHistory(prev.activeDraft);
      return acceptAll(prev, diffs);
    });
  }, [diffs, pushHistory]);

  const handleRejectAll = useCallback(() => {
    setSession(prev => {
      pushHistory(prev.activeDraft);
      return rejectAll(prev);
    });
  }, [pushHistory]);

  // Finalize: POST active_draft to backend
  const finalize = useCallback(async () => {
    const response = await fetch(`/api/v1/tailored-resumes/${session.id}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalized_data: session.activeDraft }),
    });
    return response.json();
  }, [session]);

  return {
    session,
    diffs,
    modifiedSections,
    canUndo: history.length > 0,
    undo,
    onAcceptSection: handleAcceptSection,
    onRejectSection: handleRejectSection,
    onAcceptBullet: handleAcceptBullet,
    onRejectBullet: handleRejectBullet,
    onAcceptAll: handleAcceptAll,
    onRejectAll: handleRejectAll,
    onFinalize: finalize,
  };
}
```

**Why undo is built in from day one**: Since each operation clones the draft before mutating, we get a free history stack by just saving the previous draft. This directly addresses the long-term tradeoff we identified — the active draft approach needs undo support, and by baking it into the hook from the start, every future mutation source (drag-and-drop reorder, manual text edits, AI re-generation) automatically gets undo for free.

### 2.8 How This Connects to the Future Editor

The `activeDraft` in this tailoring session IS the same document your drag-and-drop editor will operate on. When the user finishes reviewing AI suggestions and moves to the editor view, you hand off `activeDraft` as the editor's initial state. The editor then applies its own mutations (reorder sections, edit text inline, adjust formatting) to that same object. The undo history carries over.

This means the tailoring review UI and the resume editor are not two separate systems — they're two views of the same mutable document, which keeps your architecture unified as the app grows.

---

## Part 3: Implementation Order

### Phase 1 — Backend Foundation

1. Alembic migration for `tailored_resumes` table
2. Pydantic schemas for tailored resume CRUD
3. SQLAlchemy model for `tailored_resumes`
4. Repository layer for tailored resume CRUD
5. Service layer with validation (validate against ResumeDocument schema)
6. API endpoints: generate, get, compare, finalize, list

### Phase 2 — AI Generation

1. AI service method that outputs complete tailored resume JSON
2. Structured output prompt with schema enforcement
3. Validation + retry logic (if AI output fails schema validation, retry once)
4. Store validated output in `tailored_resumes`

### Phase 3 — Frontend Three-State Foundation

1. TypeScript types for `TailoringSession`, `SectionDiff`
2. `computeDiff()` utility — compare original vs AI proposal
3. `initializeTailoringSession()` — sets up the three documents
4. `useTailoringSession` hook with undo history stack built in from day one
5. Section-level `acceptSection()` and `rejectSection()` operations
6. `acceptAll()` and `rejectAll()` bulk operations

### Phase 4 — Diff Review UI

1. `DiffReviewPanel` container component
2. Section-level diff cards with Accept/Reject buttons
3. Text-level diff highlighting using `jsdiff` (word-level green/red)
4. Visual indicators for accepted vs. pending sections
5. "Accept All" / "Reject All" / "Undo" buttons
6. "Finalize" button that POSTs `activeDraft` to backend

### Phase 5 — Bullet-Level Granularity

1. `acceptBullet()` and `rejectBullet()` operations
2. Per-bullet Accept/Reject toggles within experience/project items
3. Handle edge cases: new bullets added by AI, bullets removed by AI
4. Section-level accept/reject that cascades to bullet-level tracking

### Phase 6 — Editor Integration & Polish

1. Hand off `activeDraft` to the drag-and-drop resume editor as initial state
2. Undo history carries over from tailoring review into editor
3. Version history — list all tailored versions for a resume
4. Side-by-side preview (rendered resume view alongside diff view)
5. Loading states, error handling, optimistic updates

---

## Open Questions for Claude Code to Evaluate

1. **Does a `tailored_resumes` table already exist?** If so, what columns does it have? Adapt the migration accordingly.
2. **What does the existing ResumeDocument Pydantic model look like?** The tailored data must validate against the same schema. Find and reuse it.
3. **What AI service pattern exists?** Look for how the app currently calls the LLM. The tailoring endpoint should follow the same pattern.
4. **What state management does the frontend use?** Zustand, Redux, Context, or raw hooks? The `useTailoringSession` hook should integrate with the existing pattern rather than introducing a new one.
5. **How are IDs generated for resume sections/items/bullets?** The AI needs to preserve these. Check if UUIDs, sequential IDs, or something else. The entire diffing and accept/reject system depends on stable IDs.
6. **Is there an existing API pattern for file paths, auth middleware, error handling?** New endpoints must match.
7. **Does the frontend already have a resume rendering component?** The diff UI should reuse it, adding a highlight overlay for changes.
8. **Is there an existing editor state or document model?** The `activeDraft` from the tailoring session should be compatible with (or identical to) whatever the editor will use, so the handoff is seamless.
9. **What's the `structuredClone` support situation?** If targeting older browsers, may need a polyfill or use `JSON.parse(JSON.stringify())` instead. Check the Next.js browser target config.
