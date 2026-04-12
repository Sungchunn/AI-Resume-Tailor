# Task 2: Replace Density Hard Cap with Logarithmic Curve

**Status:** Pending
**Priority:** 4
**Effort:** 30 min
**Impact:** Medium
**Dependencies:** None

---

## Overview

The current step function caps at 1.5x after 3 mentions. Someone who used Python across 6 roles gets the same score as someone who mentioned it 3 times. Replace with a log curve that keeps giving diminishing credit.

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/app/services/job/ats/constants/weights.py` | Update cap constant |
| `/backend/app/services/job/ats/analyzers/keyword/scorer.py` | Replace lookup with function |

---

## Current Implementation

**weights.py:**

```python
DENSITY_MULTIPLIERS = {
    1: 1.0,
    2: 1.3,
    3: 1.5,
}
DENSITY_CAP = 1.5
```

**scorer.py** (lookup-based):

```python
def get_density_multiplier(count: int) -> float:
    return DENSITY_MULTIPLIERS.get(count, DENSITY_CAP)
```

---

## New Implementation

**weights.py:**

```python
# Remove DENSITY_MULTIPLIERS dict
DENSITY_CAP = 2.0
```

**scorer.py:**

```python
import math

def get_density_multiplier(count: int) -> float:
    """
    Logarithmic density scoring with diminishing returns.

    Formula: 1.0 + 0.4 * log2(count), capped at DENSITY_CAP

    This rewards multiple mentions while preventing gaming through
    keyword stuffing. The log curve ensures each additional mention
    contributes less than the previous one.
    """
    if count <= 0:
        return 0.0
    return min(1.0 + 0.4 * math.log2(count), DENSITY_CAP)
```

---

## Multiplier Comparison Table

| Mentions | Old Multiplier | New Multiplier | Delta |
| -------- | -------------- | -------------- | ----- |
| 1        | 1.0            | 1.0            | 0     |
| 2        | 1.3            | 1.4            | +0.1  |
| 3        | 1.5            | 1.63           | +0.13 |
| 4        | 1.5 (capped)   | 1.8            | +0.3  |
| 5        | 1.5 (capped)   | 1.93           | +0.43 |
| 6        | 1.5 (capped)   | 2.0 (cap)      | +0.5  |
| 10       | 1.5 (capped)   | 2.0 (cap)      | +0.5  |

---

## Mathematical Justification

The formula `1.0 + 0.4 * log2(count)` was chosen because:

1. **Base of 1.0:** First mention gets full credit
2. **Log2 growth:** Each doubling of mentions adds 0.4 to the multiplier
3. **Cap at 2.0:** Prevents excessive scores from keyword stuffing

```text
log2(1) = 0    → 1.0 + 0.4 * 0   = 1.0
log2(2) = 1    → 1.0 + 0.4 * 1   = 1.4
log2(4) = 2    → 1.0 + 0.4 * 2   = 1.8
log2(8) = 3    → 1.0 + 0.4 * 3   = 2.2 → capped to 2.0
```

---

## Verification

1. Single mention → multiplier = 1.0
2. Double mention → multiplier = 1.4 (not 1.3)
3. 4+ mentions → multiplier continues to grow (not capped at 1.5)
4. 10+ mentions → multiplier capped at 2.0 (no gaming benefit)
