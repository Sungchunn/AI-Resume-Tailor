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
