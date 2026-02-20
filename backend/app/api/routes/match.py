"""
Match Router - Semantic Search API.

Provides semantic matching endpoints for finding relevant experience blocks
based on job descriptions.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.core.protocols import BlockType
from app.schemas.block import (
    MatchRequest,
    MatchResponse,
    GapAnalysisResponse,
    SemanticMatchResult,
    BlockResponse,
)

router = APIRouter()


@router.post("", response_model=MatchResponse)
async def match_blocks(
    match_in: MatchRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> MatchResponse:
    """
    Find experience blocks that match a job description.

    Uses semantic search to find the most relevant blocks from the user's
    Vault based on the job description text.
    """
    from app.services.ai.semantic_matcher import get_semantic_matcher

    matcher = get_semantic_matcher()

    matches = await matcher.match(
        db=db,
        user_id=current_user_id,
        job_description=match_in.job_description,
        limit=match_in.limit,
        block_types=match_in.block_types,
        tags=match_in.tags,
    )

    # Get total vault blocks for context
    from app.crud.block import block_repository
    total_blocks = await block_repository.count(db, user_id=current_user_id)

    # Extract keywords from job description for response
    query_keywords = await matcher.extract_keywords(match_in.job_description)

    return MatchResponse(
        matches=[
            SemanticMatchResult(
                block=BlockResponse.model_validate(m["block"]),
                score=m["score"],
                matched_keywords=m.get("matched_keywords", []),
            )
            for m in matches
        ],
        query_keywords=query_keywords,
        total_vault_blocks=total_blocks,
    )


@router.post("/analyze", response_model=GapAnalysisResponse)
async def analyze_gaps(
    match_in: MatchRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> GapAnalysisResponse:
    """
    Analyze skill gaps between job requirements and user's experience.

    First performs semantic matching, then analyzes which job requirements
    are well-covered and which have gaps.
    """
    from app.services.ai.semantic_matcher import get_semantic_matcher

    matcher = get_semantic_matcher()

    # First get matches
    matches = await matcher.match(
        db=db,
        user_id=current_user_id,
        job_description=match_in.job_description,
        limit=match_in.limit,
        block_types=match_in.block_types,
        tags=match_in.tags,
    )

    # Then analyze gaps
    gap_analysis = await matcher.analyze_gaps(
        db=db,
        user_id=current_user_id,
        job_description=match_in.job_description,
        matched_blocks=matches,
    )

    return GapAnalysisResponse(
        match_score=gap_analysis["match_score"],
        skill_matches=gap_analysis["skill_matches"],
        skill_gaps=gap_analysis["skill_gaps"],
        keyword_coverage=gap_analysis["keyword_coverage"],
        recommendations=gap_analysis["recommendations"],
    )


@router.get("/job/{job_id}", response_model=MatchResponse)
async def get_cached_match(
    job_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> MatchResponse:
    """
    Get cached match results for a job.

    If a job has been analyzed before, returns cached results.
    Otherwise fetches the job description and performs matching.
    """
    from app.services.ai.semantic_matcher import get_semantic_matcher
    from app.services.core.cache import get_cache_service
    from app.crud.job import job_crud
    from app.crud.block import block_repository

    # Get job from database
    job = await job_crud.get(db, id=job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    if job.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this job",
        )

    # Check cache
    cache = get_cache_service()
    cache_key = f"match:{current_user_id}:{job_id}:{limit}"
    cached_result = await cache.get(cache_key)

    if cached_result:
        return MatchResponse.model_validate(cached_result)

    # Perform matching
    matcher = get_semantic_matcher()

    matches = await matcher.match(
        db=db,
        user_id=current_user_id,
        job_description=job.raw_content,
        limit=limit,
    )

    total_blocks = await block_repository.count(db, user_id=current_user_id)
    query_keywords = await matcher.extract_keywords(job.raw_content)

    result = MatchResponse(
        matches=[
            SemanticMatchResult(
                block=BlockResponse.model_validate(m["block"]),
                score=m["score"],
                matched_keywords=m.get("matched_keywords", []),
            )
            for m in matches
        ],
        query_keywords=query_keywords,
        total_vault_blocks=total_blocks,
    )

    # Cache result for 15 minutes
    await cache.set(cache_key, result.model_dump(), ttl_seconds=900)

    return result
