# Phase 2: Backend API Refactoring

**Parent:** `master-plan.md`
**Depends on:** `phase-1-uuid-migration.md`
**Status:** Not Started

---

## Objective

Update API routes and CRUD operations to use UUIDs as public identifiers while maintaining a transition period for backward compatibility.

---

## Strategy: Dual-Lookup Transition

During the transition period, the API will:

1. Accept both UUID and integer IDs in URL paths
2. Return only UUID (`public_id`) in responses
3. Log warnings when integer IDs are used (to track migration progress)
4. Eventually deprecate and remove integer ID support

```text
Timeline:
┌────────────────────┬────────────────────┬────────────────────┐
│     Phase 2a       │     Phase 2b       │     Phase 2c       │
│   Dual Support     │  Deprecate Ints    │   UUID Only        │
├────────────────────┼────────────────────┼────────────────────┤
│ - Add UUID routes  │ - Log int usage    │ - Remove int       │
│ - Both IDs work    │ - Return warnings  │   support          │
│ - Responses: UUID  │ - Frontend migrated│ - Cleanup code     │
└────────────────────┴────────────────────┴────────────────────┘
```

---

## Implementation Steps

### Step 1: Create UUID Lookup CRUD Methods

Add methods to look up resources by `public_id` instead of integer `id`.

**File:** `/backend/app/crud/job.py`

```python
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import JobDescription


class JobCRUD:
    async def get(self, db: AsyncSession, *, id: int) -> JobDescription | None:
        """Get job by integer ID (internal use only)."""
        result = await db.execute(
            select(JobDescription).where(JobDescription.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_public_id(
        self,
        db: AsyncSession,
        *,
        public_id: UUID
    ) -> JobDescription | None:
        """Get job by public UUID (for API endpoints)."""
        result = await db.execute(
            select(JobDescription).where(JobDescription.public_id == public_id)
        )
        return result.scalar_one_or_none()

    async def get_by_public_id_and_owner(
        self,
        db: AsyncSession,
        *,
        public_id: UUID,
        owner_id: int
    ) -> JobDescription | None:
        """Get job by UUID with ownership verification in single query."""
        result = await db.execute(
            select(JobDescription).where(
                JobDescription.public_id == public_id,
                JobDescription.owner_id == owner_id
            )
        )
        return result.scalar_one_or_none()

    async def get_multi_by_owner(
        self,
        db: AsyncSession,
        *,
        owner_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> list[JobDescription]:
        """Get all jobs for a user."""
        result = await db.execute(
            select(JobDescription)
            .where(JobDescription.owner_id == owner_id)
            .offset(skip)
            .limit(limit)
            .order_by(JobDescription.created_at.desc())
        )
        return list(result.scalars().all())


job_crud = JobCRUD()
```

**File:** `/backend/app/crud/resume_build.py`

```python
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume_build import ResumeBuild


class ResumeBuildCRUD:
    async def get_by_public_id(
        self,
        db: AsyncSession,
        *,
        public_id: UUID
    ) -> ResumeBuild | None:
        """Get resume build by public UUID."""
        result = await db.execute(
            select(ResumeBuild).where(ResumeBuild.public_id == public_id)
        )
        return result.scalar_one_or_none()

    async def get_by_public_id_and_user(
        self,
        db: AsyncSession,
        *,
        public_id: UUID,
        user_id: int
    ) -> ResumeBuild | None:
        """Get resume build by UUID with ownership verification."""
        result = await db.execute(
            select(ResumeBuild).where(
                ResumeBuild.public_id == public_id,
                ResumeBuild.user_id == user_id
            )
        )
        return result.scalar_one_or_none()


resume_build_crud = ResumeBuildCRUD()
```

---

### Step 2: Create ID Resolution Utility

Create a utility to handle both UUID and integer ID formats during transition.

**File:** `/backend/app/api/utils/id_resolution.py`

