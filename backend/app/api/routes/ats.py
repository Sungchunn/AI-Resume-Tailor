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
from app.services.job.ats_analyzer import get_ats_analyzer
from app.core.protocols import ATSReportData

router = APIRouter()


# Importance level type
KeywordImportanceLevel = Literal["required", "preferred", "nice_to_have"]


class ATSStructureRequest(BaseModel):
    """Request for ATS structure analysis."""

    resume_content: dict = Field(
        ..., description="Parsed resume content as dictionary"
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
    - Formatting issues that may cause parsing problems

    Returns a score and actionable suggestions for improvement.
    """
    analyzer = get_ats_analyzer()
    result = analyzer.analyze_structure(request.resume_content)

    return ATSStructureResponse(
        format_score=result["format_score"],
        sections_found=result["sections_found"],
        sections_missing=result["sections_missing"],
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
