"""
ATS Analyzer Structure Models.

Dataclasses for structural analysis (Stage 1).
"""

from dataclasses import dataclass


@dataclass
class SectionOrderResult:
    """Result of section order validation."""

    order_score: int  # 75-100 based on deviation
    detected_order: list[str]  # Sections in the order they appear
    expected_order: list[str]  # The standard expected order
    deviation_type: str  # "standard", "minor", "major", "non_standard"
    issues: list[str]  # Specific order issues found
