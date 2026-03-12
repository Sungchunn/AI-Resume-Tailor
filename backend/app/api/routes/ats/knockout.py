"""
ATS Stage 0: Knockout Check

Identifies binary disqualifiers that would cause automatic rejection.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.crud.job import JobCRUD
from app.services.job.ats import get_ats_analyzer
from app.services.resume.parser import ResumeParser
from app.services.job.analyzer import JobAnalyzer
from app.services.ai.client import get_ai_client
from app.services.core.cache import get_cache_service

from app.schemas.ats import (
    KnockoutCheckRequest,
    KnockoutCheckResponse,
    KnockoutRiskResponse,
)

router = APIRouter()


@router.post("/knockout-check", response_model=KnockoutCheckResponse)
async def perform_knockout_check(
    request: KnockoutCheckRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform knockout check to identify binary disqualifiers.

    This is Stage 0 of the ATS scoring pipeline. It identifies hard
    disqualifiers that would cause automatic rejection by most ATS systems
    BEFORE calculating the actual match score.

    **What it checks:**
    - **Years of experience** vs. job requirement
    - **Education level** vs. job requirement
    - **Required certifications** presence on resume
    - **Location/work authorization** compatibility

    **Usage:**
    Provide either database IDs (resume_id, job_id) or raw text content.
    If both are provided, IDs take precedence.

    **Response interpretation:**
    - `passes_all_checks: true` - No knockout risks, proceed to keyword analysis
    - `passes_all_checks: false` - Review the risks before applying
    - `severity: critical` - Likely auto-rejection by ATS
    - `severity: warning` - May affect application, worth addressing
    """
    analyzer = get_ats_analyzer()
    ai_client = get_ai_client()
    cache = get_cache_service()
    resume_parser = ResumeParser(ai_client, cache)
    job_analyzer = JobAnalyzer(ai_client, cache)

    parsed_resume = None
    parsed_job = None

    # Get parsed resume (resume_id lookup removed - use progressive endpoint for DB lookups)
    if request.resume_content:
        parsed_resume = await resume_parser.parse(request.resume_content)
    else:
        raise HTTPException(
            status_code=400,
            detail="resume_content must be provided. Use /analyze-progressive endpoint for database lookups."
        )

    # Get parsed job
    if request.job_id:
        job_repo = JobCRUD()
        job = await job_repo.get(db, id=request.job_id)
        if not job or job.owner_id != user_id:
            raise HTTPException(
                status_code=404,
                detail=f"Job description with id {request.job_id} not found"
            )
        if job.parsed_content:
            parsed_job = job.parsed_content
        elif job.raw_content:
            parsed_job = await job_analyzer.analyze(job.raw_content)
        else:
            raise HTTPException(
                status_code=400,
                detail="Job description has no content to analyze"
            )
    elif request.job_description:
        parsed_job = await job_analyzer.analyze(request.job_description)
    else:
        raise HTTPException(
            status_code=400,
            detail="Either job_id or job_description must be provided"
        )

    # Perform knockout check
    result = analyzer.perform_knockout_check(parsed_resume, parsed_job)

    # Convert dataclass to response model
    risks = [
        KnockoutRiskResponse(
            risk_type=risk.risk_type,
            severity=risk.severity,
            description=risk.description,
            job_requires=risk.job_requires,
            user_has=risk.user_has,
        )
        for risk in result.risks
    ]

    return KnockoutCheckResponse(
        passes_all_checks=result.passes_all_checks,
        risks=risks,
        summary=result.summary,
        recommendation=result.recommendation,
        analysis=result.analysis,
    )
