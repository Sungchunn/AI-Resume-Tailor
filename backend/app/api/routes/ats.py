"""
ATS Analysis API Routes

Provides endpoints for ATS (Applicant Tracking System) compatibility analysis.
"""

import json
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user_id, get_current_user_id_sse, get_db, get_mongo_db
from app.crud.block import BlockRepository
from app.crud.job import JobCRUD
from app.crud.job_listing import JobListingRepository
from app.crud.mongo.resume import ResumeCRUD as MongoResumeCRUD
from app.services.job.ats import get_ats_analyzer
from app.services.resume.parser import ResumeParser
from app.services.job.analyzer import JobAnalyzer
from app.services.ai.client import get_ai_client
from app.services.core.cache import get_cache_service

# Import all schemas from the modularized schema package
from app.schemas.ats import (
    # Stage 0: Knockout
    KnockoutCheckRequest,
    KnockoutCheckResponse,
    KnockoutRiskResponse,
    # Stage 1: Structure
    ATSStructureRequest,
    ATSStructureResponse,
    SectionOrderDetails,
    # Stage 2: Keywords
    ATSKeywordRequest,
    ATSKeywordResponse,
    ATSTipsResponse,
    KeywordDetailResponse,
    ATSKeywordDetailedRequest,
    ATSKeywordDetailedResponse,
    KeywordMatchResponse,
    EnhancedKeywordDetailResponse,
    GapAnalysisItem,
    ATSKeywordEnhancedRequest,
    ATSKeywordEnhancedResponse,
    # Stage 3: Content Quality
    BlockTypeAnalysisResponse,
    QuantificationAnalysisResponse,
    ActionVerbAnalysisResponse,
    ContentQualityRequest,
    ContentQualityResponse,
    # Stage 4: Role Proximity
    RoleProximityRequest,
    RoleProximityResponse,
    TitleMatchResponse,
    TrajectoryResponse,
    IndustryAlignmentResponse,
    # Progressive SSE
    ATSProgressiveRequest,
    ATSCompositeScore,
)

router = APIRouter()


# ============================================================
# Stage 0: Knockout Check
# ============================================================


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


# ============================================================
# Stage 1: Structure Analysis
# ============================================================


@router.post("/structure", response_model=ATSStructureResponse)
async def analyze_structure(
    request: ATSStructureRequest,
    user_id: int = Depends(get_current_user_id),
):
    """
    Analyze resume structure for ATS compatibility.

    Checks:
    - Standard section headers (Experience, Education, Skills, etc.)
    - Contact information presence
    - Section order validation (some ATS like Taleo penalize non-standard order)
    - Formatting issues that may cause parsing problems

    **Section Order Scoring:**
    - 100: Standard order (Contact → Summary → Experience → Education → Skills → Certifications)
    - 95: Minor deviation (e.g., Skills before Education)
    - 85: Major deviation (e.g., Education before Experience)
    - 75: Completely non-standard order

    Returns a score and actionable suggestions for improvement.
    """
    analyzer = get_ats_analyzer()
    result = analyzer.analyze_structure(request.resume_content)

    return ATSStructureResponse(
        format_score=result["format_score"],
        sections_found=result["sections_found"],
        sections_missing=result["sections_missing"],
        section_order_score=result["section_order_score"],
        section_order_details=SectionOrderDetails(
            detected_order=result["section_order_details"]["detected_order"],
            expected_order=result["section_order_details"]["expected_order"],
            deviation_type=result["section_order_details"]["deviation_type"],
            issues=result["section_order_details"]["issues"],
        ),
        warnings=result["warnings"],
        suggestions=result["suggestions"],
    )


# ============================================================
# Stage 2: Keyword Analysis
# ============================================================


