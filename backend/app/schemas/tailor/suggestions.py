"""
Bullet Analysis Suggestion Schemas.

Request/Response models for the AI-powered bullet point analysis endpoint.
"""

from typing import Literal

from pydantic import BaseModel, Field


class EntryContext(BaseModel):
    """Context about the experience/project entry containing the bullet."""

    title: str = Field(..., description="Job title or project name")
    company: str = Field(..., description="Company or organization name")
    date_range: str = Field(
        ..., description="Date range string (e.g., 'Jan 2020 - Present')"
    )


class BulletInput(BaseModel):
    """A single bullet point to analyze."""

    id: str = Field(..., description="Unique bullet ID (e.g., 'exp-0:entry-0:bullet-0')")
    text: str = Field(..., description="Current bullet text")
    entry_context: EntryContext


class KeywordGapInput(BaseModel):
    """A missing keyword from ATS analysis."""

    keyword: str
    importance: Literal["required", "strongly_preferred", "preferred", "nice_to_have"]


class ATSContextInput(BaseModel):
    """ATS analysis context to inform suggestions."""

    keyword_gaps: list[KeywordGapInput] = Field(default_factory=list)
    importance_map: dict[str, str] = Field(
        default_factory=dict, description="Keyword -> importance level mapping"
    )
    bullets_needing_metrics: list[str] = Field(
        default_factory=list, description="Bullet IDs flagged as lacking quantification"
    )
    bullets_with_weak_verbs: list[str] = Field(
        default_factory=list, description="Bullet IDs flagged for weak/passive language"
    )


class KeywordAssignmentInput(BaseModel):
    """A keyword the user explicitly wants incorporated into a specific resume section."""

    keyword: str
    section_id: str = Field(..., description="Section prefix matching bullet IDs, e.g. 'blockId:entry-0'")


class BulletAnalysisRequest(BaseModel):
    """Request body for bullet analysis."""

    bullets: list[BulletInput] = Field(..., min_length=1, max_length=50)
    ats_context: ATSContextInput
    keyword_assignments: list[KeywordAssignmentInput] | None = Field(
        default=None,
        description="User-selected keyword→section assignments for targeted suggestions",
    )


class BulletSuggestionResponse(BaseModel):
    """A single bullet improvement suggestion."""

    bullet_id: str
    original: str
    suggested: str
    reason: str = Field(..., description="Explanation of what was improved")
    impact: Literal["high", "medium", "low"]
    keywords_added: list[str] = Field(default_factory=list)
    metrics_added: bool = False


class AnalyzeBulletsResponse(BaseModel):
    """Response containing all suggestions."""

    suggestions: list[BulletSuggestionResponse]
    total_analyzed: int
    suggestions_count: int
    skipped_count: int = Field(
        description="Number of bullets that didn't need improvement"
    )
