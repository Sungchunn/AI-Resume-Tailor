# Code Review Refactoring Plan

**Created**: February 23, 2026
**Status**: Pending Implementation

Based on the code review findings from commits f21fb2c through c19430e, this plan addresses 7 issues across backend and frontend in 7 phases.

---

## Overview

| Phase | Scope | Risk | Description |
| ----- | ----- | ---- | ----------- |
| 1 | Backend | Lowest | Create utils module for shared helpers |
| 2 | Backend | Low | Refactor CRUD to use helpers |
| 3 | Backend | Medium | Add URL validation to schemas |
| 4 | Frontend | Lowest | Create shared icons library |
| 5 | Frontend | Low | Refactor components to use icons |
| 6 | Frontend | Low | Add image error handling |
| 7 | Frontend | Low | Fix accessibility (aria-expanded) |

**Note**: Backend (1-3) and Frontend (4-7) phases can run in parallel.

---

## Phase 1: Backend Utils Infrastructure

**Goal**: Create shared utilities to eliminate CRUD duplication.

### Phase 1 Files to Create

- `backend/app/utils/__init__.py`
- `backend/app/utils/apify_helpers.py`

### Phase 1 Functions to Extract

From `backend/app/crud/job_listing.py`:

| Function | Source Lines | Description |
| -------- | ------------ | ----------- |
| `parse_job_date()` | 376-388, 520-537 | Parse date from Apify data |
| `extract_company_address()` | 400-405, 549-554 | Get locality/country from nested object |
| `detect_remote()` | 391-393, 540-542 | Check if job is remote |
| `convert_employment_type()` | 396-398, 545-547 | Map employment type string |

### Phase 1 Commit

```text
backend: add apify_helpers utils module for data transformation
```

---

## Phase 2: Backend CRUD Refactoring

**Goal**: Refactor CRUD to use shared utilities.

### Phase 2 Files to Modify

- `backend/app/crud/job_listing.py`

### Phase 2 Changes

1. Import helpers from `app.utils.apify_helpers`
2. Refactor `upsert_from_apify` (lines 358-460) to use helpers
3. Refactor `batch_upsert_from_apify` (lines 485-645) to use helpers

### Phase 2 Verification

- Run `poetry run pytest backend/tests/`

### Phase 2 Commit

```text
backend: refactor job_listing CRUD to use shared apify_helpers
```

---

## Phase 3: Backend URL Validation

**Goal**: Add proper URL validation using Pydantic's `HttpUrl`.

### Phase 3 Files to Create/Modify

- Create: `backend/app/utils/validators.py`
- Modify: `backend/app/schemas/job_listing.py`

### Phase 3 Changes

1. Create `OptionalHttpUrl` type that validates URLs but allows `None`

2. Update these fields in `JobListingBase` (lines 53-70):
   - `company_website: str | None` → `OptionalHttpUrl`
   - `company_linkedin_url: str | None` → `OptionalHttpUrl`
   - `job_url: str` → `HttpUrl`
   - `job_url_direct: str | None` → `OptionalHttpUrl`
   - `apply_url: str | None` → `OptionalHttpUrl`

3. Apply same changes to:
   - `JobListingUpdate` (lines 103-120)
   - `WebhookJobListing` (lines 395-410)

### Phase 3 Commit

```text
backend: add URL validation to job listing schemas
```

---

## Phase 4: Frontend Icon Library

**Goal**: Create shared icon library to eliminate duplication across 4 files.

### Phase 4 Files to Create

- `frontend/src/components/icons/index.ts`
- `frontend/src/components/icons/JobIcons.tsx`
- `frontend/src/components/icons/NavigationIcons.tsx`

### Phase 4 Icons to Extract

**JobIcons.tsx** (from `page.tsx` lines 378-517 and `JobListingCard.tsx` lines 156-215):

- `BookmarkIcon` (with `filled` prop)
- `EyeSlashIcon`
- `MapPinIcon`
- `CurrencyIcon`
- `ExternalLinkIcon`
- `CheckIcon`
- `ChevronLeftIcon`
- `ChevronDownIcon`
- `BuildingIcon`
- `GlobeIcon`
- `LinkedInIcon`
- `GiftIcon`

**NavigationIcons.tsx** (from `Sidebar.tsx` lines 29-99):

- `DashboardIcon`
- `LibraryIcon`
- `BriefcaseIcon`
- `SparklesIcon`

### Phase 4 Commit

```text
frontend: create shared icons component library
```

---

## Phase 5: Frontend Icon Refactoring

**Goal**: Update components to use shared icon library.

### Phase 5 Files to Modify

| File | Remove Lines | Action |
| ---- | ------------ | ------ |
| `frontend/src/app/dashboard/jobs/[id]/page.tsx` | 378-517 | Import from `@/components/icons` |
| `frontend/src/components/jobs/JobListingCard.tsx` | 156-215 | Import from `@/components/icons` |
| `frontend/src/components/jobs/JobListingFilters.tsx` | 407-419 | Import from `@/components/icons` |
| `frontend/src/components/layout/Sidebar.tsx` | 29-99 | Import from `@/components/icons` |

### Phase 5 Commit

```text
frontend: refactor components to use shared icon library
```

---

## Phase 6: Frontend Image Handling

**Goal**: Add error handling for broken company logo images.

### Phase 6 File to Modify

- `frontend/src/app/dashboard/jobs/[id]/page.tsx` (lines 120-126)

### Phase 6 Changes

```tsx
// Before
<img
  src={listing.company_logo}
  alt={`${listing.company_name} logo`}
  className="w-16 h-16 rounded-lg object-contain border border-gray-100"
/>

// After
<img
  src={listing.company_logo}
  alt={listing.company_name ? `${listing.company_name} logo` : 'Company logo'}
  className="w-16 h-16 rounded-lg object-contain border border-gray-100"
  loading="lazy"
  onError={(e) => { e.currentTarget.style.display = 'none' }}
/>
```

### Phase 6 Commit

```text
frontend: add error handling for company logo images
```

---

## Phase 7: Frontend Accessibility

**Goal**: Add `aria-expanded` to benefits toggle button.

### Phase 7 File to Modify

- `frontend/src/app/dashboard/jobs/[id]/page.tsx` (around line 316-326)

### Phase 7 Changes

Add to benefits toggle button:

- `aria-expanded={benefitsExpanded}`
- `aria-controls="benefits-list"`
- Add `id="benefits-list"` to the benefits content div

### Phase 7 Commit

```text
frontend: add aria-expanded to benefits toggle for accessibility
```

---

## Final Verification

After all phases:

1. **Backend Tests**

   ```bash
   cd backend && poetry run pytest
   ```

2. **Frontend Build**

   ```bash
   cd frontend && bun run build
   ```

3. **Manual Testing**
   - Navigate to job detail page
   - Verify icons render correctly
   - Test broken image URL handling
   - Check accessibility with browser dev tools

---

## Critical Files Reference

| File | Phases |
| ---- | ------ |
| `backend/app/crud/job_listing.py` | 1, 2 |
| `backend/app/schemas/job_listing.py` | 3 |
| `frontend/src/app/dashboard/jobs/[id]/page.tsx` | 5, 6, 7 |
| `frontend/src/components/jobs/JobListingCard.tsx` | 5 |
| `frontend/src/components/layout/Sidebar.tsx` | 5 |
