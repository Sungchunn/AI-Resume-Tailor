from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SuggestionSchema(BaseModel):
    section: str
    type: str
    original: str
    suggested: str
    reason: str
    impact: str


class TailoredContentSchema(BaseModel):
    summary: str
    experience: list[dict[str, Any]]
    skills: list[str]
    highlights: list[str]


class TailorRequest(BaseModel):
    resume_id: int
    job_id: int


class TailorResponse(BaseModel):
    id: int
    resume_id: int
    job_id: int
    tailored_content: TailoredContentSchema
    suggestions: list[SuggestionSchema]
    match_score: float
    skill_matches: list[str]
    skill_gaps: list[str]
    keyword_coverage: float
    created_at: datetime

    class Config:
        from_attributes = True


class QuickMatchRequest(BaseModel):
    resume_id: int
    job_id: int


class QuickMatchResponse(BaseModel):
    match_score: int
    keyword_coverage: float
    skill_matches: list[str]
    skill_gaps: list[str]


class TailoredResumeListResponse(BaseModel):
    id: int
    resume_id: int
    job_id: int
    match_score: float | None
    created_at: datetime

    class Config:
        from_attributes = True


class StyleSettingsSchema(BaseModel):
    """Style settings for PDF generation."""

    font_family: str | None = None
    font_size_body: int | None = None
    font_size_heading: int | None = None
    font_size_subheading: int | None = None
    margin_top: float | None = None
    margin_bottom: float | None = None
    margin_left: float | None = None
    margin_right: float | None = None
    line_spacing: float | None = None
    section_spacing: float | None = None


class TailoredResumeUpdateRequest(BaseModel):
    """Request to update a tailored resume."""

    tailored_content: TailoredContentSchema | None = None
    style_settings: StyleSettingsSchema | None = None
    section_order: list[str] | None = None


class TailoredResumeFullResponse(BaseModel):
    """Full response including style and section order."""

    id: int
    resume_id: int
    job_id: int | None
    job_listing_id: int | None
    tailored_content: TailoredContentSchema
    suggestions: list[SuggestionSchema]
    match_score: float
    skill_matches: list[str]
    skill_gaps: list[str]
    keyword_coverage: float
    style_settings: dict[str, Any]
    section_order: list[str]
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True
