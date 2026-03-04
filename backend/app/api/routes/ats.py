"""
ATS Analysis API Routes

Provides endpoints for ATS (Applicant Tracking System) compatibility analysis.
"""

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.crud.block import BlockRepository
from app.crud.resume import ResumeRepository
from app.crud.job import JobDescriptionRepository
from app.services.job.ats_analyzer import (
    get_ats_analyzer,
    KnockoutRiskType,
    KnockoutSeverity,
    KeywordMatch,
    EnhancedKeywordDetail,
    EnhancedKeywordAnalysis,
)
from app.services.resume.parser import ResumeParser
from app.services.job.analyzer import JobAnalyzer
from app.services.ai.client import get_ai_client
from app.services.core.cache import get_cache_service
from app.core.protocols import ATSReportData

router = APIRouter()


# Importance level types
KeywordImportanceLevel = Literal["required", "preferred", "nice_to_have"]
# Stage 2: Enhanced importance level with strongly_preferred
KeywordImportanceLevelEnhanced = Literal["required", "strongly_preferred", "preferred", "nice_to_have"]


class ATSStructureRequest(BaseModel):
    """Request for ATS structure analysis."""

    resume_content: dict = Field(
        ..., description="Parsed resume content as dictionary"
    )


class SectionOrderDetails(BaseModel):
    """Details about section order validation."""

    detected_order: list[str] = Field(
        ..., description="Sections in the order they appear in the resume"
    )
    expected_order: list[str] = Field(
        ..., description="The standard expected order for detected sections"
    )
    deviation_type: Literal["standard", "minor", "major", "non_standard"] = Field(
        ..., description="Type of deviation from standard order"
    )
    issues: list[str] = Field(
        default_factory=list, description="Specific order issues found"
    )


class ATSStructureResponse(BaseModel):
    """Response for ATS structure analysis."""

    format_score: int = Field(..., description="Format compatibility score 0-100")
    sections_found: list[str] = Field(
        ..., description="Standard sections found in resume"
    )
    sections_missing: list[str] = Field(
        ..., description="Standard sections missing from resume"
    )
    section_order_score: int = Field(
        ...,
        ge=75,
        le=100,
        description="Section order score (75-100). Scores: 100=standard, 95=minor deviation, 85=major deviation, 75=non-standard"
    )
    section_order_details: SectionOrderDetails = Field(
        ..., description="Detailed section order analysis"
    )
    warnings: list[str] = Field(..., description="Potential issues found")
    suggestions: list[str] = Field(..., description="Improvement suggestions")


class ATSKeywordRequest(BaseModel):
    """Request for ATS keyword analysis."""

    job_description: str = Field(
        ..., min_length=50, description="Job description to analyze against"
    )
    resume_block_ids: list[int] | None = Field(
        None, description="Block IDs to use for resume (uses all if not provided)"
    )


class ATSKeywordResponse(BaseModel):
    """Response for ATS keyword analysis."""

    keyword_coverage: float = Field(
        ..., ge=0, le=1, description="Keyword coverage 0-1"
    )
    matched_keywords: list[str] = Field(
        ..., description="Keywords found in resume"
    )
    missing_keywords: list[str] = Field(
        ..., description="Keywords in job but not in resume (available in vault)"
    )
    missing_from_vault: list[str] = Field(
        ..., description="Keywords not found in user's vault"
    )
    warnings: list[str] = Field(..., description="Important warnings")
    suggestions: list[str] = Field(..., description="Actionable suggestions")


class ATSTipsResponse(BaseModel):
    """Response for ATS optimization tips."""

    tips: list[str] = Field(..., description="General ATS optimization tips")


class KeywordDetailResponse(BaseModel):
    """Detailed information about a single keyword."""

    keyword: str = Field(..., description="The keyword/phrase")
    importance: KeywordImportanceLevel = Field(
        ..., description="Importance level: required, preferred, or nice_to_have"
    )
    found_in_resume: bool = Field(..., description="Whether keyword is in resume")
    found_in_vault: bool = Field(..., description="Whether keyword is in vault")
    frequency_in_job: int = Field(
        ..., description="How many times keyword appears in job description"
    )
    context: str | None = Field(
        None, description="Sample context from job description"
    )


