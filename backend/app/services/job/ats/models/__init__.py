"""
ATS Analyzer Models.

Re-exports all dataclass definitions for convenient importing.
"""

from .knockout import (
    KnockoutRisk,
    KnockoutCheckResult,
)

from .keywords import (
    KeywordMatch,
    KeywordDetail,
    EnhancedKeywordDetail,
    EnhancedKeywordAnalysis,
    DetailedKeywordAnalysis,
)

from .structure import (
    SectionOrderResult,
)

from .content import (
    BulletAnalysis,
    BlockTypeAnalysis,
    QuantificationAnalysis,
    ActionVerbAnalysis,
    ContentQualityResult,
)

from .role import (
    TitleMatchResult,
    TrajectoryResult,
    IndustryAlignmentResult,
    RoleProximityResult,
)

__all__ = [
    # Knockout
    "KnockoutRisk",
    "KnockoutCheckResult",
    # Keywords
    "KeywordMatch",
    "KeywordDetail",
    "EnhancedKeywordDetail",
    "EnhancedKeywordAnalysis",
    "DetailedKeywordAnalysis",
    # Structure
    "SectionOrderResult",
    # Content
    "BulletAnalysis",
    "BlockTypeAnalysis",
    "QuantificationAnalysis",
    "ActionVerbAnalysis",
    "ContentQualityResult",
    # Role
    "TitleMatchResult",
    "TrajectoryResult",
    "IndustryAlignmentResult",
    "RoleProximityResult",
]
