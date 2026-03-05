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
from app.crud.resume import ResumeCRUD
from app.crud.job import JobCRUD
from app.services.job.ats_analyzer import (
    get_ats_analyzer,
    KnockoutRiskType,
    KnockoutSeverity,
    KeywordMatch,
    EnhancedKeywordDetail,
    EnhancedKeywordAnalysis,
    ContentQualityResult,
    BulletAnalysis,
    BlockTypeAnalysis,
    QuantificationAnalysis,
    ActionVerbAnalysis,
    # Stage 4: Role Proximity
    TitleMatchResult,
    TrajectoryResult,
    IndustryAlignmentResult,
    RoleProximityResult,
    TrajectoryType,
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


# ============================================================
# Stage 3: Content Quality Models
# ============================================================


class BulletAnalysisResponse(BaseModel):
    """Analysis of a single resume bullet point."""

    text: str = Field(..., description="The bullet point text")
    has_quantification: bool = Field(
        ..., description="Whether bullet contains quantified metrics"
    )
    has_action_verb: bool = Field(
        ..., description="Whether bullet contains strong action verbs"
    )
    has_weak_phrase: bool = Field(
        ..., description="Whether bullet contains weak/passive phrases"
    )
    action_verb_categories: list[str] = Field(
        default_factory=list,
        description="Categories of action verbs found (leadership, achievement, etc.)"
    )
    detected_metrics: list[str] = Field(
        default_factory=list,
        description="Specific metrics found in the bullet"
    )
    quality_score: float = Field(
        ..., ge=0, le=1,
        description="Individual bullet quality score (0-1)"
    )


class BlockTypeAnalysisResponse(BaseModel):
    """Analysis of block types distribution."""

    total_bullets: int = Field(..., description="Total number of bullets analyzed")
    achievement_count: int = Field(
        ..., description="Number of achievement-style bullets"
    )
    responsibility_count: int = Field(
        ..., description="Number of responsibility-style bullets"
    )
    project_count: int = Field(
        ..., description="Number of project-style bullets"
    )
    other_count: int = Field(..., description="Number of other bullets")
    achievement_ratio: float = Field(
        ..., ge=0, le=1,
        description="Ratio of high-value (achievement + project) bullets"
    )
    quality_score: float = Field(
        ..., ge=0, le=100,
        description="Block type quality score (0-100)"
    )


class QuantificationAnalysisResponse(BaseModel):
    """Analysis of quantification density."""

    total_bullets: int = Field(..., description="Total number of bullets analyzed")
    quantified_bullets: int = Field(
        ..., description="Number of bullets containing metrics"
    )
    quantification_density: float = Field(
        ..., ge=0, le=1,
        description="Ratio of quantified bullets"
    )
    quality_score: float = Field(
        ..., ge=0, le=100,
        description="Quantification quality score (0-100)"
    )
    metrics_found: list[str] = Field(
        default_factory=list,
        description="List of metrics extracted from content"
    )
    bullets_needing_metrics: list[str] = Field(
        default_factory=list,
        description="Bullets that could benefit from adding metrics"
    )


class ActionVerbAnalysisResponse(BaseModel):
    """Analysis of action verb usage."""

    total_bullets: int = Field(..., description="Total number of bullets analyzed")
    bullets_with_action_verbs: int = Field(
        ..., description="Number of bullets with strong action verbs"
    )
    bullets_with_weak_phrases: int = Field(
        ..., description="Number of bullets with weak/passive phrases"
    )
    action_verb_coverage: float = Field(
        ..., ge=0, le=1,
        description="Ratio of bullets with action verbs"
    )
    weak_phrase_ratio: float = Field(
        ..., ge=0, le=1,
        description="Ratio of bullets with weak phrases (lower is better)"
    )
    quality_score: float = Field(
        ..., ge=0, le=100,
        description="Action verb quality score (0-100)"
    )
    verb_category_distribution: dict[str, int] = Field(
        default_factory=dict,
        description="Count of action verbs by category"
    )


class ContentQualityRequest(BaseModel):
    """Request for content quality analysis."""

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
                    "resume_id": 123,
                },
                {
                    "resume_content": {
                        "experience": [
                            {
                                "title": "Software Engineer",
                                "company": "TechCorp",
                                "bullets": [
                                    "Led team of 5 engineers to deliver ML pipeline, reducing inference latency by 60%",
                                    "Responsible for maintaining backend services",
                                ]
                            }
                        ]
                    }
                },
            ]
        }
    }


