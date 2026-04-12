# Task 7: Switch Formula from Multiplicative to Additive

**Status:** Pending
**Priority:** 5
**Effort:** 1-2 hrs
**Impact:** High
**Dependencies:** Should follow Tasks 1-4

---

## Overview

The current multiplicative formula (`placement × density × recency × importance`) means small errors cascade. A slight miscalculation in one factor amplifies through all others. Switch to additive with bounded bonuses for more predictable scores.

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/app/services/job/ats/analyzers/keyword/scorer.py` | Replace scoring function |

---

## Current Implementation

```python
def calculate_keyword_score(
    placement: float,
    density: float,
    recency: float,
    importance: float,
) -> float:
    """Multiplicative scoring - errors cascade."""
    weighted_score = 1.0 * placement * density * recency * importance
    return weighted_score
```

**Problem:** A 2x error in recency doubles the entire score.

---

## New Implementation

```python
def calculate_keyword_score(
    placement: float,
    density: float,
    recency: float,
    importance: float,
    cross_section: float = 1.0,
) -> float:
    """
    Additive scoring with bounded bonuses.
    Each factor contributes independently, limiting error propagation.

    Args:
        placement: Section weight (0.3 to 1.0)
        density: Mention count multiplier (1.0 to 2.0)
        recency: Time-based weight (0.6 to 2.0)
        importance: Tier multiplier (1.0 to 2.0)
        cross_section: Bonus for claim+proof (1.0 or 1.15)

    Returns:
        Score for this keyword (1.0 to 5.25 max)
    """
    base = 1.0

    # Convert each factor to a bounded bonus
    # Each bonus is (factor - minimum) capped at a maximum contribution

    placement_bonus = min(placement - 0.3, 0.7)      # Range: 0.0 to 0.7
    density_bonus = min(density - 1.0, 1.0)          # Range: 0.0 to 1.0
    recency_bonus = min(recency - 0.6, 1.4)          # Range: 0.0 to 1.4
    importance_bonus = min(importance - 1.0, 1.0)    # Range: 0.0 to 1.0
    cross_bonus = cross_section - 1.0                # Range: 0.0 to 0.15

    score = (
        base +
        placement_bonus +
        density_bonus +
        recency_bonus +
        importance_bonus +
        cross_bonus
    )

    return score


# Maximum possible score per keyword (for normalization)
MAX_KEYWORD_SCORE = 5.25  # 1.0 + 0.7 + 1.0 + 1.4 + 1.0 + 0.15
```

---

## Bonus Range Breakdown

| Factor | Input Range | Bonus Formula | Bonus Range | Max Contribution |
| ------ | ----------- | ------------- | ----------- | ---------------- |
| Base | N/A | 1.0 | 1.0 | 19% |
| Placement | 0.3 - 1.0 | `min(placement - 0.3, 0.7)` | 0.0 - 0.7 | 13% |
| Density | 1.0 - 2.0 | `min(density - 1.0, 1.0)` | 0.0 - 1.0 | 19% |
| Recency | 0.6 - 2.0 | `min(recency - 0.6, 1.4)` | 0.0 - 1.4 | 27% |
| Importance | 1.0 - 2.0 | `min(importance - 1.0, 1.0)` | 0.0 - 1.0 | 19% |
| Cross-section | 1.0 - 1.15 | `cross_section - 1.0` | 0.0 - 0.15 | 3% |

---

## Score Comparison

### Example: Perfect Match

| Factor | Value | Old Formula | New Formula |
| ------ | ----- | ----------- | ----------- |
| Placement | 1.0 (experience) | × 1.0 | + 0.7 |
| Density | 2.0 (capped) | × 2.0 | + 1.0 |
| Recency | 2.0 (current) | × 2.0 | + 1.4 |
| Importance | 2.0 (required) | × 2.0 | + 1.0 |
| Cross-section | 1.15 | × 1.15 | + 0.15 |
| **Total** | | **9.2** | **5.25** |

### Example: Partial Match

| Factor | Value | Old Formula | New Formula |
| ------ | ----- | ----------- | ----------- |
| Placement | 0.5 (skills) | × 0.5 | + 0.2 |
| Density | 1.0 (single) | × 1.0 | + 0.0 |
| Recency | 1.0 (mid-career) | × 1.0 | + 0.4 |
| Importance | 1.2 (preferred) | × 1.2 | + 0.2 |
| Cross-section | 1.0 (no bonus) | × 1.0 | + 0.0 |
| **Total** | | **0.6** | **1.8** |

---

## Error Propagation Comparison

**Scenario:** Recency is miscalculated (should be 1.0, actually 2.0)

### Old Formula (Multiplicative)

```text
Correct:  1.0 × 1.0 × 1.0 × 2.0 = 2.0
Wrong:    1.0 × 1.0 × 2.0 × 2.0 = 4.0
Error:    2x the correct score (100% error)
```

### New Formula (Additive)

```text
Correct:  1.0 + 0.7 + 0.0 + 0.4 + 1.0 = 3.1
Wrong:    1.0 + 0.7 + 0.0 + 1.4 + 1.0 = 4.1
Error:    +1.0 points (32% error)
```

---

## Normalization Update

The final keyword score calculation also needs updating:

```python
def calculate_final_keyword_score(keyword_scores: list[float]) -> float:
    """
    Calculate the final 0-100 keyword score.

    Args:
        keyword_scores: List of individual keyword scores

    Returns:
        Normalized score from 0 to 100
    """
    if not keyword_scores:
        return 0.0

    total_score = sum(keyword_scores)
    max_possible = len(keyword_scores) * MAX_KEYWORD_SCORE

    return (total_score / max_possible) * 100
```

---

## Verification

1. **Maximum score:** All factors at max → score = 5.25
2. **Minimum score:** All factors at min → score = 1.0 (base only)
3. **Single factor error:** Changing one factor by 2x should not change total by >50%
4. **Zero keywords:** Should return 0, not error
5. **Normalization:** Total keyword score should be 0-100 scale
