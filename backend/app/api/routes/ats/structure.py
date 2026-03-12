"""
ATS Stage 1: Structure Analysis

Analyzes resume structure for ATS compatibility.
"""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id
from app.services.job.ats import get_ats_analyzer

from app.schemas.ats import (
    ATSStructureRequest,
    ATSStructureResponse,
    SectionOrderDetails,
)

router = APIRouter()


@router.post("/structure", response_model=ATSStructureResponse)
async def analyze_structure(
    request: ATSStructureRequest,
    user_id: int = Depends(get_current_user_id),
):
    """
    Analyze resume structure for ATS compatibility.

    Checks:
    - Standard section headers (Experience, Education, Skills, etc.)
    - Contact information presence
    - Section order validation (some ATS like Taleo penalize non-standard order)
    - Formatting issues that may cause parsing problems

    **Section Order Scoring:**
    - 100: Standard order (Contact → Summary → Experience → Education → Skills → Certifications)
    - 95: Minor deviation (e.g., Skills before Education)
    - 85: Major deviation (e.g., Education before Experience)
    - 75: Completely non-standard order

    Returns a score and actionable suggestions for improvement.
    """
    analyzer = get_ats_analyzer()
    result = analyzer.analyze_structure(request.resume_content)

    return ATSStructureResponse(
        format_score=result["format_score"],
        sections_found=result["sections_found"],
        sections_missing=result["sections_missing"],
        section_order_score=result["section_order_score"],
        section_order_details=SectionOrderDetails(
            detected_order=result["section_order_details"]["detected_order"],
            expected_order=result["section_order_details"]["expected_order"],
            deviation_type=result["section_order_details"]["deviation_type"],
            issues=result["section_order_details"]["issues"],
        ),
        warnings=result["warnings"],
        suggestions=result["suggestions"],
    )
