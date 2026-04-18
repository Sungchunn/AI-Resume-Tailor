"""
ATS Keyword Analyzer.

Main orchestrator class for keyword analysis (Stage 1 basic and Stage 2 enhanced).
"""

import re
from typing import Any

from app.core.protocols import ATSReportData, ExperienceBlockData
from app.services.ai.response import AIResponse

from ...constants import KeywordImportance
from ...models import (
    DetailedKeywordAnalysis,
    EnhancedKeywordAnalysis,
    EnhancedKeywordDetail,
    KeywordDetail,
)
from ..base import (
    count_keyword_frequency,
    get_keyword_context,
)
from .extractor import KeywordExtractor
from .matcher import (
    detect_section_type,
    find_keyword_matches,
    order_experiences_by_date,
)
from .scorer import (
    MAX_KEYWORD_SCORE,
    calculate_keyword_weighted_score,
    get_density_multiplier,
    get_importance_weight,
    get_placement_weight,
    get_recency_weight,
)
from .suggestions import (
    generate_detailed_suggestions,
    generate_enhanced_suggestions,
    generate_keyword_suggestions,
)


class KeywordAnalyzer:
    """
    Analyzes keyword coverage between resume and job description.

    Implements:
    - Stage 1: Basic keyword analysis
    - Stage 2: Enhanced keyword scoring with placement, density, recency, importance
    """

    def __init__(self, ai_client=None):
        self._extractor = KeywordExtractor(ai_client=ai_client)

    @property
    def _ai_client(self):
        """Backward compatibility for test mocking."""
        return self._extractor._ai_client

    # ============================================================
    # Backward Compatibility Methods (delegate to module functions)
    # ============================================================

    async def _extract_keywords_with_importance(
        self, job_description: str
    ) -> list[dict[str, Any]]:
        """Backward compatibility wrapper for KeywordExtractor method."""
        return await self._extractor.extract_keywords_with_importance(job_description)

    async def _extract_keywords_with_importance_enhanced(
        self, job_description: str
    ) -> list[dict[str, Any]]:
        """Backward compatibility wrapper for KeywordExtractor method."""
        return await self._extractor.extract_keywords_with_importance_enhanced(job_description)

    def _detect_section_type(self, key: str) -> str:
        """Backward compatibility wrapper for detect_section_type."""
        return detect_section_type(key)

    def _get_placement_weight(self, section: str) -> float:
        """Backward compatibility wrapper for get_placement_weight."""
        return get_placement_weight(section)

    def _get_density_multiplier(self, occurrence_count: int) -> float:
        """Backward compatibility wrapper for get_density_multiplier."""
        return get_density_multiplier(occurrence_count)

    def _get_recency_weight(self, role_index: int | None) -> float:
        """Backward compatibility wrapper for get_recency_weight."""
        return get_recency_weight(role_index)

    def _get_importance_weight(self, importance: KeywordImportance) -> float:
        """Backward compatibility wrapper for get_importance_weight."""
        return get_importance_weight(importance)

    def _order_experiences_by_date(
        self, experiences: list[dict[str, Any]]
    ) -> list[tuple[int, dict[str, Any]]]:
        """Backward compatibility wrapper for order_experiences_by_date."""
        return order_experiences_by_date(experiences)

    def _find_keyword_matches_in_structured_resume(
        self, keyword: str, parsed_resume: dict[str, Any]
    ) -> list:
        """Backward compatibility wrapper for find_keyword_matches."""
        return find_keyword_matches(keyword, parsed_resume)

    def _calculate_keyword_weighted_score(
        self, matches: list, importance: KeywordImportance
    ) -> tuple[float, float, float, float]:
        """Backward compatibility wrapper for calculate_keyword_weighted_score."""
        return calculate_keyword_weighted_score(matches, importance)

    def _generate_detailed_suggestions(
        self,
        required_missing: list[str],
        preferred_missing: list[str],
    ) -> list[str]:
        """Backward compatibility wrapper for generate_detailed_suggestions."""
        return generate_detailed_suggestions(required_missing, preferred_missing)

    # ============================================================
    # Public Analysis Methods
    # ============================================================

    async def analyze_keywords(
        self,
        resume_blocks: list[ExperienceBlockData],
        job_description: str,
        return_metrics: bool = False,
    ) -> ATSReportData | tuple[ATSReportData, AIResponse | None]:
        """
        Analyze keyword coverage.

        Provides honest report showing:
        - Keywords matched
        - Keywords missing from resume

        Args:
            resume_blocks: Blocks currently in the resume
            job_description: Target job requirements

        Returns:
            ATSReportData with keyword analysis
        """
        # Extract keywords from job description
        ai_metrics = None
        if return_metrics:
            job_keywords, ai_metrics = await self._extractor.extract_keywords(
                job_description, return_metrics=True
            )
        else:
            job_keywords = await self._extractor.extract_keywords(job_description)

        # Build text content for comparison
        resume_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in resume_blocks
        ).lower()

        # Categorize keywords
        matched_keywords: list[str] = []
        missing_keywords: list[str] = []

        for keyword in job_keywords:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            if re.search(keyword_pattern, resume_text):
                matched_keywords.append(keyword)
            else:
                missing_keywords.append(keyword)

        # Calculate coverage
        total_keywords = len(job_keywords) if job_keywords else 1
        keyword_coverage = len(matched_keywords) / total_keywords

        # Generate suggestions
        suggestions = generate_keyword_suggestions(missing_keywords)

        # Generate warnings
        warnings: list[str] = []
        if keyword_coverage < 0.3:
            warnings.append(
                "Low keyword match - your resume may not pass ATS keyword filters"
            )
        if len(missing_keywords) > len(job_keywords) * 0.5:
            warnings.append(
                f"{len(missing_keywords)} job requirements not found in your resume. "
                "Consider whether this role is a good fit or if you have transferable skills."
            )

        result = ATSReportData(
            format_score=100,  # Not calculating format here, just keywords
            keyword_coverage=round(keyword_coverage, 2),
            matched_keywords=matched_keywords,
            missing_keywords=missing_keywords,
            missing_from_vault=[],  # Deprecated, kept for API compatibility
            warnings=warnings,
            suggestions=suggestions,
        )

        return (result, ai_metrics) if return_metrics else result

    async def analyze_keywords_detailed(
        self,
        resume_blocks: list[ExperienceBlockData],
        job_description: str,
        return_metrics: bool = False,
    ) -> DetailedKeywordAnalysis | tuple[DetailedKeywordAnalysis, AIResponse | None]:
        """
        Perform detailed keyword analysis with importance levels.

        Args:
            resume_blocks: Blocks currently in the resume
            job_description: Target job requirements

        Returns:
            DetailedKeywordAnalysis with importance-grouped keywords
        """
        # Extract keywords with importance
        ai_metrics = None
        if return_metrics:
            keywords_with_importance, ai_metrics = await self._extractor.extract_keywords_with_importance(
                job_description, return_metrics=True
            )
        else:
            keywords_with_importance = await self._extractor.extract_keywords_with_importance(
                job_description
            )

        # Build text content for comparison
        resume_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in resume_blocks
        ).lower()

        # Categorize keywords
        all_keywords: list[KeywordDetail] = []
        required_matched: list[str] = []
        required_missing: list[str] = []
        preferred_matched: list[str] = []
        preferred_missing: list[str] = []
        nice_to_have_matched: list[str] = []
        nice_to_have_missing: list[str] = []

        for kw_data in keywords_with_importance:
            keyword = kw_data["keyword"]
            importance: KeywordImportance = kw_data["importance"]
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            found_in_resume = bool(re.search(keyword_pattern, resume_text))
            frequency = count_keyword_frequency(keyword, job_description)
            context = get_keyword_context(keyword, job_description)

            all_keywords.append(KeywordDetail(
                keyword=keyword,
                importance=importance,
                found_in_resume=found_in_resume,
                found_in_vault=False,  # Deprecated
                frequency_in_job=frequency,
                context=context,
            ))

            # Categorize by importance and match status
            if importance == "required":
                if found_in_resume:
                    required_matched.append(keyword)
                else:
                    required_missing.append(keyword)
            elif importance == "preferred":
                if found_in_resume:
                    preferred_matched.append(keyword)
                else:
                    preferred_missing.append(keyword)
            else:  # nice_to_have
                if found_in_resume:
                    nice_to_have_matched.append(keyword)
                else:
                    nice_to_have_missing.append(keyword)

        # Calculate coverage scores
        total_keywords = len(keywords_with_importance)
        total_matched = (
            len(required_matched) + len(preferred_matched) + len(nice_to_have_matched)
        )
        coverage_score = total_matched / total_keywords if total_keywords > 0 else 0

        required_total = len(required_matched) + len(required_missing)
        required_coverage = (
            len(required_matched) / required_total if required_total > 0 else 1.0
        )

        preferred_total = len(preferred_matched) + len(preferred_missing)
        preferred_coverage = (
            len(preferred_matched) / preferred_total if preferred_total > 0 else 1.0
        )

        # Generate suggestions
        suggestions = generate_detailed_suggestions(
            required_missing,
            preferred_missing,
        )

        # Generate warnings
        warnings: list[str] = []
        if required_coverage < 0.5:
            warnings.append(
                f"Only {int(required_coverage * 100)}% of required keywords found. "
                "This may significantly reduce your chances."
            )

        total_missing = len(required_missing) + len(preferred_missing) + len(nice_to_have_missing)
        if total_missing > 5:
            warnings.append(
                f"{total_missing} keywords not found in your resume. "
                "Consider if you have transferable skills or if this role is a good fit."
            )

        result = DetailedKeywordAnalysis(
            coverage_score=round(coverage_score, 2),
            required_coverage=round(required_coverage, 2),
            preferred_coverage=round(preferred_coverage, 2),
            required_matched=required_matched,
            required_missing=required_missing,
            preferred_matched=preferred_matched,
            preferred_missing=preferred_missing,
            nice_to_have_matched=nice_to_have_matched,
            nice_to_have_missing=nice_to_have_missing,
            missing_available_in_vault=[],  # Deprecated
            missing_not_in_vault=[],  # Deprecated
            all_keywords=all_keywords,
            suggestions=suggestions,
            warnings=warnings,
        )

        return (result, ai_metrics) if return_metrics else result

    async def analyze_keywords_enhanced(
        self,
        parsed_resume: dict[str, Any],
        job_description: str,
        return_metrics: bool = False,
    ) -> EnhancedKeywordAnalysis | tuple[EnhancedKeywordAnalysis, AIResponse | None]:
        """
        Perform enhanced keyword analysis with Stage 2 scoring.

        This method implements the full Stage 2 keyword scoring pipeline:
        - Stage 2.1: Placement weighting (where keywords appear)
        - Stage 2.2: Density scoring (diminishing returns for repetition)
        - Stage 2.3: Recency weighting (recent roles matter more)
        - Stage 2.4: Importance tiers (required > preferred)

        Args:
            parsed_resume: Parsed resume content as structured dictionary
            job_description: Target job requirements text
            return_metrics: If True, return (result, AIResponse) tuple

        Returns:
            EnhancedKeywordAnalysis with weighted scores and detailed breakdown.
            If return_metrics=True, returns (EnhancedKeywordAnalysis, AIResponse | None).
        """
        # Extract keywords with enhanced importance
        extraction_result = await self._extractor.extract_keywords_with_importance_enhanced(
            job_description, return_metrics=True
        )
        keywords_with_importance, ai_metrics = extraction_result

        # Analyze each keyword
        all_keywords: list[EnhancedKeywordDetail] = []

        # Group by importance
        required_matched: list[str] = []
        required_missing: list[str] = []
        strongly_preferred_matched: list[str] = []
        strongly_preferred_missing: list[str] = []
        preferred_matched: list[str] = []
        preferred_missing: list[str] = []
        nice_to_have_matched: list[str] = []
        nice_to_have_missing: list[str] = []

        # Gap analysis
        gap_list: list[dict[str, Any]] = []

        # Track totals for score calculation
        total_weighted_score = 0.0
        max_possible_score = 0.0

        # Track contributions for breakdown
        total_placement_contribution = 0.0
        total_density_contribution = 0.0
        total_recency_contribution = 0.0

        for kw_data in keywords_with_importance:
            keyword = kw_data["keyword"]
            importance: KeywordImportance = kw_data["importance"]

            # Find matches in resume
            matches = find_keyword_matches(keyword, parsed_resume)
            found_in_resume = len(matches) > 0

            # Get frequency in job description
            frequency = count_keyword_frequency(keyword, job_description)
            context = get_keyword_context(keyword, job_description)

            # Calculate weighted scores
            importance_weight = get_importance_weight(importance)
            max_possible_score += MAX_KEYWORD_SCORE

            if found_in_resume:
                placement_score, density_score, recency_score, weighted_score = (
                    calculate_keyword_weighted_score(matches, importance)
                )
                total_weighted_score += weighted_score

                # Track contributions (normalized by importance)
                base_score = importance_weight  # What score would be without enhancements
                if base_score > 0:
                    total_placement_contribution += (placement_score - 1.0) * importance_weight / len(keywords_with_importance)
                    total_density_contribution += (density_score - 1.0) * importance_weight / len(keywords_with_importance)
                    total_recency_contribution += (recency_score - 1.0) * importance_weight / len(keywords_with_importance)
            else:
                placement_score = 0.0
                density_score = 0.0
                recency_score = 0.0
                weighted_score = 0.0

            # Create enhanced keyword detail
            kw_detail = EnhancedKeywordDetail(
                keyword=keyword,
                importance=importance,
                found_in_resume=found_in_resume,
                found_in_vault=False,  # Deprecated
                frequency_in_job=frequency,
                context=context,
                matches=matches,
                occurrence_count=len(matches),
                base_score=1.0 if found_in_resume else 0.0,
                placement_score=placement_score,
                density_score=density_score,
                recency_score=recency_score,
                importance_weight=importance_weight,
                weighted_score=weighted_score,
            )
            all_keywords.append(kw_detail)

            # Categorize by importance and match status
            if importance == "required":
                if found_in_resume:
                    required_matched.append(keyword)
                else:
                    required_missing.append(keyword)
            elif importance == "strongly_preferred":
                if found_in_resume:
                    strongly_preferred_matched.append(keyword)
                else:
                    strongly_preferred_missing.append(keyword)
            elif importance == "preferred":
                if found_in_resume:
                    preferred_matched.append(keyword)
                else:
                    preferred_missing.append(keyword)
            else:  # nice_to_have
                if found_in_resume:
                    nice_to_have_matched.append(keyword)
                else:
                    nice_to_have_missing.append(keyword)

            # Build gap list for missing keywords
            if not found_in_resume:
                gap_list.append({
                    "keyword": keyword,
                    "importance": importance,
                    "in_vault": False,  # Deprecated
                    "suggestion": f"Consider adding '{keyword}' to your resume",
                })

        # Sort gap list by importance (required first)
        importance_order = {"required": 0, "strongly_preferred": 1, "preferred": 2, "nice_to_have": 3}
        gap_list.sort(key=lambda x: importance_order.get(x["importance"], 4))

        # Calculate final scores
        keyword_score = (total_weighted_score / max_possible_score * 100) if max_possible_score > 0 else 0.0

        # Raw coverage (simple matched/total)
        total_matched = len(required_matched) + len(strongly_preferred_matched) + len(preferred_matched) + len(nice_to_have_matched)
        total_keywords = len(keywords_with_importance)
        raw_coverage = (total_matched / total_keywords * 100) if total_keywords > 0 else 0.0

        # Coverage by tier
        required_total = len(required_matched) + len(required_missing)
        required_coverage = len(required_matched) / required_total if required_total > 0 else 1.0

        strongly_preferred_total = len(strongly_preferred_matched) + len(strongly_preferred_missing)
        strongly_preferred_coverage = len(strongly_preferred_matched) / strongly_preferred_total if strongly_preferred_total > 0 else 1.0

        preferred_total = len(preferred_matched) + len(preferred_missing)
        preferred_coverage = len(preferred_matched) / preferred_total if preferred_total > 0 else 1.0

        nice_to_have_total = len(nice_to_have_matched) + len(nice_to_have_missing)
        nice_to_have_coverage = len(nice_to_have_matched) / nice_to_have_total if nice_to_have_total > 0 else 1.0

        # Generate suggestions
        suggestions = generate_enhanced_suggestions(
            required_missing,
            strongly_preferred_missing,
            preferred_missing,
        )

        # Generate warnings
        warnings: list[str] = []
        if required_coverage < 0.5:
            warnings.append(
                f"Only {int(required_coverage * 100)}% of required keywords found. "
                "This may significantly reduce your chances."
            )
        if required_coverage < 0.8 and required_total > 0:
            warnings.append(
                f"Missing {len(required_missing)} required keywords. "
                "Focus on adding these to your resume."
            )
        total_missing = len(required_missing) + len(strongly_preferred_missing) + len(preferred_missing) + len(nice_to_have_missing)
        if total_missing > 5:
            warnings.append(
                f"{total_missing} keywords not found in your resume. "
                "Consider if you have transferable skills or if this role is a good fit."
            )

        result = EnhancedKeywordAnalysis(
            keyword_score=round(keyword_score, 1),
            raw_coverage=round(raw_coverage, 1),
            required_coverage=round(required_coverage, 2),
            strongly_preferred_coverage=round(strongly_preferred_coverage, 2),
            preferred_coverage=round(preferred_coverage, 2),
            nice_to_have_coverage=round(nice_to_have_coverage, 2),
            placement_contribution=round(total_placement_contribution * 100, 1),
            density_contribution=round(total_density_contribution * 100, 1),
            recency_contribution=round(total_recency_contribution * 100, 1),
            required_matched=required_matched,
            required_missing=required_missing,
            strongly_preferred_matched=strongly_preferred_matched,
            strongly_preferred_missing=strongly_preferred_missing,
            preferred_matched=preferred_matched,
            preferred_missing=preferred_missing,
            nice_to_have_matched=nice_to_have_matched,
            nice_to_have_missing=nice_to_have_missing,
            missing_available_in_vault=[],  # Deprecated
            missing_not_in_vault=[],  # Deprecated
            gap_list=gap_list,
            all_keywords=all_keywords,
            suggestions=suggestions,
            warnings=warnings,
        )

        return (result, ai_metrics) if return_metrics else result
