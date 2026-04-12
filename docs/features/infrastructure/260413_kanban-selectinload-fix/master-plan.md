# Fix SELECT * on job_listings (kanban selectinload)

## Context

The Supabase dashboard shows `select jl.* from public.job_listings as jl` as the 2nd most inefficient query (9.4% total time, mean 1,726ms, max 12,818ms, 2,400 rows across 12 calls). This violates CLAUDE.md rule #5: "NEVER use SELECT *."

The root cause is `selectinload(UserJobInteraction.job_listing)` with no column constraints in `get_kanban_board()`. SQLAlchemy generates `SELECT jl.* ...` to eagerly load the related listing, pulling all 50+ columns including large TOAST columns (`job_description`, `job_description_html`, `company_description`) and JSONB arrays.

The kanban card UI only renders **5 listing fields**: `id`, `job_title`, `company_name`, `company_logo`, `location`.

## Plan

### Step 1 -- Backend schema: add `KanbanJobItem`

**File:** `backend/app/schemas/job_listing.py`

Add a slim Pydantic model after `JobListingListItem` (~line 211):

```python
class KanbanJobItem(BaseModel):
    """Minimal schema for kanban board cards."""
    id: int
    job_title: str
    company_name: str
    company_logo: str | None = None
    location: str | None = None
    application_status: ApplicationStatus | None = None
    status_changed_at: datetime | None = None
    applied_at: datetime | None = None
    column_position: int = 0
    model_config = ConfigDict(from_attributes=True)
```

Update `KanbanColumnResponse` (line 372) to use `list[KanbanJobItem]` instead of `list[JobListingResponse]`.

### Step 2 -- Backend CRUD: constrain selectinloads

**File:** `backend/app/crud/job_listing.py`

Add a column tuple (near `UserJobInteractionRepository` or module-level):

```python
_KANBAN_LOAD_COLUMNS = (
    JobListing.id,
    JobListing.job_title,
    JobListing.company_name,
    JobListing.company_logo,
    JobListing.location,
)
```

Update three methods to use `load_only`:

| Method | Line | Change |
| ------ | ---- | ------ |
| `get_kanban_board()` | 1113 | `.options(selectinload(...).load_only(*_KANBAN_LOAD_COLUMNS))` |
| `get_saved_jobs()` | 1023 | `.options(selectinload(...).load_only(*JobListingRepository._LIST_LOAD_COLUMNS))` |
| `get_applied_jobs()` | 1045 | `.options(selectinload(...).load_only(*JobListingRepository._LIST_LOAD_COLUMNS))` |

### Step 3 -- Backend route: add slim builder, update kanban endpoint

**File:** `backend/app/api/routes/job_listings.py`

Add `_build_kanban_item()` helper (near `_build_listing_response` at line 228):

```python
def _build_kanban_item(listing, interaction) -> KanbanJobItem:
    return KanbanJobItem(
        id=listing.id,
        job_title=listing.job_title,
        company_name=listing.company_name,
        company_logo=listing.company_logo,
        location=listing.location,
        application_status=interaction.application_status,
        status_changed_at=interaction.status_changed_at,
        applied_at=interaction.applied_at,
        column_position=interaction.column_position or 0,
    )
```

Update kanban endpoint (line 635-638): replace `_build_listing_response(listing, interaction)` with `_build_kanban_item(listing, interaction)`.

Add `KanbanJobItem` to the imports from `app.schemas.job_listing`.

### Step 4 -- Frontend types: add `KanbanJobItem`, update `KanbanColumnResponse`

**File:** `frontend/src/lib/api/types.ts`

Add interface near kanban types (~line 910):

```typescript
export interface KanbanJobItem {
  id: number;
  job_title: string;
  company_name: string;
  company_logo: string | null;
  location: string | null;
  application_status: ApplicationStatus | null;
  status_changed_at: string | null;
  applied_at: string | null;
  column_position: number;
}
```

Update `KanbanColumnResponse.jobs` from `JobListingResponse[]` to `KanbanJobItem[]`.

### Step 5 -- Frontend components: swap type references

Replace `JobListingResponse` with `KanbanJobItem` in 4 files:

| File | Changes |
| ---- | ------- |
| `KanbanCard.tsx` | Import + prop type (lines 7, 11) |
| `KanbanCardOverlay.tsx` | Import + prop type (lines 3, 6) |
| `KanbanColumn.tsx` | Import + prop type (lines 6, 12) |
| `KanbanBoard.tsx` | Import (line 18), `useState` type (line 31), `findJob` return type (line 46) |

No template changes needed -- all accessed fields (`id`, `job_title`, `company_name`, `company_logo`, `location`, `status_changed_at`, `applied_at`, `application_status`, `column_position`) exist on `KanbanJobItem`.

## Expected Impact

- **SQL:** Query goes from ~35 columns (with TOAST decompression) to 5 columns. Expected ~50-100ms (down from 1,726ms mean).
- **Payload:** Each job object shrinks from ~35 fields to 9 fields. For 200 jobs, payload drops from ~1MB to ~20KB.

## Verification

1. `cd backend && poetry run python -c "from app.schemas.job_listing import KanbanJobItem; print('ok')"` -- schema imports
2. `cd frontend && bun run build` -- TypeScript compiles with no errors
3. Start dev servers, open kanban board at `/jobs?tab=tracker`, verify cards render correctly with title, company, logo, location, and stagnancy indicators
4. Drag a card between columns -- verify optimistic update and persistence work
5. Check Supabase query dashboard after a few kanban loads -- the `select jl.*` query should be replaced by a 5-column select
