"""
ATS Stage 1: Structure Analysis Schemas

Request/response models for resume structure and format validation.
"""

from typing import Literal

from pydantic import BaseModel, Field


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
