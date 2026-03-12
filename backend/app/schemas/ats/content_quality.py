"""
ATS Stage 3: Content Quality Schemas

Request/response models for analyzing resume content quality:
- Block type distribution (achievement vs responsibility)
- Quantification density
- Action verb usage
"""

from pydantic import BaseModel, Field


class BulletAnalysisResponse(BaseModel):
    """Analysis of a single resume bullet point."""

    text: str = Field(..., description="The bullet point text")
    has_quantification: bool = Field(
        ..., description="Whether bullet contains quantified metrics"
    )
    has_action_verb: bool = Field(
        ..., description="Whether bullet contains strong action verbs"
    )
    has_weak_phrase: bool = Field(
        ..., description="Whether bullet contains weak/passive phrases"
    )
    action_verb_categories: list[str] = Field(
        default_factory=list,
        description="Categories of action verbs found (leadership, achievement, etc.)"
    )
    detected_metrics: list[str] = Field(
        default_factory=list,
        description="Specific metrics found in the bullet"
    )
    quality_score: float = Field(
        ..., ge=0, le=1,
        description="Individual bullet quality score (0-1)"
    )


class BlockTypeAnalysisResponse(BaseModel):
    """Analysis of block types distribution."""

    total_bullets: int = Field(..., description="Total number of bullets analyzed")
    achievement_count: int = Field(
        ..., description="Number of achievement-style bullets"
    )
    responsibility_count: int = Field(
        ..., description="Number of responsibility-style bullets"
    )
    project_count: int = Field(
        ..., description="Number of project-style bullets"
    )
    other_count: int = Field(..., description="Number of other bullets")
    achievement_ratio: float = Field(
        ..., ge=0, le=1,
        description="Ratio of high-value (achievement + project) bullets"
    )
    quality_score: float = Field(
        ..., ge=0, le=100,
        description="Block type quality score (0-100)"
    )


class QuantificationAnalysisResponse(BaseModel):
    """Analysis of quantification density."""

    total_bullets: int = Field(..., description="Total number of bullets analyzed")
    quantified_bullets: int = Field(
        ..., description="Number of bullets containing metrics"
    )
    quantification_density: float = Field(
        ..., ge=0, le=1,
        description="Ratio of quantified bullets"
    )
    quality_score: float = Field(
        ..., ge=0, le=100,
        description="Quantification quality score (0-100)"
    )
    metrics_found: list[str] = Field(
        default_factory=list,
        description="List of metrics extracted from content"
    )
    bullets_needing_metrics: list[str] = Field(
        default_factory=list,
        description="Bullets that could benefit from adding metrics"
    )


class ActionVerbAnalysisResponse(BaseModel):
    """Analysis of action verb usage."""

    total_bullets: int = Field(..., description="Total number of bullets analyzed")
    bullets_with_action_verbs: int = Field(
        ..., description="Number of bullets with strong action verbs"
    )
    bullets_with_weak_phrases: int = Field(
        ..., description="Number of bullets with weak/passive phrases"
    )
    action_verb_coverage: float = Field(
        ..., ge=0, le=1,
        description="Ratio of bullets with action verbs"
    )
    weak_phrase_ratio: float = Field(
        ..., ge=0, le=1,
        description="Ratio of bullets with weak phrases (lower is better)"
    )
    quality_score: float = Field(
        ..., ge=0, le=100,
        description="Action verb quality score (0-100)"
    )
    verb_category_distribution: dict[str, int] = Field(
        default_factory=dict,
        description="Count of action verbs by category"
    )


class ContentQualityRequest(BaseModel):
    """Request for content quality analysis."""

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
                    "resume_id": 123,
                },
                {
                    "resume_content": {
                        "experience": [
                            {
                                "title": "Software Engineer",
                                "company": "TechCorp",
                                "bullets": [
                                    "Led team of 5 engineers to deliver ML pipeline, reducing inference latency by 60%",
                                    "Responsible for maintaining backend services",
                                ]
                            }
                        ]
                    }
                },
            ]
        }
    }


class ContentQualityResponse(BaseModel):
    """Response for Stage 3 content quality analysis."""

    # Overall score
    content_quality_score: float = Field(
        ..., ge=0, le=100,
        description="Overall content quality score (0-100)"
    )

    # Component scores
    block_type_score: float = Field(
        ..., ge=0, le=100,
        description="Block type distribution score (0-100)"
    )
    quantification_score: float = Field(
        ..., ge=0, le=100,
        description="Quantification density score (0-100)"
    )
    action_verb_score: float = Field(
        ..., ge=0, le=100,
        description="Action verb usage score (0-100)"
    )

    # Component weights
    block_type_weight: float = Field(
        ..., description="Weight applied to block type score"
    )
    quantification_weight: float = Field(
        ..., description="Weight applied to quantification score"
    )
    action_verb_weight: float = Field(
        ..., description="Weight applied to action verb score"
    )

    # Detailed analyses
    block_type_analysis: BlockTypeAnalysisResponse = Field(
        ..., description="Detailed block type analysis"
    )
    quantification_analysis: QuantificationAnalysisResponse = Field(
        ..., description="Detailed quantification analysis"
    )
    action_verb_analysis: ActionVerbAnalysisResponse = Field(
        ..., description="Detailed action verb analysis"
    )

    # Summary stats
    total_bullets_analyzed: int = Field(
        ..., description="Total number of bullet points analyzed"
    )
    high_quality_bullets: int = Field(
        ..., description="Number of high quality bullets (score > 0.7)"
    )
    low_quality_bullets: int = Field(
        ..., description="Number of low quality bullets (score < 0.4)"
    )

    # Suggestions
    suggestions: list[str] = Field(
        default_factory=list, description="Actionable improvement suggestions"
    )
    warnings: list[str] = Field(
        default_factory=list, description="Quality warnings to address"
    )
