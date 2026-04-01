"""
ATS Content-Based Analysis Endpoint

Synchronous ATS analysis that accepts raw resume content (no DB lookup).
Uses the same 5-stage scoring as the progressive SSE endpoint for consistency.
"""

from dataclasses import asdict, is_dataclass

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.schemas.ats import (
    ATSProgressiveRequest,
    ATSContentAnalysisRequest,
    ATSContentAnalysisResponse,
    KnockoutRiskItem,
)
from app.services.ai import get_usage_tracker
from app.services.ai.response import AccumulatedMetrics

from app.api.routes.ats.helpers import (
    execute_knockout_check,
    execute_structure_analysis,
    execute_keyword_analysis,
    execute_content_quality,
    execute_role_proximity,
    calculate_composite_score,
)

router = APIRouter()


@router.post("/analyze-content", response_model=ATSContentAnalysisResponse)
async def analyze_content(
    request: ATSContentAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ATSContentAnalysisResponse:
    """
    Synchronous ATS analysis using raw content (no database lookup).

    This endpoint provides the same 5-stage weighted scoring as /analyze-progressive
    but operates synchronously without SSE streaming. It accepts raw resume content
    directly, enabling the editor page to score live edits without saving first.

    **Scoring Stages:**
    - Stage 0: Knockout Risk Check (warnings only, not scored)
    - Stage 1: Structure Analysis (15% weight)
    - Stage 2: Enhanced Keyword Matching (40% weight)
    - Stage 3: Content Quality (25% weight)
    - Stage 4: Role Proximity (20% weight)

    **Use Cases:**
    - Editor page live scoring during unsaved edits
    - Preview scoring before finalizing changes
    - Consistent scoring between stepper and editor

    **Note:** This endpoint makes AI calls and tracks usage for cost monitoring.
    """
    # Track AI metrics across all stages
    accumulated_metrics = AccumulatedMetrics()

    # Build the progressive request format used by helper functions
    progressive_request = ATSProgressiveRequest(
        resume_content=request.resume_content,
        job_description=request.job_description,
        job_content=request.job_content,
    )

    # Determine which stages to skip
    skip_stages = set(request.skip_stages or [])

    # Stage results and failures
    stage_results = {}
    failed_stages = []
    stage_scores = {}
    knockout_risks = []
    keyword_analysis_data = None

    # Stage 0: Knockout Check (always run for warnings, not scored)
    if 0 not in skip_stages:
        try:
            knockout_result = await execute_knockout_check(
                progressive_request, current_user_id, db
            )
            stage_results["knockout-check"] = knockout_result

            # Extract knockout risks for response
            if knockout_result:
                if hasattr(knockout_result, "model_dump"):
                    knockout_data = knockout_result.model_dump()
                elif is_dataclass(knockout_result):
                    knockout_data = asdict(knockout_result)
                else:
                    knockout_data = knockout_result

                for risk in knockout_data.get("risks", []):
                    knockout_risks.append(
                        KnockoutRiskItem(
                            risk_type=risk.get("risk_type", "unknown"),
                            severity=risk.get("severity", "info"),
                            description=risk.get("description", ""),
                            job_requires=risk.get("job_requires", ""),
                            user_has=risk.get("user_has"),
                        )
                    )
        except Exception as e:
            failed_stages.append("Knockout Check")

    # Stage 1: Structure Analysis
    if 1 not in skip_stages:
        try:
            structure_result = await execute_structure_analysis(
                progressive_request, current_user_id, db
            )
            stage_results["structure"] = structure_result
            stage_scores["structure"] = float(structure_result.format_score)
        except Exception as e:
            failed_stages.append("Structure Analysis")

    # Stage 2: Enhanced Keyword Matching
    if 2 not in skip_stages:
        try:
            keyword_result, ai_metrics = await execute_keyword_analysis(
                progressive_request, current_user_id, db
            )
            stage_results["keywords-enhanced"] = keyword_result
            stage_scores["keywords-enhanced"] = float(keyword_result.keyword_score)

            # Accumulate AI metrics
            if ai_metrics:
                accumulated_metrics.add(ai_metrics)

            # Serialize keyword analysis for response
            if hasattr(keyword_result, "model_dump"):
                keyword_analysis_data = keyword_result.model_dump()
            elif is_dataclass(keyword_result):
                keyword_analysis_data = asdict(keyword_result)
            else:
                keyword_analysis_data = keyword_result
        except Exception as e:
            failed_stages.append("Keyword Matching")

    # Stage 3: Content Quality
    if 3 not in skip_stages:
        try:
            content_quality_result = await execute_content_quality(
                progressive_request, current_user_id, db
            )
            stage_results["content-quality"] = content_quality_result
            stage_scores["content-quality"] = float(
                content_quality_result.content_quality_score
            )
        except Exception as e:
            failed_stages.append("Content Quality")

    # Stage 4: Role Proximity
    if 4 not in skip_stages:
        try:
            role_proximity_result = await execute_role_proximity(
                progressive_request, current_user_id, db
            )
            stage_results["role-proximity"] = role_proximity_result
            stage_scores["role-proximity"] = float(
                role_proximity_result.role_proximity_score
            )
        except Exception as e:
            failed_stages.append("Role Proximity")

    # Calculate composite score using the same logic as progressive endpoint
    composite_score = calculate_composite_score(stage_results, failed_stages)

    # Log AI usage for cost monitoring
    if accumulated_metrics.call_count > 0:
        usage_tracker = get_usage_tracker()
        ai_response = accumulated_metrics.to_ai_response()
        await usage_tracker.log_generation(
            db=db,
            user_id=current_user_id,
            endpoint="/ats/analyze-content",
            response=ai_response,
        )
        await db.commit()

    return ATSContentAnalysisResponse(
        final_score=composite_score.final_score,
        stage_scores=stage_scores,
        stage_breakdown=composite_score.stage_breakdown,
        weights_used=composite_score.weights_used,
        failed_stages=composite_score.failed_stages,
        knockout_risks=knockout_risks,
        keyword_analysis=keyword_analysis_data,
    )
