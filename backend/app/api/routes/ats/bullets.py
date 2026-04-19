"""
ATS Bullet Analysis endpoint.

Analyzes bullet points against a job description and ATS keyword gaps,
returning improvement suggestions. This is the library-editor counterpart
to the tailor endpoint POST /tailor/{tailored_id}/analyze-bullets.
"""

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUserId, DatabaseSessionsWithRLS, resolve_ai_model
from app.api.utils.id_resolution import IDResolutionError, resolve_job_id
from app.crud.job import JobCRUD
from app.crud.job_listing import JobListingRepository
from app.crud.mongo.resume import ResumeCRUD as MongoResumeCRUD
from app.schemas.tailor.suggestions import (
    AnalyzeBulletsResponse,
    ATSContextInput,
    BulletAnalysisRequest,
    KeywordGapInput,
)
from app.services.ai import get_usage_tracker
from app.services.ai.client import AIServiceError, get_ai_client_for_model
from app.services.job.diff import BulletAnalyzer

router = APIRouter()


@router.post("/analyze-bullets", response_model=AnalyzeBulletsResponse)
async def analyze_bullets_for_resume(
    request: BulletAnalysisRequest,
    resume_id: str = Query(..., description="Resume MongoDB ObjectId"),
    job_id: str | None = Query(None, description="User-created job ID (UUID or int)"),
    job_listing_id: int | None = Query(
        None, description="Scraped job listing PostgreSQL ID"
    ),
    dbs: DatabaseSessionsWithRLS = ...,
    current_user_id: CurrentUserId = ...,
) -> AnalyzeBulletsResponse:
    """
    Analyze bullet points and suggest ATS-optimized improvements.

    This endpoint works with a resume + job pair directly (no tailored resume
    required), making it usable from the library editor when a job is linked.
    """
    pg = dbs["pg"]
    mongo = dbs["mongo"]

    # 1. Validate user owns the resume
    mongo_resume_repo = MongoResumeCRUD()
    mongo_resume = await mongo_resume_repo.get(mongo, id=resume_id)
    if not mongo_resume or mongo_resume.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or not authorized",
        )

    # 2. Fetch job description from job_id or job_listing_id
    if not job_id and not job_listing_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either job_id or job_listing_id",
        )

    job_description: str | None = None

    if job_listing_id:
        job_listing_repo = JobListingRepository()
        job_listing = await job_listing_repo.get(pg, id=job_listing_id)
        if not job_listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job listing not found",
            )
        job_description = str(job_listing.job_description or "")
    elif job_id:
        job_crud = JobCRUD()
        try:
            job = await resolve_job_id(
                pg,
                job_id,
                current_user_id,
                crud=job_crud,
                endpoint="/ats/analyze-bullets",
            )
            job_description = str(job.raw_content or "")
        except IDResolutionError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found",
            )

    if not job_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No job description available",
        )

    # 3. Resolve bullets and ATS context based on mode
    if request.keyword_assignments:
        # Targeted mode: user has assigned specific keywords to specific resume sections.
        # Only analyze bullets within those sections.
        assigned_section_ids = {a.section_id for a in request.keyword_assignments}
        bullets_to_analyze = [
            b for b in request.bullets
            if any(b.id.startswith(sec_id + ":bullet-") for sec_id in assigned_section_ids)
        ]
        if not bullets_to_analyze:
            return AnalyzeBulletsResponse(
                suggestions=[], total_analyzed=0, suggestions_count=0, skipped_count=0
            )

        assigned_keywords = {a.keyword for a in request.keyword_assignments}
        existing_gaps = [g for g in request.ats_context.keyword_gaps if g.keyword in assigned_keywords]
        targeted_gaps = existing_gaps or [
            KeywordGapInput(keyword=a.keyword, importance="required")
            for a in request.keyword_assignments
        ]
        ats_context_to_use = ATSContextInput(
            keyword_gaps=targeted_gaps,
            importance_map={g.keyword: g.importance for g in targeted_gaps},
            bullets_needing_metrics=[],
            bullets_with_weak_verbs=[],
        )
    else:
        # General mode: validate ATS context present
        if not request.ats_context.keyword_gaps:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ATS analysis required. Run ATS analysis before bullet suggestions.",
            )
        bullets_to_analyze = request.bullets
        ats_context_to_use = request.ats_context

    # 4. Run bullet analysis
    model = await resolve_ai_model(current_user_id, pg, "general")
    ai_client = get_ai_client_for_model(model)
    usage_tracker = get_usage_tracker()
    analyzer = BulletAnalyzer(ai_client)

    try:
        suggestions, ai_response = await analyzer.analyze_batch(
            bullets=bullets_to_analyze,
            job_description=job_description,
            ats_context=ats_context_to_use,
            return_metrics=True,
        )
    except AIServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service error: {str(e)}",
        )

    # 5. Log AI usage
    await usage_tracker.log_generation(
        db=pg,
        user_id=current_user_id,
        endpoint=f"/ats/analyze-bullets?resume_id={resume_id}",
        response=ai_response,
    )
    await pg.commit()

    # 6. Return response
    return AnalyzeBulletsResponse(
        suggestions=suggestions,
        total_analyzed=len(bullets_to_analyze),
        suggestions_count=len(suggestions),
        skipped_count=len(bullets_to_analyze) - len(suggestions),
    )
