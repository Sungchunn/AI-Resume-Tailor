"""
ATS Analyzer Keyword Models.

Dataclasses for keyword analysis (Stage 1 and Stage 2).
"""

from dataclasses import dataclass, field
from typing import Any

from ..constants import KeywordImportance


@dataclass
class KeywordMatch:
    """A single match of a keyword in the resume."""

    section: str  # Which section the match was found in
    role_index: int | None  # Index of the role (0 = most recent) if in experience
    text_snippet: str | None  # Snippet around the match


@dataclass
class KeywordDetail:
    """Detailed information about a keyword."""

    keyword: str
    importance: KeywordImportance
    found_in_resume: bool
    found_in_vault: bool
    frequency_in_job: int  # How many times it appears in job description
    context: str | None  # Sample context from job description


@dataclass
class EnhancedKeywordDetail:
    """
    Enhanced keyword detail with Stage 2 scoring components.

    Includes placement weighting, density scoring, recency weighting,
    and importance tier scoring.
    """

    keyword: str
    importance: KeywordImportance
    found_in_resume: bool
    found_in_vault: bool
    frequency_in_job: int  # How many times it appears in job description
    context: str | None  # Sample context from job description

    # Stage 2 enhancements
    matches: list[KeywordMatch] = field(default_factory=list)  # All matches found
    occurrence_count: int = 0  # Total occurrences in resume

    # Calculated scores
    base_score: float = 0.0  # 0 or 1 based on presence
    placement_score: float = 0.0  # Weighted by section (Stage 2.1)
    density_score: float = 0.0  # With diminishing returns (Stage 2.2)
    recency_score: float = 0.0  # Weighted by role position (Stage 2.3)
    importance_weight: float = 1.0  # Importance tier multiplier (Stage 2.4)

    # Final weighted score for this keyword
    weighted_score: float = 0.0


@dataclass
class EnhancedKeywordAnalysis:
    """
    Enhanced keyword analysis with Stage 2 scoring.

    Provides a weighted keyword score that accounts for:
    - Placement: where keywords appear (experience > skills)
    - Density: repetition with diminishing returns
    - Recency: recent roles weighted higher
    - Importance: required keywords weighted higher than preferred
    """

    # Overall scores (0-100)
    keyword_score: float  # Final weighted keyword score
    raw_coverage: float  # Simple coverage (matched/total)

    # Coverage by importance tier (0-1)
    required_coverage: float
    strongly_preferred_coverage: float
    preferred_coverage: float
    nice_to_have_coverage: float

    # Score breakdown
    placement_contribution: float  # How much placement weighting affected score
    density_contribution: float  # How much density scoring affected score
    recency_contribution: float  # How much recency weighting affected score

    # Grouped by importance
    required_matched: list[str]
    required_missing: list[str]
    strongly_preferred_matched: list[str]
    strongly_preferred_missing: list[str]
    preferred_matched: list[str]
    preferred_missing: list[str]
    nice_to_have_matched: list[str]
    nice_to_have_missing: list[str]

    # Vault availability for missing keywords
    missing_available_in_vault: list[str]
    missing_not_in_vault: list[str]

    # Gap analysis with importance tiers
    gap_list: list[dict[str, Any]]  # [{keyword, importance, in_vault, suggestion}]

    # Detailed keyword list
    all_keywords: list[EnhancedKeywordDetail]

    # Suggestions and warnings
    suggestions: list[str]
    warnings: list[str]


@dataclass
class DetailedKeywordAnalysis:
    """Enhanced keyword analysis with importance grouping."""

    coverage_score: float  # Overall coverage 0-1
    required_coverage: float  # Coverage of required keywords 0-1
    preferred_coverage: float  # Coverage of preferred keywords 0-1

    # Grouped by importance
    required_matched: list[str]
    required_missing: list[str]
    preferred_matched: list[str]
    preferred_missing: list[str]
    nice_to_have_matched: list[str]
    nice_to_have_missing: list[str]

    # Vault availability for missing keywords
    missing_available_in_vault: list[str]
    missing_not_in_vault: list[str]

    # Detailed keyword list
    all_keywords: list[KeywordDetail]

    # Suggestions
    suggestions: list[str]
    warnings: list[str]
