# Task 6: Add Cross-Section Bonus

**Status:** Pending
**Priority:** 6
**Effort:** 30 min
**Impact:** Medium
**Dependencies:** Requires Task 7 (additive formula)

---

## Overview

A keyword found in both a "claim" section (skills, summary) AND a "proof" section (experience, projects) is a stronger signal than either alone. Add a small bonus for this.

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/app/services/job/ats/constants/weights.py` | Add new constants |
| `/backend/app/services/job/ats/analyzers/keyword/scorer.py` | Add bonus function |

---

## New Constants (weights.py)

```python
# Cross-section bonus for keywords appearing in both claim and proof sections
CROSS_SECTION_BONUS = 1.15  # 15% bonus (or 0.15 additive in new formula)

# Section classifications
DEMONSTRATION_SECTIONS = {"experience", "projects"}  # "Proof" sections
CLAIM_SECTIONS = {"skills", "summary"}  # "Claim" sections
```

---

## New Function (scorer.py)

```python
from ..constants.weights import (
    CROSS_SECTION_BONUS,
    DEMONSTRATION_SECTIONS,
    CLAIM_SECTIONS,
)


def apply_cross_section_bonus(section_matches: list[str]) -> float:
    """
    Returns bonus multiplier if keyword appears in both
    a demonstration section and a claim section.

    The intuition: If someone lists "Python" in their skills AND
    demonstrates it in their experience, that's stronger evidence
    than either alone.

    Args:
        section_matches: List of section names where keyword was found

    Returns:
        CROSS_SECTION_BONUS if both section types present, else 1.0
    """
    matched_sections = set(s.lower() for s in section_matches)

    has_demonstration = bool(matched_sections & DEMONSTRATION_SECTIONS)
    has_claim = bool(matched_sections & CLAIM_SECTIONS)

    if has_demonstration and has_claim:
        return CROSS_SECTION_BONUS
    return 1.0
```

---

## Integration with Scoring

### With Multiplicative Formula (pre-Task 7)

```python
def calculate_keyword_score(...) -> float:
    # ... existing calculations ...

    cross_bonus = apply_cross_section_bonus(keyword_sections)

    weighted_score = (
        1.0 * placement * density * recency * importance * cross_bonus
    )
    return weighted_score
```

### With Additive Formula (post-Task 7)

```python
def calculate_keyword_score(...) -> float:
    # ... existing calculations ...

    cross_section = apply_cross_section_bonus(keyword_sections)
    cross_bonus = cross_section - 1.0  # Convert multiplier to additive bonus

    score = base + placement_bonus + density_bonus + recency_bonus + importance_bonus + cross_bonus
    return score
```

---

## Section Classification Table

| Section | Type | Rationale |
| ------- | ---- | --------- |
| `experience` | Demonstration | Proven in real job context |
| `projects` | Demonstration | Applied knowledge with evidence |
| `skills` | Claim | Listed without proof |
| `summary` | Claim | Self-description without evidence |
| `education` | Neither | Academic context (no bonus) |
| `certifications` | Neither | Credential (no bonus) |

---

## Examples

### Example 1: Bonus Applied

```text
Keyword: "Python"
Found in: ["skills", "experience"]
Result: 1.15 bonus (claim + demonstration)
```

### Example 2: No Bonus (Proof Only)

```text
Keyword: "AWS"
Found in: ["experience", "projects"]
Result: 1.0 (both are demonstration, no claim)
```

### Example 3: No Bonus (Claim Only)

```text
Keyword: "Leadership"
Found in: ["skills", "summary"]
Result: 1.0 (both are claims, no demonstration)
```

### Example 4: No Bonus (Single Section)

```text
Keyword: "Docker"
Found in: ["experience"]
Result: 1.0 (only one section)
```

---

## Verification

1. **Bonus case:** Keyword in skills + experience → cross_bonus = 1.15
2. **No bonus (proof only):** Keyword in experience + projects → cross_bonus = 1.0
3. **No bonus (claim only):** Keyword in skills + summary → cross_bonus = 1.0
4. **Single section:** Keyword in experience only → cross_bonus = 1.0
5. **Case insensitive:** "Experience" and "SKILLS" should work correctly
