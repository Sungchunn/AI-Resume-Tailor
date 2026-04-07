# Phase 3: Frontend Updates

**Parent:** `master-plan.md`
**Depends on:** `phase-2-api-update.md`
**Status:** Not Started

---

## Objective

Update the frontend to use UUID-based routes and API calls, ensuring all user-facing URLs contain unpredictable identifiers.

---

## Scope

### Pages Requiring Updates

| Page | Current Route | Target Route | Priority |
| ---- | ------------- | ------------ | -------- |
| Job Detail | `/library/jobs/[id]` | `/library/jobs/[id]` (UUID) | HIGH |
| Job Edit | `/library/jobs/[id]/edit` | `/library/jobs/[id]/edit` (UUID) | HIGH |
| Resume Build | `/library/builds/[id]` | `/library/builds/[id]` (UUID) | HIGH |
| Tailor Result | `/tailor/[id]` | `/tailor/[id]` (ObjectId, no change) | NONE |

### API Client Functions Requiring Updates

| Function | Current | Target |
| -------- | ------- | ------ |
| `getJob(id: number)` | Integer param | UUID string param |
| `updateJob(id: number, ...)` | Integer param | UUID string param |
| `deleteJob(id: number)` | Integer param | UUID string param |
| `getResumeBuild(id: number)` | Integer param | UUID string param |

---

## Implementation Steps

### Step 1: Update TypeScript Types

Regenerate types from OpenAPI schema and update manual type definitions.

**Run type generation:**

```bash
cd frontend
./scripts/generate-client.sh
```

**File:** `/frontend/src/types/api.ts`

```typescript
// Before
export interface Job {
  id: number;
  title: string;
  company: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

// After
export interface Job {
  id: string;  // UUID format: "550e8400-e29b-41d4-a716-446655440000"
  title: string;
  company: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ResumeBuild {
  id: string;  // UUID
  name: string | null;
  resume_id: string;  // MongoDB ObjectId
  job_id: string | null;  // UUID (reference to Job.id)
  status: string | null;
  created_at: string;
  updated_at: string | null;
}
```

---

### Step 2: Update API Client Functions

**File:** `/frontend/src/lib/api/jobs.ts`

```typescript
import { apiClient } from './client';
import type { Job, JobCreate, JobUpdate, JobListResponse } from '@/types/api';

/**
 * Job API client functions.
 *
 * All job IDs are UUIDs in the format: "550e8400-e29b-41d4-a716-446655440000"
 */

export async function listJobs(params?: {
  skip?: number;
  limit?: number;
}): Promise<JobListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.skip) searchParams.set('skip', params.skip.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const url = `/api/jobs${searchParams.toString() ? `?${searchParams}` : ''}`;
  return apiClient.get<JobListResponse>(url);
}

export async function getJob(id: string): Promise<Job> {
  // Validate UUID format before making request
  if (!isValidUUID(id)) {
    throw new Error(`Invalid job ID format: ${id}`);
  }
  return apiClient.get<Job>(`/api/jobs/${id}`);
}

export async function createJob(data: JobCreate): Promise<Job> {
  return apiClient.post<Job>('/api/jobs', data);
}

export async function updateJob(id: string, data: JobUpdate): Promise<Job> {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid job ID format: ${id}`);
  }
  return apiClient.put<Job>(`/api/jobs/${id}`, data);
}

export async function deleteJob(id: string): Promise<void> {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid job ID format: ${id}`);
  }
  return apiClient.delete(`/api/jobs/${id}`);
}

// UUID validation helper
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
```

**File:** `/frontend/src/lib/api/resume-builds.ts`

```typescript
import { apiClient } from './client';
import type {
  ResumeBuild,
  ResumeBuildCreate,
  ResumeBuildDetailResponse
} from '@/types/api';
import { isValidUUID } from './jobs';

export async function getResumeBuild(id: string): Promise<ResumeBuildDetailResponse> {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid resume build ID format: ${id}`);
  }
  return apiClient.get<ResumeBuildDetailResponse>(`/api/resume-builds/${id}`);
}

export async function createResumeBuild(data: ResumeBuildCreate): Promise<ResumeBuild> {
  return apiClient.post<ResumeBuild>('/api/resume-builds', data);
}

