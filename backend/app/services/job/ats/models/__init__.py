"""
ATS Analyzer Models.

Re-exports all dataclass definitions for convenient importing.
"""

from .content import (
    ActionVerbAnalysis,
    BlockTypeAnalysis,
    BulletAnalysis,
    ContentQualityResult,
    QuantificationAnalysis,
)
from .keywords import (
    DetailedKeywordAnalysis,
    EnhancedKeywordAnalysis,
    EnhancedKeywordDetail,
    KeywordDetail,
    KeywordMatch,
)
from .knockout import (
    KnockoutCheckResult,
    KnockoutRisk,
)
from .role import (
    IndustryAlignmentResult,
    RoleProximityResult,
    TitleMatchResult,
    TrajectoryResult,
)
from .structure import (
    SectionOrderResult,
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
