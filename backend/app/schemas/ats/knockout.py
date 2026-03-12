"""
ATS Stage 0: Knockout Check Schemas

Request/response models for binary disqualifier detection.
"""

from pydantic import BaseModel, Field

from app.services.job.ats import KnockoutRiskType, KnockoutSeverity


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