class ATSKeywordDetailedRequest(BaseModel):
    """Request for detailed ATS keyword analysis."""

    job_description: str = Field(
        ..., min_length=50, description="Job description to analyze against"
    )
    resume_content: str | None = Field(
        None, description="Resume text content to analyze (uses vault blocks if not provided)"
    )
    resume_block_ids: list[int] | None = Field(
        None, description="Block IDs to use for resume (uses all if not provided)"
    )


class ATSKeywordDetailedResponse(BaseModel):
    """Detailed response for ATS keyword analysis with importance grouping."""

    coverage_score: float = Field(
        ..., ge=0, le=1, description="Overall keyword coverage 0-1"
    )
    required_coverage: float = Field(
        ..., ge=0, le=1, description="Coverage of required keywords 0-1"
    )
    preferred_coverage: float = Field(
        ..., ge=0, le=1, description="Coverage of preferred keywords 0-1"
    )

    # Grouped by importance
    required_matched: list[str] = Field(
        ..., description="Required keywords found in resume"
    )
    required_missing: list[str] = Field(
        ..., description="Required keywords missing from resume"
    )
    preferred_matched: list[str] = Field(
        ..., description="Preferred keywords found in resume"
    )
    preferred_missing: list[str] = Field(
        ..., description="Preferred keywords missing from resume"
    )
    nice_to_have_matched: list[str] = Field(
        ..., description="Nice-to-have keywords found in resume"
    )
    nice_to_have_missing: list[str] = Field(
        ..., description="Nice-to-have keywords missing from resume"
    )

    # Vault availability
    missing_available_in_vault: list[str] = Field(
        ..., description="Missing keywords that exist in user's vault"
    )
    missing_not_in_vault: list[str] = Field(
        ..., description="Missing keywords not found in vault"
    )

    # Full keyword details
    all_keywords: list[KeywordDetailResponse] = Field(
        ..., description="Detailed info for all extracted keywords"
    )

    # Suggestions and warnings
    suggestions: list[str] = Field(..., description="Actionable suggestions")
    warnings: list[str] = Field(..., description="Important warnings")


# ============================================================
# Stage 2: Enhanced Keyword Analysis Models
# ============================================================


class KeywordMatchResponse(BaseModel):
    """A single match of a keyword in the resume."""

    section: str = Field(
        ..., description="Section where the match was found (experience, skills, etc.)"
    )
    role_index: int | None = Field(
        None, description="Index of the role (0 = most recent) if in experience section"
    )
    text_snippet: str | None = Field(
        None, description="Text snippet around the match"
    )


class EnhancedKeywordDetailResponse(BaseModel):
    """Enhanced keyword detail with Stage 2 scoring components."""

    keyword: str = Field(..., description="The keyword/phrase")
    importance: KeywordImportanceLevelEnhanced = Field(
        ..., description="Importance level: required, strongly_preferred, preferred, or nice_to_have"
    )
    found_in_resume: bool = Field(..., description="Whether keyword is in resume")
    found_in_vault: bool = Field(..., description="Whether keyword is in vault")
    frequency_in_job: int = Field(
        ..., description="How many times keyword appears in job description"
    )
    context: str | None = Field(
        None, description="Sample context from job description"
    )

    # Stage 2 enhancements
    matches: list[KeywordMatchResponse] = Field(
        default_factory=list, description="All matches found in resume"
    )
    occurrence_count: int = Field(
        default=0, description="Total occurrences in resume"
    )

    # Calculated scores
    base_score: float = Field(default=0.0, description="Base score (0 or 1)")
    placement_score: float = Field(
        default=0.0, description="Placement weight score (Stage 2.1)"
    )
    density_score: float = Field(
        default=0.0, description="Density multiplier score (Stage 2.2)"
    )
    recency_score: float = Field(
        default=0.0, description="Recency weight score (Stage 2.3)"
    )
    importance_weight: float = Field(
        default=1.0, description="Importance tier multiplier (Stage 2.4)"
    )
    weighted_score: float = Field(
        default=0.0, description="Final weighted score for this keyword"
    )


class GapAnalysisItem(BaseModel):
    """Gap analysis item for missing keywords."""

    keyword: str = Field(..., description="The missing keyword")
    importance: KeywordImportanceLevelEnhanced = Field(
        ..., description="Importance level"
    )
    in_vault: bool = Field(..., description="Whether keyword exists in vault")
    suggestion: str = Field(..., description="Suggestion for addressing the gap")


