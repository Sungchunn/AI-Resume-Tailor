"""
ATS Analyzer Content Quality Models.

Dataclasses for content quality analysis (Stage 3).
"""

from dataclasses import dataclass


@dataclass
class BulletAnalysis:
    """Analysis of a single resume bullet point."""

    text: str
    has_quantification: bool
    has_action_verb: bool
    has_weak_phrase: bool
    action_verb_categories: list[str]  # e.g., ["leadership", "achievement"]
    detected_metrics: list[str]  # Specific metrics found (e.g., "40%", "$1M")
    quality_score: float  # 0-1 individual bullet quality


@dataclass
class BlockTypeAnalysis:
    """Analysis of block types (achievement vs responsibility)."""

    total_bullets: int
    achievement_count: int
    responsibility_count: int
    project_count: int
    other_count: int
    achievement_ratio: float  # 0-1 ratio of achievements
    quality_score: float  # 0-100 score based on achievement ratio


@dataclass
class QuantificationAnalysis:
    """Analysis of quantification density in content."""

    total_bullets: int
    quantified_bullets: int
    quantification_density: float  # 0-1 ratio
    quality_score: float  # 0-100 score
    metrics_found: list[str]  # All metrics extracted
    bullets_needing_metrics: list[str]  # Bullets without metrics (for suggestions)


@dataclass
class ActionVerbAnalysis:
    """Analysis of action verb usage in content."""

    total_bullets: int
    bullets_with_action_verbs: int
    bullets_with_weak_phrases: int
    action_verb_coverage: float  # 0-1 ratio
    weak_phrase_ratio: float  # 0-1 ratio (lower is better)
    quality_score: float  # 0-100 score
    verb_category_distribution: dict[str, int]  # Count by category


@dataclass
class ContentQualityResult:
    """
    Result of Stage 3 content quality analysis.

    Combines:
    - Block type classification (achievement vs responsibility ratio)
    - Quantification density scoring
    - Action verb analysis
    """

    # Overall content quality score (0-100)
    content_quality_score: float

    # Component scores (0-100)
    block_type_score: float
    quantification_score: float
    action_verb_score: float

    # Component weights (how much each contributed)
    block_type_weight: float  # Default 0.4
    quantification_weight: float  # Default 0.35
    action_verb_weight: float  # Default 0.25

    # Detailed analysis
    block_type_analysis: BlockTypeAnalysis
    quantification_analysis: QuantificationAnalysis
    action_verb_analysis: ActionVerbAnalysis

    # Individual bullet analyses
    bullet_analyses: list[BulletAnalysis]

    # Suggestions for improvement
    suggestions: list[str]
    warnings: list[str]

    # Summary stats
    total_bullets_analyzed: int
    high_quality_bullets: int  # Score > 0.7
    low_quality_bullets: int   # Score < 0.4
