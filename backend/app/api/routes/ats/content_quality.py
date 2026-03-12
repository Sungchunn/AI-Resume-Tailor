"""
ATS Stage 3: Content Quality Analysis

Analyzes the quality of resume content across multiple dimensions.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.services.job.ats import get_ats_analyzer

from app.schemas.ats import (
    BlockTypeAnalysisResponse,
    QuantificationAnalysisResponse,
    ActionVerbAnalysisResponse,
    ContentQualityRequest,
    ContentQualityResponse,
)

router = APIRouter()


@router.post("/content-quality", response_model=ContentQualityResponse)
async def analyze_content_quality(
    request: ContentQualityRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform Stage 3 content quality analysis on a resume.

    This endpoint analyzes the quality of resume content across three dimensions:

    **Block Type Analysis (40% weight):**
    Evaluates the ratio of achievement-oriented vs responsibility-oriented bullets.
    - Achievement bullets: contain metrics, outcomes, and strong action verbs
    - Responsibility bullets: describe duties without measurable outcomes
    - Target: 60%+ achievement/project bullets for optimal ATS performance

    **Quantification Density (35% weight):**
    Measures the percentage of bullets containing quantified metrics.
    Detects: percentages (%), currency ($), quantities (users, projects),
    multiples (3x improvement), time metrics, and rankings.
    - Target: 50%+ of bullets should contain metrics

    **Action Verb Analysis (25% weight):**
    Analyzes use of strong action verbs vs weak/passive phrases.
    - Strong verbs: Led, Built, Increased, Delivered, Achieved
    - Weak phrases: Responsible for, Assisted with, Helped with
    - Target: 80%+ bullets with action verbs, <20% with weak phrases

    **Usage:**
    Provide either resume_id (uses parsed_content from database) or
    resume_content (parsed resume dictionary). Resume_id takes precedence.

    **Response includes:**
    - Overall content quality score (0-100)
    - Component scores for each dimension
    - Detailed analysis with bullet-level breakdown
    - Actionable suggestions for improvement
    - Warnings about quality issues
    """
    analyzer = get_ats_analyzer()

    # Get parsed resume (resume_id lookup removed - use progressive endpoint for DB lookups)
    if request.resume_content:
        parsed_resume = request.resume_content
    else:
        raise HTTPException(
            status_code=400,
            detail="resume_content must be provided. Use /analyze-progressive endpoint for database lookups."
        )

    # Perform content quality analysis
    result = analyzer.analyze_content_quality(parsed_resume)

    # Convert dataclasses to response models
    return ContentQualityResponse(
        content_quality_score=result.content_quality_score,
        block_type_score=result.block_type_score,
        quantification_score=result.quantification_score,
        action_verb_score=result.action_verb_score,
        block_type_weight=result.block_type_weight,
        quantification_weight=result.quantification_weight,
        action_verb_weight=result.action_verb_weight,
        block_type_analysis=BlockTypeAnalysisResponse(
            total_bullets=result.block_type_analysis.total_bullets,
            achievement_count=result.block_type_analysis.achievement_count,
            responsibility_count=result.block_type_analysis.responsibility_count,
            project_count=result.block_type_analysis.project_count,
            other_count=result.block_type_analysis.other_count,
            achievement_ratio=result.block_type_analysis.achievement_ratio,
            quality_score=result.block_type_analysis.quality_score,
        ),
        quantification_analysis=QuantificationAnalysisResponse(
            total_bullets=result.quantification_analysis.total_bullets,
            quantified_bullets=result.quantification_analysis.quantified_bullets,
            quantification_density=result.quantification_analysis.quantification_density,
            quality_score=result.quantification_analysis.quality_score,
            metrics_found=result.quantification_analysis.metrics_found,
            bullets_needing_metrics=result.quantification_analysis.bullets_needing_metrics,
        ),
        action_verb_analysis=ActionVerbAnalysisResponse(
            total_bullets=result.action_verb_analysis.total_bullets,
            bullets_with_action_verbs=result.action_verb_analysis.bullets_with_action_verbs,
            bullets_with_weak_phrases=result.action_verb_analysis.bullets_with_weak_phrases,
            action_verb_coverage=result.action_verb_analysis.action_verb_coverage,
            weak_phrase_ratio=result.action_verb_analysis.weak_phrase_ratio,
            quality_score=result.action_verb_analysis.quality_score,
            verb_category_distribution=result.action_verb_analysis.verb_category_distribution,
        ),
        total_bullets_analyzed=result.total_bullets_analyzed,
        high_quality_bullets=result.high_quality_bullets,
        low_quality_bullets=result.low_quality_bullets,
        suggestions=result.suggestions,
        warnings=result.warnings,
    )
