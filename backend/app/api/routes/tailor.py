"""Resume tailoring API endpoints using MongoDB for resumes, PostgreSQL for jobs.

Two Copies Architecture:
- POST /tailor: Generate complete tailored resume (tailored_data)
- GET /{id}/compare: Fetch both original and tailored for frontend diffing
- POST /{id}/finalize: Save user's approved version (finalized_data)
"""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_databases, get_current_user_id, DatabaseSessions
from app.crud import job_crud
from app.crud.job_listing import job_listing_repository
from app.crud.mongo import resume_crud, tailored_resume_crud
from app.models.mongo.tailored_resume import (
    TailoredResumeCreate as MongoTailoredResumeCreate,
    TailoredResumeUpdate as MongoTailoredResumeUpdate,
    TailoredResumeFinalize as MongoTailoredResumeFinalize,
    TailoredResumeStatus,
    JobSource,
)
from app.schemas.tailor import (
    TailorRequest,
    TailorResponse,
    QuickMatchRequest,
    QuickMatchResponse,
    TailoredResumeListResponse,
    TailoredResumeUpdateRequest,
    TailoredResumeFullResponse,
    TailoredResumeCompareResponse,
    TailoredResumeFinalizeRequest,
)
from app.services import (
    get_ai_client,
    get_cache_service,
    ResumeParser,
    JobAnalyzer,
    TailoringService,
    TailoringValidationError,
)
from app.services.ai.client import AIServiceError

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

    Two Copies Architecture: Returns complete tailored_data (not suggestions).
    Frontend should call GET /{id}/compare to get both original and tailored
    for client-side diffing.

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
    job_title: str | None = None
    company_name: str | None = None

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
        job_title = job.title  # type: ignore[assignment]
        company_name = job.company  # type: ignore[assignment]
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
        job_title = job_listing.job_title  # type: ignore[assignment]
        company_name = job_listing.company_name  # type: ignore[assignment]

    # Run tailoring - now returns complete tailored document
    service = get_tailoring_service()
    try:
        result = await service.tailor(
            resume_id=request.resume_id,
            job_id=job_source_id,
            raw_resume=resume.raw_content,
            raw_job=raw_job,
            original_parsed=resume.parsed.model_dump() if resume.parsed else {},
            focus_keywords=request.focus_keywords,
        )
    except TailoringValidationError as e:
        # AI output failed Pydantic validation even after retry
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "AI failed to generate valid tailored resume after retry",
                "errors": e.validation_errors,
            },
        )
    except AIServiceError as e:
        # AI service unavailable or API error
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service error: {str(e)}",
        )

    # Save to MongoDB with complete tailored_data
    create_data = MongoTailoredResumeCreate(
        resume_id=request.resume_id,
        user_id=current_user_id,
        job_source=JobSource(type=job_source_type, id=job_source_id),
        tailored_data=result["tailored_content"],
        match_score=result.get("match_score"),
        job_title=job_title,
        company_name=company_name,
    )
    tailored = await tailored_resume_crud.create(mongo, obj_in=create_data)

    return TailorResponse(
        id=str(tailored.id),
        resume_id=str(tailored.resume_id),
        job_id=request.job_id,
        job_listing_id=request.job_listing_id,
        tailored_data=tailored.tailored_data,
        status=tailored.status,
        match_score=result.get("match_score", 0.0),
        skill_matches=result.get("skill_matches", []),
        skill_gaps=result.get("skill_gaps", []),
        keyword_coverage=result.get("keyword_coverage", 0.0),
        job_title=job_title,
        company_name=company_name,
        focus_keywords_used=request.focus_keywords,
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


@router.get("/{tailored_id}", response_model=TailoredResumeFullResponse)
async def get_tailored_resume(
    tailored_id: str,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> TailoredResumeFullResponse:
    """Get a tailored resume by ID.

    Includes ATS cache metadata (Phase 5):
    - ats_score: Cached ATS composite score (if available)
    - ats_cached_at: When ATS analysis was last cached
    - is_outdated: True if resume content changed since ATS analysis
    """
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

    # Get ATS cache metadata (Phase 5)
    ats_score: float | None = None
    ats_cached_at = None
    is_outdated = False

    cache = get_cache_service()

    # Get the original resume to compute content hash for cache lookup
    original_resume = await resume_crud.get(mongo, id=str(tailored.resume_id))
    if original_resume and original_resume.raw_content:
        resume_content_hash = cache.hash_content(original_resume.raw_content)
        job_id = tailored.job_source.id

        # Look up ATS cache
        ats_metadata = await cache.get_ats_metadata(resume_content_hash, job_id)
        if ats_metadata:
            ats_score = ats_metadata.get("final_score")
            cached_at_str = ats_metadata.get("cached_at")
            if cached_at_str:
                ats_cached_at = datetime.fromisoformat(cached_at_str.replace("Z", "+00:00"))

            # Check staleness: compare cached hash with current content hash
            cached_hash = ats_metadata.get("resume_content_hash")
            if cached_hash and cached_hash != resume_content_hash:
                is_outdated = True

    return TailoredResumeFullResponse(
        id=str(tailored.id),
        resume_id=str(tailored.resume_id),
        job_id=tailored.job_source.id if tailored.job_source.type == "user_created" else None,
        job_listing_id=tailored.job_source.id if tailored.job_source.type == "job_listing" else None,
        tailored_data=tailored.tailored_data,
        finalized_data=tailored.finalized_data,
        status=tailored.status,
        match_score=tailored.match_score,
        job_title=tailored.job_title,
        company_name=tailored.company_name,
        style_settings=tailored.style_settings or {},
        section_order=tailored.section_order,
        created_at=tailored.created_at,
        updated_at=tailored.updated_at,
        finalized_at=tailored.finalized_at,
        # ATS cache metadata (Phase 5)
        ats_score=ats_score,
        ats_cached_at=ats_cached_at,
        is_outdated=is_outdated,
    )


@router.get("/{tailored_id}/compare", response_model=TailoredResumeCompareResponse)
async def get_compare_data(
    tailored_id: str,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> TailoredResumeCompareResponse:
    """Get both original and tailored resume for frontend diffing.

    This is the critical endpoint for the Two Copies architecture.
    Returns both the original resume's parsed content and the AI-generated
    tailored_data so the frontend can compute diffs client-side.
    """
    mongo = dbs["mongo"]

    compare_data = await tailored_resume_crud.get_compare_data(mongo, id=tailored_id)
    if not compare_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume or original resume not found",
        )

    tailored = compare_data.tailored_resume

    # Verify ownership
    if tailored.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this tailored resume",
        )

    return TailoredResumeCompareResponse(
        id=str(tailored.id),
        resume_id=str(tailored.resume_id),
        original=compare_data.original_parsed,
        tailored=tailored.tailored_data,
        status=tailored.status,
        match_score=tailored.match_score,
        job_title=tailored.job_title,
        company_name=tailored.company_name,
    )


@router.post("/{tailored_id}/finalize", response_model=TailoredResumeFullResponse)
async def finalize_tailored_resume(
    tailored_id: str,
    request: TailoredResumeFinalizeRequest,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> TailoredResumeFullResponse:
    """Finalize a tailored resume with user's approved changes.

    Two Copies Architecture: The frontend sends the merged document
    (finalized_data) that the user built by accepting some AI changes
    and keeping some originals. This endpoint validates and stores it.
    """
    mongo = dbs["mongo"]

    # Verify ownership
    tailored = await tailored_resume_crud.get(mongo, id=tailored_id)
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found",
        )

    if tailored.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to finalize this tailored resume",
        )

    # Check if already finalized
    if tailored.status == TailoredResumeStatus.FINALIZED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This tailored resume has already been finalized",
        )

    # Finalize with the user's merged document
    finalize_data = MongoTailoredResumeFinalize(finalized_data=request.finalized_data)
    updated = await tailored_resume_crud.finalize(mongo, id=tailored_id, obj_in=finalize_data)

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to finalize tailored resume",
        )

    return TailoredResumeFullResponse(
        id=str(updated.id),
        resume_id=str(updated.resume_id),
        job_id=updated.job_source.id if updated.job_source.type == "user_created" else None,
        job_listing_id=updated.job_source.id if updated.job_source.type == "job_listing" else None,
        tailored_data=updated.tailored_data,
        finalized_data=updated.finalized_data,
        status=updated.status,
        match_score=updated.match_score,
        job_title=updated.job_title,
        company_name=updated.company_name,
        style_settings=updated.style_settings or {},
        section_order=updated.section_order,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
        finalized_at=updated.finalized_at,
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
        tailored_data=request.tailored_data,
        section_order=request.section_order,
        style_settings=request.style_settings,
    )
    updated = await tailored_resume_crud.update(mongo, id=tailored_id, obj_in=update_data)

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tailored resume",
        )

    return TailoredResumeFullResponse(
        id=str(updated.id),
        resume_id=str(updated.resume_id),
        job_id=updated.job_source.id if updated.job_source.type == "user_created" else None,
        job_listing_id=updated.job_source.id if updated.job_source.type == "job_listing" else None,
        tailored_data=updated.tailored_data,
        finalized_data=updated.finalized_data,
        status=updated.status,
        match_score=updated.match_score,
        job_title=updated.job_title,
        company_name=updated.company_name,
        style_settings=updated.style_settings or {},
        section_order=updated.section_order,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
        finalized_at=updated.finalized_at,
    )


