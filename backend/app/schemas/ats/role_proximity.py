"""
ATS Stage 4: Role Proximity Schemas

Request/response models for analyzing career trajectory alignment:
- Title similarity matching
- Career trajectory analysis
- Industry alignment
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.services.job.ats import TrajectoryType


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