```python
import logging
from uuid import UUID
from typing import TypeVar, Generic
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

T = TypeVar('T')


class IDResolutionError(Exception):
    """Raised when ID cannot be resolved."""
    pass


def parse_resource_id(id_string: str) -> UUID | int:
    """
    Parse an ID string and return UUID or int.

    UUID format: 8-4-4-4-12 hex digits
    Integer format: numeric string

    Returns:
        UUID if valid UUID format, int if valid integer

    Raises:
        ValueError if neither format is valid
    """
    # Try UUID first (more specific format)
    try:
        return UUID(id_string)
    except ValueError:
        pass

    # Try integer
    try:
        return int(id_string)
    except ValueError:
        raise ValueError(f"Invalid ID format: {id_string}. Expected UUID or integer.")


async def resolve_job_id(
    db: AsyncSession,
    id_string: str,
    owner_id: int,
    *,
    crud,  # JobCRUD instance
    log_legacy: bool = True
) -> "JobDescription":
    """
    Resolve job ID (UUID or int) to JobDescription with ownership check.

    Args:
        db: Database session
        id_string: UUID or integer ID as string
        owner_id: Expected owner ID for authorization
        crud: JobCRUD instance
        log_legacy: Whether to log when integer IDs are used

    Returns:
        JobDescription if found and authorized

    Raises:
        IDResolutionError: If not found or not authorized
    """
    from app.models.job import JobDescription

    parsed_id = parse_resource_id(id_string)

    if isinstance(parsed_id, UUID):
        job = await crud.get_by_public_id_and_owner(
            db,
            public_id=parsed_id,
            owner_id=owner_id
        )
    else:
        # Integer ID - legacy path
        if log_legacy:
            logger.warning(
                f"Legacy integer ID used for job: {parsed_id}. "
                "Client should migrate to UUID."
            )
        job = await crud.get(db, id=parsed_id)
        if job and job.owner_id != owner_id:
            job = None  # Not authorized

    if not job:
        raise IDResolutionError("Job not found or not authorized")

    return job
```

---

### Step 3: Update Response Schemas

Modify Pydantic schemas to return `public_id` as the `id` field.

**File:** `/backend/app/schemas/job.py`

```python
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class JobBase(BaseModel):
    """Base schema for job data."""
    title: str
    company: str | None = None
    description: str | None = None
    location: str | None = None
    url: str | None = None


class JobCreate(JobBase):
    """Schema for creating a job."""
    pass


class JobUpdate(BaseModel):
    """Schema for updating a job (all fields optional)."""
    title: str | None = None
    company: str | None = None
    description: str | None = None
    location: str | None = None
    url: str | None = None


class JobResponse(JobBase):
    """Schema for job responses - uses public_id as 'id'."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(alias="public_id")
    created_at: datetime
    updated_at: datetime | None = None

    # IMPORTANT: Never expose internal integer ID or owner_id


class JobListResponse(BaseModel):
    """Schema for listing multiple jobs."""
    items: list[JobResponse]
    total: int
    skip: int
    limit: int
```

**File:** `/backend/app/schemas/resume_build.py`

```python
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ResumeBuildBase(BaseModel):
    """Base schema for resume build."""
    name: str | None = None
    status: str | None = None


class ResumeBuildCreate(ResumeBuildBase):
    """Schema for creating a resume build."""
    resume_id: str  # MongoDB ObjectId
    job_id: UUID | None = None  # Reference to job_descriptions.public_id


class ResumeBuildResponse(ResumeBuildBase):
    """Schema for resume build responses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(alias="public_id")
    resume_id: str
    job_id: UUID | None = Field(default=None, alias="job_public_id")
    created_at: datetime
    updated_at: datetime | None = None


class ResumeBuildDetailResponse(ResumeBuildResponse):
    """Detailed response including nested data."""
    # Add fields for sections, suggestions, etc.
    pass
```

---

### Step 4: Update Route Handlers

Modify routes to accept string IDs and use resolution utilities.

**File:** `/backend/app/api/routes/jobs.py`

```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user_id
from app.api.utils.id_resolution import resolve_job_id, IDResolutionError
from app.crud.job import job_crud
from app.schemas.job import (
    JobCreate,
    JobUpdate,
    JobResponse,
    JobListResponse
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=JobListResponse)
async def list_jobs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """List all jobs for the current user."""
    jobs = await job_crud.get_multi_by_owner(
        db,
        owner_id=current_user_id,
        skip=skip,
        limit=limit
    )
    # Response schema automatically maps public_id -> id
    return JobListResponse(
        items=jobs,
        total=len(jobs),
        skip=skip,
        limit=limit
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,  # Accept string to support both UUID and int
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """
    Get a specific job by ID.

    The job_id can be either:
    - UUID format (preferred): 550e8400-e29b-41d4-a716-446655440000
    - Integer format (deprecated): 123
    """
    try:
        job = await resolve_job_id(
            db,
            job_id,
            current_user_id,
            crud=job_crud
        )
    except IDResolutionError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    return job


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_in: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Create a new job description."""
    job = await job_crud.create(
        db,
        obj_in=job_in,
        owner_id=current_user_id
    )
    await db.commit()
    await db.refresh(job)
    return job


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    job_in: JobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Update an existing job."""
    try:
        job = await resolve_job_id(
            db,
            job_id,
            current_user_id,
            crud=job_crud
        )
    except IDResolutionError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    job = await job_crud.update(db, db_obj=job, obj_in=job_in)
    await db.commit()
    await db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Delete a job."""
    try:
        job = await resolve_job_id(
            db,
            job_id,
            current_user_id,
            crud=job_crud
        )
    except IDResolutionError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    await job_crud.delete(db, id=job.id)
    await db.commit()
```

---

### Step 5: Update Related Endpoints

Other endpoints that reference jobs or resume builds need updates.

