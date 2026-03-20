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


def calculate_keyword_weighted_score(
    matches: list[KeywordMatch],
    importance: KeywordImportance,
) -> tuple[float, float, float, float]:
    """
    Calculate weighted score for a keyword based on Stage 2 factors.

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

    # Calculate component scores
    placement_score = best_placement
    density_score = density_multiplier
    recency_score = best_recency

    # Final weighted score combines all factors
    # Base of 1.0 (keyword found) * placement * density * recency * importance
    final_score = 1.0 * placement_score * density_score * recency_score * importance_weight

    return (placement_score, density_score, recency_score, final_score)