export async function updateResumeBuild(
  id: string,
  data: Partial<ResumeBuild>
): Promise<ResumeBuild> {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid resume build ID format: ${id}`);
  }
  return apiClient.put<ResumeBuild>(`/api/resume-builds/${id}`, data);
}

export async function deleteResumeBuild(id: string): Promise<void> {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid resume build ID format: ${id}`);
  }
  return apiClient.delete(`/api/resume-builds/${id}`);
}
```

---

### Step 3: Update Next.js Dynamic Routes

Next.js dynamic routes already accept string parameters, so minimal changes needed. Update type annotations and validation.

**File:** `/frontend/src/app/(protected)/library/jobs/[id]/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { getJob, isValidUUID } from '@/lib/api/jobs';

interface JobPageProps {
  params: {
    id: string;  // UUID from URL
  };
}

export default async function JobPage({ params }: JobPageProps) {
  const { id } = params;

  // Validate UUID format
  if (!isValidUUID(id)) {
    notFound();
  }

  const job = await getJob(id);

  if (!job) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1>{job.title}</h1>
      <p>{job.company}</p>
      {/* ... */}
    </div>
  );
}
```

**File:** `/frontend/src/app/(protected)/library/jobs/[id]/edit/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { getJob, isValidUUID } from '@/lib/api/jobs';
import { JobEditForm } from '@/components/jobs/JobEditForm';

interface JobEditPageProps {
  params: {
    id: string;
  };
}

export default async function JobEditPage({ params }: JobEditPageProps) {
  const { id } = params;

  if (!isValidUUID(id)) {
    notFound();
  }

  const job = await getJob(id);

  if (!job) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1>Edit Job</h1>
      <JobEditForm job={job} />
    </div>
  );
}
```

---

### Step 4: Update Component Props

Update components that receive job/resume-build IDs as props.

**File:** `/frontend/src/components/jobs/JobCard.tsx`

```typescript
import Link from 'next/link';
import type { Job } from '@/types/api';

interface JobCardProps {
  job: Job;
  onDelete?: (id: string) => void;  // Changed from number to string
}

export function JobCard({ job, onDelete }: JobCardProps) {
  return (
    <div className="p-4 border rounded-lg">
      <Link href={`/library/jobs/${job.id}`}>
        <h3>{job.title}</h3>
        <p>{job.company}</p>
      </Link>
      {onDelete && (
        <button onClick={() => onDelete(job.id)}>
          Delete
        </button>
      )}
    </div>
  );
}
```

**File:** `/frontend/src/components/jobs/JobList.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobCard } from './JobCard';
import { deleteJob } from '@/lib/api/jobs';
import type { Job } from '@/types/api';

interface JobListProps {
  initialJobs: Job[];
}

