"""
ATS Stage 2: Keyword Analysis Schemas

Request/response models for keyword extraction, matching, and scoring.
Includes basic, detailed, and enhanced (weighted) keyword analysis.
"""

from typing import Literal

from pydantic import BaseModel, Field


# Importance level types
KeywordImportanceLevel = Literal["required", "preferred", "nice_to_have"]
KeywordImportanceLevelEnhanced = Literal["required", "strongly_preferred", "preferred", "nice_to_have"]


# ============================================================
# Basic Keyword Analysis
# ============================================================


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


# ============================================================
# Detailed Keyword Analysis
# ============================================================


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
# Enhanced Keyword Analysis (Stage 2 Weighted Scoring)
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
