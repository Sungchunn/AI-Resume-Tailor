# Phase 1 — Payload Trimming & React Query Persistence

**Parent:** [master-plan.md](./master-plan.md)
**Status:** Planning
**Goal:** Shrink list response size and keep warm data across refreshes / logins.

## Why this phase first

Payload trimming is the single highest-impact change and it's a prerequisite for every caching layer that follows. You can't cache your way out of shipping 5 MB of job descriptions nobody reads. Once Phase 1 is in place, Phase 2 and Phase 3 operate on much smaller values and their hit-rate math improves.

## 1a. Backend: list-item schema

Add a slim schema and use it on list endpoints.

### File: `backend/app/schemas/job_listing.py`

```python
class JobListingListItem(BaseModel):
    id: int
    external_job_id: str
    job_title: str
    company_name: str
    company_logo: str | None
    location: str | None
    is_remote: bool | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str
    salary_period: str | None
    date_posted: datetime | None
    seniority: str | None
    # User interaction (needed for list UI badges)
    is_saved: bool
    is_hidden: bool
    applied_at: datetime | None
    application_status: ApplicationStatus | None

    model_config = ConfigDict(from_attributes=True)


class JobListingListItemResponse(BaseModel):
    listings: list[JobListingListItem]
    total: int
    limit: int
    offset: int
```

### File: `backend/app/crud/job_listing.py:111-347` (`list()` method)

Narrow the `select()` so Postgres skips TOAST columns. Instead of `select(JobListing)`, select only the columns used in the list item:

```python
stmt = select(
    JobListing.id,
    JobListing.external_job_id,
    JobListing.job_title,
    JobListing.company_name,
    JobListing.company_logo,
    JobListing.location,
    JobListing.is_remote,
    JobListing.salary_min,
    JobListing.salary_max,
    JobListing.salary_currency,
    JobListing.salary_period,
    JobListing.date_posted,
    JobListing.seniority,
    JobListing.is_active,
).where(...)
```

**Why this matters:** TOAST columns (`job_description`, `job_description_html`, `company_description`) are stored out-of-line in Postgres and their retrieval often dominates the query cost on large rows. Skipping them in the `SELECT` list is one of the highest-ROI changes in this entire plan.

### File: `backend/app/api/routes/job_listings.py:124-353`

- Return `JobListingListItemResponse` from `list_job_listings`, `list_saved_job_listings`, `list_applied_job_listings`.
- Keep `GET /job-listings/{id}` returning the full `JobListingResponse` — detail page still needs everything.

## 1b. Frontend: TS types + hook updates

### File: `frontend/src/lib/api/types.ts:741-787`

Add the `JobListingListItem` TypeScript type mirroring the backend schema.

### File: `frontend/src/lib/api/hooks.ts:706-731`

- Update `useJobListings` and `useSavedJobListings` return types to the new list-item shape.
- `useJobListing(id)` keeps the full response unchanged.
- Add a new dedicated `useFilterOptions` hook that wraps `jobListingApi.getFilterOptions()` in `useQuery` with key `['jobListings', 'filterOptions']` and `staleTime: 60 * 60 * 1000` (1 h).
- Add `placeholderData: keepPreviousData` to `useJobListings` so pagination doesn't flash skeletons.

### File: `frontend/src/components/jobs/JobListingCard.tsx`

Drop any references to fields that no longer exist on list items. Audit removals: `job_description`, `job_description_html`, `benefits`, `emails`, `company_description`.

### File: `frontend/src/app/(protected)/jobs/[id]/page.tsx`

Still fetches full detail via `useJobListing` — no change needed.

### File: `frontend/src/components/jobs/JobListingFilters.tsx:40-50`

Replace the direct `jobListingApi.getFilterOptions()` call with the new `useFilterOptions()` hook. This is what stops the repeat-on-mount behavior.

## 1c. Frontend: React Query persistence

### File: `frontend/package.json`

Add dependencies:

```bash
cd frontend
bun add @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister
```

### File: `frontend/src/providers/QueryProvider.tsx`

- Raise `staleTime` to `5 * 60 * 1000` (5 min, matches freshness tolerance).
- Add `gcTime: 24 * 60 * 60 * 1000` (24 h) so persisted data survives.
- Wire `PersistQueryClientProvider` with a localStorage persister.

```tsx
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "rb-jobs-cache-v1",
});

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister,
    buster: currentUserId ?? "anon", // invalidate on user change
    maxAge: 24 * 60 * 60 * 1000,
    dehydrateOptions: {
      shouldDehydrateQuery: (q) =>
        q.queryKey[0] === "jobListings" && q.state.status === "success",
    },
  }}
>
```

**Critical:** the `buster` key must be tied to user id so logging in as a different account on the same browser doesn't leak cached data. Read the JWT `sub` from `localStorage` at provider init.

**Critical:** use `dehydrateOptions.shouldDehydrateQuery` to persist **only** job-listings queries. Do not persist auth, user, or mutation state.

## Expected impact

- Response size: 60–90% smaller.
- `filter-options` stops re-firing on every filter sidebar mount.
- Refreshes hit `localStorage` instead of cold-fetching.
- First paint on warm cache should drop from ~2 s to a few hundred ms.

## Files touched (checklist)

- [ ] `backend/app/schemas/job_listing.py` — add `JobListingListItem`
- [ ] `backend/app/crud/job_listing.py:111-347` — narrow `select()` columns
- [ ] `backend/app/api/routes/job_listings.py:124-353` — return new schema
- [ ] `frontend/src/lib/api/types.ts:741-787` — add list-item type
- [ ] `frontend/src/lib/api/hooks.ts:706-731` — update hooks + new `useFilterOptions`
- [ ] `frontend/src/components/jobs/JobListingCard.tsx` — drop unused fields
- [ ] `frontend/src/components/jobs/JobListingFilters.tsx:40-50` — use new hook
- [ ] `frontend/src/providers/QueryProvider.tsx` — wire `PersistQueryClientProvider`
- [ ] `frontend/package.json` — add persist-client deps

## Phase 1 verification

1. **Payload size** — Chrome DevTools Network tab on `/api/job-listings?limit=20`. Expect 60–90% reduction.
2. **Cold first load** — DevTools Performance tab, record `/jobs` with disabled cache. Measure TTFB and time to first card rendered.
3. **Warm refresh** — refresh `/jobs` with cache enabled. Confirm `localStorage.getItem('rb-jobs-cache-v1')` contains job-listings entries. Page should paint immediately from persisted cache.
4. **User isolation** — log out, log in as different user. Confirm old user's data does **not** appear. Tests the `buster` key.
5. **Filter sidebar** — toggle filters, flip back within 1 h. Confirm filter-options does not re-fetch (React Query Devtools shows stale-but-valid).
6. **Pagination** — click next page. With `keepPreviousData` the previous list should stay visible (no skeleton flash) until the new page arrives.
