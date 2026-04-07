"""
Job Description API routes.

Supports dual-lookup for resource IDs during migration:
- UUID format (preferred): 550e8400-e29b-41d4-a716-446655440000
- Integer format (deprecated): 123
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db_session
from app.api.utils.id_resolution import (
    IDResolutionError,
    add_deprecation_headers,
    is_uuid_format,
    resolve_job_id,
)
from app.crud import job_crud
from app.schemas import JobCreate, JobResponse, JobUpdate
from app.schemas.job import JobListResponse

router = APIRouter()


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_in: JobCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> JobResponse:
    """Create a new job description."""
    job = await job_crud.create(db, obj_in=job_in, owner_id=current_user_id)
    await db.commit()
    await db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> JobResponse:
    """
    Get a job description by ID.

    The job_id can be either:
    - UUID format (preferred): 550e8400-e29b-41d4-a716-446655440000
    - Integer format (deprecated): 123
    """
    # Add deprecation headers for legacy integer IDs
    if not is_uuid_format(job_id):
        add_deprecation_headers(response, "job")

    try:
        job = await resolve_job_id(
            db, job_id, current_user_id, crud=job_crud
        )
    except IDResolutionError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return job


@router.get("", response_model=JobListResponse)
async def list_jobs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> JobListResponse:
    """List all job descriptions for the current user."""
    jobs = await job_crud.get_by_owner(
        db, owner_id=current_user_id, skip=skip, limit=limit
    )
    # Response schema automatically maps public_id -> id
    return JobListResponse(
        items=jobs,
        total=len(jobs),
        skip=skip,
        limit=limit,
    )


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    job_in: JobUpdate,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> JobResponse:
    """Update a job description."""
    # Add deprecation headers for legacy integer IDs
    if not is_uuid_format(job_id):
        add_deprecation_headers(response, "job")

    try:
        job = await resolve_job_id(
            db, job_id, current_user_id, crud=job_crud
        )
    except IDResolutionError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    updated_job = await job_crud.update(db, db_obj=job, obj_in=job_in)
    await db.commit()
    await db.refresh(updated_job)
    return updated_job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: str,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> None:
    """Delete a job description."""
    # Add deprecation headers for legacy integer IDs
    if not is_uuid_format(job_id):
        add_deprecation_headers(response, "job")

    try:
        job = await resolve_job_id(
            db, job_id, current_user_id, crud=job_crud
        )
    except IDResolutionError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    await job_crud.delete(db, id=job.id)
    await db.commit()
