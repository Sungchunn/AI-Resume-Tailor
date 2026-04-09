"""Resume tailoring API endpoints using MongoDB for resumes, PostgreSQL for jobs.

Two Copies Architecture:
- POST /tailor: Generate complete tailored resume (tailored_data)
- GET /{id}/compare: Fetch both original and tailored for frontend diffing
- POST /{id}/finalize: Save user's approved version (finalized_data)

Supports dual-lookup for job IDs during migration:
- UUID format (preferred): 550e8400-e29b-41d4-a716-446655440000
- Integer format (deprecated): 123
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import CurrentUserId, DatabaseSessionsWithRLS, resolve_ai_model
from app.api.utils.id_resolution import (
    IDResolutionError,
    add_deprecation_headers,
    is_uuid_format,
    resolve_job_id,
)
from app.crud import job_crud
from app.crud.job_listing import job_listing_repository
from app.crud.mongo import resume_crud, tailored_resume_crud

# Import for type hints in list_tailored_resumes (line 607)
from app.models.job import JobDescription
from app.models.mongo.tailored_resume import (
    JobSource,
    TailoredResumeStatus,
)
from app.models.mongo.tailored_resume import (
    TailoredResumeCreate as MongoTailoredResumeCreate,
)
from app.models.mongo.tailored_resume import (
    TailoredResumeFinalize as MongoTailoredResumeFinalize,
)
from app.models.mongo.tailored_resume import (
    TailoredResumeUpdate as MongoTailoredResumeUpdate,
)
from app.schemas.tailor import (
    QuickMatchRequest,
    QuickMatchResponse,
    TailoredResumeCompareResponse,
    TailoredResumeFinalizeRequest,
    TailoredResumeFullResponse,
    TailoredResumeListResponse,
    TailoredResumeUpdateRequest,
    TailorRequest,
    TailorResponse,
)
from app.schemas.tailor.suggestions import (
    AnalyzeBulletsResponse,
    BulletAnalysisRequest,
)
from app.services import (
    JobAnalyzer,
    ResumeParser,
    TailoringService,
    TailoringValidationError,
    get_cache_service,
)
from app.services.ai import get_usage_tracker
from app.services.ai.client import AIServiceError, get_ai_client_for_model
from app.services.job.diff import BulletAnalyzer

router = APIRouter()


def get_tailoring_service(ai_client=None) -> TailoringService:
    """Get the tailoring service with dependencies."""
    from app.services.ai.client import get_ai_client

    client = ai_client or get_ai_client()
    cache = get_cache_service()
    resume_parser = ResumeParser(client, cache)
    job_analyzer = JobAnalyzer(client, cache)
    return TailoringService(client, cache, resume_parser, job_analyzer)


@router.post("", response_model=TailorResponse, status_code=status.HTTP_201_CREATED)
async def tailor_resume(
    request: TailorRequest,
    response: Response,
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
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

    # Check if resume is parsed
    if not resume.parsed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume must be parsed before tailoring. Please parse your resume first.",
        )

    # Check if parsed content is verified
    if not getattr(resume, "parsed_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume parsed content must be verified before tailoring. "
                   "Please review and verify your parsed resume.",
            headers={"X-Redirect": f"/library/resumes/{request.resume_id}/verify"},
        )

    # Get job content based on which source is provided (PostgreSQL)
    job_source_type: Literal["user_created", "job_listing"]
    job_title: str | None = None
    company_name: str | None = None
    job_public_id: UUID | None = None  # For response

    if request.job_id is not None:
        # User-created job description - resolve UUID or integer ID
        if not is_uuid_format(request.job_id):
            add_deprecation_headers(response, "job")
        try:
            job = await resolve_job_id(
                pg, request.job_id, current_user_id, crud=job_crud,
                endpoint="/api/tailor"
            )
        except IDResolutionError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job description not found",
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
        raw_job = job.raw_content
        job_source_type = "user_created"
        job_source_id = job.id  # Store integer ID in MongoDB for backward compat
        job_public_id = job.public_id  # Return UUID in response
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
    model = await resolve_ai_model(current_user_id, pg, "general")
    ai_client = get_ai_client_for_model(model)
    service = get_tailoring_service(ai_client=ai_client)
    try:
        result = await service.tailor(
            resume_id=request.resume_id,
            job_id=job_source_id,
            raw_resume=resume.raw_content,
            raw_job=raw_job,
            original_parsed=resume.parsed.model_dump() if resume.parsed else {},
            focus_keywords=request.focus_keywords,
        )

        # Log AI usage metrics
        if "ai_metrics" in result:
            usage_tracker = get_usage_tracker()
            await usage_tracker.log_generation(
                db=pg,
                user_id=current_user_id,
                endpoint="/tailor",
                response=result["ai_metrics"],
            )
            await pg.commit()

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
        job_id=job_public_id,  # Return UUID, not the request string
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
    response: Response,
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
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
        # User-created job description - resolve UUID or integer ID
        if not is_uuid_format(request.job_id):
            add_deprecation_headers(response, "job")
        try:
            job = await resolve_job_id(
                pg, request.job_id, current_user_id, crud=job_crud,
                endpoint="/api/tailor/quick-match"
            )
        except IDResolutionError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job description not found",
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
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
    model = await resolve_ai_model(current_user_id, pg, "general")
    ai_client = get_ai_client_for_model(model)
    service = get_tailoring_service(ai_client=ai_client)
    result = await service.get_quick_match_score(
        raw_resume=resume.raw_content,
        raw_job=raw_job,
    )

    # Log AI usage metrics
    if "ai_metrics" in result:
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=pg,
            user_id=current_user_id,
            endpoint="/tailor/quick-match",
            response=result["ai_metrics"],
        )
        await pg.commit()
        # Remove ai_metrics before returning (not part of response schema)
        del result["ai_metrics"]

    return QuickMatchResponse(**result)


@router.get("/{tailored_id}", response_model=TailoredResumeFullResponse)
async def get_tailored_resume(
    tailored_id: str,
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
) -> TailoredResumeFullResponse:
    """Get a tailored resume by ID.

    Includes ATS cache metadata (Phase 5):
    - ats_score: Cached ATS composite score (if available)
    - ats_cached_at: When ATS analysis was last cached
    - is_outdated: True if resume content changed since ATS analysis
    """
    pg = dbs["pg"]
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
        job_int_id = tailored.job_source.id

        # Look up ATS cache
        ats_metadata = await cache.get_ats_metadata(resume_content_hash, job_int_id)
        if ats_metadata:
            ats_score = ats_metadata.get("final_score")
            cached_at_str = ats_metadata.get("cached_at")
            if cached_at_str:
                ats_cached_at = datetime.fromisoformat(cached_at_str.replace("Z", "+00:00"))

            # Check staleness: compare cached hash with current content hash
            cached_hash = ats_metadata.get("resume_content_hash")
            if cached_hash and cached_hash != resume_content_hash:
                is_outdated = True

    # Look up job public_id for user-created jobs
    job_public_id: UUID | None = None
    if tailored.job_source.type == "user_created":
        job = await job_crud.get(pg, id=tailored.job_source.id)
        if job:
            job_public_id = job.public_id

    return TailoredResumeFullResponse(
        id=str(tailored.id),
        resume_id=str(tailored.resume_id),
        job_id=job_public_id,
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
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
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
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
) -> TailoredResumeFullResponse:
    """Finalize a tailored resume with user's approved changes.

    Two Copies Architecture: The frontend sends the merged document
    (finalized_data) that the user built by accepting some AI changes
    and keeping some originals. This endpoint validates and stores it.
    """
    pg = dbs["pg"]
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

    # Look up job public_id for user-created jobs
    job_public_id: UUID | None = None
    if updated.job_source.type == "user_created":
        job = await job_crud.get(pg, id=updated.job_source.id)
        if job:
            job_public_id = job.public_id

    return TailoredResumeFullResponse(
        id=str(updated.id),
        resume_id=str(updated.resume_id),
        job_id=job_public_id,
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
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
) -> TailoredResumeFullResponse:
    """Update a tailored resume's content, style settings, or section order."""
    pg = dbs["pg"]
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

    # Look up job public_id for user-created jobs
    job_public_id: UUID | None = None
    if updated.job_source.type == "user_created":
        job = await job_crud.get(pg, id=updated.job_source.id)
        if job:
            job_public_id = job.public_id

    return TailoredResumeFullResponse(
        id=str(updated.id),
        resume_id=str(updated.resume_id),
        job_id=job_public_id,
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
    response: Response,
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
    resume_id: str | None = None,
    job_id: str | None = None,  # UUID or integer string
    job_listing_id: int | None = None,
    status_filter: TailoredResumeStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[TailoredResumeListResponse]:
    """List tailored resumes, optionally filtered by resume, job, job listing, or status."""
    pg = dbs["pg"]
    mongo = dbs["mongo"]

    resolved_job: "JobDescription | None" = None

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
        # Verify ownership (user-created job descriptions) - resolve UUID or integer
        if not is_uuid_format(job_id):
            add_deprecation_headers(response, "job")
        try:
            resolved_job = await resolve_job_id(
                pg, job_id, current_user_id, crud=job_crud,
                endpoint="/api/tailor"
            )
        except IDResolutionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this job",
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
        tailored_list = await tailored_resume_crud.get_by_job_source(
            mongo, job_source_type="user_created", job_source_id=resolved_job.id, status=status_filter
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

    # Batch fetch job public_ids for user-created jobs in the response
    user_job_ids = {
        t.job_source.id for t in tailored_list
        if t.job_source.type == "user_created"
    }
    job_id_to_public_id: dict[int, UUID] = {}
    if user_job_ids:
        jobs = await job_crud.get_by_ids(pg, ids=list(user_job_ids))
        job_id_to_public_id = {j.id: j.public_id for j in jobs}

    return [
        TailoredResumeListResponse(
            id=str(t.id),
            resume_id=str(t.resume_id),
            job_id=job_id_to_public_id.get(t.job_source.id) if t.job_source.type == "user_created" else None,
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
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
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


@router.post(
    "/{tailored_id}/analyze-bullets",
    response_model=AnalyzeBulletsResponse,
)
async def analyze_bullets(
    tailored_id: str,
    request: BulletAnalysisRequest,
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
) -> AnalyzeBulletsResponse:
    """
    Analyze bullet points and suggest ATS-optimized improvements.

    Requires ATS analysis to be completed first for keyword-aware suggestions.
    Returns suggestions only for bullets that genuinely need improvement.
    """
    pg = dbs["pg"]
    mongo = dbs["mongo"]

    # 1. Validate user owns the tailored resume
    tailored = await tailored_resume_crud.get(mongo, id=tailored_id)
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found",
        )
    if tailored.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

    # 2. Fetch job description based on job source
    job_description = await _fetch_job_description(
        pg,
        job_source=tailored.job_source,
    )
    if not job_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No job description available for this tailored resume",
        )

    # 3. Validate ATS context is provided (required prerequisite)
    if not request.ats_context.keyword_gaps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ATS analysis required. Run ATS analysis before bullet suggestions.",
        )

    # 4. Run bullet analysis
    model = await resolve_ai_model(current_user_id, pg, "general")
    ai_client = get_ai_client_for_model(model)
    usage_tracker = get_usage_tracker()
    analyzer = BulletAnalyzer(ai_client)

    try:
        suggestions, ai_response = await analyzer.analyze_batch(
            bullets=request.bullets,
            job_description=job_description,
            ats_context=request.ats_context,
            return_metrics=True,
        )
    except AIServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service error: {str(e)}",
        )

    # 5. Log AI usage (required per CLAUDE.md)
    await usage_tracker.log_generation(
        db=pg,
        user_id=current_user_id,
        endpoint=f"/tailor/{tailored_id}/analyze-bullets",
        response=ai_response,
    )
    await pg.commit()

    # 6. Return response
    return AnalyzeBulletsResponse(
        suggestions=suggestions,
        total_analyzed=len(request.bullets),
        suggestions_count=len(suggestions),
        skipped_count=len(request.bullets) - len(suggestions),
    )


async def _fetch_job_description(
    pg,
    job_source: JobSource,
) -> str | None:
    """Fetch job description from user job or scraped listing."""
    if job_source.type == "user_created":
        job = await job_crud.get(pg, id=job_source.id)
        return job.raw_content if job else None

    if job_source.type == "job_listing":
        listing = await job_listing_repository.get(pg, id=job_source.id)
        return listing.job_description if listing else None

    return None
