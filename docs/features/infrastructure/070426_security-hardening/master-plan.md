# Security Hardening Plan: User Data Isolation

**Scope:** Full implementation (UUIDs + RLS)

---

## Executive Summary

Security audit completed. The codebase has strong application-level security but needs two improvements:

1. **UUID migration** for PostgreSQL user-facing IDs (currently sequential integers)
2. **Supabase RLS** as defense-in-depth (second layer of protection)

---

## Current Security Status

| Area | Status | Notes |
| ---- | ------ | ----- |
| Authentication | Secure | JWT-based, user_id from verified tokens only |
| Ownership verification | Secure | All endpoints check resource.user_id == current_user_id |
| Response serialization | Secure | Explicit Pydantic schemas, no raw ORM leakage |
| File storage | Secure | Namespaced as users/{user_id}/resumes/{uuid}_{filename} |
| MongoDB IDs | Secure | Uses ObjectId (unpredictable) |
| PostgreSQL IDs | Issue | Sequential integers exposed in API URLs |
| Supabase RLS | Missing | No row-level security policies configured |

---

## Phase 1: Add UUID Columns to PostgreSQL Tables

### Tables Requiring UUIDs

| Table | Current ID | Exposed As | Priority |
| ----- | ---------- | ---------- | -------- |
| job_descriptions | INTEGER | /jobs/{id} | HIGH |
| resume_builds | INTEGER | /resume-builds/{id} | HIGH |
| user_job_interactions | INTEGER | Indirect via job listings | MEDIUM |

### Tables NOT Requiring UUIDs

- `resumes`, `tailored_resumes` - Already use MongoDB ObjectId
- `job_listings` - System-wide, not user-owned
- `users` - Auth via JWT, IDs not in URLs

### Migration Steps

1. Create Alembic migration to add `public_id` UUID column:

```python
# alembic/versions/YYYYMMDD_add_public_id_columns.py
def upgrade():
    # job_descriptions
    op.add_column('job_descriptions',
        sa.Column('public_id', postgresql.UUID(), nullable=True))
    op.execute("UPDATE job_descriptions SET public_id = gen_random_uuid() WHERE public_id IS NULL")
    op.alter_column('job_descriptions', 'public_id', nullable=False)
    op.create_index('ix_job_descriptions_public_id', 'job_descriptions', ['public_id'], unique=True)

    # resume_builds
    op.add_column('resume_builds',
        sa.Column('public_id', postgresql.UUID(), nullable=True))
    op.execute("UPDATE resume_builds SET public_id = gen_random_uuid() WHERE public_id IS NULL")
    op.alter_column('resume_builds', 'public_id', nullable=False)
    op.create_index('ix_resume_builds_public_id', 'resume_builds', ['public_id'], unique=True)
```

2. Update models to include `public_id` field with default UUID generation

### Files to Modify

- `/backend/app/models/job.py` - Add public_id column
- `/backend/app/models/resume_build.py` - Add public_id column
- `/backend/alembic/versions/` - New migration file

---

## Phase 2: Update API to Use UUIDs

### Strategy: Dual-Lookup During Transition

1. Add CRUD methods for UUID lookup:

```python
# /backend/app/crud/job.py
async def get_by_public_id(self, db: AsyncSession, *, public_id: UUID) -> JobDescription | None:
    result = await db.execute(
        select(JobDescription).where(JobDescription.public_id == public_id)
    )
    return result.scalar_one_or_none()
```

2. Update route handlers to accept string IDs and resolve:

```python
# /backend/app/api/routes/jobs.py
@router.get("/{job_id}")
async def get_job(job_id: str, ...):
    job = await job_crud.get_by_public_id(db, public_id=UUID(job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.owner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return job
```

3. Update response schemas to return `public_id` as `id`:

```python
# /backend/app/schemas/job.py
class JobResponse(BaseModel):
    id: UUID  # Map from public_id
    title: str
    # ...
```

### Files to Modify

- `/backend/app/crud/job.py` - Add get_by_public_id
- `/backend/app/crud/resume_build.py` - Add get_by_public_id
- `/backend/app/api/routes/jobs.py` - Update route handlers
- `/backend/app/api/routes/resume_builds.py` - Update route handlers
- `/backend/app/schemas/job.py` - Update response schema
- `/backend/app/schemas/resume_build.py` - Update response schema

---

## Phase 3: Update Frontend Routes

1. Update API client to use new UUID-based endpoints
2. Update Next.js dynamic routes (already accept strings, minimal changes)

### Files to Modify

- `/frontend/src/lib/api/client.ts` - Update job/resume-build endpoints
- `/frontend/src/app/(protected)/library/jobs/[id]/page.tsx` - Verify compatibility

---

## Phase 4: Enable Supabase Row Level Security

### Challenge

The app uses FastAPI JWT auth, not Supabase Auth. RLS policies need to use a session variable.

### Implementation

1. Enable RLS on tables:

```sql
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_job_interactions ENABLE ROW LEVEL SECURITY;
```

2. Create policies using session variable:

```sql
-- Job descriptions: Owner-only access
CREATE POLICY "job_descriptions_owner_policy"
ON job_descriptions FOR ALL
USING (owner_id = current_setting('app.current_user_id', true)::int)
WITH CHECK (owner_id = current_setting('app.current_user_id', true)::int);
```

3. Set session variable before queries:

```python
# /backend/app/db/session.py - In get_db dependency
async def get_db_with_rls(user_id: int) -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        await session.execute(text(f"SET app.current_user_id = {user_id}"))
        yield session
```

### Files to Modify

- `/backend/app/db/session.py` - Add RLS session setup
- `/backend/app/api/deps.py` - Update get_db dependency
- `/backend/alembic/versions/` - New migration for RLS policies

---

## Verification

### Unit Tests

1. Test UUID generation and uniqueness
2. Test get_by_public_id CRUD methods
3. Test RLS blocks unauthorized access (with mocked session variable)

### Integration Tests

1. Test API endpoints with UUID paths return correct data
2. Test 403 returned when accessing another user's resource
3. Test RLS policies independently via direct DB queries

### Manual Testing

```bash
# 1. Run migrations
cd backend && alembic upgrade head

# 2. Start backend
poetry run uvicorn app.main:app --reload

# 3. Test job endpoints with new UUIDs
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/jobs

# 4. Verify UUID format in response
# Expected: {"id": "550e8400-e29b-41d4-a716-446655440000", ...}
```

---

## Implementation Order

1. **Documentation** - Write plan to /docs/features/infrastructure/070426_security-hardening/
2. **Database migration** - Add public_id columns, backfill, add indexes
3. **CRUD layer** - Add get_by_public_id methods
4. **Routes/schemas** - Update to use UUIDs
5. **Frontend** - Update API client
6. **RLS policies** - Enable and test
7. **Cleanup** - Remove legacy integer lookups after transition period
