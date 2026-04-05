"""
ATS Analyzer Facade.

Provides the main ATSAnalyzer class that composes all analyzer modules
and maintains backward compatibility with the original API.
"""

from functools import lru_cache
from typing import Any

from app.core.protocols import ATSReportData, ExperienceBlockData
from app.services.ai.response import AIResponse

from .analyzers import (
    ContentAnalyzer,
    KeywordAnalyzer,
    KnockoutAnalyzer,
    RoleAnalyzer,
    StructureAnalyzer,
    get_ats_tips,
)
from .models import (
    ContentQualityResult,
    DetailedKeywordAnalysis,
    EnhancedKeywordAnalysis,
    KnockoutCheckResult,
    RoleProximityResult,
    SectionOrderResult,
)


class ATSAnalyzer:
    """
    Honest ATS compatibility analysis.

    Does NOT claim to work with all ATS systems.
    Provides structural checks and keyword analysis.

    This is the main facade that composes all analyzer modules:
    - Stage 0: Knockout checks (KnockoutAnalyzer)
    - Stage 1: Structural analysis (StructureAnalyzer)
    - Stage 2: Keyword analysis (KeywordAnalyzer)
    - Stage 3: Content quality analysis (ContentAnalyzer)
    - Stage 4: Role proximity analysis (RoleAnalyzer)

    Analyzers are lazily initialized to avoid requiring API keys
    for tests that only use non-AI analyzers (e.g., structure tests).
    """

    def __init__(self):
        # Lazy initialization - set to None and create on first access
        self._structure_analyzer_instance: StructureAnalyzer | None = None
        self._knockout_analyzer_instance: KnockoutAnalyzer | None = None
        self._keyword_analyzer_instance: KeywordAnalyzer | None = None
        self._content_analyzer_instance: ContentAnalyzer | None = None
        self._role_analyzer_instance: RoleAnalyzer | None = None

    @property
    def _structure_analyzer(self) -> StructureAnalyzer:
        if self._structure_analyzer_instance is None:
            self._structure_analyzer_instance = StructureAnalyzer()
        return self._structure_analyzer_instance

    @property
    def _knockout_analyzer(self) -> KnockoutAnalyzer:
        if self._knockout_analyzer_instance is None:
            self._knockout_analyzer_instance = KnockoutAnalyzer()
        return self._knockout_analyzer_instance

    @property
    def _keyword_analyzer(self) -> KeywordAnalyzer:
        if self._keyword_analyzer_instance is None:
            self._keyword_analyzer_instance = KeywordAnalyzer()
        return self._keyword_analyzer_instance

    @property
    def _content_analyzer(self) -> ContentAnalyzer:
        if self._content_analyzer_instance is None:
            self._content_analyzer_instance = ContentAnalyzer()
        return self._content_analyzer_instance

    @property
    def _role_analyzer(self) -> RoleAnalyzer:
        if self._role_analyzer_instance is None:
            self._role_analyzer_instance = RoleAnalyzer()
        return self._role_analyzer_instance

    # ============================================================
    # Stage 0: Knockout Checks
    # ============================================================

    def perform_knockout_check(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> KnockoutCheckResult:
        """
        Perform knockout check to identify binary disqualifiers.

        This is Stage 0 of the ATS scoring pipeline.

        Args:
            parsed_resume: ParsedResume dict with experience, education, certifications
            parsed_job: ParsedJob dict with requirements and skills

        Returns:
            KnockoutCheckResult with pass/fail status and risk details
        """
        return self._knockout_analyzer.perform_knockout_check(parsed_resume, parsed_job)

    # ============================================================
    # Stage 1: Structural Analysis
    # ============================================================

    def validate_section_order(
        self,
        resume_content: dict[str, Any],
    ) -> SectionOrderResult:
        """
        Validate section order against expected ATS-friendly ordering.

        Args:
            resume_content: Parsed resume content as dictionary with section keys

        Returns:
            SectionOrderResult with order score and deviation details
        """
        return self._structure_analyzer.validate_section_order(resume_content)

    def analyze_structure(
        self,
        resume_content: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Analyze structural ATS compatibility.

        Args:
            resume_content: Parsed resume content as dictionary

        Returns:
            Dict with format_score, sections_found, sections_missing, etc.
        """
        return self._structure_analyzer.analyze_structure(resume_content)

    # ============================================================
    # Stage 2: Keyword Analysis
    # ============================================================

    async def analyze_keywords(
        self,
        resume_blocks: list[ExperienceBlockData],
        job_description: str,
    ) -> ATSReportData:
        """
        Analyze keyword coverage.

        Args:
            resume_blocks: Blocks currently in the resume
            job_description: Target job requirements

        Returns:
            ATSReportData with keyword analysis
        """
        return await self._keyword_analyzer.analyze_keywords(
            resume_blocks, job_description
        )

    async def analyze_keywords_detailed(
        self,
        resume_blocks: list[ExperienceBlockData],
        job_description: str,
    ) -> DetailedKeywordAnalysis:
        """
        Perform detailed keyword analysis with importance levels.

        Args:
            resume_blocks: Blocks currently in the resume
            job_description: Target job requirements

        Returns:
            DetailedKeywordAnalysis with importance-grouped keywords
        """
        return await self._keyword_analyzer.analyze_keywords_detailed(
            resume_blocks, job_description
        )

    async def analyze_keywords_enhanced(
        self,
        parsed_resume: dict[str, Any],
        job_description: str,
        return_metrics: bool = False,
    ) -> EnhancedKeywordAnalysis | tuple[EnhancedKeywordAnalysis, AIResponse | None]:
        """
        Perform enhanced keyword analysis with Stage 2 scoring.

        Args:
            parsed_resume: Parsed resume content as structured dictionary
            job_description: Target job requirements text
            return_metrics: If True, return (result, AIResponse) tuple

        Returns:
            EnhancedKeywordAnalysis with weighted scores and detailed breakdown.
            If return_metrics=True, returns (EnhancedKeywordAnalysis, AIResponse | None).
        """
        return await self._keyword_analyzer.analyze_keywords_enhanced(
            parsed_resume, job_description, return_metrics=return_metrics
        )

    # ============================================================
    # Stage 3: Content Quality Analysis
    # ============================================================

    def analyze_content_quality(
        self,
        parsed_resume: dict[str, Any],
        block_type_weight: float = 0.4,
        quantification_weight: float = 0.35,
        action_verb_weight: float = 0.25,
    ) -> ContentQualityResult:
        """
        Perform Stage 3 content quality analysis on a resume.

        Args:
            parsed_resume: Structured resume content
            block_type_weight: Weight for block type score (default 0.4)
            quantification_weight: Weight for quantification score (default 0.35)
            action_verb_weight: Weight for action verb score (default 0.25)

        Returns:
            ContentQualityResult with detailed analysis and suggestions
        """
        return self._content_analyzer.analyze_content_quality(
            parsed_resume, block_type_weight, quantification_weight, action_verb_weight
        )

    # ============================================================
    # Stage 4: Role Proximity Analysis
    # ============================================================

    async def calculate_role_proximity_score(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> RoleProximityResult:
        """
        Calculate the Stage 4 Role Proximity Score.

        Args:
            parsed_resume: Structured resume content with 'experience' key
            parsed_job: Parsed job content with 'title' and 'company' keys

        Returns:
            RoleProximityResult with score and detailed breakdown
        """
        return await self._role_analyzer.calculate_role_proximity_score(
            parsed_resume, parsed_job
        )

    # ============================================================
    # Utility Methods
    # ============================================================

    def get_ats_tips(self) -> list[str]:
        """Return general ATS optimization tips."""
        return get_ats_tips()


@lru_cache
def get_ats_analyzer() -> ATSAnalyzer:
    """Get a singleton ATSAnalyzer instance."""
    return ATSAnalyzer()