@router.post("/keywords", response_model=ATSKeywordResponse)
async def analyze_keywords(
    request: ATSKeywordRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze keyword coverage for a job description.

    Compares job requirements against:
    1. Blocks currently in the resume
    2. All blocks in the user's Vault

    Returns:
    - Keywords matched in resume
    - Keywords missing but available in Vault (can be added)
    - Keywords not in Vault (user may lack this experience)
    """
    analyzer = get_ats_analyzer()
    block_repo = BlockRepository()

    # Get all vault blocks
    vault_blocks = await block_repo.list_blocks(db, user_id=user_id, limit=500)

    # Get resume blocks (either specified or all)
    if request.resume_block_ids:
        resume_blocks = [
            block for block in vault_blocks
            if block.id in request.resume_block_ids
        ]
    else:
        resume_blocks = vault_blocks

    if not resume_blocks:
        raise HTTPException(
            status_code=400,
            detail="No blocks found for analysis. Create some experience blocks first.",
        )

    result = await analyzer.analyze_keywords(
        resume_blocks=resume_blocks,
        job_description=request.job_description,
        vault_blocks=vault_blocks,
    )

    return ATSKeywordResponse(
        keyword_coverage=result.keyword_coverage,
        matched_keywords=result.matched_keywords,
        missing_keywords=result.missing_keywords,
        missing_from_vault=result.missing_from_vault,
        warnings=result.warnings,
        suggestions=result.suggestions,
    )


@router.post("/keywords/detailed", response_model=ATSKeywordDetailedResponse)
async def analyze_keywords_detailed(
    request: ATSKeywordDetailedRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform detailed keyword analysis with importance levels.

    This endpoint provides comprehensive keyword analysis including:
    - Keywords grouped by importance (required, preferred, nice-to-have)
    - Coverage percentages for each importance level
    - Vault availability for missing keywords
    - Actionable suggestions prioritized by importance

    Use this for the ATS Keywords Panel in the resume editor.
    """
    analyzer = get_ats_analyzer()
    block_repo = BlockRepository()

    # Get all vault blocks
    vault_blocks = await block_repo.list_blocks(db, user_id=user_id, limit=500)

    # Determine resume content source
    if request.resume_content:
        # Use provided resume content directly
        resume_blocks = [{"content": request.resume_content, "id": 0}]
    elif request.resume_block_ids:
        # Use specified block IDs
        resume_blocks = [
            block for block in vault_blocks
            if block.id in request.resume_block_ids
        ]
    else:
        # Use all vault blocks as resume
        resume_blocks = vault_blocks

    if not resume_blocks:
        raise HTTPException(
            status_code=400,
            detail="No resume content found for analysis. Provide resume_content or create vault blocks.",
        )

    result = await analyzer.analyze_keywords_detailed(
        resume_blocks=resume_blocks,
        job_description=request.job_description,
        vault_blocks=vault_blocks,
    )

    # Convert KeywordDetail dataclasses to response models
    all_keywords = [
        KeywordDetailResponse(
            keyword=kw.keyword,
            importance=kw.importance,
            found_in_resume=kw.found_in_resume,
            found_in_vault=kw.found_in_vault,
            frequency_in_job=kw.frequency_in_job,
            context=kw.context,
        )
        for kw in result.all_keywords
    ]

    return ATSKeywordDetailedResponse(
        coverage_score=result.coverage_score,
        required_coverage=result.required_coverage,
        preferred_coverage=result.preferred_coverage,
        required_matched=result.required_matched,
        required_missing=result.required_missing,
        preferred_matched=result.preferred_matched,
        preferred_missing=result.preferred_missing,
        nice_to_have_matched=result.nice_to_have_matched,
        nice_to_have_missing=result.nice_to_have_missing,
        missing_available_in_vault=result.missing_available_in_vault,
        missing_not_in_vault=result.missing_not_in_vault,
        all_keywords=all_keywords,
        suggestions=result.suggestions,
        warnings=result.warnings,
    )


@router.post("/keywords/enhanced", response_model=ATSKeywordEnhancedResponse)
async def analyze_keywords_enhanced(
    request: ATSKeywordEnhancedRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform Stage 2 enhanced keyword analysis with weighted scoring.

    This is the most comprehensive keyword analysis endpoint, implementing
    the full Stage 2 scoring pipeline:

    **Stage 2.1 - Placement Weighting:**
    Keywords are weighted based on where they appear:
    - Experience bullets: 1.0x (demonstrated experience)
    - Projects: 0.9x (applied knowledge)
    - Skills section: 0.7x (listed but not demonstrated)
    - Summary: 0.6x (claims without evidence)
    - Education: 0.5x (academic context)

    **Stage 2.2 - Density Scoring:**
    Repetition matters, but with diminishing returns:
    - 1 occurrence: 1.0x
    - 2 occurrences: 1.3x
    - 3+ occurrences: 1.5x (capped)

    **Stage 2.3 - Recency Weighting:**
    Keywords in recent roles are weighted higher:
    - Most recent 2 roles: 2.0x
    - Third most recent: 1.0x
    - Older roles: 0.8x

    **Stage 2.4 - Importance Tiers:**
    Keywords are weighted by importance:
    - Required: 3.0x
    - Strongly Preferred: 2.0x
    - Preferred: 1.5x
    - Nice to Have: 1.0x

    **Use this endpoint when you need:**
    - The most accurate keyword matching score
    - Detailed breakdown of scoring factors
    - Gap analysis prioritized by importance
    - Actionable suggestions for improvement
    """
    analyzer = get_ats_analyzer()
    block_repo = BlockRepository()

    # Get vault blocks for gap analysis
    vault_blocks = await block_repo.list_blocks(db, user_id=user_id, limit=500)

    # Get parsed resume (resume_id lookup removed - use progressive endpoint for DB lookups)
    if request.resume_content:
        parsed_resume = request.resume_content
    else:
        raise HTTPException(
            status_code=400,
            detail="resume_content must be provided. Use /analyze-progressive endpoint for database lookups."
        )

    # Perform enhanced keyword analysis
    result = await analyzer.analyze_keywords_enhanced(
        parsed_resume=parsed_resume,
        job_description=request.job_description,
        vault_blocks=vault_blocks,
    )

    # Convert dataclasses to response models
    all_keywords = [
        EnhancedKeywordDetailResponse(
            keyword=kw.keyword,
            importance=kw.importance,
            found_in_resume=kw.found_in_resume,
            found_in_vault=kw.found_in_vault,
            frequency_in_job=kw.frequency_in_job,
            context=kw.context,
            matches=[
                KeywordMatchResponse(
                    section=m.section,
                    role_index=m.role_index,
                    text_snippet=m.text_snippet,
                )
                for m in kw.matches
            ],
            occurrence_count=kw.occurrence_count,
            base_score=kw.base_score,
            placement_score=kw.placement_score,
            density_score=kw.density_score,
            recency_score=kw.recency_score,
            importance_weight=kw.importance_weight,
            weighted_score=kw.weighted_score,
        )
        for kw in result.all_keywords
    ]

    gap_list = [
        GapAnalysisItem(
            keyword=gap["keyword"],
            importance=gap["importance"],
            in_vault=gap["in_vault"],
            suggestion=gap["suggestion"],
        )
        for gap in result.gap_list
    ]

    return ATSKeywordEnhancedResponse(
        keyword_score=result.keyword_score,
        raw_coverage=result.raw_coverage,
        required_coverage=result.required_coverage,
        strongly_preferred_coverage=result.strongly_preferred_coverage,
        preferred_coverage=result.preferred_coverage,
        nice_to_have_coverage=result.nice_to_have_coverage,
        placement_contribution=result.placement_contribution,
        density_contribution=result.density_contribution,
        recency_contribution=result.recency_contribution,
        required_matched=result.required_matched,
        required_missing=result.required_missing,
        strongly_preferred_matched=result.strongly_preferred_matched,
        strongly_preferred_missing=result.strongly_preferred_missing,
        preferred_matched=result.preferred_matched,
        preferred_missing=result.preferred_missing,
        nice_to_have_matched=result.nice_to_have_matched,
        nice_to_have_missing=result.nice_to_have_missing,
        missing_available_in_vault=result.missing_available_in_vault,
        missing_not_in_vault=result.missing_not_in_vault,
        gap_list=gap_list,
        all_keywords=all_keywords,
        suggestions=result.suggestions,
        warnings=result.warnings,
    )


@router.get("/tips", response_model=ATSTipsResponse)
async def get_ats_tips():
    """
    Get general ATS optimization tips.

    Returns actionable advice for making resumes more ATS-friendly.
    These are general best practices that apply to most ATS systems.

    Note: Different ATS systems have different parsing behaviors.
    These tips improve compatibility with most systems but cannot
    guarantee universal compatibility.
    """
    analyzer = get_ats_analyzer()
    tips = analyzer.get_ats_tips()

    return ATSTipsResponse(tips=tips)


# ============================================================
# Stage 3: Content Quality
# ============================================================


@router.post("/content-quality", response_model=ContentQualityResponse)
async def analyze_content_quality(
    request: ContentQualityRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform Stage 3 content quality analysis on a resume.

    This endpoint analyzes the quality of resume content across three dimensions:

    **Block Type Analysis (40% weight):**
    Evaluates the ratio of achievement-oriented vs responsibility-oriented bullets.
    - Achievement bullets: contain metrics, outcomes, and strong action verbs
    - Responsibility bullets: describe duties without measurable outcomes
    - Target: 60%+ achievement/project bullets for optimal ATS performance

    **Quantification Density (35% weight):**
    Measures the percentage of bullets containing quantified metrics.
    Detects: percentages (%), currency ($), quantities (users, projects),
    multiples (3x improvement), time metrics, and rankings.
    - Target: 50%+ of bullets should contain metrics

    **Action Verb Analysis (25% weight):**
    Analyzes use of strong action verbs vs weak/passive phrases.
    - Strong verbs: Led, Built, Increased, Delivered, Achieved
    - Weak phrases: Responsible for, Assisted with, Helped with
    - Target: 80%+ bullets with action verbs, <20% with weak phrases

    **Usage:**
    Provide either resume_id (uses parsed_content from database) or
    resume_content (parsed resume dictionary). Resume_id takes precedence.

    **Response includes:**
    - Overall content quality score (0-100)
    - Component scores for each dimension
    - Detailed analysis with bullet-level breakdown
    - Actionable suggestions for improvement
    - Warnings about quality issues
    """
    analyzer = get_ats_analyzer()

    # Get parsed resume (resume_id lookup removed - use progressive endpoint for DB lookups)
    if request.resume_content:
        parsed_resume = request.resume_content
    else:
        raise HTTPException(
            status_code=400,
            detail="resume_content must be provided. Use /analyze-progressive endpoint for database lookups."
        )

    # Perform content quality analysis
    result = analyzer.analyze_content_quality(parsed_resume)

    # Convert dataclasses to response models
    return ContentQualityResponse(
        content_quality_score=result.content_quality_score,
        block_type_score=result.block_type_score,
        quantification_score=result.quantification_score,
        action_verb_score=result.action_verb_score,
        block_type_weight=result.block_type_weight,
        quantification_weight=result.quantification_weight,
        action_verb_weight=result.action_verb_weight,
        block_type_analysis=BlockTypeAnalysisResponse(
            total_bullets=result.block_type_analysis.total_bullets,
            achievement_count=result.block_type_analysis.achievement_count,
            responsibility_count=result.block_type_analysis.responsibility_count,
            project_count=result.block_type_analysis.project_count,
            other_count=result.block_type_analysis.other_count,
            achievement_ratio=result.block_type_analysis.achievement_ratio,
            quality_score=result.block_type_analysis.quality_score,
        ),
        quantification_analysis=QuantificationAnalysisResponse(
            total_bullets=result.quantification_analysis.total_bullets,
            quantified_bullets=result.quantification_analysis.quantified_bullets,
            quantification_density=result.quantification_analysis.quantification_density,
            quality_score=result.quantification_analysis.quality_score,
            metrics_found=result.quantification_analysis.metrics_found,
            bullets_needing_metrics=result.quantification_analysis.bullets_needing_metrics,
        ),
        action_verb_analysis=ActionVerbAnalysisResponse(
            total_bullets=result.action_verb_analysis.total_bullets,
            bullets_with_action_verbs=result.action_verb_analysis.bullets_with_action_verbs,
            bullets_with_weak_phrases=result.action_verb_analysis.bullets_with_weak_phrases,
            action_verb_coverage=result.action_verb_analysis.action_verb_coverage,
            weak_phrase_ratio=result.action_verb_analysis.weak_phrase_ratio,
            quality_score=result.action_verb_analysis.quality_score,
            verb_category_distribution=result.action_verb_analysis.verb_category_distribution,
        ),
        total_bullets_analyzed=result.total_bullets_analyzed,
        high_quality_bullets=result.high_quality_bullets,
        low_quality_bullets=result.low_quality_bullets,
        suggestions=result.suggestions,
        warnings=result.warnings,
    )


# ============================================================
# Stage 4: Role Proximity
# ============================================================


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


# ============================================================================
# Progressive ATS Analysis with Server-Sent Events (SSE)
# ============================================================================


@router.get("/analyze-progressive")
async def analyze_progressive_ats(
    resume_id: str | None = Query(None, description="Resume MongoDB ObjectId"),
    job_id: int | None = Query(None, description="User-created job PostgreSQL ID"),
    job_listing_id: int | None = Query(None, description="Scraped job listing PostgreSQL ID"),
    force_refresh: bool = Query(False, description="Skip cache and run fresh analysis"),
    user_id: int = Depends(get_current_user_id_sse),
    db: AsyncSession = Depends(get_db),
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
):
    """
    Run complete ATS analysis with real-time progress updates via SSE.

    This endpoint orchestrates all 5 ATS stages and streams progress events:

    **Event Types:**
    - `cache_hit`: Cached results found, returning fast playback
    - `cache_miss`: No cached results, running full analysis
    - `stage_start`: Stage N is beginning
    - `stage_complete`: Stage N completed successfully (includes result data)
    - `stage_error`: Stage N failed (includes error message, continues to next stage)
    - `score_calculation`: Calculating final composite score
    - `complete`: All stages finished, composite score ready
    - `error`: Fatal error that aborts entire analysis

    **Caching Behavior:**
    - Cache key: `ats:{resume_content_hash[:16]}:{job_id}`
    - TTL: 24 hours
    - On cache hit, streams cached results as fast playback
    - On cache miss, runs full pipeline and caches results

    **Client Usage:**
    ```javascript
    const eventSource = new EventSource('/api/v1/ats/analyze-progressive?resume_id=123&job_id=456');
    eventSource.addEventListener('stage_complete', (e) => {
      const data = JSON.parse(e.data);
      console.log(`Stage ${data.stage} done:`, data.result);
    });
    ```
    """
    # Get cache service for ATS result caching
    cache = get_cache_service()

    async def event_generator():
        nonlocal resume_id, job_id, job_listing_id
        start_time = time.time()
        stage_results = {}
        failed_stages = []
        resume_content_hash: str | None = None
        effective_job_id: int | None = None
        parsed_resume_content: dict = {}
        job_description: str = ""

        # Stage metadata
        stages = [
            (0, "knockout-check", "Knockout Risk Check"),
            (1, "structure", "Structure Analysis"),
            (2, "keywords-enhanced", "Keyword Matching"),
            (3, "content-quality", "Content Quality"),
            (4, "role-proximity", "Role Proximity"),
        ]

        try:
            # Validate input - need resume_id AND (job_id OR job_listing_id)
            if not resume_id or not (job_id or job_listing_id):
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "error": "Must provide resume_id and either job_id or job_listing_id"
                    })
                }
                return

            # Fetch resume from MongoDB using ObjectId string
            mongo_resume_repo = MongoResumeCRUD()
            mongo_resume = await mongo_resume_repo.get(mongo_db, id=resume_id)
            if not mongo_resume or mongo_resume.user_id != user_id:
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Resume not found or not authorized"})
                }
                return

            raw_resume_content = mongo_resume.raw_content or ""
            parsed_resume_content = mongo_resume.parsed.model_dump() if mongo_resume.parsed else {}
            resume_content_hash = cache.hash_content(raw_resume_content)

            # Fetch job description from job_listings or job_descriptions table
            job_content: dict = {}
            if job_listing_id:
                job_listing_repo = JobListingRepository()
                job_listing = await job_listing_repo.get(db, id=job_listing_id)
                if not job_listing:
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": "Job listing not found"})
                    }
                    return
                job_description = str(job_listing.job_description or "")
                effective_job_id = job_listing_id
                job_content = {
                    "title": str(job_listing.job_title or ""),
                    "company": str(job_listing.company_name or ""),
                    "location": str(job_listing.location or ""),
                    "seniority": str(job_listing.seniority or ""),
                    "job_function": str(job_listing.job_function or ""),
                    "industry": str(job_listing.industry or ""),
                    "description": job_description,
                }
            elif job_id:
                job_repo = JobCRUD()
                job = await job_repo.get(db, id=job_id)
                if not job or job.owner_id != user_id:
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": "Job not found or not authorized"})
                    }
                    return
                job_description = str(job.raw_content or "")
                effective_job_id = job_id
                parsed = job.parsed_content
                if parsed and isinstance(parsed, dict):
                    job_content = parsed
                else:
                    job_content = {
                        "title": str(getattr(job, 'title', "") or ""),
                        "company": str(getattr(job, 'company', "") or ""),
                        "description": job_description,
                    }

            # Build request object with fetched content for helper functions
            request = ATSProgressiveRequest(
                resume_content=parsed_resume_content,
                job_description=job_description,
                job_content=job_content,
            )

            # Check cache before running analysis (skip if force_refresh is True)
            cached_result = None if force_refresh else await cache.get_ats_result(resume_content_hash, effective_job_id)
            if cached_result:
                cached_at = cached_result.get("cached_at", "")
                yield {
                    "event": "cache_hit",
                    "data": json.dumps({
                        "cached_at": cached_at,
                        "resume_content_hash": resume_content_hash,
                    })
                }

                cached_stages = cached_result.get("stage_results", {})
                for idx, (stage_num, stage_key, stage_name) in enumerate(stages):
                    progress_percent = int(((idx + 1) / len(stages)) * 100)

                    if stage_key in cached_stages:
                        yield {
                            "event": "stage_complete",
                            "data": json.dumps({
                                "stage": stage_num,
                                "stage_name": stage_name,
                                "status": "completed",
                                "progress_percent": progress_percent,
                                "elapsed_ms": 0,
                                "result": cached_stages[stage_key],
                                "from_cache": True,
                            })
                        }
                    else:
                        failed_stages.append(stage_name)

                cached_knockout_risks = []
                cached_knockout = cached_stages.get("knockout-check", {})
                if cached_knockout:
                    cached_knockout_risks = cached_knockout.get("risks", [])

                composite_score = cached_result.get("composite_score", {})
                yield {
                    "event": "complete",
                    "data": json.dumps({
                        "stage": 5,
                        "stage_name": "Complete",
                        "status": "completed",
                        "progress_percent": 100,
                        "elapsed_ms": int((time.time() - start_time) * 1000),
                        "composite_score": composite_score,
                        "knockout_risks": cached_knockout_risks,
                        "from_cache": True,
                        "cached_at": cached_at,
                    })
                }
                return

            yield {
                "event": "cache_miss",
                "data": json.dumps({
                    "resume_content_hash": resume_content_hash,
                    "job_id": effective_job_id,
                })
            }

            for idx, (stage_num, stage_key, stage_name) in enumerate(stages):
                stage_start = time.time()
                progress_percent = int((idx / len(stages)) * 100)

                yield {
                    "event": "stage_start",
                    "data": json.dumps({
                        "stage": stage_num,
                        "stage_name": stage_name,
                        "status": "running",
                        "progress_percent": progress_percent,
                    })
                }

                try:
                    if stage_num == 0:
                        result = await _execute_knockout_check(request, user_id, db)
                    elif stage_num == 1:
                        result = await _execute_structure_analysis(request, user_id, db)
                    elif stage_num == 2:
                        result = await _execute_keyword_analysis(request, user_id, db)
                    elif stage_num == 3:
                        result = await _execute_content_quality(request, user_id, db)
                    elif stage_num == 4:
                        result = await _execute_role_proximity(request, user_id, db)

                    stage_elapsed = int((time.time() - stage_start) * 1000)
                    progress_percent = int(((idx + 1) / len(stages)) * 100)

                    stage_results[stage_key] = result

                    yield {
                        "event": "stage_complete",
                        "data": json.dumps({
                            "stage": stage_num,
                            "stage_name": stage_name,
                            "status": "completed",
                            "progress_percent": progress_percent,
                            "elapsed_ms": stage_elapsed,
                            "result": result.model_dump() if hasattr(result, 'model_dump') else result,
                        })
                    }

                except Exception as e:
                    stage_elapsed = int((time.time() - stage_start) * 1000)
                    failed_stages.append(stage_name)

                    yield {
                        "event": "stage_error",
                        "data": json.dumps({
                            "stage": stage_num,
                            "stage_name": stage_name,
                            "status": "failed",
                            "progress_percent": progress_percent,
                            "elapsed_ms": stage_elapsed,
                            "error": str(e),
                        })
                    }

            yield {
                "event": "score_calculation",
                "data": json.dumps({
                    "stage": 5,
                    "stage_name": "Calculating Final Score",
                    "status": "running",
                    "progress_percent": 95,
                })
            }

            composite_score = _calculate_composite_score(stage_results, failed_stages)
            total_elapsed = int((time.time() - start_time) * 1000)

            if resume_content_hash and effective_job_id and stage_results and not failed_stages:
                cacheable_stage_results = {}
                for key, result in stage_results.items():
                    if hasattr(result, 'model_dump'):
                        cacheable_stage_results[key] = result.model_dump()
                    else:
                        cacheable_stage_results[key] = result

                await cache.set_ats_result(
                    resume_content_hash=resume_content_hash,
                    job_id=effective_job_id,
                    composite_score=composite_score.model_dump(),
                    stage_results=cacheable_stage_results,
                )

            knockout_risks = []
            knockout_result = stage_results.get("knockout-check")
            if knockout_result:
                if hasattr(knockout_result, 'model_dump'):
                    knockout_data = knockout_result.model_dump()
                else:
                    knockout_data = knockout_result
                knockout_risks = knockout_data.get("risks", [])

            yield {
                "event": "complete",
                "data": json.dumps({
                    "stage": 5,
                    "stage_name": "Complete",
                    "status": "completed",
                    "progress_percent": 100,
                    "elapsed_ms": total_elapsed,
                    "composite_score": composite_score.model_dump(),
                    "knockout_risks": knockout_risks,
                    "from_cache": False,
                })
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({
                    "error": f"Fatal error during ATS analysis: {str(e)}"
                })
            }

    return EventSourceResponse(event_generator())


