"""
ATS Analyzer Role Proximity Models.

Dataclasses for role proximity analysis (Stage 4).
"""

from dataclasses import dataclass
from typing import Literal

from ..constants import TrajectoryType


@dataclass
class TitleMatchResult:
    """Result of title similarity analysis."""

    resume_title: str  # Most recent job title from resume
    job_title: str  # Target job title
    normalized_resume_title: str  # After normalization
    normalized_job_title: str  # After normalization
    similarity_score: float  # 0-1 semantic similarity
    title_score: float  # 0-100 converted score
    resume_level: int  # Extracted seniority level
    job_level: int  # Extracted seniority level
    level_gap: int  # job_level - resume_level
    resume_function: str  # Functional category
    job_function: str  # Functional category
    function_match: bool  # Whether functions match


@dataclass
class TrajectoryResult:
    """Result of career trajectory analysis."""

    trajectory_type: TrajectoryType
    modifier: int  # Score modifier (-20 to +20)
    current_level: int  # Most recent role level
    target_level: int  # Target job level
    level_gap: int  # target - current
    level_progression: list[int]  # Historical levels from oldest to newest
    is_ascending: bool  # Whether career has been progressing upward
    function_match: bool  # Whether moving in same function
    explanation: str  # Human-readable explanation


@dataclass
class IndustryAlignmentResult:
    """Result of industry alignment analysis."""

    resume_industries: list[str]  # Industries detected from resume
    most_recent_industry: str  # Industry from most recent role
    target_industry: str  # Industry of target job
    alignment_type: Literal["same", "adjacent", "unrelated"]
    modifier: int  # Score modifier (0 to +10)


@dataclass
class RoleProximityResult:
    """
    Result of Stage 4 Role Proximity Score analysis.

    Combines:
    - Title similarity (semantic + structural)
    - Career trajectory analysis
    - Industry alignment
    """

    # Overall score (0-100)
    role_proximity_score: float

    # Component results
    title_match: TitleMatchResult
    trajectory: TrajectoryResult
    industry_alignment: IndustryAlignmentResult

    # Human-readable summary
    explanation: str

    # Actionable insights
    concerns: list[str]  # e.g., ["Large level gap: Junior → Staff"]
    strengths: list[str]  # e.g., ["Same industry", "Clear progression"]