class ContentQualityResponse(BaseModel):
    """Response for Stage 3 content quality analysis."""

    # Overall score
    content_quality_score: float = Field(
        ..., ge=0, le=100,
        description="Overall content quality score (0-100)"
    )

    # Component scores
    block_type_score: float = Field(
        ..., ge=0, le=100,
        description="Block type distribution score (0-100)"
    )
    quantification_score: float = Field(
        ..., ge=0, le=100,
        description="Quantification density score (0-100)"
    )
    action_verb_score: float = Field(
        ..., ge=0, le=100,
        description="Action verb usage score (0-100)"
    )

    # Component weights
    block_type_weight: float = Field(
        ..., description="Weight applied to block type score"
    )
    quantification_weight: float = Field(
        ..., description="Weight applied to quantification score"
    )
    action_verb_weight: float = Field(
        ..., description="Weight applied to action verb score"
    )

    # Detailed analyses
    block_type_analysis: BlockTypeAnalysisResponse = Field(
        ..., description="Detailed block type analysis"
    )
    quantification_analysis: QuantificationAnalysisResponse = Field(
        ..., description="Detailed quantification analysis"
    )
    action_verb_analysis: ActionVerbAnalysisResponse = Field(
        ..., description="Detailed action verb analysis"
    )

    # Summary stats
    total_bullets_analyzed: int = Field(
        ..., description="Total number of bullet points analyzed"
    )
    high_quality_bullets: int = Field(
        ..., description="Number of high quality bullets (score > 0.7)"
    )
    low_quality_bullets: int = Field(
        ..., description="Number of low quality bullets (score < 0.4)"
    )

    # Suggestions
    suggestions: list[str] = Field(
        default_factory=list, description="Actionable improvement suggestions"
    )
    warnings: list[str] = Field(
        default_factory=list, description="Quality warnings to address"
    )


# ============================================================
# Stage 4: Role Proximity Models
# ============================================================


class RoleProximityRequest(BaseModel):
    """Request for Stage 4 role proximity analysis."""

    resume_id: int | None = Field(
        None, description="Resume ID to analyze (uses parsed_content from database)"
    )
    job_id: int | None = Field(
        None, description="Job description ID to analyze against"
    )
    resume_content: dict | None = Field(
        None, description="Parsed resume content as dictionary (fallback if resume_id not provided)"
    )
    job_content: dict | None = Field(
        None, description="Parsed job content as dictionary (fallback if job_id not provided)"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "resume_id": 123,
                    "job_id": 456,
                },
                {
                    "resume_content": {
                        "experience": [
                            {"title": "Senior Software Engineer", "company": "TechCorp"},
                            {"title": "Software Engineer", "company": "StartupInc"},
                        ]
                    },
                    "job_content": {
                        "title": "Staff Software Engineer",
                        "company": "BigTech",
                    },
                },
            ]
        }
    }


class TitleMatchResponse(BaseModel):
    """Title similarity analysis result."""

    resume_title: str = Field(..., description="Most recent job title from resume")
    job_title: str = Field(..., description="Target job title")
    normalized_resume_title: str = Field(..., description="Normalized resume title")
    normalized_job_title: str = Field(..., description="Normalized job title")
    similarity_score: float = Field(
        ..., ge=0, le=1, description="Semantic similarity (0-1)"
    )
    title_score: float = Field(
        ..., ge=0, le=100, description="Title match score (0-100)"
    )
    resume_level: int = Field(..., description="Extracted seniority level from resume")
    job_level: int = Field(..., description="Extracted seniority level from job")
    level_gap: int = Field(..., description="Gap between job and resume level")
    resume_function: str = Field(..., description="Functional category of resume title")
    job_function: str = Field(..., description="Functional category of job title")
    function_match: bool = Field(..., description="Whether functions match")


class TrajectoryResponse(BaseModel):
    """Career trajectory analysis result."""

    trajectory_type: TrajectoryType = Field(
        ..., description="Type of career trajectory"
    )
    modifier: int = Field(..., description="Score modifier (-20 to +20)")
    current_level: int = Field(..., description="Current seniority level")
    target_level: int = Field(..., description="Target job seniority level")
    level_gap: int = Field(..., description="Gap between target and current")
    level_progression: list[int] = Field(
        ..., description="Historical level progression (oldest to newest)"
    )
    is_ascending: bool = Field(..., description="Whether career is progressing upward")
    function_match: bool = Field(..., description="Whether moving in same function")
    explanation: str = Field(..., description="Human-readable explanation")


