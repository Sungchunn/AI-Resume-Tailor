"""
ATS Keyword Analyzer.

Handles keyword analysis (Stage 1 basic and Stage 2 enhanced).
"""

import json
import re
from datetime import datetime
from typing import Any

from app.core.protocols import ExperienceBlockData, ATSReportData
from app.services.ai.client import get_ai_client

from ..constants import (
    KeywordImportance,
    SECTION_PLACEMENT_WEIGHTS,
    DENSITY_MULTIPLIERS,
    DENSITY_CAP,
    RECENCY_WEIGHTS,
    RECENCY_DEFAULT,
    IMPORTANCE_WEIGHTS,
)
from ..models import (
    KeywordMatch,
    KeywordDetail,
    EnhancedKeywordDetail,
    EnhancedKeywordAnalysis,
    DetailedKeywordAnalysis,
)
from .base import (
    STANDARD_SECTIONS,
    basic_keyword_extraction,
    get_keyword_context,
    count_keyword_frequency,
    parse_date,
)


class KeywordAnalyzer:
    """
    Analyzes keyword coverage between resume and job description.

    Implements:
    - Stage 1: Basic keyword analysis
    - Stage 2: Enhanced keyword scoring with placement, density, recency, importance
    """

    def __init__(self):
        self._ai_client = get_ai_client()

    async def analyze_keywords(
        self,
        resume_blocks: list[ExperienceBlockData],
        job_description: str,
        vault_blocks: list[ExperienceBlockData],
    ) -> ATSReportData:
        """
        Analyze keyword coverage.

        Provides honest report showing:
        - Keywords matched
        - Keywords missing but available in Vault (user can add these)
        - Keywords missing entirely (user doesn't have this experience)

        Args:
            resume_blocks: Blocks currently in the resume
            job_description: Target job requirements
            vault_blocks: All user's Vault blocks (for gap analysis)

        Returns:
            ATSReportData with keyword analysis
        """
        # Extract keywords from job description
        job_keywords = await self._extract_keywords(job_description)

        # Build text content for comparison
        resume_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in resume_blocks
        ).lower()

        vault_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in vault_blocks
        ).lower()

        # Categorize keywords
        matched_keywords: list[str] = []
        missing_keywords: list[str] = []
        missing_from_vault: list[str] = []

        for keyword in job_keywords:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            if re.search(keyword_pattern, resume_text):
                matched_keywords.append(keyword)
            elif re.search(keyword_pattern, vault_text):
                missing_keywords.append(keyword)  # In vault but not in resume
            else:
                missing_from_vault.append(keyword)  # Not in vault at all

        # Calculate coverage
        total_keywords = len(job_keywords) if job_keywords else 1
        keyword_coverage = len(matched_keywords) / total_keywords

        # Generate suggestions
        suggestions = self._generate_keyword_suggestions(
            missing_keywords, vault_blocks
        )

        # Generate warnings
        warnings: list[str] = []
        if keyword_coverage < 0.3:
            warnings.append(
                "Low keyword match - your resume may not pass ATS keyword filters"
            )
        if len(missing_from_vault) > len(job_keywords) * 0.3:
            warnings.append(
                f"{len(missing_from_vault)} job requirements not found in your experience. "
                "Consider whether this role is a good fit or if you have transferable skills."
            )

        return ATSReportData(
            format_score=100,  # Not calculating format here, just keywords
            keyword_coverage=round(keyword_coverage, 2),
            matched_keywords=matched_keywords,
            missing_keywords=missing_keywords,
            missing_from_vault=missing_from_vault,
            warnings=warnings,
            suggestions=suggestions,
        )

    async def analyze_keywords_detailed(
        self,
        resume_blocks: list[ExperienceBlockData],
        job_description: str,
        vault_blocks: list[ExperienceBlockData],
    ) -> DetailedKeywordAnalysis:
        """
        Perform detailed keyword analysis with importance levels.

        Args:
            resume_blocks: Blocks currently in the resume
            job_description: Target job requirements
            vault_blocks: All user's Vault blocks (for gap analysis)

        Returns:
            DetailedKeywordAnalysis with importance-grouped keywords
        """
        # Extract keywords with importance
        keywords_with_importance = await self._extract_keywords_with_importance(
            job_description
        )

        # Build text content for comparison
        resume_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in resume_blocks
        ).lower()

        vault_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in vault_blocks
        ).lower()

        # Categorize keywords
        all_keywords: list[KeywordDetail] = []
        required_matched: list[str] = []
        required_missing: list[str] = []
        preferred_matched: list[str] = []
        preferred_missing: list[str] = []
        nice_to_have_matched: list[str] = []
        nice_to_have_missing: list[str] = []
        missing_available_in_vault: list[str] = []
        missing_not_in_vault: list[str] = []

        for kw_data in keywords_with_importance:
            keyword = kw_data["keyword"]
            importance: KeywordImportance = kw_data["importance"]
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            found_in_resume = bool(re.search(keyword_pattern, resume_text))
            found_in_vault = bool(re.search(keyword_pattern, vault_text))
            frequency = count_keyword_frequency(keyword, job_description)
            context = get_keyword_context(keyword, job_description)

            all_keywords.append(KeywordDetail(
                keyword=keyword,
                importance=importance,
                found_in_resume=found_in_resume,
                found_in_vault=found_in_vault,
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

            # Track vault availability for missing keywords
            if not found_in_resume:
                if found_in_vault:
                    missing_available_in_vault.append(keyword)
                else:
                    missing_not_in_vault.append(keyword)

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
        suggestions = self._generate_detailed_suggestions(
            required_missing,
            preferred_missing,
            missing_available_in_vault,
            vault_blocks,
        )

        # Generate warnings
        warnings: list[str] = []
        if required_coverage < 0.5:
            warnings.append(
                f"Only {int(required_coverage * 100)}% of required keywords found. "
                "This may significantly reduce your chances."
            )
        if len(missing_not_in_vault) > 5:
            warnings.append(
                f"{len(missing_not_in_vault)} keywords not found in your vault. "
                "Consider if you have transferable skills or if this role is a good fit."
            )

        return DetailedKeywordAnalysis(
            coverage_score=round(coverage_score, 2),
            required_coverage=round(required_coverage, 2),
            preferred_coverage=round(preferred_coverage, 2),
            required_matched=required_matched,
            required_missing=required_missing,
            preferred_matched=preferred_matched,
            preferred_missing=preferred_missing,
            nice_to_have_matched=nice_to_have_matched,
            nice_to_have_missing=nice_to_have_missing,
            missing_available_in_vault=missing_available_in_vault,
            missing_not_in_vault=missing_not_in_vault,
            all_keywords=all_keywords,
            suggestions=suggestions,
            warnings=warnings,
        )

    async def analyze_keywords_enhanced(
        self,
        parsed_resume: dict[str, Any],
        job_description: str,
        vault_blocks: list[ExperienceBlockData],
    ) -> EnhancedKeywordAnalysis:
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
            vault_blocks: All user's Vault blocks (for gap analysis)

        Returns:
            EnhancedKeywordAnalysis with weighted scores and detailed breakdown
        """
        # Extract keywords with enhanced importance
        keywords_with_importance = await self._extract_keywords_with_importance_enhanced(
            job_description
        )

        # Build vault text for checking availability
        vault_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in vault_blocks
        ).lower()

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

        # Vault availability
        missing_available_in_vault: list[str] = []
        missing_not_in_vault: list[str] = []

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
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            # Find matches in resume
            matches = self._find_keyword_matches_in_structured_resume(keyword, parsed_resume)
            found_in_resume = len(matches) > 0

            # Check vault
            found_in_vault = bool(re.search(keyword_pattern, vault_text))

            # Get frequency in job description
            frequency = count_keyword_frequency(keyword, job_description)
            context = get_keyword_context(keyword, job_description)

            # Calculate weighted scores
            importance_weight = self._get_importance_weight(importance)
            max_possible_score += importance_weight

            if found_in_resume:
                placement_score, density_score, recency_score, weighted_score = (
                    self._calculate_keyword_weighted_score(matches, importance)
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
                found_in_vault=found_in_vault,
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

            # Track vault availability and build gap list for missing keywords
            if not found_in_resume:
                if found_in_vault:
                    missing_available_in_vault.append(keyword)
                    gap_list.append({
                        "keyword": keyword,
                        "importance": importance,
                        "in_vault": True,
                        "suggestion": f"Add '{keyword}' from your vault",
                    })
                else:
                    missing_not_in_vault.append(keyword)
                    gap_list.append({
                        "keyword": keyword,
                        "importance": importance,
                        "in_vault": False,
                        "suggestion": f"Consider gaining experience with '{keyword}'",
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
        suggestions = self._generate_enhanced_suggestions(
            required_missing,
            strongly_preferred_missing,
            preferred_missing,
            missing_available_in_vault,
            vault_blocks,
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
        if len(missing_not_in_vault) > 5:
            warnings.append(
                f"{len(missing_not_in_vault)} keywords not found in your vault. "
                "Consider if you have transferable skills or if this role is a good fit."
            )

        return EnhancedKeywordAnalysis(
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
            missing_available_in_vault=missing_available_in_vault,
            missing_not_in_vault=missing_not_in_vault,
            gap_list=gap_list,
            all_keywords=all_keywords,
            suggestions=suggestions,
            warnings=warnings,
        )

    # ============================================================
    # Private Methods - Keyword Extraction
    # ============================================================

    async def _extract_keywords(self, job_description: str) -> list[str]:
        """
        Extract important keywords from job description using AI.

        Focuses on:
        - Technical skills (languages, tools, frameworks)
        - Soft skills
        - Required qualifications
        - Industry-specific terms
        """
        system_prompt = """You are an expert recruiter analyzing a job description.
Extract the most important keywords that an ATS (Applicant Tracking System) would look for.

Focus on:
1. Hard skills (programming languages, tools, technologies)
2. Soft skills (leadership, communication, etc.)
3. Qualifications and certifications
4. Industry-specific terminology
5. Action verbs and key phrases

Return ONLY a JSON array of keywords, no other text.
Example: ["Python", "AWS", "team leadership", "CI/CD", "Agile"]

Keep the list focused (10-25 most important keywords).
Do not include common words like "experience", "ability", "skills".
"""

        try:
            response = await self._ai_client.generate_json(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords from this job description:\n\n{job_description}",
                max_tokens=500,
            )

            # Parse the response
            keywords = json.loads(response)
            if isinstance(keywords, list):
                return [str(k).strip() for k in keywords if k]
            return []

        except Exception:
            # Fallback to basic keyword extraction
            return basic_keyword_extraction(job_description)

    async def _extract_keywords_with_importance(
        self, job_description: str
    ) -> list[dict[str, Any]]:
        """
        Extract keywords with importance levels from job description using AI.

        Returns list of dicts with:
        - keyword: the keyword/phrase
        - importance: "required", "preferred", or "nice_to_have"
        """
        system_prompt = """You are an expert recruiter analyzing a job description.
Extract the most important keywords that an ATS (Applicant Tracking System) would look for.

Categorize each keyword by importance:
- "required": Must-have skills, explicitly stated as required or mandatory
- "preferred": Nice-to-have skills, stated as preferred or bonus
- "nice_to_have": Mentioned but not emphasized, or implied from context

Focus on:
1. Hard skills (programming languages, tools, technologies)
2. Soft skills (leadership, communication, etc.)
3. Qualifications and certifications
4. Industry-specific terminology

Return ONLY a JSON array of objects with "keyword" and "importance" fields.
Example:
[
  {"keyword": "Python", "importance": "required"},
  {"keyword": "AWS", "importance": "preferred"},
  {"keyword": "team leadership", "importance": "nice_to_have"}
]

Keep the list focused (15-30 keywords).
Do not include common generic words like "experience", "ability", "skills".
"""

        try:
            response = await self._ai_client.generate_json(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords with importance levels from this job description:\n\n{job_description}",
                max_tokens=1000,
            )

            # Parse the response
            keywords = json.loads(response)
            if isinstance(keywords, list):
                valid_importances = {"required", "preferred", "nice_to_have"}
                result = []
                for k in keywords:
                    if isinstance(k, dict) and "keyword" in k:
                        importance = k.get("importance", "nice_to_have")
                        if importance not in valid_importances:
                            importance = "nice_to_have"
                        result.append({
                            "keyword": str(k["keyword"]).strip(),
                            "importance": importance,
                        })
                return result
            return []

        except Exception:
            # Fallback to basic extraction with default importance
            basic_keywords = basic_keyword_extraction(job_description)
            return [
                {"keyword": k, "importance": "preferred"}
                for k in basic_keywords
            ]

    async def _extract_keywords_with_importance_enhanced(
        self, job_description: str
    ) -> list[dict[str, Any]]:
        """
        Extract keywords with enhanced importance levels from job description.

        Stage 2.4: Includes "strongly_preferred" tier.

        Returns list of dicts with:
        - keyword: the keyword/phrase
        - importance: "required", "strongly_preferred", "preferred", or "nice_to_have"
        """
        system_prompt = """You are an expert recruiter analyzing a job description.
Extract the most important keywords that an ATS (Applicant Tracking System) would look for.

Categorize each keyword by importance:
- "required": Must-have skills, explicitly stated as required, mandatory, or "must have"
- "strongly_preferred": Strongly emphasized, stated as "strongly preferred", "highly desired", or "ideal candidate has"
- "preferred": Nice-to-have skills, stated as preferred, bonus, or "plus"
- "nice_to_have": Mentioned but not emphasized, or implied from context

Focus on:
1. Hard skills (programming languages, tools, technologies)
2. Soft skills (leadership, communication, etc.)
3. Qualifications and certifications
4. Industry-specific terminology

Return ONLY a JSON array of objects with "keyword" and "importance" fields.
Example:
[
  {"keyword": "Python", "importance": "required"},
  {"keyword": "AWS", "importance": "strongly_preferred"},
  {"keyword": "Docker", "importance": "preferred"},
  {"keyword": "team leadership", "importance": "nice_to_have"}
]

Keep the list focused (15-30 keywords).
Do not include common generic words like "experience", "ability", "skills".
"""

        try:
            response = await self._ai_client.generate_json(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords with importance levels from this job description:\n\n{job_description}",
                max_tokens=1000,
            )

            # Parse the response
            keywords = json.loads(response)
            if isinstance(keywords, list):
                valid_importances = {"required", "strongly_preferred", "preferred", "nice_to_have"}
                result = []
                for k in keywords:
                    if isinstance(k, dict) and "keyword" in k:
                        importance = k.get("importance", "nice_to_have")
                        if importance not in valid_importances:
                            importance = "nice_to_have"
                        result.append({
                            "keyword": str(k["keyword"]).strip(),
                            "importance": importance,
                        })
                return result
            return []

        except Exception:
            # Fallback to basic extraction with default importance
            basic_keywords = basic_keyword_extraction(job_description)
            return [
                {"keyword": k, "importance": "preferred"}
                for k in basic_keywords
            ]

    # ============================================================
    # Private Methods - Stage 2 Scoring
    # ============================================================

    def _detect_section_type(self, key: str) -> str:
        """
        Detect the section type from a resume key.

        Maps resume dictionary keys to standard section types for
        placement weighting.
        """
        key_lower = key.lower()

        # Direct matches
        if key_lower in ("experience", "work experience", "employment history",
                         "work history", "professional experience"):
            return "experience"
        if key_lower in ("projects", "key projects", "notable projects"):
            return "projects"
        if key_lower in ("skills", "technical skills", "core competencies",
                         "competencies", "expertise"):
            return "skills"
        if key_lower in ("summary", "professional summary", "objective",
                         "profile", "about"):
            return "summary"
        if key_lower in ("education", "academic background", "academic history",
                         "qualifications"):
            return "education"
        if key_lower in ("certifications", "certificates", "professional certifications",
                         "licenses"):
            return "certifications"

        return "other"

    def _get_placement_weight(self, section: str) -> float:
        """
        Get the placement weight for a section type.

        Stage 2.1: Keywords in experience sections are weighted higher.
        """
        return SECTION_PLACEMENT_WEIGHTS.get(section, SECTION_PLACEMENT_WEIGHTS["other"])

    def _get_density_multiplier(self, occurrence_count: int) -> float:
        """
        Get the density multiplier with diminishing returns.

        Stage 2.2: Multiple occurrences increase score but with caps.
        """
        if occurrence_count <= 0:
            return 0.0
        return DENSITY_MULTIPLIERS.get(occurrence_count, DENSITY_CAP)

    def _get_recency_weight(self, role_index: int | None) -> float:
        """
        Get the recency weight based on role position.

        Stage 2.3: Recent roles are weighted higher.
        """
        if role_index is None:
            return 1.0  # Not in a role, use neutral weight
        return RECENCY_WEIGHTS.get(role_index, RECENCY_DEFAULT)

    def _get_importance_weight(self, importance: KeywordImportance) -> float:
        """
        Get the importance tier weight.

        Stage 2.4: Required keywords weighted higher than preferred.
        """
        return IMPORTANCE_WEIGHTS.get(importance, 1.0)

    def _order_experiences_by_date(
        self,
        experiences: list[dict[str, Any]],
    ) -> list[tuple[int, dict[str, Any]]]:
        """
        Order experience entries by date (most recent first).

        Returns list of (original_index, experience) tuples.
        """
        dated_experiences = []

        for idx, exp in enumerate(experiences):
            end_date_str = exp.get("end_date", "")

            # "Present" or "Current" should be most recent
            if not end_date_str or end_date_str.lower() in (
                "present", "current", "now", "ongoing"
            ):
                # Use a far future date for sorting
                sort_date = datetime(2099, 12, 31)
            else:
                parsed = parse_date(end_date_str)
                sort_date = parsed if parsed else datetime(1900, 1, 1)

            dated_experiences.append((idx, sort_date, exp))

        # Sort by date descending (most recent first)
        dated_experiences.sort(key=lambda x: x[1], reverse=True)

        # Return (new_index, exp) where new_index is position after sorting
        return [(i, exp) for i, (_, _, exp) in enumerate(dated_experiences)]

    def _find_keyword_matches_in_structured_resume(
        self,
        keyword: str,
        parsed_resume: dict[str, Any],
    ) -> list[KeywordMatch]:
        """
        Find all matches of a keyword in a structured resume.

        Returns detailed match information including section and role index
        for placement and recency weighting.
        """
        matches: list[KeywordMatch] = []
        keyword_lower = keyword.lower()
        keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

        # Order experiences for recency calculation
        experiences = parsed_resume.get("experience", [])
        if experiences:
            ordered_experiences = self._order_experiences_by_date(experiences)
        else:
            ordered_experiences = []

        # Create a map from experience content to role index
        exp_role_map: dict[int, int] = {}  # original exp index -> recency index
        for recency_idx, (orig_idx, exp) in enumerate(ordered_experiences):
            exp_role_map[orig_idx] = recency_idx

        # Search each section
        for key, value in parsed_resume.items():
            section_type = self._detect_section_type(key)

            if section_type == "experience" and isinstance(value, list):
                # Handle experience section specially for recency
                for orig_idx, exp in enumerate(value):
                    if isinstance(exp, dict):
                        # Check bullets
                        bullets = exp.get("bullets", [])
                        if isinstance(bullets, list):
                            for bullet in bullets:
                                if isinstance(bullet, str) and re.search(
                                    keyword_pattern, bullet.lower()
                                ):
                                    recency_idx = exp_role_map.get(orig_idx, orig_idx)
                                    matches.append(KeywordMatch(
                                        section="experience",
                                        role_index=recency_idx,
                                        text_snippet=bullet[:100] if len(bullet) > 100 else bullet,
                                    ))

                        # Check other text fields in experience
                        for field in ("title", "description", "responsibilities"):
                            field_value = exp.get(field, "")
                            if isinstance(field_value, str) and re.search(
                                keyword_pattern, field_value.lower()
                            ):
                                recency_idx = exp_role_map.get(orig_idx, orig_idx)
                                matches.append(KeywordMatch(
                                    section="experience",
                                    role_index=recency_idx,
                                    text_snippet=field_value[:100] if len(field_value) > 100 else field_value,
                                ))

            elif isinstance(value, str):
                # Simple string field
                if re.search(keyword_pattern, value.lower()):
                    matches.append(KeywordMatch(
                        section=section_type,
                        role_index=None,
                        text_snippet=value[:100] if len(value) > 100 else value,
                    ))

            elif isinstance(value, list):
                # List of items (skills, certifications, etc.)
                for item in value:
                    if isinstance(item, str):
                        if re.search(keyword_pattern, item.lower()):
                            matches.append(KeywordMatch(
                                section=section_type,
                                role_index=None,
                                text_snippet=item[:100] if len(item) > 100 else item,
                            ))
                    elif isinstance(item, dict):
                        # Dict items (education entries, etc.)
                        for field_value in item.values():
                            if isinstance(field_value, str) and re.search(
                                keyword_pattern, field_value.lower()
                            ):
                                matches.append(KeywordMatch(
                                    section=section_type,
                                    role_index=None,
                                    text_snippet=field_value[:100] if len(field_value) > 100 else field_value,
                                ))

            elif isinstance(value, dict):
                # Dict section (contact, etc.)
                for field_value in value.values():
                    if isinstance(field_value, str) and re.search(
                        keyword_pattern, field_value.lower()
                    ):
                        matches.append(KeywordMatch(
                            section=section_type,
                            role_index=None,
                            text_snippet=field_value[:100] if len(field_value) > 100 else field_value,
                        ))

        return matches

    def _calculate_keyword_weighted_score(
        self,
        matches: list[KeywordMatch],
        importance: KeywordImportance,
    ) -> tuple[float, float, float, float]:
        """
        Calculate weighted score for a keyword based on Stage 2 factors.

        Returns:
            (placement_score, density_score, recency_score, final_weighted_score)
        """
        if not matches:
            return (0.0, 0.0, 0.0, 0.0)

        # Stage 2.1: Placement weighting - use best placement
        placement_weights = [self._get_placement_weight(m.section) for m in matches]
        best_placement = max(placement_weights) if placement_weights else 0.0

        # Stage 2.2: Density scoring - count unique matches
        occurrence_count = len(matches)
        density_multiplier = self._get_density_multiplier(occurrence_count)

        # Stage 2.3: Recency weighting - use best recency
        recency_weights = [
            self._get_recency_weight(m.role_index)
            for m in matches
            if m.role_index is not None
        ]
        best_recency = max(recency_weights) if recency_weights else 1.0

        # Stage 2.4: Importance weight
        importance_weight = self._get_importance_weight(importance)

        # Calculate component scores
        placement_score = best_placement
        density_score = density_multiplier
        recency_score = best_recency

        # Final weighted score combines all factors
        # Base of 1.0 (keyword found) * placement * density * recency * importance
        final_score = 1.0 * placement_score * density_score * recency_score * importance_weight

        return (placement_score, density_score, recency_score, final_score)

    # ============================================================
    # Private Methods - Suggestion Generation
    # ============================================================

    def _generate_keyword_suggestions(
        self,
        missing_keywords: list[str],
        vault_blocks: list[ExperienceBlockData],
    ) -> list[str]:
        """
        Generate actionable suggestions for adding missing keywords.
        """
        suggestions: list[str] = []

        # Find which vault blocks contain the missing keywords
        for keyword in missing_keywords[:5]:  # Limit to top 5
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            for block in vault_blocks:
                content = block.get("content", "") if isinstance(block, dict) else block.content
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"Add your '{keyword}' experience from {source}"
                    )
                    break

        return suggestions

    def _generate_detailed_suggestions(
        self,
        required_missing: list[str],
        preferred_missing: list[str],
        available_in_vault: list[str],
        vault_blocks: list[ExperienceBlockData],
    ) -> list[str]:
        """Generate suggestions for adding missing keywords."""
        suggestions: list[str] = []

        # Prioritize required keywords that are in vault
        priority_keywords = [k for k in required_missing if k in available_in_vault]
        for keyword in priority_keywords[:3]:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
            for block in vault_blocks:
                content = (
                    block.get("content", "") if isinstance(block, dict) else block.content
                )
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"Add '{keyword}' (required) from your {source} experience"
                    )
                    break

        # Then preferred keywords
        preferred_in_vault = [k for k in preferred_missing if k in available_in_vault]
        for keyword in preferred_in_vault[:2]:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
            for block in vault_blocks:
                content = (
                    block.get("content", "") if isinstance(block, dict) else block.content
                )
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"Add '{keyword}' (preferred) from your {source} experience"
                    )
                    break

        return suggestions

    def _generate_enhanced_suggestions(
        self,
        required_missing: list[str],
        strongly_preferred_missing: list[str],
        preferred_missing: list[str],
        available_in_vault: list[str],
        vault_blocks: list[ExperienceBlockData],
    ) -> list[str]:
        """Generate suggestions prioritized by importance tier."""
        suggestions: list[str] = []

        # Priority 1: Required keywords that are in vault
        priority_required = [k for k in required_missing if k in available_in_vault]
        for keyword in priority_required[:3]:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
            for block in vault_blocks:
                content = (
                    block.get("content", "") if isinstance(block, dict) else block.content
                )
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"CRITICAL: Add '{keyword}' (required) from your {source} experience"
                    )
                    break

        # Priority 2: Strongly preferred keywords that are in vault
        priority_strongly_preferred = [k for k in strongly_preferred_missing if k in available_in_vault]
        for keyword in priority_strongly_preferred[:2]:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
            for block in vault_blocks:
                content = (
                    block.get("content", "") if isinstance(block, dict) else block.content
                )
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"HIGH: Add '{keyword}' (strongly preferred) from your {source} experience"
                    )
                    break

        # Priority 3: Preferred keywords that are in vault
        priority_preferred = [k for k in preferred_missing if k in available_in_vault]
        for keyword in priority_preferred[:2]:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
            for block in vault_blocks:
                content = (
                    block.get("content", "") if isinstance(block, dict) else block.content
                )
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"Add '{keyword}' (preferred) from your {source} experience"
                    )
                    break

        return suggestions
