import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.crud import resume_crud, job_crud
from app.crud.job_listing import job_listing_repository
from app.crud.tailor import tailored_resume_crud
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
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> TailorResponse:
    """Tailor a resume for a specific job using AI.

    Supports both user-created JobDescription (job_id) and
    system-wide JobListing from scrapers (job_listing_id).
    """
    # Verify resume exists and belongs to user
    resume = await resume_crud.get(db, id=request.resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )

    # Get job content based on which source is provided
    if request.job_id is not None:
        # User-created job description
        job = await job_crud.get(db, id=request.job_id)
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
        job_listing = await job_listing_repository.get(db, id=request.job_listing_id)
        if not job_listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job listing not found",
            )
        raw_job = job_listing.job_description

    # Run tailoring
    service = get_tailoring_service()
    result = await service.tailor(
        resume_id=request.resume_id,
        job_id=request.job_id or request.job_listing_id,
        raw_resume=resume.raw_content,
        raw_job=raw_job,
    )

    # Save to database
    tailored = await tailored_resume_crud.create(
        db,
        resume_id=request.resume_id,
        job_id=request.job_id,
        job_listing_id=request.job_listing_id,
        tailored_content=result["tailored_content"],
        suggestions=result["suggestions"],
        match_score=result["match_score"],
    )

    return TailorResponse(
        id=tailored.id,
        resume_id=tailored.resume_id,
        job_id=tailored.job_id,
        job_listing_id=tailored.job_listing_id,
        tailored_content=result["tailored_content"],
        suggestions=result["suggestions"],
        match_score=result["match_score"],
        skill_matches=result.get("skill_matches", []),
        skill_gaps=result.get("skill_gaps", []),
        keyword_coverage=result.get("keyword_coverage", 0.0),
        created_at=tailored.created_at,
    )


@router.post("/quick-match", response_model=QuickMatchResponse)
async def quick_match(
    request: QuickMatchRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> QuickMatchResponse:
    """Get a quick match score between a resume and job without full tailoring.

    Supports both user-created JobDescription (job_id) and
    system-wide JobListing from scrapers (job_listing_id).
    """
    # Verify resume exists and belongs to user
    resume = await resume_crud.get(db, id=request.resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )

    # Get job content based on which source is provided
    if request.job_id is not None:
        # User-created job description
        job = await job_crud.get(db, id=request.job_id)
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
        job_listing = await job_listing_repository.get(db, id=request.job_listing_id)
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
    tailored_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> TailorResponse:
    """Get a tailored resume by ID."""
    tailored = await tailored_resume_crud.get(db, id=tailored_id)
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found",
        )

    # Verify ownership through original resume
    resume = await resume_crud.get(db, id=tailored.resume_id)
    if not resume or resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this tailored resume",
        )

    # Parse stored content
    tailored_content = json.loads(tailored.tailored_content)
    suggestions = tailored.suggestions or []

    return TailorResponse(
        id=tailored.id,
        resume_id=tailored.resume_id,
        job_id=tailored.job_id,
        job_listing_id=tailored.job_listing_id,
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
    tailored_id: int,
    request: TailoredResumeUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> TailoredResumeFullResponse:
    """Update a tailored resume's content, style settings, or section order."""
    tailored = await tailored_resume_crud.get(db, id=tailored_id)
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found",
        )

    # Verify ownership through original resume
    resume = await resume_crud.get(db, id=tailored.resume_id)
    if not resume or resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this tailored resume",
        )

    # Update the tailored resume
    updated = await tailored_resume_crud.update(
        db,
        id=tailored_id,
        tailored_content=request.tailored_content.model_dump() if request.tailored_content else None,
        style_settings=request.style_settings.model_dump(exclude_none=True) if request.style_settings else None,
        section_order=request.section_order,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tailored resume",
        )

    # Parse stored content
    tailored_content = json.loads(updated.tailored_content)
    suggestions = updated.suggestions or []

    return TailoredResumeFullResponse(
        id=updated.id,
        resume_id=updated.resume_id,
        job_id=updated.job_id,
        job_listing_id=updated.job_listing_id,
        tailored_content=tailored_content,
        suggestions=suggestions,
        match_score=updated.match_score or 0.0,
        skill_matches=[],
        skill_gaps=[],
        keyword_coverage=0.0,
        style_settings=updated.style_settings or {},
        section_order=updated.section_order or ["summary", "experience", "skills", "education", "projects"],
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.get("", response_model=list[TailoredResumeListResponse])
async def list_tailored_resumes(
    resume_id: int | None = None,
    job_id: int | None = None,
    job_listing_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> list[TailoredResumeListResponse]:
    """List tailored resumes, optionally filtered by resume, job, or job listing."""
    if resume_id:
        # Verify ownership
        resume = await resume_crud.get(db, id=resume_id)
        if not resume or resume.owner_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this resume",
            )
        tailored_list = await tailored_resume_crud.get_by_resume(
            db, resume_id=resume_id, skip=skip, limit=limit
        )
    elif job_id:
        # Verify ownership (user-created job descriptions)
        job = await job_crud.get(db, id=job_id)
        if not job or job.owner_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this job",
            )
        tailored_list = await tailored_resume_crud.get_by_job(
            db, job_id=job_id, skip=skip, limit=limit
        )
    elif job_listing_id:
        # Job listings are system-wide, verify it exists
        job_listing = await job_listing_repository.get(db, id=job_listing_id)
        if not job_listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job listing not found",
            )
        tailored_list = await tailored_resume_crud.get_by_job_listing(
            db, job_listing_id=job_listing_id, skip=skip, limit=limit
        )
    else:
        # List all tailored resumes for the current user
        tailored_list = await tailored_resume_crud.get_by_user(
            db, user_id=current_user_id, skip=skip, limit=limit
        )

    return [TailoredResumeListResponse.model_validate(t) for t in tailored_list]


@router.delete("/{tailored_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tailored_resume(
    tailored_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> None:
    """Delete a tailored resume."""
    tailored = await tailored_resume_crud.get(db, id=tailored_id)
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found",
        )

    # Verify ownership through original resume
    resume = await resume_crud.get(db, id=tailored.resume_id)
    if not resume or resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this tailored resume",
        )

    await tailored_resume_crud.delete(db, id=tailored_id)
