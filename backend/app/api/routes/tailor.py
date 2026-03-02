"""Resume tailoring API endpoints using MongoDB for resumes, PostgreSQL for jobs."""

import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_databases, get_current_user_id, DatabaseSessions
from app.crud import job_crud
from app.crud.job_listing import job_listing_repository
from app.crud.mongo import resume_crud, tailored_resume_crud
from app.models.mongo.tailored_resume import (
    TailoredResumeCreate as MongoTailoredResumeCreate,
    TailoredResumeUpdate as MongoTailoredResumeUpdate,
    JobSource,
    Suggestion,
    ATSKeywords,
)
from app.schemas.tailor import (
    TailorRequest,
    TailorResponse,
    QuickMatchRequest,
    QuickMatchResponse,
    TailoredResumeListResponse,
    TailoredResumeUpdateRequest,
    TailoredResumeFullResponse,
)
from app.services import (
    get_ai_client,
    get_cache_service,
    ResumeParser,
    JobAnalyzer,
    TailoringService,
)

router = APIRouter()


def get_tailoring_service() -> TailoringService:
    """Get the tailoring service with dependencies."""
    ai_client = get_ai_client()
    cache = get_cache_service()
    resume_parser = ResumeParser(ai_client, cache)
    job_analyzer = JobAnalyzer(ai_client, cache)
    return TailoringService(ai_client, cache, resume_parser, job_analyzer)


@router.post("", response_model=TailorResponse, status_code=status.HTTP_201_CREATED)
async def tailor_resume(
    request: TailorRequest,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> TailorResponse:
    """Tailor a resume for a specific job using AI.

    Supports both user-created JobDescription (job_id) and
    system-wide JobListing from scrapers (job_listing_id).
    """
    pg = dbs["pg"]
    mongo = dbs["mongo"]

    # Verify resume exists and belongs to user (MongoDB)
    resume = await resume_crud.get(mongo, id=request.resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )

    # Get job content based on which source is provided (PostgreSQL)
    job_source_type: Literal["user_created", "job_listing"]
    if request.job_id is not None:
        # User-created job description
        job = await job_crud.get(pg, id=request.job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job description not found",
            )
        if job.owner_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this job description",
            )
        raw_job = job.raw_content
        job_source_type = "user_created"
        job_source_id = request.job_id
    else:
        # System-wide job listing from scraper
        job_listing = await job_listing_repository.get(pg, id=request.job_listing_id)
        if not job_listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job listing not found",
            )
        raw_job = job_listing.job_description
        job_source_type = "job_listing"
        job_source_id = request.job_listing_id

    # Run tailoring
    service = get_tailoring_service()
    result = await service.tailor(
        resume_id=request.resume_id,
        job_id=job_source_id,
        raw_resume=resume.raw_content,
        raw_job=raw_job,
    )

    # Convert suggestions to MongoDB format
    suggestions = []
    for i, s in enumerate(result.get("suggestions", [])):
        suggestions.append(Suggestion(
            id=f"suggestion_{i}",
            section=s.get("section", "unknown"),
            path=s.get("path", ""),
            original=s.get("original", ""),
            suggested=s.get("suggested", ""),
            reason=s.get("reason", ""),
            status="pending",
        ))

    # Save to MongoDB
    create_data = MongoTailoredResumeCreate(
        resume_id=request.resume_id,
        user_id=current_user_id,
        job_source=JobSource(type=job_source_type, id=job_source_id),
        content=json.dumps(result["tailored_content"]),
        suggestions=suggestions,
        match_score=result.get("match_score"),
    )
    tailored = await tailored_resume_crud.create(mongo, obj_in=create_data)

    return TailorResponse(
        id=str(tailored.id),
        resume_id=str(tailored.resume_id),
        job_id=request.job_id,
        job_listing_id=request.job_listing_id,
        tailored_content=result["tailored_content"],
        suggestions=result.get("suggestions", []),
        match_score=result.get("match_score", 0.0),
        skill_matches=result.get("skill_matches", []),
        skill_gaps=result.get("skill_gaps", []),
        keyword_coverage=result.get("keyword_coverage", 0.0),
        created_at=tailored.created_at,
    )


@router.post("/quick-match", response_model=QuickMatchResponse)
async def quick_match(
    request: QuickMatchRequest,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> QuickMatchResponse:
    """Get a quick match score between a resume and job without full tailoring.

    Supports both user-created JobDescription (job_id) and
    system-wide JobListing from scrapers (job_listing_id).
    """
    pg = dbs["pg"]
    mongo = dbs["mongo"]

    # Verify resume exists and belongs to user (MongoDB)
    resume = await resume_crud.get(mongo, id=request.resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )

    # Get job content based on which source is provided (PostgreSQL)
    if request.job_id is not None:
        # User-created job description
        job = await job_crud.get(pg, id=request.job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job description not found",
            )
        if job.owner_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this job description",
            )
        raw_job = job.raw_content
    else:
        # System-wide job listing from scraper
        job_listing = await job_listing_repository.get(pg, id=request.job_listing_id)
        if not job_listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job listing not found",
            )
        raw_job = job_listing.job_description

    # Get quick match
    service = get_tailoring_service()
    result = await service.get_quick_match_score(
        raw_resume=resume.raw_content,
        raw_job=raw_job,
    )

    return QuickMatchResponse(**result)