# ============================================================================
# Progressive Analysis Helper Functions
# ============================================================================


async def _execute_knockout_check(request: ATSProgressiveRequest, user_id: int, db: AsyncSession):
    """Execute Stage 0: Knockout Check."""
    resume_text = None
    if request.resume_content:
        parts = []
        contact = request.resume_content.get("contact", {})
        if contact:
            if contact.get("name"):
                parts.append(contact["name"])
            if contact.get("email"):
                parts.append(contact["email"])
            if contact.get("location"):
                parts.append(contact["location"])

        if request.resume_content.get("summary"):
            parts.append(request.resume_content["summary"])

        for exp in request.resume_content.get("experience", []):
            if exp.get("title"):
                parts.append(exp["title"])
            if exp.get("company"):
                parts.append(exp["company"])
            if exp.get("dates"):
                parts.append(exp["dates"])
            for bullet in exp.get("bullets", []):
                parts.append(bullet)

        for edu in request.resume_content.get("education", []):
            if edu.get("degree"):
                parts.append(edu["degree"])
            if edu.get("institution"):
                parts.append(edu["institution"])

        skills = request.resume_content.get("skills", [])
        if skills:
            parts.extend(skills)

        for cert in request.resume_content.get("certifications", []):
            if isinstance(cert, str):
                parts.append(cert)
            elif isinstance(cert, dict) and cert.get("name"):
                parts.append(cert["name"])

        resume_text = "\n".join(parts)

    knockout_request = KnockoutCheckRequest(
        resume_id=request.resume_id,
        job_id=request.job_id,
        resume_content=resume_text,
        job_description=request.job_description,
    )
    return await perform_knockout_check(knockout_request, user_id, db)