class ATSKeywordEnhancedRequest(BaseModel):
    """Request for Stage 2 enhanced ATS keyword analysis."""

    job_description: str = Field(
        ..., min_length=50, description="Job description to analyze against"
    )
    resume_id: int | None = Field(
        None, description="Resume ID to analyze (uses parsed_content from database)"
    )
    resume_content: dict | None = Field(
        None, description="Parsed resume content as dictionary (fallback if resume_id not provided)"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "job_description": "We are looking for a Senior Software Engineer with 5+ years of Python experience. Must have AWS and Docker expertise. Kubernetes experience is strongly preferred.",
                    "resume_id": 123,
                },
            ]
        }
    }


class ATSKeywordEnhancedResponse(BaseModel):
    """Response for Stage 2 enhanced ATS keyword analysis."""

    # Overall scores
    keyword_score: float = Field(
        ..., ge=0, le=100,
        description="Final weighted keyword score (0-100) accounting for placement, density, recency, and importance"
    )
    raw_coverage: float = Field(
        ..., ge=0, le=100,
        description="Simple coverage percentage (matched/total * 100)"
    )

    # Coverage by importance tier
    required_coverage: float = Field(
        ..., ge=0, le=1, description="Coverage of required keywords (0-1)"
    )
    strongly_preferred_coverage: float = Field(
        ..., ge=0, le=1, description="Coverage of strongly preferred keywords (0-1)"
    )
    preferred_coverage: float = Field(
        ..., ge=0, le=1, description="Coverage of preferred keywords (0-1)"
    )
    nice_to_have_coverage: float = Field(
        ..., ge=0, le=1, description="Coverage of nice-to-have keywords (0-1)"
    )

    # Score breakdown - how much each factor contributed
    placement_contribution: float = Field(
        ..., description="Placement weighting contribution to score (%)"
    )
    density_contribution: float = Field(
        ..., description="Density scoring contribution to score (%)"
    )
    recency_contribution: float = Field(
        ..., description="Recency weighting contribution to score (%)"
    )

    # Grouped by importance
    required_matched: list[str] = Field(
        ..., description="Required keywords found in resume"
    )
    required_missing: list[str] = Field(
        ..., description="Required keywords missing from resume"
    )
    strongly_preferred_matched: list[str] = Field(
        ..., description="Strongly preferred keywords found in resume"
    )
    strongly_preferred_missing: list[str] = Field(
        ..., description="Strongly preferred keywords missing from resume"
    )
    preferred_matched: list[str] = Field(
        ..., description="Preferred keywords found in resume"
    )
    preferred_missing: list[str] = Field(
        ..., description="Preferred keywords missing from resume"
    )
    nice_to_have_matched: list[str] = Field(
        ..., description="Nice-to-have keywords found in resume"
    )
    nice_to_have_missing: list[str] = Field(
        ..., description="Nice-to-have keywords missing from resume"
    )

    # Vault availability
    missing_available_in_vault: list[str] = Field(
        ..., description="Missing keywords that exist in user's vault"
    )
    missing_not_in_vault: list[str] = Field(
        ..., description="Missing keywords not found in vault"
    )

    # Gap analysis prioritized by importance
    gap_list: list[GapAnalysisItem] = Field(
        ..., description="Gap analysis sorted by importance (required first)"
    )

    # Full keyword details
    all_keywords: list[EnhancedKeywordDetailResponse] = Field(
        ..., description="Detailed info for all extracted keywords with Stage 2 scores"
    )

    # Suggestions and warnings
    suggestions: list[str] = Field(..., description="Prioritized actionable suggestions")
    warnings: list[str] = Field(..., description="Important warnings")


# ============================================================
# Knockout Check Models (Stage 0)
# ============================================================


class KnockoutCheckRequest(BaseModel):
    """Request for knockout check analysis."""

    resume_id: int | None = Field(
        None, description="Resume ID to analyze (uses parsed_content from database)"
    )
    job_id: int | None = Field(
        None, description="Job description ID to analyze against"
    )
    resume_content: str | None = Field(
        None, description="Raw resume text (fallback if resume_id not provided)"
    )
    job_description: str | None = Field(
        None, description="Raw job description text (fallback if job_id not provided)"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "resume_id": 123,
                    "job_id": 456,
                },
                {
                    "resume_content": "John Doe\nSoftware Engineer...",
                    "job_description": "We are looking for a Senior Engineer with 5+ years...",
                },
            ]
        }
    }