@router.get("/{tailored_id}", response_model=TailorResponse)
async def get_tailored_resume(
    tailored_id: str,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> TailorResponse:
    """Get a tailored resume by ID."""
    mongo = dbs["mongo"]

    tailored = await tailored_resume_crud.get(mongo, id=tailored_id)
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found",
        )

    # Verify ownership through user_id (denormalized)
    if tailored.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this tailored resume",
        )

    # Parse stored content
    tailored_content = json.loads(tailored.content)
    suggestions = [
        {
            "section": s.section,
            "type": "suggestion",
            "original": s.original,
            "suggested": s.suggested,
            "reason": s.reason,
            "impact": "medium",
        }
        for s in tailored.suggestions
    ]

    return TailorResponse(
        id=str(tailored.id),
        resume_id=str(tailored.resume_id),
        job_id=tailored.job_source.id if tailored.job_source.type == "user_created" else None,
        job_listing_id=tailored.job_source.id if tailored.job_source.type == "job_listing" else None,
        tailored_content=tailored_content,
        suggestions=suggestions,
        match_score=tailored.match_score or 0.0,
        skill_matches=[],  # Not stored, would need to recalculate
        skill_gaps=[],
        keyword_coverage=0.0,
        created_at=tailored.created_at,
    )


@router.patch("/{tailored_id}", response_model=TailoredResumeFullResponse)
async def update_tailored_resume(
    tailored_id: str,
    request: TailoredResumeUpdateRequest,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> TailoredResumeFullResponse:
    """Update a tailored resume's content, style settings, or section order."""
    mongo = dbs["mongo"]

    tailored = await tailored_resume_crud.get(mongo, id=tailored_id)
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found",
        )

    # Verify ownership
    if tailored.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this tailored resume",
        )

    # Build update
    update_data = MongoTailoredResumeUpdate(
        content=json.dumps(request.tailored_content.model_dump()) if request.tailored_content else None,
        section_order=request.section_order,
        style_settings=request.style_settings.model_dump(exclude_none=True) if request.style_settings else None,
    )
    updated = await tailored_resume_crud.update(mongo, id=tailored_id, obj_in=update_data)

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tailored resume",
        )

    # Parse stored content
    tailored_content = json.loads(updated.content)
    suggestions = [
        {
            "section": s.section,
            "type": "suggestion",
            "original": s.original,
            "suggested": s.suggested,
            "reason": s.reason,
            "impact": "medium",
        }
        for s in updated.suggestions
    ]

    return TailoredResumeFullResponse(
        id=str(updated.id),
        resume_id=str(updated.resume_id),
        job_id=updated.job_source.id if updated.job_source.type == "user_created" else None,
        job_listing_id=updated.job_source.id if updated.job_source.type == "job_listing" else None,
        tailored_content=tailored_content,
        suggestions=suggestions,
        match_score=updated.match_score or 0.0,
        skill_matches=[],
        skill_gaps=[],
        keyword_coverage=0.0,
        style_settings=updated.style_settings or {},
        section_order=updated.section_order,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.get("", response_model=list[TailoredResumeListResponse])
async def list_tailored_resumes(
    resume_id: str | None = None,
    job_id: int | None = None,
    job_listing_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> list[TailoredResumeListResponse]:
    """List tailored resumes, optionally filtered by resume, job, or job listing."""
    pg = dbs["pg"]
    mongo = dbs["mongo"]

    if resume_id:
        # Verify ownership
        if not await resume_crud.exists(mongo, id=resume_id, user_id=current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this resume",
            )
        tailored_list = await tailored_resume_crud.get_by_resume(
            mongo, resume_id=resume_id, skip=skip, limit=limit
        )
    elif job_id:
        # Verify ownership (user-created job descriptions)
        job = await job_crud.get(pg, id=job_id)
        if not job or job.owner_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this job",
            )
        tailored_list = await tailored_resume_crud.get_by_job_source(
            mongo, job_source_type="user_created", job_source_id=job_id
        )
    elif job_listing_id:
        # Job listings are system-wide, verify it exists
        job_listing = await job_listing_repository.get(pg, id=job_listing_id)
        if not job_listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job listing not found",
            )
        tailored_list = await tailored_resume_crud.get_by_job_source(
            mongo, job_source_type="job_listing", job_source_id=job_listing_id
        )
    else:
        # List all tailored resumes for the current user
        tailored_list = await tailored_resume_crud.get_by_user(
            mongo, user_id=current_user_id, skip=skip, limit=limit
        )

    return [
        TailoredResumeListResponse(
            id=str(t.id),
            resume_id=str(t.resume_id),
            job_id=t.job_source.id if t.job_source.type == "user_created" else None,
            job_listing_id=t.job_source.id if t.job_source.type == "job_listing" else None,
            match_score=t.match_score,
            created_at=t.created_at,
        )
        for t in tailored_list
    ]


@router.delete("/{tailored_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tailored_resume(
    tailored_id: str,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> None:
    """Delete a tailored resume."""
    mongo = dbs["mongo"]

    # Verify ownership
    if not await tailored_resume_crud.exists(mongo, id=tailored_id, user_id=current_user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found or not authorized",
        )

    await tailored_resume_crud.delete(mongo, id=tailored_id)
