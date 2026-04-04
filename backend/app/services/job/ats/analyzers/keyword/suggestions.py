"""
Keyword Suggestion Generation.

Functions for generating actionable suggestions based on missing keywords.
"""


def generate_keyword_suggestions(
    missing_keywords: list[str],
) -> list[str]:
    """
    Generate actionable suggestions for adding missing keywords.
    """
    suggestions: list[str] = []

    # Suggest adding the most important missing keywords
    for keyword in missing_keywords[:5]:  # Limit to top 5
        suggestions.append(
            f"Consider adding '{keyword}' to your resume if you have relevant experience"
        )

    return suggestions


def generate_detailed_suggestions(
    required_missing: list[str],
    preferred_missing: list[str],
) -> list[str]:
    """Generate suggestions for adding missing keywords."""
    suggestions: list[str] = []

    # Prioritize required keywords
    for keyword in required_missing[:3]:
        suggestions.append(
            f"Add '{keyword}' (required) - this is critical for passing ATS filters"
        )

    # Then preferred keywords
    for keyword in preferred_missing[:2]:
        suggestions.append(
            f"Add '{keyword}' (preferred) to strengthen your application"
        )

    return suggestions


def generate_enhanced_suggestions(
    required_missing: list[str],
    strongly_preferred_missing: list[str],
    preferred_missing: list[str],
) -> list[str]:
    """Generate suggestions prioritized by importance tier."""
    suggestions: list[str] = []

    # Priority 1: Required keywords
    for keyword in required_missing[:3]:
        suggestions.append(
            f"CRITICAL: Add '{keyword}' (required) to pass ATS filters"
        )

    # Priority 2: Strongly preferred keywords
    for keyword in strongly_preferred_missing[:2]:
        suggestions.append(
            f"HIGH: Add '{keyword}' (strongly preferred) to improve your match"
        )

    # Priority 3: Preferred keywords
    for keyword in preferred_missing[:2]:
        suggestions.append(
            f"Add '{keyword}' (preferred) to strengthen your application"
        )

    return suggestions
