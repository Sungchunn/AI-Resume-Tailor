# Code Review Action Plan

**Created**: March 9, 2026
**Status**: Pending Implementation

Based on the code review findings from 45 commits (a779761 through 7028926), this plan addresses 9 issues across backend and frontend in 6 phases.

---

## Overview

| Phase | Scope | Risk | Description |
| ----- | ----- | ---- | ----------- |
| 1 | Backend | Medium | Add database index and fix race condition |
| 2 | Backend | Low | Fix import location and field name alignment |
| 3 | Frontend | Low | Add validation and error boundaries |
| 4 | Frontend | Low | Fix modal cleanup and ID regeneration |
| 5 | Frontend | Low | Optimize data fetching |
| 6 | All | Lowest | Verification and testing |

**Note**: Backend (1-2) and Frontend (3-5) phases can run in parallel.

---

## Phase 1: Database Index and Concurrency Fix

**Goal**: Add missing index and prevent race conditions in scraper request operations.

### Phase 1 Files to Modify

- `backend/alembic/versions/20260309_0001_add_scraper_requests.py`
- `backend/app/crud/scraper_request.py`

### Phase 1 Changes

**1.1 Add Index on `reviewed_at`**

Create new migration file `20260309_0002_add_reviewed_at_index.py`:

```python
"""Add index on reviewed_at for scraper_requests

Revision ID: auto-generated
"""

from alembic import op


def upgrade() -> None:
    op.create_index(
        "ix_scraper_requests_reviewed_at",
        "scraper_requests",
        ["reviewed_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_scraper_requests_reviewed_at", table_name="scraper_requests")
```

**1.2 Add Optimistic Locking to approve/reject**

In `backend/app/crud/scraper_request.py`, modify `approve()` method (lines 176-195):

```python
async def approve(
    self,
    db: AsyncSession,
    *,
    request_id: UUID,
    admin_id: UUID,
    admin_notes: str | None = None,
) -> ScraperRequest | None:
    # Use SELECT FOR UPDATE to prevent concurrent modifications
    stmt = (
        select(ScraperRequest)
        .where(ScraperRequest.id == request_id)
        .with_for_update()
    )
    result = await db.execute(stmt)
    request = result.scalar_one_or_none()

    if not request or request.status != RequestStatus.PENDING:
        return None

    request.status = RequestStatus.APPROVED
    request.reviewed_by = admin_id
    request.reviewed_at = datetime.utcnow()
    if admin_notes:
        request.admin_notes = admin_notes

    await db.commit()
    await db.refresh(request)
    return request
```

Apply same pattern to `reject()` method (lines 197-210).

### Phase 1 Verification

```bash
cd backend && poetry run alembic upgrade head
cd backend && poetry run pytest tests/
```

### Phase 1 Commit

```text
backend: add reviewed_at index and fix concurrent approve/reject race condition
```

---

## Phase 2: Backend Code Quality Fixes

**Goal**: Fix import location and align field names between parser and frontend.

### Phase 2 Files to Modify

- `backend/app/schemas/scraper.py`
- `backend/app/services/resume/parser.py`
- `backend/app/services/resume/tailor.py`

### Phase 2 Changes

**2.1 Move Import to Top of File**

In `backend/app/schemas/scraper.py`, move line 303:

```python
# Move this import from line 303 to the top with other imports
from app.models.scraper_request import RequestStatus
```

**2.2 Align Leadership Field Names**

In `backend/app/services/resume/parser.py`, update `Leadership` TypedDict:

```python
class Leadership(TypedDict):
    title: str  # Changed from 'role' to match frontend
    organization: str
    start_date: str
    end_date: str | None
    highlights: list[str]
```

Update parser prompt to use `title` instead of `role` for leadership entries.

In `backend/app/services/resume/tailor.py`, verify `LeadershipEntrySchema` uses `title` field.

### Phase 2 Verification

```bash
cd backend && poetry run pytest tests/
```

### Phase 2 Commit

```text
backend: fix import location and align leadership field names with frontend
```

---

## Phase 3: Frontend Validation and Error Handling

**Goal**: Add validation for admin rejection notes and error boundaries.

### Phase 3 Files to Modify

- `frontend/src/app/(protected)/admin/scraper/components/RequestQueue.tsx`
- `frontend/src/app/(protected)/tailor/editor/[id]/page.tsx`

### Phase 3 Changes

**3.1 Add Rejection Notes Validation**

In `RequestQueue.tsx`, add validation before calling reject API:

```tsx
const handleReject = async () => {
  if (!adminNotes.trim()) {
    // Show error - notes required for rejection
    setNotesError("Admin notes are required when rejecting a request");
    return;
  }
  // ... existing reject logic
};
```

**3.2 Add Error Boundary to Tailor Editor**

