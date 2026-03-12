"""
ATS Analysis Helper Functions

Shared execution helpers for the progressive ATS analysis endpoint.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.block import BlockRepository
from app.schemas.ats import (
    ATSProgressiveRequest,
    KnockoutCheckRequest,
    ATSStructureRequest,
    ContentQualityRequest,
    RoleProximityRequest,
    ATSCompositeScore,
)
from app.services.ai.response import AIResponse
from app.services.job.ats import get_ats_analyzer

# Import endpoint functions from stage modules
from app.api.routes.ats.knockout import perform_knockout_check
from app.api.routes.ats.structure import analyze_structure
from app.api.routes.ats.content_quality import analyze_content_quality
from app.api.routes.ats.role_proximity import analyze_role_proximity


async def execute_knockout_check(
    request: ATSProgressiveRequest, user_id: int, db: AsyncSession
):
    """Execute Stage 0: Knockout Check."""
    resume_text = None
    if request.resume_content:
        parts = []
        contact = request.resume_content.get("contact", {})
        if contact:
            if contact.get("name"):
                parts.append(contact["name"])
            if contact.get("email"):
                parts.append(contact["email"])
            if contact.get("location"):
                parts.append(contact["location"])

        if request.resume_content.get("summary"):
            parts.append(request.resume_content["summary"])

        for exp in request.resume_content.get("experience", []):
            if exp.get("title"):
                parts.append(exp["title"])
            if exp.get("company"):
                parts.append(exp["company"])
            if exp.get("dates"):
                parts.append(exp["dates"])
            for bullet in exp.get("bullets", []):
                parts.append(bullet)

        for edu in request.resume_content.get("education", []):
            if edu.get("degree"):
                parts.append(edu["degree"])
            if edu.get("institution"):
                parts.append(edu["institution"])

        skills = request.resume_content.get("skills", [])
        if skills:
            parts.extend(skills)

        for cert in request.resume_content.get("certifications", []):
            if isinstance(cert, str):
                parts.append(cert)
            elif isinstance(cert, dict) and cert.get("name"):
                parts.append(cert["name"])

        resume_text = "\n".join(parts)

    knockout_request = KnockoutCheckRequest(
        resume_id=request.resume_id,
        job_id=request.job_id,
        resume_content=resume_text,
        job_description=request.job_description,
    )
    return await perform_knockout_check(knockout_request, user_id, db)


async def execute_structure_analysis(
    request: ATSProgressiveRequest, user_id: int, db: AsyncSession
):
    """Execute Stage 1: Structure Analysis."""
    resume_content = request.resume_content or {}
    structure_request = ATSStructureRequest(resume_content=resume_content)
    return await analyze_structure(structure_request, user_id)


async def execute_keyword_analysis(
    request: ATSProgressiveRequest, user_id: int, db: AsyncSession
) -> tuple[Any, AIResponse | None]:
    """Execute Stage 2: Enhanced Keyword Analysis.

    Returns:
        Tuple of (EnhancedKeywordAnalysis result, AIResponse metrics or None)
    """
    analyzer = get_ats_analyzer()
    block_repo = BlockRepository()

    # Get vault blocks for gap analysis
    vault_blocks = await block_repo.list_blocks(db, user_id=user_id, limit=500)

    # Perform enhanced keyword analysis with metrics
    result, ai_metrics = await analyzer.analyze_keywords_enhanced(
        parsed_resume=request.resume_content or {},
        job_description=request.job_description or "",
        vault_blocks=vault_blocks,
        return_metrics=True,
    )

    return result, ai_metrics


async def execute_content_quality(
    request: ATSProgressiveRequest, user_id: int, db: AsyncSession
):
    """Execute Stage 3: Content Quality."""
    content_request = ContentQualityRequest(
        resume_id=request.resume_id,
        resume_content=request.resume_content,
    )
    return await analyze_content_quality(content_request, user_id, db)


async def execute_role_proximity(
    request: ATSProgressiveRequest, user_id: int, db: AsyncSession
):
    """Execute Stage 4: Role Proximity."""
    proximity_request = RoleProximityRequest(
        resume_id=request.resume_id,
        job_id=request.job_id,
        resume_content=request.resume_content,
        job_content=request.job_content,
    )
    return await analyze_role_proximity(proximity_request, user_id, db)


def calculate_composite_score(
    stage_results: dict,
    failed_stages: list[str]
) -> ATSCompositeScore:
    """
    Calculate weighted composite ATS score.

    Standard weights:
    - Structure: 15%
    - Keywords: 40%
    - Content Quality: 25%
    - Role Proximity: 20%

    If stages fail, renormalize remaining weights to sum to 1.0.
    """
    weights = {
        "structure": 0.15,
        "keywords-enhanced": 0.40,
        "content-quality": 0.25,
        "role-proximity": 0.20,
    }

    scores = {}
    available_weight = 0.0

    for stage_key, weight in weights.items():
        if stage_key in stage_results:
            result = stage_results[stage_key]

            if stage_key == "structure":
                scores[stage_key] = float(result.format_score)
            elif stage_key == "keywords-enhanced":
                scores[stage_key] = float(result.keyword_score)
            elif stage_key == "content-quality":
                scores[stage_key] = float(result.content_quality_score)
            elif stage_key == "role-proximity":
                scores[stage_key] = float(result.role_proximity_score)

            available_weight += weight

    normalization_applied = available_weight < 1.0
    if normalization_applied and available_weight > 0:
        normalization_factor = 1.0 / available_weight
        weights = {k: v * normalization_factor if k in scores else 0 for k, v in weights.items()}

    final_score = sum(scores[k] * weights.get(k, 0) for k in scores) if scores else 0.0

    stage_breakdown = {
        k: round(scores[k] * weights.get(k, 0), 2) for k in scores
    }

    return ATSCompositeScore(
        final_score=round(final_score, 1),
        stage_breakdown=stage_breakdown,
        weights_used={k: round(v, 3) for k, v in weights.items()},
        normalization_applied=normalization_applied,
        failed_stages=failed_stages,
    )
