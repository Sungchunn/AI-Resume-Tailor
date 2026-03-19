# Task 1: Widen Placement Weights

**Status:** Pending
**Priority:** 2
**Effort:** 5 min
**Impact:** High
**Dependencies:** None

---

## Overview

The current placement weights are too close together (0.5 to 1.0). A keyword in a skills list scores almost as well as one proven in an experience bullet. Widen the spread so demonstrated usage matters more.

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/app/services/job/ats/constants/weights.py` | Update constants |

---

## Current Implementation

```python
SECTION_PLACEMENT_WEIGHTS = {
    "experience": 1.0,
    "projects": 0.9,
    "skills": 0.7,
    "summary": 0.6,
    "education": 0.5,
    "certifications": 0.5,
    "other": 0.5,
}
```

---

## New Implementation

```python
SECTION_PLACEMENT_WEIGHTS = {
    "experience": 1.0,      # Proven in a real role
    "projects": 0.8,        # Applied but not professional
    "skills": 0.5,          # Listed, not demonstrated
    "summary": 0.3,         # Claimed without evidence
    "education": 0.3,       # Academic context only
    "certifications": 0.4,  # Validated credential
    "other": 0.3,           # Unknown section
}
```

---

## Rationale

"Python" in a skills list vs "Built microservice in Python serving 10K req/day" should not score similarly.

| Comparison | Old Gap | New Gap |
| ---------- | ------- | ------- |
| Experience vs Skills | 1.43x (1.0 vs 0.7) | 2.0x (1.0 vs 0.5) |
| Experience vs Summary | 1.67x (1.0 vs 0.6) | 3.33x (1.0 vs 0.3) |
| Projects vs Skills | 1.29x (0.9 vs 0.7) | 1.6x (0.8 vs 0.5) |

---

## Verification

After implementing, test with a resume that has the same keyword in different sections:

1. Keyword only in `skills` section → should score ~50% of max placement score
2. Keyword only in `experience` section → should score 100% of max placement score
3. The difference should be visually noticeable in the UI (~2x)
