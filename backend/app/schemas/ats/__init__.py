"""
ATS Analysis Schemas

Re-exports all ATS-related Pydantic models for convenient importing.

Usage:
    from app.schemas.ats import (
        ATSStructureRequest,
        ATSKeywordResponse,
        ContentQualityResponse,
        # etc.
    )
"""

# Stage 0: Knockout Check
from app.schemas.ats.knockout import (
    KnockoutCheckRequest,
    KnockoutCheckResponse,
    KnockoutRiskResponse,
)

# Stage 1: Structure Analysis
from app.schemas.ats.structure import (
    ATSStructureRequest,
    ATSStructureResponse,
    SectionOrderDetails,
)

# Stage 2: Keyword Analysis
from app.schemas.ats.keywords import (
    # Type aliases
    KeywordImportanceLevel,
    KeywordImportanceLevelEnhanced,
    # Basic keyword analysis
    ATSKeywordRequest,
    ATSKeywordResponse,
    ATSTipsResponse,
    # Detailed keyword analysis
    KeywordDetailResponse,
    ATSKeywordDetailedRequest,
    ATSKeywordDetailedResponse,
    # Enhanced keyword analysis (weighted scoring)
    KeywordMatchResponse,
    EnhancedKeywordDetailResponse,
    GapAnalysisItem,
    ATSKeywordEnhancedRequest,
    ATSKeywordEnhancedResponse,
)

# Stage 3: Content Quality
from app.schemas.ats.content_quality import (
    BulletAnalysisResponse,
    BlockTypeAnalysisResponse,
    QuantificationAnalysisResponse,
    ActionVerbAnalysisResponse,
    ContentQualityRequest,
    ContentQualityResponse,
)

# Stage 4: Role Proximity
from app.schemas.ats.role_proximity import (
    RoleProximityRequest,
    RoleProximityResponse,
    TitleMatchResponse,
    TrajectoryResponse,
    IndustryAlignmentResponse,
)

# Progressive SSE Analysis
from app.schemas.ats.progressive import (
    ATSProgressiveRequest,
    ATSStageProgress,
    ATSCompositeScore,
)

__all__ = [
    # Stage 0
    "KnockoutCheckRequest",
    "KnockoutCheckResponse",
    "KnockoutRiskResponse",
    # Stage 1
    "ATSStructureRequest",
    "ATSStructureResponse",
    "SectionOrderDetails",
    # Stage 2
    "KeywordImportanceLevel",
    "KeywordImportanceLevelEnhanced",
    "ATSKeywordRequest",
    "ATSKeywordResponse",
    "ATSTipsResponse",
    "KeywordDetailResponse",
    "ATSKeywordDetailedRequest",
    "ATSKeywordDetailedResponse",
    "KeywordMatchResponse",
    "EnhancedKeywordDetailResponse",
    "GapAnalysisItem",
    "ATSKeywordEnhancedRequest",
    "ATSKeywordEnhancedResponse",
    # Stage 3
    "BulletAnalysisResponse",
    "BlockTypeAnalysisResponse",
    "QuantificationAnalysisResponse",
    "ActionVerbAnalysisResponse",
    "ContentQualityRequest",
    "ContentQualityResponse",
    # Stage 4
    "RoleProximityRequest",
    "RoleProximityResponse",
    "TitleMatchResponse",
    "TrajectoryResponse",
    "IndustryAlignmentResponse",
    # Progressive
    "ATSProgressiveRequest",
    "ATSStageProgress",
    "ATSCompositeScore",
]
