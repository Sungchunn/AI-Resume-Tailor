"""
ATS Analyzer Constants.

Re-exports all constant definitions for convenient importing.
"""

from .weights import (
    KeywordImportance,
    SECTION_PLACEMENT_WEIGHTS,
    DENSITY_MULTIPLIERS,
    DENSITY_CAP,
    RECENCY_WEIGHTS,
    RECENCY_DEFAULT,
    IMPORTANCE_WEIGHTS,
    BLOCK_TYPE_WEIGHTS,
    QUANTIFICATION_TARGET,
    ACHIEVEMENT_RATIO_TARGET,
    ACTION_VERB_THRESHOLD,
)

from .patterns import (
    QUANTIFICATION_PATTERNS,
    ACTION_VERB_PATTERNS,
    WEAK_PHRASE_PATTERNS,
    TECH_KEYWORD_PATTERNS,
)

from .titles import (
    TITLE_ABBREVIATIONS,
    LEVEL_HIERARCHY,
    NUMERIC_LEVEL_MAP,
    FUNCTION_CATEGORIES,
    TRAJECTORY_MODIFIERS,
    TrajectoryType,
)

from .industry import (
    INDUSTRY_TAXONOMY,
)

from .education import (
    KnockoutSeverity,
    KnockoutRiskType,
    EDUCATION_LEVELS,
    EDUCATION_PATTERNS,
)

__all__ = [
    # Weights
    "KeywordImportance",
    "SECTION_PLACEMENT_WEIGHTS",
    "DENSITY_MULTIPLIERS",
    "DENSITY_CAP",
    "RECENCY_WEIGHTS",
    "RECENCY_DEFAULT",
    "IMPORTANCE_WEIGHTS",
    "BLOCK_TYPE_WEIGHTS",
    "QUANTIFICATION_TARGET",
    "ACHIEVEMENT_RATIO_TARGET",
    "ACTION_VERB_THRESHOLD",
    # Patterns
    "QUANTIFICATION_PATTERNS",
    "ACTION_VERB_PATTERNS",
    "WEAK_PHRASE_PATTERNS",
    "TECH_KEYWORD_PATTERNS",
    # Titles
    "TITLE_ABBREVIATIONS",
    "LEVEL_HIERARCHY",
    "NUMERIC_LEVEL_MAP",
    "FUNCTION_CATEGORIES",
    "TRAJECTORY_MODIFIERS",
    "TrajectoryType",
    # Industry
    "INDUSTRY_TAXONOMY",
    # Education
    "KnockoutSeverity",
    "KnockoutRiskType",
    "EDUCATION_LEVELS",
    "EDUCATION_PATTERNS",
]
