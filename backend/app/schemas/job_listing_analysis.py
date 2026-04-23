"""
Deep analysis response schemas for POST /job-listings/{id}/analyze.

These types compose existing ATS analyzer outputs (knockout risks, tiered
keyword analysis, per-bullet rewrite suggestions) into a single response so
the frontend can render the three sections with independent loading/error
states.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ats.keywords import KeywordDetailResponse
from app.schemas.ats.knockout import KnockoutRiskResponse
from app.schemas.tailor.suggestions import BulletSuggestionResponse

AnalysisStage = Literal["knockout", "keywords", "bullets"]


class AnalysisWarning(BaseModel):
    """One entry per partial failure. Present in the 200 response when a
    non-critical stage errored out; the keyword stage is critical and
    propagates as a 500 instead."""

    stage: AnalysisStage
    error: str
    retriable: bool = True


class AIUsageSummary(BaseModel):
    """Aggregated AI usage for a single deep-analysis run. Zero when the
    response is served from cache."""

    total_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0


class KnockoutBlock(BaseModel):
    """Knockout-check result flattened for frontend consumption."""

    passes_all_checks: bool
    risks: list[KnockoutRiskResponse] = Field(default_factory=list)
    summary: str
    recommendation: str


class KeywordBlock(BaseModel):
    """DetailedKeywordAnalysis reshaped for the deep-analysis response."""

    coverage_score: float = Field(..., ge=0, le=1)
    required_coverage: float = Field(..., ge=0, le=1)
    preferred_coverage: float = Field(..., ge=0, le=1)

    required_matched: list[str] = Field(default_factory=list)
    required_missing: list[str] = Field(default_factory=list)
    preferred_matched: list[str] = Field(default_factory=list)
    preferred_missing: list[str] = Field(default_factory=list)
    nice_to_have_matched: list[str] = Field(default_factory=list)
    nice_to_have_missing: list[str] = Field(default_factory=list)

    all_keywords: list[KeywordDetailResponse] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class BulletsBlock(BaseModel):
    """Per-bullet rewrite suggestions for the resume's work-experience
    bullets against the target job description."""

    suggestions: list[BulletSuggestionResponse] = Field(default_factory=list)
    total_analyzed: int = 0
    suggestions_count: int = 0
    skipped_count: int = 0


class JobDeepAnalysisResponse(BaseModel):
    """Composite response from POST /job-listings/{id}/analyze."""

    job_listing_id: int
    resume_id: str
    resume_content_hash: str

    cached: bool = False
    cached_at: datetime | None = None
    generated_at: datetime

    knockout: KnockoutBlock | None = None
    keywords: KeywordBlock | None = None
    bullets: BulletsBlock | None = None

    warnings: list[AnalysisWarning] = Field(default_factory=list)
    ai_usage: AIUsageSummary = Field(default_factory=AIUsageSummary)


class QuotaExceededDetail(BaseModel):
    """429 response body carrying enough state for the frontend to display a
    countdown without a separate quota-meta request."""

    detail: str = "Daily limit reached"
    limit: int
    used: int
    resets_at: datetime
