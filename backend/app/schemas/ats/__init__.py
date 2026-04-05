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
# Stage 3: Content Quality
from app.schemas.ats.content_quality import (
    ActionVerbAnalysisResponse,
    BlockTypeAnalysisResponse,
    BulletAnalysisResponse,
    ContentQualityRequest,
    ContentQualityResponse,
    QuantificationAnalysisResponse,
)

# Stage 2: Keyword Analysis
from app.schemas.ats.keywords import (
    ATSKeywordDetailedRequest,
    ATSKeywordDetailedResponse,
    ATSKeywordEnhancedRequest,
    ATSKeywordEnhancedResponse,
    # Basic keyword analysis
    ATSKeywordRequest,
    ATSKeywordResponse,
    ATSTipsResponse,
    EnhancedKeywordDetailResponse,
    ExtractKeywordsRequest,
    ExtractKeywordsResponse,
    GapAnalysisItem,
    GetKeywordOverrideResponse,
    # Detailed keyword analysis
    KeywordDetailResponse,
    # Type aliases
    KeywordImportanceLevel,
    KeywordImportanceLevelEnhanced,
    # Enhanced keyword analysis (weighted scoring)
    KeywordMatchResponse,
    # Keyword overrides (user edits)
    KeywordOverrideRequest,
    KeywordOverrideResponse,
    # Keyword extraction with context (for review step)
    KeywordWithContext,
    SourceSectionType,
)
from app.schemas.ats.knockout import (
    KnockoutCheckRequest,
    KnockoutCheckResponse,
    KnockoutRiskResponse,
)

# Progressive SSE Analysis
from app.schemas.ats.progressive import (
    ATSCompositeScore,
    # Content-based synchronous analysis
    ATSContentAnalysisRequest,
    ATSContentAnalysisResponse,
    ATSProgressiveRequest,
    ATSStageProgress,
    KnockoutRiskItem,
)

# Stage 4: Role Proximity
from app.schemas.ats.role_proximity import (
    IndustryAlignmentResponse,
    RoleProximityRequest,
    RoleProximityResponse,
    TitleMatchResponse,
    TrajectoryResponse,
)

# Stage 1: Structure Analysis
from app.schemas.ats.structure import (
    ATSStructureRequest,
    ATSStructureResponse,
    SectionOrderDetails,
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
    "SourceSectionType",
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
    # Keyword extraction with context
    "KeywordWithContext",
    "ExtractKeywordsRequest",
    "ExtractKeywordsResponse",
    # Keyword overrides
    "KeywordOverrideRequest",
    "KeywordOverrideResponse",
    "GetKeywordOverrideResponse",
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
    # Content-based analysis
    "ATSContentAnalysisRequest",
    "ATSContentAnalysisResponse",
    "KnockoutRiskItem",
]