export function JobList({ initialJobs }: JobListProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const router = useRouter();

  const handleDelete = async (id: string) => {
    await deleteJob(id);
    setJobs(jobs.filter(job => job.id !== id));
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {jobs.map(job => (
        <JobCard
          key={job.id}  // UUID is unique
          job={job}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
```

---

### Step 5: Update Navigation and Links

Search for all places that construct URLs with job/resume-build IDs.

**Search patterns:**

```bash
# Find all job ID URL constructions
grep -r "/jobs/" frontend/src --include="*.tsx" --include="*.ts"
grep -r "job.id" frontend/src --include="*.tsx" --include="*.ts"
grep -r "jobId" frontend/src --include="*.tsx" --include="*.ts"

# Find all resume-build ID URL constructions
grep -r "/builds/" frontend/src --include="*.tsx" --include="*.ts"
grep -r "build.id" frontend/src --include="*.tsx" --include="*.ts"
grep -r "buildId" frontend/src --include="*.tsx" --include="*.ts"
```

**Common patterns to update:**

```typescript
// Before
const url = `/library/jobs/${job.id}`;  // job.id was number

// After (no change needed if id is now string)
const url = `/library/jobs/${job.id}`;  // job.id is UUID string

// Before - with number type annotation
function navigateToJob(id: number) {
  router.push(`/library/jobs/${id}`);
}

// After - with string type annotation
function navigateToJob(id: string) {
  router.push(`/library/jobs/${id}`);
}
```

---

### Step 6: Update React Query Keys

If using React Query, update query keys to use UUIDs.

**File:** `/frontend/src/lib/queries/jobs.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJob, listJobs, updateJob, deleteJob } from '@/lib/api/jobs';

// Query key factory
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...jobKeys.lists(), filters] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,  // id is UUID string
};

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: () => getJob(id),
    enabled: !!id,
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}
```

---

### Step 7: Update Local Storage and State

If IDs are stored in localStorage or client state, update to use UUID strings.

**File:** `/frontend/src/hooks/useRecentJobs.ts`

```typescript
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'recent_jobs';
const MAX_RECENT = 5;

// Store recent job UUIDs
export function useRecentJobs() {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Migrate old integer IDs (filter them out)
        const validUuids = parsed.filter(
          (id: unknown) => typeof id === 'string' && id.includes('-')
        );
        setRecentIds(validUuids);
      } catch {
        setRecentIds([]);
      }
    }
  }, []);

  const addRecent = (id: string) => {
    const updated = [id, ...recentIds.filter(i => i !== id)].slice(0, MAX_RECENT);
    setRecentIds(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return { recentIds, addRecent };
}
```

---

## Edge Cases and Migration

### Handling Bookmarked URLs

Users may have bookmarked URLs with integer IDs. Options:

#### Option 1: Redirect middleware (Recommended)

```typescript
// /frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for integer ID in job routes
  const jobMatch = pathname.match(/^\/library\/jobs\/(\d+)/);
  if (jobMatch) {
    // Redirect to a lookup endpoint that resolves int -> UUID
    return NextResponse.redirect(
      new URL(`/api/resolve-legacy-id?type=job&id=${jobMatch[1]}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/library/jobs/:path*', '/library/builds/:path*'],
};
```

#### Option 2: Client-side detection

```typescript
// In page component
useEffect(() => {
  // If ID looks like an integer, redirect to fetch UUID
  if (/^\d+$/.test(id)) {
    fetch(`/api/jobs/${id}/resolve-uuid`)
      .then(res => res.json())
      .then(data => {
        router.replace(`/library/jobs/${data.uuid}`);
      });
  }
}, [id]);
```

### Shared Links

If users share links externally:

1. During transition period, both formats work
2. After transition, integer links return 404
3. Consider adding a "link expired" page with explanation

---

## Files to Modify

| File | Change |
| ---- | ------ |
| `/frontend/src/types/api.ts` | Update id types to string |
| `/frontend/src/lib/api/jobs.ts` | Update function signatures |
| `/frontend/src/lib/api/resume-builds.ts` | Update function signatures |
| `/frontend/src/lib/api/client.ts` | Add UUID validation helper |
| `/frontend/src/app/(protected)/library/jobs/[id]/page.tsx` | Add UUID validation |
| `/frontend/src/app/(protected)/library/jobs/[id]/edit/page.tsx` | Add UUID validation |
| `/frontend/src/components/jobs/JobCard.tsx` | Update prop types |
| `/frontend/src/components/jobs/JobList.tsx` | Update handler types |
| `/frontend/src/lib/queries/jobs.ts` | Update query key types |
| `/frontend/src/hooks/useRecentJobs.ts` | Migrate storage format |
| `/frontend/src/middleware.ts` | Add legacy ID redirect (optional) |

---

## Testing Checklist

### Manual Testing

- [ ] Navigate to job list page, verify jobs load
- [ ] Click on a job, verify URL contains UUID
- [ ] Edit a job, verify save works
- [ ] Delete a job, verify removal
- [ ] Create new job, verify UUID in response/URL
- [ ] Navigate to resume build, verify UUID in URL
- [ ] Test with bookmarked integer URL (should redirect or 404)

### Automated Testing

- [ ] Unit tests for `isValidUUID` function
- [ ] Integration tests for API client functions
- [ ] E2E tests for job CRUD flows

---

## Completion Checklist

- [ ] TypeScript types regenerated from OpenAPI
- [ ] API client functions updated
- [ ] Dynamic route pages updated with validation
- [ ] Component props updated
- [ ] Navigation/links verified
- [ ] React Query keys updated (if applicable)
- [ ] Local storage migration handled
- [ ] Legacy URL redirect implemented (optional)
- [ ] All tests passing

---

## Next Phase

After completing Phase 3, proceed to `phase-4-rls-policies.md` for Row Level Security implementation.