class KnockoutRiskResponse(BaseModel):
    """A single knockout risk detected."""

    risk_type: KnockoutRiskType = Field(
        ..., description="Type of knockout risk"
    )
    severity: KnockoutSeverity = Field(
        ..., description="Severity level: critical, warning, or info"
    )
    description: str = Field(
        ..., description="Human-readable description of the risk"
    )
    job_requires: str = Field(
        ..., description="What the job posting requires"
    )
    user_has: str | None = Field(
        None, description="What the user's resume shows (if determinable)"
    )


class KnockoutCheckResponse(BaseModel):
    """Response for knockout check analysis."""

    passes_all_checks: bool = Field(
        ..., description="True if no knockout risks detected"
    )
    risks: list[KnockoutRiskResponse] = Field(
        default_factory=list,
        description="List of knockout risks detected"
    )
    summary: str = Field(
        ..., description="Summary of the knockout check results"
    )
    recommendation: str = Field(
        ..., description="Recommended action for the user"
    )
    analysis: dict = Field(
        default_factory=dict,
        description="Detailed breakdown of each check (for debugging/advanced users)"
    )


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

    # Get parsed resume
    if request.resume_id:
        resume_repo = ResumeRepository(db)
        resume = await resume_repo.get(request.resume_id, user_id)
        if not resume:
            raise HTTPException(
                status_code=404,
                detail=f"Resume with id {request.resume_id} not found"
            )
        if resume.parsed_content:
            parsed_resume = resume.parsed_content
        elif resume.raw_content:
            parsed_resume = await resume_parser.parse(resume.raw_content)
        else:
            raise HTTPException(
                status_code=400,
                detail="Resume has no content to analyze"
            )
    elif request.resume_content:
        parsed_resume = await resume_parser.parse(request.resume_content)
    else:
        raise HTTPException(
            status_code=400,
            detail="Either resume_id or resume_content must be provided"
        )

    # Get parsed job
    if request.job_id:
        job_repo = JobDescriptionRepository(db)
        job = await job_repo.get(request.job_id, user_id)
        if not job:
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
    block_repo = BlockRepository(db)

    # Get all vault blocks
    vault_blocks = await block_repo.list(user_id=user_id, limit=500)

    # Get resume blocks (either specified or all)
    if request.resume_block_ids:
        resume_blocks = [
            block for block in vault_blocks
            if block["id"] in request.resume_block_ids
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
        keyword_coverage=result["keyword_coverage"],
        matched_keywords=result["matched_keywords"],
        missing_keywords=result["missing_keywords"],
        missing_from_vault=result["missing_from_vault"],
        warnings=result["warnings"],
        suggestions=result["suggestions"],
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
    block_repo = BlockRepository(db)

    # Get all vault blocks
    vault_blocks = await block_repo.list(user_id=user_id, limit=500)

    # Determine resume content source
    if request.resume_content:
        # Use provided resume content directly
        resume_blocks = [{"content": request.resume_content, "id": 0}]
    elif request.resume_block_ids:
        # Use specified block IDs
        resume_blocks = [
            block for block in vault_blocks
            if block["id"] in request.resume_block_ids
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
    block_repo = BlockRepository(db)

    # Get vault blocks for gap analysis
    vault_blocks = await block_repo.list(user_id=user_id, limit=500)

    # Get parsed resume
    parsed_resume = None

    if request.resume_id:
        resume_repo = ResumeRepository(db)
        resume = await resume_repo.get(request.resume_id, user_id)
        if not resume:
            raise HTTPException(
                status_code=404,
                detail=f"Resume with id {request.resume_id} not found"
            )
        if resume.parsed_content:
            parsed_resume = resume.parsed_content
        elif resume.raw_content:
            ai_client = get_ai_client()
            cache = get_cache_service()
            resume_parser = ResumeParser(ai_client, cache)
            parsed_resume = await resume_parser.parse(resume.raw_content)
        else:
            raise HTTPException(
                status_code=400,
                detail="Resume has no content to analyze"
            )
    elif request.resume_content:
        parsed_resume = request.resume_content
    else:
        raise HTTPException(
            status_code=400,
            detail="Either resume_id or resume_content must be provided"
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
