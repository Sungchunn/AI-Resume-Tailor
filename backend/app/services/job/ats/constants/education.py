"""
ATS Analyzer Education Constants.

Education level hierarchy and pattern matching for knockout checks.
"""

from typing import Literal

# Severity levels for knockout risks
KnockoutSeverity = Literal["critical", "warning", "info"]

# Knockout risk types
KnockoutRiskType = Literal[
    "experience_years",
    "education_level",
    "certification",
    "location",
    "work_authorization",
]

# Education level hierarchy (higher number = higher level)
EDUCATION_LEVELS = {
    "none": 0,
    "high_school": 1,
    "associate": 2,
    "bachelors": 3,
    "masters": 4,
    "phd": 5,
    "doctorate": 5,
}

# Patterns for detecting education requirements
EDUCATION_PATTERNS = {
    "phd": [
        r"\bph\.?d\.?\b",
        r"\bdoctorate\b",
        r"\bdoctoral\b",
    ],
    "masters": [
        r"\bmaster'?s?\b",
        r"\bm\.?s\.?\b",
        r"\bm\.?a\.?\b",
        r"\bm\.?b\.?a\.?\b",
        r"\bmsc\b",
    ],
    "bachelors": [
        r"\bbachelor'?s?\b",
        r"\bb\.?s\.?\b",
        r"\bb\.?a\.?\b",
        r"\bundergraduate\b",
        r"\b4[- ]?year\s+degree\b",
    ],
    "associate": [
        r"\bassociate'?s?\b",
        r"\ba\.?s\.?\b",
        r"\b2[- ]?year\s+degree\b",
    ],
}