Create `frontend/src/components/errors/TailorEditorErrorBoundary.tsx`:

```tsx
"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TailorEditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Failed to load editor
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The resume content could not be displayed.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Wrap editor in `tailor/editor/[id]/page.tsx`:

```tsx
import { TailorEditorErrorBoundary } from "@/components/errors/TailorEditorErrorBoundary";

// In render:
<TailorEditorErrorBoundary>
  {/* existing editor content */}
</TailorEditorErrorBoundary>
```

### Phase 3 Commit

```text
frontend: add rejection validation and error boundary to tailor editor
```

---

## Phase 4: Frontend Modal and ID Fixes

**Goal**: Fix modal cleanup issues and prevent ID regeneration.

### Phase 4 Files to Modify

- `frontend/src/components/jobs/RequestJobsModal.tsx`
- `frontend/src/components/workshop/panels/sections/SectionEditorAdapter.tsx`

### Phase 4 Changes

**4.1 Fix Modal Scroll Lock Cleanup**

In `RequestJobsModal.tsx`, use a more robust cleanup approach:

```tsx
useEffect(() => {
  const originalOverflow = document.body.style.overflow;

  if (isOpen) {
    document.body.style.overflow = "hidden";
  }

  return () => {
    document.body.style.overflow = originalOverflow;
  };
}, [isOpen]);
```

**4.2 Fix ID Regeneration in SectionEditorAdapter**

In `SectionEditorAdapter.tsx`, persist generated IDs using a ref:

```tsx
// At component level, create a stable ID map
const idMapRef = useRef<Map<number, string>>(new Map());

// In transform functions, use stable IDs
const getStableId = (index: number, existingId?: string): string => {
  if (existingId) return existingId;
  if (!idMapRef.current.has(index)) {
    idMapRef.current.set(index, nanoid());
  }
  return idMapRef.current.get(index)!;
};
```

### Phase 4 Commit

```text
frontend: fix modal scroll cleanup and stabilize generated IDs
```

---

## Phase 5: Frontend Performance Optimization

**Goal**: Optimize data fetching in Library page.

### Phase 5 File to Modify

- `frontend/src/app/(protected)/library/page.tsx`

### Phase 5 Changes

Implement conditional data fetching based on active tab:

```tsx
// Only fetch data for active tab
const { data: resumes } = useQuery({
  queryKey: ["resumes"],
  queryFn: fetchResumes,
  enabled: activeTab === "resumes",
});

const { data: savedData } = useQuery({
  queryKey: ["saved-jobs"],
  queryFn: fetchSavedJobs,
  enabled: activeTab === "saved",
});

const { data: kanbanData } = useQuery({
  queryKey: ["kanban"],
  queryFn: fetchKanbanData,
  enabled: activeTab === "applied",
});
```

Or use lazy loading with tab content:

```tsx
{activeTab === "resumes" && <ResumesTab />}
{activeTab === "saved" && <SavedJobsTab />}
{activeTab === "applied" && <AppliedJobsTab />}
```

### Phase 5 Commit

```text
frontend: optimize library page with conditional data fetching
```

---

## Phase 6: Final Verification

**Goal**: Verify all changes and run full test suite.

### Phase 6 Verification Steps

**6.1 Backend Tests**

```bash
cd backend && poetry run pytest
```

**6.2 Frontend Build**

```bash
cd frontend && bun run build
```

**6.3 Manual Testing Checklist**

- [ ] Admin can approve scraper requests without race conditions
- [ ] Admin rejection requires non-empty notes
- [ ] Tailor editor gracefully handles malformed content
- [ ] Request modal closes cleanly without scroll issues
- [ ] Library page only fetches data for active tab
- [ ] Section entries maintain stable IDs during editing

---

## Critical Files Reference

| File | Phases |
| ---- | ------ |
| `backend/app/crud/scraper_request.py` | 1 |
| `backend/app/schemas/scraper.py` | 2 |
| `backend/app/services/resume/parser.py` | 2 |
| `frontend/src/app/(protected)/admin/scraper/components/RequestQueue.tsx` | 3 |
| `frontend/src/app/(protected)/tailor/editor/[id]/page.tsx` | 3 |
| `frontend/src/components/jobs/RequestJobsModal.tsx` | 4 |
| `frontend/src/components/workshop/panels/sections/SectionEditorAdapter.tsx` | 4 |
| `frontend/src/app/(protected)/library/page.tsx` | 5 |

---

## Future Considerations

These items are not blocking but should be considered for future work:

1. **Rate Limiting**: Add rate limiting to scraper request creation endpoint
2. **Pagination**: Add pagination to Saved Jobs tab for large datasets
3. **Automated Tests**: Add unit tests for scraper request repository and frontend hooks
4. **Optimistic Updates**: Consider optimistic UI updates for admin approve/reject actions