async def _execute_structure_analysis(request: ATSProgressiveRequest, user_id: int, db: AsyncSession):
    """Execute Stage 1: Structure Analysis."""
    resume_content = request.resume_content or {}
    structure_request = ATSStructureRequest(resume_content=resume_content)
    return await analyze_structure(structure_request, user_id)


async def _execute_keyword_analysis(request: ATSProgressiveRequest, user_id: int, db: AsyncSession):
    """Execute Stage 2: Enhanced Keyword Analysis."""
    keyword_request = ATSKeywordEnhancedRequest(
        resume_id=request.resume_id,
        resume_content=request.resume_content,
        job_description=request.job_description or "",
    )
    return await analyze_keywords_enhanced(keyword_request, user_id, db)


async def _execute_content_quality(request: ATSProgressiveRequest, user_id: int, db: AsyncSession):
    """Execute Stage 3: Content Quality."""
    content_request = ContentQualityRequest(
        resume_id=request.resume_id,
        resume_content=request.resume_content,
    )
    return await analyze_content_quality(content_request, user_id, db)


async def _execute_role_proximity(request: ATSProgressiveRequest, user_id: int, db: AsyncSession):
    """Execute Stage 4: Role Proximity."""
    proximity_request = RoleProximityRequest(
        resume_id=request.resume_id,
        job_id=request.job_id,
        resume_content=request.resume_content,
        job_content=request.job_content,
    )
    return await analyze_role_proximity(proximity_request, user_id, db)


