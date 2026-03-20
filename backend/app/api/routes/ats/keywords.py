"""
ATS Stage 2: Keyword Analysis

All keyword-related endpoints including basic, detailed, and enhanced analysis.
Also includes keyword extraction with context and user override endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db, get_mongo_db
from app.crud.block import BlockRepository
from app.crud.mongo import keyword_override_crud
from app.models.mongo.keyword_override import (
    KeywordOverrideCreate,
    KeywordEntry,
    compute_job_content_hash,
)
from app.services.job.ats import get_ats_analyzer
from app.services.job.ats.analyzers.keyword.extractor import KeywordExtractor

from app.schemas.ats import (
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
    # New schemas for keyword review
    KeywordWithContext,
    ExtractKeywordsRequest,
    ExtractKeywordsResponse,
    KeywordOverrideRequest,
    KeywordOverrideResponse,
    GetKeywordOverrideResponse,
)

router = APIRouter()


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
# Keyword Extraction with Context (for Review Step)
# ============================================================


@router.post("/keywords/extract", response_model=ExtractKeywordsResponse)
async def extract_keywords_with_context(
    request: ExtractKeywordsRequest,
    user_id: int = Depends(get_current_user_id),
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    db: AsyncSession = Depends(get_db),
):
    """
    Extract keywords from job description with context sentences.

    This endpoint performs section-aware keyword extraction:
    1. Parses the JD into sections (Requirements, Nice to Have, etc.)
    2. Extracts keywords using AI
    3. For each keyword, finds the sentence where it appears
    4. Assigns importance based on section (Requirements → required)

    Use this before the keyword review step to show users what
    keywords were extracted and where they appear.
    """
    extractor = KeywordExtractor()

    # Extract keywords with context and metrics
    keywords_data, ai_metrics = await extractor.extract_keywords_with_context(
        job_description=request.job_description,
        return_metrics=True,
    )

    # Log AI usage
    if ai_metrics:
        from app.services.ai import get_usage_tracker

        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=db,
            user_id=user_id,
            endpoint="/ats/keywords/extract",
            response=ai_metrics,
        )
        await db.commit()

    # Convert to response schema
    keywords = [
        KeywordWithContext(
            keyword=kw["keyword"],
            importance=kw["importance"],
            context=kw["context"],
            source_section=kw["source_section"],
            frequency=kw["frequency"],
            user_added=False,
            user_modified=False,
        )
        for kw in keywords_data
    ]

    # Calculate section breakdown
    section_breakdown: dict[str, int] = {}
    for kw in keywords_data:
        section = kw["source_section"] or "other"
        section_breakdown[section] = section_breakdown.get(section, 0) + 1

    # Check if user has cached overrides
    has_cached = await keyword_override_crud.exists(
        mongo_db,
        user_id=user_id,
        job_listing_id=request.job_listing_id,
        job_id=request.job_id,
    )

    return ExtractKeywordsResponse(
        keywords=keywords,
        section_breakdown=section_breakdown,
        has_cached_override=has_cached,
    )


@router.get("/keywords/override", response_model=GetKeywordOverrideResponse | None)
async def get_keyword_override(
    job_listing_id: int | None = Query(None, description="Job listing ID"),
    job_id: int | None = Query(None, description="Job ID"),
    job_description: str | None = Query(None, description="Job description for staleness check"),
    user_id: int = Depends(get_current_user_id),
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
):
    """
    Get user's saved keyword overrides for a job.

    Returns the user's edited keyword list if they have previously
    reviewed and saved keywords for this job.

    If job_description is provided, checks if the saved keywords
    are stale (JD content changed since last review).
    """
    if not job_listing_id and not job_id:
        raise HTTPException(
            status_code=400,
            detail="Either job_listing_id or job_id must be provided",
        )

    override = await keyword_override_crud.get(
        mongo_db,
        user_id=user_id,
        job_listing_id=job_listing_id,
        job_id=job_id,
    )

    if not override:
        return None

    # Check staleness if JD provided
    is_stale = False
    if job_description:
        current_hash = compute_job_content_hash(job_description)
        is_stale = override.job_content_hash != current_hash

    # Convert to response schema
    keywords = [
        KeywordWithContext(
            keyword=kw.keyword,
            importance=kw.importance,
            context=kw.context,
            source_section=kw.source_section,
            frequency=kw.frequency,
            user_added=kw.user_added,
            user_modified=kw.user_modified,
        )
        for kw in override.keywords
    ]

    original_keywords = [
        KeywordWithContext(
            keyword=kw.keyword,
            importance=kw.importance,
            context=kw.context,
            source_section=kw.source_section,
            frequency=kw.frequency,
            user_added=kw.user_added,
            user_modified=kw.user_modified,
        )
        for kw in override.original_keywords
    ]

    return GetKeywordOverrideResponse(
        keywords=keywords,
        original_keywords=original_keywords,
        reviewed=override.reviewed,
        is_stale=is_stale,
    )


@router.put("/keywords/override", response_model=KeywordOverrideResponse)
async def save_keyword_override(
    request: KeywordOverrideRequest,
    user_id: int = Depends(get_current_user_id),
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
):
    """
    Save user's keyword edits for a job.

    After the user reviews and modifies keywords (add, remove, change
    importance), save their edits. These edited keywords will be used
    in subsequent ATS scoring instead of re-extracting from the JD.
    """
    if not request.job_listing_id and not request.job_id:
        raise HTTPException(
            status_code=400,
            detail="Either job_listing_id or job_id must be provided",
        )

    # Convert request keywords to model format
    keyword_entries = [
        KeywordEntry(
            keyword=kw.keyword,
            importance=kw.importance,
            context=kw.context,
            source_section=kw.source_section,
            frequency=kw.frequency,
            user_added=kw.user_added,
            user_modified=kw.user_modified,
        )
        for kw in request.keywords
    ]

    # Compute content hash
    job_content_hash = compute_job_content_hash(request.job_description)

    # Check if we need to get original keywords
    existing = await keyword_override_crud.get(
        mongo_db,
        user_id=user_id,
        job_listing_id=request.job_listing_id,
        job_id=request.job_id,
    )

    if existing:
        # Use existing original_keywords
        original_keywords = existing.original_keywords
    else:
        # First save - extract original keywords
        extractor = KeywordExtractor()
        keywords_data = await extractor.extract_keywords_with_context(
            job_description=request.job_description,
            return_metrics=False,
        )
        original_keywords = [
            KeywordEntry(
                keyword=kw["keyword"],
                importance=kw["importance"],
                context=kw["context"],
                source_section=kw["source_section"],
                frequency=kw["frequency"],
                user_added=False,
                user_modified=False,
            )
            for kw in keywords_data
        ]

    # Upsert the override
    create_data = KeywordOverrideCreate(
        user_id=user_id,
        job_listing_id=request.job_listing_id,
        job_id=request.job_id,
        job_content_hash=job_content_hash,
        original_keywords=original_keywords,
        keywords=keyword_entries,
        reviewed=request.mark_reviewed,
    )

    result = await keyword_override_crud.upsert(mongo_db, create_data)

    return KeywordOverrideResponse(
        id=str(result.id),
        keyword_count=len(request.keywords),
        reviewed=result.reviewed,
        is_stale=False,
    )
