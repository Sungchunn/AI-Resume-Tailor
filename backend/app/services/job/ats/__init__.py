"""
ATS Analyzer Module.

Provides HONEST, actionable feedback about ATS (Applicant Tracking System)
compatibility. Does NOT claim universal ATS compatibility (which is impossible
since different ATS systems have different parsing behaviors).

Features:
- Stage 0: Knockout checks (binary disqualifiers)
- Stage 1: Structural analysis (section headers, formatting)
- Stage 2: Keyword coverage analysis with importance levels
- Stage 3: Content quality analysis (achievement vs responsibility ratio)
- Stage 4: Role proximity analysis (title similarity, career trajectory)

Usage:
    from app.services.job.ats import ATSAnalyzer, get_ats_analyzer

    analyzer = get_ats_analyzer()
    result = await analyzer.analyze_keywords(resume_blocks, job_description, vault_blocks)
"""

from .constants import (
    ACHIEVEMENT_RATIO_TARGET,
    ACTION_VERB_PATTERNS,
    # Education
    EDUCATION_LEVELS,
    EDUCATION_PATTERNS,
    FUNCTION_CATEGORIES,
    # Industry
    INDUSTRY_TAXONOMY,
    # Titles
    LEVEL_HIERARCHY,
    # Patterns
    QUANTIFICATION_PATTERNS,
    # Weights and thresholds
    QUANTIFICATION_TARGET,
    TRAJECTORY_MODIFIERS,
    # Types / Enums
    KeywordImportance,
    KnockoutRiskType,
    KnockoutSeverity,
    TrajectoryType,
)
from .facade import ATSAnalyzer, get_ats_analyzer
from .models import (
    ActionVerbAnalysis,
    BlockTypeAnalysis,
    # Content
    BulletAnalysis,
    ContentQualityResult,
    DetailedKeywordAnalysis,
    EnhancedKeywordAnalysis,
    EnhancedKeywordDetail,
    IndustryAlignmentResult,
    KeywordDetail,
    # Keywords
    KeywordMatch,
    KnockoutCheckResult,
    # Knockout
    KnockoutRisk,
    QuantificationAnalysis,
    RoleProximityResult,
    # Structure
    SectionOrderResult,
    # Role
    TitleMatchResult,
    TrajectoryResult,
)

__all__ = [
    # Main exports
    "ATSAnalyzer",
    "get_ats_analyzer",
    # Knockout models
    "KnockoutRisk",
    "KnockoutCheckResult",
    # Keyword models
    "KeywordMatch",
    "KeywordDetail",
    "EnhancedKeywordDetail",
    "EnhancedKeywordAnalysis",
    "DetailedKeywordAnalysis",
    # Structure models
    "SectionOrderResult",
    # Content models
    "BulletAnalysis",
    "BlockTypeAnalysis",
    "QuantificationAnalysis",
    "ActionVerbAnalysis",
    "ContentQualityResult",
    # Role models
    "TitleMatchResult",
    "TrajectoryResult",
    "IndustryAlignmentResult",
    "RoleProximityResult",
    # Types
    "KeywordImportance",
    "KnockoutSeverity",
    "KnockoutRiskType",
    "TrajectoryType",
    # Constants (for backward compatibility)
    "QUANTIFICATION_TARGET",
    "ACHIEVEMENT_RATIO_TARGET",
    "QUANTIFICATION_PATTERNS",
    "ACTION_VERB_PATTERNS",
    "LEVEL_HIERARCHY",
    "FUNCTION_CATEGORIES",
    "TRAJECTORY_MODIFIERS",
    "INDUSTRY_TAXONOMY",
    "EDUCATION_LEVELS",
    "EDUCATION_PATTERNS",
]