@router.get("", response_model=list[TailoredResumeListResponse])
async def list_tailored_resumes(
    resume_id: str | None = None,
    job_id: int | None = None,
    job_listing_id: int | None = None,
    status_filter: TailoredResumeStatus | None = None,
    skip: int = 0,
    limit: int = 100,
    dbs: DatabaseSessions = Depends(get_databases),
    current_user_id: int = Depends(get_current_user_id),
) -> list[TailoredResumeListResponse]:
    """List tailored resumes, optionally filtered by resume, job, job listing, or status."""
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
            mongo, resume_id=resume_id, status=status_filter, skip=skip, limit=limit
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
            mongo, job_source_type="user_created", job_source_id=job_id, status=status_filter
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
            mongo, job_source_type="job_listing", job_source_id=job_listing_id, status=status_filter
        )
    else:
        # List all tailored resumes for the current user
        tailored_list = await tailored_resume_crud.get_by_user(
            mongo, user_id=current_user_id, status=status_filter, skip=skip, limit=limit
        )

    return [
        TailoredResumeListResponse(
            id=str(t.id),
            resume_id=str(t.resume_id),
            job_id=t.job_source.id if t.job_source.type == "user_created" else None,
            job_listing_id=t.job_source.id if t.job_source.type == "job_listing" else None,
            status=t.status,
            match_score=t.match_score,
            job_title=t.job_title,
            company_name=t.company_name,
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
