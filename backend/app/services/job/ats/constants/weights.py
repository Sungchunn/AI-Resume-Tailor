"""
ATS Analyzer Weights and Scoring Constants.

Section placement, density, recency, and importance tier weights
used in the Stage 2 enhanced keyword scoring system.
"""

from typing import Literal

# Importance level type (Stage 2.4 - Enhanced with strongly_preferred)
KeywordImportance = Literal["required", "strongly_preferred", "preferred", "nice_to_have"]

# Section placement weights (Stage 2.1)
# Keywords in experience sections are weighted higher than skills sections
SECTION_PLACEMENT_WEIGHTS = {
    "experience": 1.0,      # Demonstrated experience - highest weight
    "projects": 0.9,        # Applied knowledge
    "skills": 0.7,          # Listed but not demonstrated
    "summary": 0.6,         # Claims without evidence
    "education": 0.5,       # Academic context
    "certifications": 0.5,  # Certifications section
    "other": 0.5,           # Default for unrecognized sections
}

# Density multipliers with diminishing returns (Stage 2.2)
DENSITY_MULTIPLIERS = {
    1: 1.0,
    2: 1.3,
    3: 1.5,
    # 4+ uses 1.5 (capped)
}
DENSITY_CAP = 1.5

# Recency weights by role position (Stage 2.3)
RECENCY_WEIGHTS = {
    0: 2.0,  # Most recent role (index 0)
    1: 2.0,  # Second most recent
    2: 1.0,  # Third most recent
    # Older roles use 0.8
}
RECENCY_DEFAULT = 0.8

# Importance tier weights (Stage 2.4)
IMPORTANCE_WEIGHTS = {
    "required": 3.0,
    "strongly_preferred": 2.0,
    "preferred": 1.5,
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
