"""
ATS Progressive Analysis Schemas

Request/response models for the SSE-based progressive ATS analysis endpoint.
"""

from typing import Literal

from pydantic import BaseModel, Field


class ATSProgressiveRequest(BaseModel):
    """Request for progressive ATS analysis with SSE streaming."""

    resume_id: int | None = Field(default=None, description="Resume database ID")
    job_id: int | None = Field(default=None, description="Job database ID")
    resume_content: dict | None = Field(default=None, description="Raw resume content")
    job_description: str | None = Field(default=None, description="Raw job description text")
    job_content: dict | None = Field(default=None, description="Parsed job content for role proximity")


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


# ============================================================================
# Synchronous Content-Based Analysis (for Editor page)
# ============================================================================


class ATSContentAnalysisRequest(BaseModel):
    """Request for synchronous ATS analysis with raw content (no DB lookup).

    Used by the editor page to analyze live edits without saving to DB first.
    """

    resume_content: dict = Field(
        ...,
        description="Parsed resume content (TailoredContent structure)"
    )
    job_description: str = Field(
        ...,
        description="Raw job description text"
    )
    job_content: dict | None = Field(
        default=None,
        description="Optional parsed job content for role proximity stage"
    )
    skip_stages: list[int] | None = Field(
        default=None,
        description="Optional list of stage numbers (0-4) to skip for faster scoring"
    )


class KnockoutRiskItem(BaseModel):
    """A single knockout risk identified during analysis."""

    risk_type: str = Field(..., description="Type of knockout risk")
    severity: str = Field(..., description="Severity: critical, warning, or info")
    description: str = Field(..., description="Human-readable description")
    job_requires: str = Field(..., description="What the job requires")
    user_has: str | None = Field(None, description="What the resume indicates")


class ATSContentAnalysisResponse(BaseModel):
    """Response from synchronous ATS content analysis.

    Matches the progressive endpoint's final composite score format.
    """

    final_score: float = Field(..., ge=0, le=100, description="Weighted composite score")
    stage_scores: dict[str, float] = Field(
        ...,
        description="Raw scores from each stage (0-100)"
    )
    stage_breakdown: dict[str, float] = Field(
        ...,
        description="Individual stage scores with weights applied"
    )
    weights_used: dict[str, float] = Field(
        ...,
        description="Weights applied to each stage"
    )
    failed_stages: list[str] = Field(
        default_factory=list,
        description="Names of stages that failed (if any)"
    )
    knockout_risks: list[KnockoutRiskItem] = Field(
        default_factory=list,
        description="Knockout risks identified (Stage 0)"
    )
    keyword_analysis: dict | None = Field(
        default=None,
        description="Enhanced keyword analysis details from Stage 2"
    )
