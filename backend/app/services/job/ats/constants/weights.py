"""
ATS Analyzer Weights and Scoring Constants.

Section placement, density, recency, and importance tier weights
used in the Stage 2 enhanced keyword scoring system.
"""

from typing import Literal

# Importance level type (Stage 2.4 - Enhanced with strongly_preferred)
KeywordImportance = Literal["required", "strongly_preferred", "preferred", "nice_to_have"]

# Section placement weights (Stage 2.1)
# Widened spread so demonstrated usage matters more than claims
# See docs/features/ats/190326_keyword-analysis-improvements/task-1-placement-weights.md
SECTION_PLACEMENT_WEIGHTS = {
    "experience": 1.0,      # Proven in a real role - highest weight
    "projects": 0.8,        # Applied but not professional
    "skills": 0.5,          # Listed, not demonstrated
    "summary": 0.3,         # Claimed without evidence
    "education": 0.3,       # Academic context only
    "certifications": 0.4,  # Validated credential
    "other": 0.3,           # Unknown section
}

# Density scoring (Stage 2.2)
# Logarithmic curve replaces step function for smoother diminishing returns
# See docs/features/ats/190326_keyword-analysis-improvements/task-2-density-curve.md
DENSITY_CAP = 2.0  # Maximum density multiplier (prevents keyword stuffing)

# Recency weights by role position (Stage 2.3)
RECENCY_WEIGHTS = {
    0: 2.0,  # Most recent role (index 0)
    1: 2.0,  # Second most recent
    2: 1.0,  # Third most recent
    # Older roles use 0.8
}
RECENCY_DEFAULT = 0.8

# Importance tier weights (Stage 2.4)
# Compressed range (1.0-2.0) to reduce misclassification error propagation
# See docs/features/ats/190326_keyword-analysis-improvements/task-4-importance-tiers.md
IMPORTANCE_WEIGHTS = {
    "required": 2.0,
    "strongly_preferred": 1.5,
    "preferred": 1.2,
    "nice_to_have": 1.0,
}

# Block type weights for content quality scoring
BLOCK_TYPE_WEIGHTS = {
    "achievement": 1.0,     # Achievements are highest value
    "project": 0.85,        # Projects with outcomes
    "responsibility": 0.6,  # Duties without metrics
    "skill": 0.5,           # Skills statements
    "education": 0.4,       # Academic items
    "certification": 0.4,   # Certifications
}

# Content quality thresholds
QUANTIFICATION_TARGET = 0.5       # 50% of achievement bullets should be quantified
ACHIEVEMENT_RATIO_TARGET = 0.6    # 60% achievement vs responsibility ratio target
ACTION_VERB_THRESHOLD = 0.8       # 80% of bullets should start with action verbs