class IndustryAlignmentResponse(BaseModel):
    """Industry alignment analysis result."""

    resume_industries: list[str] = Field(
        ..., description="Industries detected from resume"
    )
    most_recent_industry: str = Field(..., description="Most recent industry")
    target_industry: str = Field(..., description="Target job industry")
    alignment_type: Literal["same", "adjacent", "unrelated"] = Field(
        ..., description="Type of alignment"
    )
    modifier: int = Field(..., description="Score modifier (0 to +10)")


class RoleProximityResponse(BaseModel):
    """Response for Stage 4 role proximity analysis."""

    # Overall score
    role_proximity_score: float = Field(
        ..., ge=0, le=100,
        description="Overall role proximity score (0-100)"
    )

    # Component results
    title_match: TitleMatchResponse = Field(
        ..., description="Title similarity analysis"
    )
    trajectory: TrajectoryResponse = Field(
        ..., description="Career trajectory analysis"
    )
    industry_alignment: IndustryAlignmentResponse = Field(
        ..., description="Industry alignment analysis"
    )

    # Human-readable summary
    explanation: str = Field(
        ..., description="Human-readable summary of the analysis"
    )

    # Actionable insights
    concerns: list[str] = Field(
        default_factory=list,
        description="Potential concerns about role fit"
    )
    strengths: list[str] = Field(
        default_factory=list,
        description="Strengths for this role"
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
        resume_repo = ResumeCRUD()
        resume = await resume_repo.get(db, id=request.resume_id)
        if not resume or resume.owner_id != user_id:
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
        resume_repo = ResumeCRUD()
        resume = await resume_repo.get(db, id=request.resume_id)
        if not resume or resume.owner_id != user_id:
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

    parsed_resume = None

    # Get parsed resume
    if request.resume_id:
        resume_repo = ResumeCRUD()
        resume = await resume_repo.get(db, id=request.resume_id)
        if not resume or resume.owner_id != user_id:
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
    resume_parser = ResumeParser(ai_client, cache)
    job_analyzer = JobAnalyzer(ai_client, cache)

    parsed_resume = None
    parsed_job = None

    # Get parsed resume
    if request.resume_id:
        resume_repo = ResumeCRUD()
        resume = await resume_repo.get(db, id=request.resume_id)
        if not resume or resume.owner_id != user_id:
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
        parsed_resume = request.resume_content
    else:
        raise HTTPException(
            status_code=400,
            detail="Either resume_id or resume_content must be provided"
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

import json
import time
from sse_starlette.sse import EventSourceResponse


class ATSProgressiveRequest(BaseModel):
    """Request for progressive ATS analysis with SSE streaming."""

    resume_id: int | None = Field(None, description="Resume database ID")
    job_id: int | None = Field(None, description="Job database ID")
    resume_content: dict | None = Field(None, description="Raw resume content")
    job_description: str | None = Field(None, description="Raw job description text")


class ATSStageProgress(BaseModel):
    """Progress update for a single stage."""

    stage: int = Field(..., description="Stage number (0-4)")
    stage_name: str = Field(..., description="Human-readable stage name")
    status: Literal["pending", "running", "completed", "failed"] = Field(..., description="Stage status")
    progress_percent: int = Field(..., ge=0, le=100, description="Overall progress 0-100")
    elapsed_ms: int | None = Field(None, description="Time taken for this stage in milliseconds")
    result: dict | None = Field(None, description="Stage result data (only when status=completed)")
    error: str | None = Field(None, description="Error message (only when status=failed)")


class ATSCompositeScore(BaseModel):
    """Final composite ATS score calculation."""

    final_score: float = Field(..., ge=0, le=100, description="Weighted composite score")
    stage_breakdown: dict[str, float] = Field(
        ...,
        description="Individual stage scores with weights applied"
    )
    weights_used: dict[str, float] = Field(
        ...,
        description="Weights applied to each stage"
    )
    normalization_applied: bool = Field(
        ...,
        description="True if some stages failed and weights were renormalized"
    )
    failed_stages: list[str] = Field(
        default_factory=list,
        description="Names of stages that failed (if any)"
    )


@router.post("/analyze-progressive")
async def analyze_progressive_ats(
    request: ATSProgressiveRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Run complete ATS analysis with real-time progress updates via SSE.

    This endpoint orchestrates all 5 ATS stages and streams progress events:

    **Event Types:**
    - `stage_start`: Stage N is beginning
    - `stage_complete`: Stage N completed successfully (includes result data)
    - `stage_error`: Stage N failed (includes error message, continues to next stage)
    - `score_calculation`: Calculating final composite score
    - `complete`: All stages finished, composite score ready
    - `error`: Fatal error that aborts entire analysis

    **Client Usage:**
    ```javascript
    const eventSource = new EventSource('/api/v1/ats/analyze-progressive?resume_id=123&job_id=456');
    eventSource.addEventListener('stage_complete', (e) => {
      const data = JSON.parse(e.data);
      console.log(`Stage ${data.stage} done:`, data.result);
    });
    ```
    """

    async def event_generator():
        start_time = time.time()
        stage_results = {}
        failed_stages = []

        # Stage metadata
        stages = [
            (0, "knockout-check", "Knockout Risk Check"),
            (1, "structure", "Structure Analysis"),
            (2, "keywords-enhanced", "Keyword Matching"),
            (3, "content-quality", "Content Quality"),
            (4, "role-proximity", "Role Proximity"),
        ]

        try:
            # Validate input
            if not ((request.resume_id and request.job_id) or
                    (request.resume_content and request.job_description)):
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "error": "Must provide either (resume_id + job_id) or (resume_content + job_description)"
                    })
                }
                return

            # Execute each stage sequentially
            for idx, (stage_num, stage_key, stage_name) in enumerate(stages):
                stage_start = time.time()
                progress_percent = int((idx / len(stages)) * 100)

                # Emit stage_start event
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
                    # Call the appropriate internal method based on stage
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

                    # Store result for composite scoring
                    stage_results[stage_key] = result

                    # Emit stage_complete event
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
                    # Stage failed, but continue to next stage
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

            # Calculate composite score
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

            # Emit complete event
            yield {
                "event": "complete",
                "data": json.dumps({
                    "stage": 5,
                    "stage_name": "Complete",
                    "status": "completed",
                    "progress_percent": 100,
                    "elapsed_ms": total_elapsed,
                    "composite_score": composite_score.model_dump(),
                })
            }

        except Exception as e:
            # Fatal error - abort entire analysis
            yield {
                "event": "error",
                "data": json.dumps({
                    "error": f"Fatal error during ATS analysis: {str(e)}"
                })
            }

    return EventSourceResponse(event_generator())


# Helper methods to execute each stage
async def _execute_knockout_check(request: ATSProgressiveRequest, user_id: int, db: AsyncSession):
    """Execute Stage 0: Knockout Check."""
    knockout_request = KnockoutCheckRequest(
        resume_id=request.resume_id,
        job_id=request.job_id,
        resume_content=request.resume_content,
        job_description=request.job_description,
    )
    # Call the existing knockout check function
    return await perform_knockout_check(knockout_request, user_id, db)


async def _execute_structure_analysis(request: ATSProgressiveRequest, user_id: int, db: AsyncSession):
    """Execute Stage 1: Structure Analysis."""
    # Get parsed resume content
    if request.resume_id:
        resume_repo = ResumeCRUD()
        resume = await resume_repo.get(db, id=request.resume_id)
        if not resume or resume.owner_id != user_id:
            raise HTTPException(status_code=404, detail="Resume not found")
        resume_content = resume.parsed_content or {}
    else:
        resume_content = request.resume_content or {}

    structure_request = ATSStructureRequest(resume_content=resume_content)
    return await analyze_structure(structure_request, user_id, db)


async def _execute_keyword_analysis(request: ATSProgressiveRequest, user_id: int, db: AsyncSession):
    """Execute Stage 2: Enhanced Keyword Analysis."""
    keyword_request = ATSKeywordEnhancedRequest(
        resume_id=request.resume_id,
        job_id=request.job_id,
        resume_content=request.resume_content,
        job_description=request.job_description,
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
        job_description=request.job_description,
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
    # Default weights
    weights = {
        "structure": 0.15,
        "keywords-enhanced": 0.40,
        "content-quality": 0.25,
        "role-proximity": 0.20,
    }

    # Extract scores from stage results
    scores = {}
    available_weight = 0.0

    for stage_key, weight in weights.items():
        if stage_key in stage_results:
            result = stage_results[stage_key]

            # Extract score based on stage type
            if stage_key == "structure":
                scores[stage_key] = float(result.format_score)
            elif stage_key == "keywords-enhanced":
                scores[stage_key] = float(result.keyword_score)
            elif stage_key == "content-quality":
                scores[stage_key] = float(result.content_quality_score)
            elif stage_key == "role-proximity":
                scores[stage_key] = float(result.role_proximity_score)

            available_weight += weight

    # Renormalize weights if some stages failed
    normalization_applied = available_weight < 1.0
    if normalization_applied and available_weight > 0:
        normalization_factor = 1.0 / available_weight
        weights = {k: v * normalization_factor if k in scores else 0 for k, v in weights.items()}

    # Calculate weighted score
    final_score = sum(scores[k] * weights.get(k, 0) for k in scores) if scores else 0.0

    # Create breakdown
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
