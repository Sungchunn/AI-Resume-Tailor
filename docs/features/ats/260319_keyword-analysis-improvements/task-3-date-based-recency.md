# Task 3: Switch Recency from Index-Based to Date-Based

**Status:** Pending
**Priority:** 7
**Effort:** 1-2 hrs
**Impact:** Medium
**Dependencies:** Requires date parsing in matcher

---

## Overview

Index 0 and index 1 both get 2.0x weight, meaning "current job" and "job from 4 years ago listed second" are treated the same. Use actual dates instead, falling back to index-based if dates can't be parsed.

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/app/services/job/ats/constants/weights.py` | Update/add constants |
| `/backend/app/services/job/ats/analyzers/keyword/scorer.py` | Add date-based function |
| `/backend/app/services/job/ats/analyzers/keyword/matcher.py` | Pass role date info |

---

## Current Implementation

**weights.py:**

```python
RECENCY_WEIGHTS = {
    0: 2.0,  # Most recent role (index 0)
    1: 2.0,  # Second most recent
    2: 1.0,  # Third most recent
}
RECENCY_DEFAULT = 0.8
```

**Problem:** Index 0 and 1 both get 2.0x, which doesn't reflect actual time elapsed.

---

## New Implementation

**weights.py:**

```python
# Fallback when date parsing fails
RECENCY_WEIGHTS_BY_INDEX = {
    0: 2.0,
    1: 1.5,  # Now differentiated from index 0
    2: 1.0,
}
RECENCY_DEFAULT = 0.8

# Date-based constants
RECENCY_MAX_WEIGHT = 2.0
RECENCY_MIN_WEIGHT = 0.6
RECENCY_DECAY_MONTHS = 36  # Full decay over 3 years
```

**scorer.py:**

```python
from datetime import datetime
from ..constants.weights import (
    RECENCY_WEIGHTS_BY_INDEX,
    RECENCY_DEFAULT,
    RECENCY_MAX_WEIGHT,
    RECENCY_MIN_WEIGHT,
    RECENCY_DECAY_MONTHS,
)

def get_recency_weight(role_end_date: str | None, role_index: int) -> float:
    """
    Weight by how recently the role ended.
    Falls back to index-based if date parsing fails.

    Args:
        role_end_date: ISO date string or "Present" for current roles
        role_index: Position in resume (0 = most recent)

    Returns:
        Weight between RECENCY_MIN_WEIGHT and RECENCY_MAX_WEIGHT
    """
    if role_end_date:
        try:
            # Handle "Present" or current role indicators
            if role_end_date.lower() in ("present", "current", "now"):
                return RECENCY_MAX_WEIGHT

            end = parse_date(role_end_date)  # Use existing date parser
            months_ago = (datetime.now() - end).days / 30

            # Linear decay from max to min over RECENCY_DECAY_MONTHS
            weight = RECENCY_MAX_WEIGHT - (months_ago / RECENCY_DECAY_MONTHS) * (RECENCY_MAX_WEIGHT - RECENCY_MIN_WEIGHT)
            return max(RECENCY_MIN_WEIGHT, weight)

        except (ValueError, TypeError):
            pass  # Fall through to index-based

    # Fallback to index-based
    return RECENCY_WEIGHTS_BY_INDEX.get(role_index, RECENCY_DEFAULT)
```

---

## Weight Decay Table

| Role ended      | Months ago | Weight | Notes |
| --------------- | ---------- | ------ | ----- |
| Current/Present | 0          | 2.0    | Maximum weight |
| 6 months ago    | 6          | 1.83   | Recent role |
| 1 year ago      | 12         | 1.67   | Slight decay |
| 18 months ago   | 18         | 1.50   | Moderate decay |
| 2 years ago     | 24         | 1.33   | Significant decay |
| 3 years ago     | 36         | 0.6    | Minimum weight |
| 5+ years ago    | 60+        | 0.6    | Capped at minimum |

---

## Matcher Integration

The matcher needs to pass role date information. Check how `matcher.py` identifies which role a keyword was found in and ensure `end_date` is available.

**Expected data flow:**

```python
# In matcher.py, when finding a keyword match:
match = KeywordMatch(
    keyword="python",
    section="experience",
    role_index=0,
    role_end_date="2026-03-01",  # NEW: Pass this to scorer
    # ... other fields
)
```

---

## Verification

1. **Current role:** Keyword in "Present" role → weight = 2.0
2. **Recent role:** Keyword in role ending 6 months ago → weight ≈ 1.83
3. **Old role:** Keyword in role ending 3+ years ago → weight = 0.6
4. **No date:** Falls back to index-based weights
5. **Invalid date:** Falls back to index-based weights (no errors)
