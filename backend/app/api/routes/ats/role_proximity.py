"""
ATS Stage 4: Role Proximity Analysis

Analyzes career trajectory alignment with target role.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.crud.job import JobCRUD
from app.services.job.ats import get_ats_analyzer
from app.services.job.analyzer import JobAnalyzer
from app.services.ai.client import get_ai_client
from app.services.core.cache import get_cache_service

from app.schemas.ats import (
    RoleProximityRequest,
    RoleProximityResponse,
    TitleMatchResponse,
    TrajectoryResponse,
    IndustryAlignmentResponse,
)

router = APIRouter()


@router.post("/role-proximity", response_model=RoleProximityResponse)
async def analyze_role_proximity(
    request: RoleProximityRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform Stage 4 role proximity analysis.

    This endpoint analyzes how closely the candidate's career trajectory
    aligns with the target role, providing insights beyond keyword matching.

    **Why This Matters:**

    A candidate can have 95% keyword match but still be wrong for the role
    if there's a significant level mismatch or function change. Role proximity
    explains why high keyword scores don't always translate to ATS success.

    **Components Analyzed:**

    **Title Match (Base Score 0-100):**
    - Semantic similarity between current and target titles
    - Seniority level extraction and comparison
    - Functional category matching (engineering, product, design, etc.)

    **Career Trajectory (Modifier -20 to +20):**
    - Level progression analysis across career history
    - Whether target role is a logical next step
    - Trajectory types: progressing_toward (+20), lateral (+10), step_down (-10),
      large_gap (-15), career_change (-5)

    **Industry Alignment (Modifier 0 to +10):**
    - Industry detection from company and context
    - Same industry (+10), adjacent (+5), unrelated (0)

    **Score Interpretation:**
    - 80-100: Strong fit - title, trajectory, and industry align
    - 60-79: Good fit - minor gaps in level or function
    - 40-59: Moderate fit - career change or level jump
    - 20-39: Weak fit - significant mismatch
    - 0-19: Poor fit - very different role type

    **Usage:**
    Provide either database IDs (resume_id, job_id) or raw parsed content.
    IDs take precedence if both are provided.
    """
    analyzer = get_ats_analyzer()
    ai_client = get_ai_client()
    cache = get_cache_service()
    job_analyzer = JobAnalyzer(ai_client, cache)

    parsed_resume = None
    parsed_job = None

    # Get parsed resume (resume_id lookup removed - use progressive endpoint for DB lookups)
    if request.resume_content:
        parsed_resume = request.resume_content
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
    elif request.job_content:
        parsed_job = request.job_content
    else:
        raise HTTPException(
            status_code=400,
            detail="Either job_id or job_content must be provided"
        )

    # Perform role proximity analysis
    result = await analyzer.calculate_role_proximity_score(parsed_resume, parsed_job)

    # Convert dataclasses to response models
    return RoleProximityResponse(
        role_proximity_score=result.role_proximity_score,
        title_match=TitleMatchResponse(
            resume_title=result.title_match.resume_title,
            job_title=result.title_match.job_title,
            normalized_resume_title=result.title_match.normalized_resume_title,
            normalized_job_title=result.title_match.normalized_job_title,
            similarity_score=result.title_match.similarity_score,
            title_score=result.title_match.title_score,
            resume_level=result.title_match.resume_level,
            job_level=result.title_match.job_level,
            level_gap=result.title_match.level_gap,
            resume_function=result.title_match.resume_function,
            job_function=result.title_match.job_function,
            function_match=result.title_match.function_match,
        ),
        trajectory=TrajectoryResponse(
            trajectory_type=result.trajectory.trajectory_type,
            modifier=result.trajectory.modifier,
            current_level=result.trajectory.current_level,
            target_level=result.trajectory.target_level,
            level_gap=result.trajectory.level_gap,
            level_progression=result.trajectory.level_progression,
            is_ascending=result.trajectory.is_ascending,
            function_match=result.trajectory.function_match,
            explanation=result.trajectory.explanation,
        ),
        industry_alignment=IndustryAlignmentResponse(
            resume_industries=result.industry_alignment.resume_industries,
            most_recent_industry=result.industry_alignment.most_recent_industry,
            target_industry=result.industry_alignment.target_industry,
            alignment_type=result.industry_alignment.alignment_type,
            modifier=result.industry_alignment.modifier,
        ),
        explanation=result.explanation,
        concerns=result.concerns,
        strengths=result.strengths,
    )