def _calculate_composite_score(
    stage_results: dict,
    failed_stages: list[str]
) -> ATSCompositeScore:
    """
    Calculate weighted composite ATS score.

    Standard weights:
    - Structure: 15%
    - Keywords: 40%
    - Content Quality: 25%
    - Role Proximity: 20%

    If stages fail, renormalize remaining weights to sum to 1.0.
    """
    weights = {
        "structure": 0.15,
        "keywords-enhanced": 0.40,
        "content-quality": 0.25,
        "role-proximity": 0.20,
    }

    scores = {}
    available_weight = 0.0

    for stage_key, weight in weights.items():
        if stage_key in stage_results:
            result = stage_results[stage_key]

            if stage_key == "structure":
                scores[stage_key] = float(result.format_score)
            elif stage_key == "keywords-enhanced":
                scores[stage_key] = float(result.keyword_score)
            elif stage_key == "content-quality":
                scores[stage_key] = float(result.content_quality_score)
            elif stage_key == "role-proximity":
                scores[stage_key] = float(result.role_proximity_score)

            available_weight += weight

    normalization_applied = available_weight < 1.0
    if normalization_applied and available_weight > 0:
        normalization_factor = 1.0 / available_weight
        weights = {k: v * normalization_factor if k in scores else 0 for k, v in weights.items()}

    final_score = sum(scores[k] * weights.get(k, 0) for k in scores) if scores else 0.0

    stage_breakdown = {
        k: round(scores[k] * weights.get(k, 0), 2) for k in scores
    }

    return ATSCompositeScore(
        final_score=round(final_score, 1),
        stage_breakdown=stage_breakdown,
        weights_used={k: round(v, 3) for k, v in weights.items()},
        normalization_applied=normalization_applied,
        failed_stages=failed_stages,
    )
