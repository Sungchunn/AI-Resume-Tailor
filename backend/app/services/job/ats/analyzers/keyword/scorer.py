"""
Keyword Scoring Functions.

Implements Stage 2 weighted scoring:
- Stage 2.1: Placement weighting
- Stage 2.2: Density scoring (logarithmic curve)
- Stage 2.3: Recency weighting
- Stage 2.4: Importance tiers

See docs/features/ats/190326_keyword-analysis-improvements/
"""

import math

from ...constants import (
    KeywordImportance,
    SECTION_PLACEMENT_WEIGHTS,
    DENSITY_CAP,
    RECENCY_WEIGHTS,
    RECENCY_DEFAULT,
    IMPORTANCE_WEIGHTS,
)
from ...models import KeywordMatch


def get_placement_weight(section: str) -> float:
    """
    Get the placement weight for a section type.

    Stage 2.1: Keywords in experience sections are weighted higher.
    """
    return SECTION_PLACEMENT_WEIGHTS.get(section, SECTION_PLACEMENT_WEIGHTS["other"])


def get_density_multiplier(occurrence_count: int) -> float:
    """
    Logarithmic density scoring with diminishing returns.

    Formula: 1.0 + 0.4 * log2(count), capped at DENSITY_CAP

    This rewards multiple mentions while preventing gaming through
    keyword stuffing. The log curve ensures each additional mention
    contributes less than the previous one.

    Stage 2.2: See task-2-density-curve.md for rationale.
    """
    if occurrence_count <= 0:
        return 0.0
    return min(1.0 + 0.4 * math.log2(occurrence_count), DENSITY_CAP)


def get_recency_weight(role_index: int | None) -> float:
    """
    Get the recency weight based on role position.

    Stage 2.3: Recent roles are weighted higher.
    """
    if role_index is None:
        return 1.0  # Not in a role, use neutral weight
    return RECENCY_WEIGHTS.get(role_index, RECENCY_DEFAULT)


def get_importance_weight(importance: KeywordImportance) -> float:
    """
    Get the importance tier weight.

    Stage 2.4: Required keywords weighted higher than preferred.
    """
    return IMPORTANCE_WEIGHTS.get(importance, 1.0)


# Maximum possible score per keyword for normalization
# Base(1.0) + placement(0.7) + density(1.0) + recency(1.4) + importance(1.0) + cross(0.15)
MAX_KEYWORD_SCORE = 5.25


def calculate_additive_score(
    placement: float,
    density: float,
    recency: float,
    importance: float,
    cross_section: float = 1.0,
) -> float:
    """
    Additive scoring with bounded bonuses.

    Each factor contributes independently, limiting error propagation.
    A 2x error in one factor adds ~30% error instead of 100% error
    with multiplicative scoring.

    Args:
        placement: Section weight (0.3 to 1.0)
        density: Mention count multiplier (1.0 to 2.0)
        recency: Time-based weight (0.6 to 2.0)
        importance: Tier multiplier (1.0 to 2.0)
        cross_section: Bonus for claim+proof (1.0 or 1.15)

    Returns:
        Score for this keyword (1.0 to 5.25 max)

    See docs/features/ats/190326_keyword-analysis-improvements/task-7-additive-formula.md
    """
    base = 1.0

    # Convert each factor to a bounded bonus
    # Each bonus is (factor - minimum) capped at a maximum contribution
    placement_bonus = min(placement - 0.3, 0.7)      # Range: 0.0 to 0.7
    density_bonus = min(density - 1.0, 1.0)          # Range: 0.0 to 1.0
    recency_bonus = min(recency - 0.6, 1.4)          # Range: 0.0 to 1.4
    importance_bonus = min(importance - 1.0, 1.0)    # Range: 0.0 to 1.0
    cross_bonus = cross_section - 1.0                # Range: 0.0 to 0.15

    return (
        base +
        placement_bonus +
        density_bonus +
        recency_bonus +
        importance_bonus +
        cross_bonus
    )


def calculate_keyword_weighted_score(
    matches: list[KeywordMatch],
    importance: KeywordImportance,
    cross_section_bonus: float = 1.0,
) -> tuple[float, float, float, float]:
    """
    Calculate weighted score for a keyword based on Stage 2 factors.

    Uses additive formula to limit error propagation.

    Args:
        matches: List of keyword matches in resume
        importance: Keyword importance tier
        cross_section_bonus: Bonus multiplier for claim+proof (default 1.0)

    Returns:
        (placement_score, density_score, recency_score, final_weighted_score)
    """
    if not matches:
        return (0.0, 0.0, 0.0, 0.0)

    # Stage 2.1: Placement weighting - use best placement
    placement_weights = [get_placement_weight(m.section) for m in matches]
    best_placement = max(placement_weights) if placement_weights else 0.0

    # Stage 2.2: Density scoring - count unique matches
    occurrence_count = len(matches)
    density_multiplier = get_density_multiplier(occurrence_count)

    # Stage 2.3: Recency weighting - use best recency
    recency_weights = [
        get_recency_weight(m.role_index)
        for m in matches
        if m.role_index is not None
    ]
    best_recency = max(recency_weights) if recency_weights else 1.0

    # Stage 2.4: Importance weight
    importance_weight = get_importance_weight(importance)

    # Calculate component scores (for reporting)
    placement_score = best_placement
    density_score = density_multiplier
    recency_score = best_recency

    # Final score uses additive formula
    final_score = calculate_additive_score(
        placement=best_placement,
        density=density_multiplier,
        recency=best_recency,
        importance=importance_weight,
        cross_section=cross_section_bonus,
    )

    return (placement_score, density_score, recency_score, final_score)
