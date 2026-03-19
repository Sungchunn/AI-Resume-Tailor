# Task 4: Compress Importance Tier Multipliers

**Status:** Pending
**Priority:** 1
**Effort:** 5 min
**Impact:** High
**Dependencies:** None

---

## Overview

The 3.0x multiplier for "required" is too aggressive. If the AI accidentally tags a "preferred" skill as "required," the score swings by 2x on the most impactful factor. Compress the range so misclassifications hurt less.

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/app/services/job/ats/constants/weights.py` | Update constants |

---

## Current Implementation

```python
IMPORTANCE_WEIGHTS = {
    "required": 3.0,
    "strongly_preferred": 2.0,
    "preferred": 1.5,
    "nice_to_have": 1.0,
}
```

---

## New Implementation

```python
IMPORTANCE_WEIGHTS = {
    "required": 2.0,
    "strongly_preferred": 1.5,
    "preferred": 1.2,
    "nice_to_have": 1.0,
}
```

---

## Impact Analysis

### Misclassification Error Reduction

| Misclassification | Old Error | New Error | Improvement |
| ----------------- | --------- | --------- | ----------- |
| required → preferred | 2.0x (3.0/1.5) | 1.67x (2.0/1.2) | 17% less error |
| required → strongly_preferred | 1.5x (3.0/2.0) | 1.33x (2.0/1.5) | 11% less error |
| strongly_preferred → preferred | 1.33x (2.0/1.5) | 1.25x (1.5/1.2) | 6% less error |

### Tier Gaps

| Tier Comparison | Old Gap | New Gap |
| --------------- | ------- | ------- |
| required vs nice_to_have | 3.0x | 2.0x |
| required vs preferred | 2.0x | 1.67x |
| required vs strongly_preferred | 1.5x | 1.33x |

---

## Rationale

The AI keyword extractor classifies importance tiers based on language patterns like "must have," "required," "preferred," etc. This classification is inherently imperfect:

1. **False positives:** "Experience with X required" might refer to a different role level
2. **Context loss:** Job descriptions often use "required" loosely
3. **Ambiguity:** "Strong background in X" could be required or preferred

By compressing the multiplier range:

- Still meaningful differentiation between tiers
- Less catastrophic when classification is wrong
- More stable scores across similar job descriptions

---

## Verification

1. **Score stability test:** Change a single keyword from "required" to "preferred"
   - Old: Score drops by up to 50% (3.0 → 1.5)
   - New: Score drops by ~40% (2.0 → 1.2)

2. **Total score swing:** With 10 keywords, misclassifying one should not swing total by >15%

3. **Edge case:** All keywords marked "nice_to_have" should still produce a reasonable score (not artificially low)