**File:** `/backend/app/api/routes/tailor.py` (excerpt)

```python
@router.post("/tailor")
async def create_tailored_resume(
    request: TailorRequest,  # Update to accept job_id as UUID string
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Create a tailored resume for a job."""
    # Resolve job_id if provided
    if request.job_id:
        try:
            job = await resolve_job_id(
                db,
                str(request.job_id),
                current_user_id,
                crud=job_crud
            )
        except IDResolutionError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found"
            )
    # ... rest of implementation
```

---

### Step 6: Update OpenAPI Schema

Ensure the OpenAPI documentation reflects UUID parameters.

**File:** `/backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title="Resume Builder API",
    version="2.0.0",  # Bump version for UUID migration
    description="""
    AI Resume Tailor API.

    ## ID Format Migration

    As of v2.0.0, all resource IDs are UUIDs.

    - **New format:** `550e8400-e29b-41d4-a716-446655440000`
    - **Old format (deprecated):** `123`

    Integer IDs are temporarily supported but will be removed in a future version.
    """
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # Add UUID format examples to schema
    openapi_schema["components"]["schemas"]["JobResponse"]["example"] = {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Software Engineer",
        "company": "Tech Corp",
        "created_at": "2026-04-07T12:00:00Z"
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
```

---

## Cross-Reference Updates

### Foreign Key References in Responses

When one resource references another (e.g., `resume_builds.job_id`), responses should return the public UUID, not the internal integer.

**Option 1: Computed property in model**

```python
# /backend/app/models/resume_build.py
class ResumeBuild(Base):
    # ...

    @property
    def job_public_id(self) -> UUID | None:
        """Return the job's public_id for API responses."""
        return self.job.public_id if self.job else None
```

**Option 2: Schema-level mapping**

```python
# /backend/app/schemas/resume_build.py
class ResumeBuildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: UUID | None = Field(default=None)

    @model_validator(mode='before')
    @classmethod
    def map_job_id(cls, data):
        if hasattr(data, 'job') and data.job:
            data.job_id = data.job.public_id
        return data
```

---

## Error Response Updates

Update error messages to not leak internal IDs.

```python
# WRONG - Leaks internal ID
raise HTTPException(
    status_code=404,
    detail=f"Job with ID {job.id} not found"  # Exposes integer
)

# CORRECT - Use public ID only
raise HTTPException(
    status_code=404,
    detail="Job not found"  # Generic message
)

# CORRECT - If ID needed, use public_id
raise HTTPException(
    status_code=404,
    detail=f"Job {job_id} not found"  # Uses the input (UUID)
)
```

---

## Backward Compatibility Period

### Deprecation Headers

Add deprecation warnings when integer IDs are used:

```python
from fastapi import Response

@router.get("/{job_id}")
async def get_job(
    job_id: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    parsed = parse_resource_id(job_id)

    if isinstance(parsed, int):
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "2026-06-01"  # Removal date
        response.headers["Link"] = '</api/docs#uuid-migration>; rel="deprecation"'

    # ... rest of handler
```

### Logging for Migration Tracking

```python
# Track integer ID usage to measure migration progress
import logging
logger = logging.getLogger("migration.uuid")

async def resolve_job_id(...):
    if isinstance(parsed_id, int):
        logger.info(
            "Integer ID access",
            extra={
                "resource": "job",
                "int_id": parsed_id,
                "user_id": owner_id,
                "endpoint": "/api/jobs/{id}"
            }
        )
```

---

## Files Modified

| File | Change |
| ---- | ------ |
| `/backend/app/crud/job.py` | Add `get_by_public_id`, `get_by_public_id_and_owner` |
| `/backend/app/crud/resume_build.py` | Add `get_by_public_id`, `get_by_public_id_and_user` |
| `/backend/app/api/utils/id_resolution.py` | New file for ID parsing/resolution |
| `/backend/app/schemas/job.py` | Update responses to use `public_id` as `id` |
| `/backend/app/schemas/resume_build.py` | Update responses to use `public_id` as `id` |
| `/backend/app/api/routes/jobs.py` | Update handlers to accept string IDs |
| `/backend/app/api/routes/resume_builds.py` | Update handlers to accept string IDs |
| `/backend/app/api/routes/tailor.py` | Update job references |
| `/backend/app/main.py` | Update OpenAPI version and docs |

---

## Completion Checklist

- [ ] CRUD methods added for UUID lookup
- [ ] ID resolution utility created and tested
- [ ] Response schemas updated to return UUIDs
- [ ] Route handlers updated to accept string IDs
- [ ] Cross-reference updates (foreign keys in responses)
- [ ] Deprecation headers added for integer ID usage
- [ ] OpenAPI documentation updated
- [ ] Integration tests passing with UUID paths
- [ ] Backward compatibility verified with integer paths

---

## Next Phase

After completing Phase 2, proceed to `phase-3-frontend-update.md` for frontend changes.
