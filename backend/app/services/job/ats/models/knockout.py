"""
ATS Analyzer Knockout Models.

Dataclasses for knockout check analysis (Stage 0).
"""

from dataclasses import dataclass, field
from typing import Any

from ..constants import KnockoutRiskType, KnockoutSeverity


@dataclass
class KnockoutRisk:
    """A potential knockout risk that may auto-disqualify the candidate."""

    risk_type: KnockoutRiskType
    severity: KnockoutSeverity
    description: str
    job_requires: str
    user_has: str | None = None


@dataclass
class KnockoutCheckResult:
    """Result of the knockout check analysis."""

    passes_all_checks: bool
    risks: list[KnockoutRisk] = field(default_factory=list)
    summary: str = ""
    recommendation: str = ""
    analysis: dict[str, Any] = field(default_factory=dict)
