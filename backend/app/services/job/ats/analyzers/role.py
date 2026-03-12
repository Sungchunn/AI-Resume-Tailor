"""
ATS Role Proximity Analyzer.

Handles role proximity analysis (Stage 4).
"""

import re
from typing import Any, Literal

from ..constants import (
    TITLE_ABBREVIATIONS,
    LEVEL_HIERARCHY,
    NUMERIC_LEVEL_MAP,
    FUNCTION_CATEGORIES,
    TRAJECTORY_MODIFIERS,
    INDUSTRY_TAXONOMY,
    TrajectoryType,
)
from ..models import (
    TitleMatchResult,
    TrajectoryResult,
    IndustryAlignmentResult,
    RoleProximityResult,
)


class RoleAnalyzer:
    """
    Analyzes role proximity between candidate and target job.

    Implements Stage 4 role proximity scoring:
    - Title similarity (semantic + structural)
    - Career trajectory analysis
    - Industry alignment
    """

    async def calculate_role_proximity_score(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> RoleProximityResult:
        """
        Calculate the Stage 4 Role Proximity Score.

        This score measures how closely the candidate's career trajectory
        aligns with the target role, combining:
        - Title similarity (semantic and structural)
        - Career trajectory analysis
        - Industry alignment

        Args:
            parsed_resume: Structured resume content with 'experience' key
            parsed_job: Parsed job content with 'title' and 'company' keys

        Returns:
            RoleProximityResult with score and detailed breakdown
        """
        # Extract experience entries
        experience_entries = parsed_resume.get("experience", [])

        # Get target job info
        target_title = parsed_job.get("title", "")
        target_company = parsed_job.get("company", "")
        job_summary = parsed_job.get("summary", "")

        # Get most recent job title from resume
        resume_title = ""
        if experience_entries:
            resume_title = experience_entries[0].get("title", "")

        # Normalize titles
        normalized_resume_title = self._normalize_title(resume_title)
        normalized_job_title = self._normalize_title(target_title)

        # Calculate title similarity (async - uses embeddings)
        similarity_score = await self._calculate_title_similarity(
            normalized_resume_title,
            normalized_job_title,
        )
        title_score = similarity_score * 100

        # Extract levels and functions
        resume_level = self._extract_level(normalized_resume_title)
        job_level = self._extract_level(normalized_job_title)
        resume_function = self._extract_function(normalized_resume_title)
        job_function = self._extract_function(normalized_job_title)

        # Build title match result
        title_match = TitleMatchResult(
            resume_title=resume_title,
            job_title=target_title,
            normalized_resume_title=normalized_resume_title,
            normalized_job_title=normalized_job_title,
            similarity_score=similarity_score,
            title_score=round(title_score, 1),
            resume_level=resume_level,
            job_level=job_level,
            level_gap=job_level - resume_level,
            resume_function=resume_function,
            job_function=job_function,
            function_match=resume_function == job_function,
        )

        # Calculate trajectory score
        trajectory = self._calculate_trajectory_score(
            experience_entries,
            target_title,
            job_level,
            job_function,
        )

        # Calculate industry alignment
        industry_alignment = self._calculate_industry_alignment(
            experience_entries,
            target_company,
            job_summary,
        )

        # Combine scores
        # Title similarity is the base, modifiers adjust
        raw_score = title_score + trajectory.modifier + industry_alignment.modifier

        # Clamp to 0-100
        role_proximity_score = max(0.0, min(100.0, raw_score))

        # Generate explanation and insights
        explanation = self._generate_role_proximity_explanation(
            title_match, trajectory, industry_alignment
        )
        concerns, strengths = self._generate_role_proximity_insights(
            title_match, trajectory, industry_alignment
        )

        return RoleProximityResult(
            role_proximity_score=round(role_proximity_score, 1),
            title_match=title_match,
            trajectory=trajectory,
            industry_alignment=industry_alignment,
            explanation=explanation,
            concerns=concerns,
            strengths=strengths,
        )

    # ============================================================
    # Title Normalization and Extraction
    # ============================================================

    def _normalize_title(self, title: str) -> str:
        """
        Normalize a job title for comparison.

        Expands abbreviations, removes special characters, and
        converts to lowercase for consistent matching.

        Examples:
            "Sr. Software Engineer" → "senior software engineer"
            "SWE III" → "software engineer iii"
            "Full-Stack Developer" → "full stack developer"
        """
        if not title:
            return ""

        title = title.lower().strip()

        # Expand abbreviations (sort by length descending to avoid partial matches)
        sorted_abbrevs = sorted(
            TITLE_ABBREVIATIONS.items(),
            key=lambda x: len(x[0]),
            reverse=True
        )
        for abbrev, full in sorted_abbrevs:
            # Use word boundary matching to avoid partial replacements
            title = re.sub(rf'\b{re.escape(abbrev)}\b', full, title)

        # Remove special characters but keep spaces
        title = re.sub(r'[^\w\s]', ' ', title)

        # Collapse multiple spaces
        title = re.sub(r'\s+', ' ', title)

        return title.strip()

    def _extract_level(self, title: str) -> int:
        """
        Extract seniority level from a job title.

        Returns an integer representing seniority (0=intern, 8=c-level).
        Default is 2 (mid-level) if no level indicators found.

        Args:
            title: Job title (original or normalized)

        Returns:
            Integer seniority level (0-8)
        """
        if not title:
            return 2  # Default to mid-level

        title_lower = title.lower()

        # Check for explicit level keywords
        for level_name, level_rank in LEVEL_HIERARCHY.items():
            if level_name in title_lower:
                return level_rank

        # Check for numeric levels (I, II, III, IV, V or 1, 2, 3, 4, 5)
        # Look for patterns like "Engineer II" or "Level 3"
        numeric_match = re.search(r'\b(?:level\s*)?([iv]+|\d)\b', title_lower)
        if numeric_match:
            level_str = numeric_match.group(1).lower()
            if level_str in NUMERIC_LEVEL_MAP:
                numeric_level = NUMERIC_LEVEL_MAP[level_str]
                # Map numeric levels: 1=junior, 2=mid, 3=senior, 4=staff, 5=principal
                level_mapping = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5}
                return level_mapping.get(numeric_level, 2)

        # Default to mid-level if no indicators found
        return 2

    def _extract_function(self, title: str) -> str:
        """
        Extract functional category from a job title.

        Returns a category string like "engineering", "product", "design".
        Returns "other" if no category matches.

        Args:
            title: Job title (original or normalized)

        Returns:
            Functional category string
        """
        if not title:
            return "other"

        title_lower = title.lower()

        # Check against function categories (order matters for priority)
        # Check more specific categories first
        category_priority = [
            "product", "design", "data", "devops", "security",
            "qa", "sales", "marketing", "support", "engineering", "management"
        ]

        for category in category_priority:
            if category in FUNCTION_CATEGORIES:
                for keyword in FUNCTION_CATEGORIES[category]:
                    if keyword in title_lower:
                        return category

        return "other"

    def _extract_industry(self, company: str, context: str = "") -> str:
        """
        Infer industry from company name and context.

        This is a heuristic-based approach that looks for industry
        keywords in the company name and any additional context.

        Args:
            company: Company name
            context: Additional context (role description, job posting text)

        Returns:
            Industry identifier string
        """
        combined = f"{company} {context}".lower()

        for industry, data in INDUSTRY_TAXONOMY.items():
            for name in data["names"]:
                if name in combined:
                    return industry

        return "other"

    # ============================================================
    # Title Similarity
    # ============================================================

    async def _calculate_title_similarity(
        self,
        resume_title: str,
        job_title: str,
    ) -> float:
        """
        Calculate semantic similarity between two job titles.

        Uses embeddings to compute cosine similarity, which captures
        semantic meaning beyond exact string matching.

        Args:
            resume_title: Candidate's job title (normalized)
            job_title: Target job title (normalized)

        Returns:
            Similarity score 0-1
        """
        try:
            from app.services.ai.embedding import get_embedding_service
            import numpy as np

            embedding_service = get_embedding_service()

            # Get embeddings for both titles
            resume_embedding = await embedding_service.embed_for_similarity(resume_title)
            job_embedding = await embedding_service.embed_for_similarity(job_title)

            # Calculate cosine similarity
            resume_vec = np.array(resume_embedding)
            job_vec = np.array(job_embedding)

            # Cosine similarity = dot(A, B) / (norm(A) * norm(B))
            dot_product = np.dot(resume_vec, job_vec)
            norm_resume = np.linalg.norm(resume_vec)
            norm_job = np.linalg.norm(job_vec)

            if norm_resume == 0 or norm_job == 0:
                return 0.0

            similarity = dot_product / (norm_resume * norm_job)

            # Clamp to 0-1 range
            return max(0.0, min(1.0, float(similarity)))

        except Exception:
            # Fallback to basic string matching if embeddings fail
            return self._basic_title_similarity(resume_title, job_title)

    def _basic_title_similarity(self, title1: str, title2: str) -> float:
        """
        Basic title similarity using word overlap.

        Used as fallback when embedding service is unavailable.
        """
        words1 = set(title1.lower().split())
        words2 = set(title2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = words1 & words2
        union = words1 | words2

        # Jaccard similarity
        return len(intersection) / len(union)

    # ============================================================
    # Trajectory Analysis
    # ============================================================

    def _calculate_trajectory_score(
        self,
        experience_entries: list[dict[str, Any]],
        target_title: str,
        target_level: int,
        target_function: str,
    ) -> TrajectoryResult:
        """
        Analyze career trajectory relative to target role.

        Examines:
        - Level progression over career history
        - Whether candidate is moving toward or away from target
        - Function alignment (same career track)

        Args:
            experience_entries: List of experience entries with 'title' key
            target_title: Target job title
            target_level: Extracted level from target title
            target_function: Functional category of target role

        Returns:
            TrajectoryResult with analysis and modifier
        """
        if not experience_entries:
            return TrajectoryResult(
                trajectory_type="unclear",
                modifier=0,
                current_level=2,
                target_level=target_level,
                level_gap=target_level - 2,
                level_progression=[],
                is_ascending=False,
                function_match=False,
                explanation="Unable to analyze trajectory: no experience entries found",
            )

        # Extract levels from all experience entries
        # Assume entries are ordered most recent first, so reverse for chronological
        levels: list[int] = []
        functions: list[str] = []

        for entry in reversed(experience_entries):
            title = entry.get("title", "")
            if title:
                normalized = self._normalize_title(title)
                levels.append(self._extract_level(normalized))
                functions.append(self._extract_function(normalized))

        if not levels:
            return TrajectoryResult(
                trajectory_type="unclear",
                modifier=0,
                current_level=2,
                target_level=target_level,
                level_gap=target_level - 2,
                level_progression=[],
                is_ascending=False,
                function_match=False,
                explanation="Unable to analyze trajectory: no titles found in experience",
            )

        # Get current (most recent) level and function
        current_level = levels[-1]
        current_function = functions[-1] if functions else "other"

        # Check if levels are generally ascending
        is_ascending = True
        for i in range(len(levels) - 1):
            if levels[i + 1] < levels[i]:
                is_ascending = False
                break

        # Calculate level gap
        level_gap = target_level - current_level

        # Determine function match
        function_match = current_function == target_function

        # Determine trajectory type and modifier
        if level_gap == 1 and function_match:
            # Perfect: one level up in same function
            trajectory_type: TrajectoryType = "progressing_toward"
            modifier = TRAJECTORY_MODIFIERS["progressing_toward"]
            explanation = "This role is a natural next step in your career progression"
        elif level_gap == 0 and function_match:
            # Lateral move in same function
            trajectory_type = "lateral"
            modifier = TRAJECTORY_MODIFIERS["lateral"]
            explanation = "This is a lateral move at your current level"
        elif level_gap == 2 and function_match:
            # Slight stretch
            trajectory_type = "slight_stretch"
            modifier = TRAJECTORY_MODIFIERS["slight_stretch"]
            explanation = "This role is a stretch but achievable with your experience"
        elif level_gap < 0:
            # Step down
            trajectory_type = "step_down"
            modifier = TRAJECTORY_MODIFIERS["step_down"]
            explanation = f"This role is at a lower level than your current position (level {current_level} → {target_level})"
        elif level_gap > 2:
            # Too big a jump
            trajectory_type = "large_gap"
            modifier = TRAJECTORY_MODIFIERS["large_gap"]
            explanation = f"This role represents a significant level jump ({level_gap} levels) that may be difficult to achieve directly"
        elif not function_match and level_gap >= 0:
            # Career change
            trajectory_type = "career_change"
            modifier = TRAJECTORY_MODIFIERS["career_change"]
            explanation = f"This represents a career change from {current_function} to {target_function}"
        else:
            trajectory_type = "unclear"
            modifier = TRAJECTORY_MODIFIERS["unclear"]
            explanation = "Career trajectory is unclear based on available information"

        return TrajectoryResult(
            trajectory_type=trajectory_type,
            modifier=modifier,
            current_level=current_level,
            target_level=target_level,
            level_gap=level_gap,
            level_progression=levels,
            is_ascending=is_ascending,
            function_match=function_match,
            explanation=explanation,
        )

    # ============================================================
    # Industry Alignment
    # ============================================================

    def _calculate_industry_alignment(
        self,
        experience_entries: list[dict[str, Any]],
        target_company: str,
        target_context: str = "",
    ) -> IndustryAlignmentResult:
        """
        Calculate industry alignment between candidate and target role.

        Args:
            experience_entries: List of experience entries with 'company' key
            target_company: Target company name
            target_context: Additional context about target role

        Returns:
            IndustryAlignmentResult with alignment score
        """
        # Extract industries from experience
        resume_industries: list[str] = []
        for entry in experience_entries:
            company = entry.get("company", "")
            description = entry.get("description", "")
            if company:
                industry = self._extract_industry(company, description)
                if industry not in resume_industries:
                    resume_industries.append(industry)

        # Get most recent industry
        most_recent_industry = resume_industries[0] if resume_industries else "other"

        # Get target industry
        target_industry = self._extract_industry(target_company, target_context)

        # Determine alignment
        if most_recent_industry == target_industry:
            alignment_type: Literal["same", "adjacent", "unrelated"] = "same"
            modifier = 10
        elif target_industry in INDUSTRY_TAXONOMY:
            adjacent = INDUSTRY_TAXONOMY[target_industry].get("adjacent", [])
            if most_recent_industry in adjacent:
                alignment_type = "adjacent"
                modifier = 5
            else:
                alignment_type = "unrelated"
                modifier = 0
        else:
            alignment_type = "unrelated"
            modifier = 0

        return IndustryAlignmentResult(
            resume_industries=resume_industries,
            most_recent_industry=most_recent_industry,
            target_industry=target_industry,
            alignment_type=alignment_type,
            modifier=modifier,
        )

    # ============================================================
    # Explanation and Insights Generation
    # ============================================================

    def _generate_role_proximity_explanation(
        self,
        title_match: TitleMatchResult,
        trajectory: TrajectoryResult,
        industry_alignment: IndustryAlignmentResult,
    ) -> str:
        """Generate a human-readable explanation of role proximity analysis."""
        parts = []

        # Title match explanation
        if title_match.title_score >= 80:
            parts.append(
                f"Your title '{title_match.resume_title}' closely matches "
                f"the target role '{title_match.job_title}'"
            )
        elif title_match.title_score >= 50:
            parts.append(
                f"Your title '{title_match.resume_title}' is somewhat related "
                f"to the target role"
            )
        else:
            parts.append(
                f"Your title '{title_match.resume_title}' differs significantly "
                f"from '{title_match.job_title}'"
            )

        # Trajectory explanation
        parts.append(trajectory.explanation)

        # Industry explanation
        if industry_alignment.alignment_type == "same":
            parts.append("You have direct industry experience")
        elif industry_alignment.alignment_type == "adjacent":
            parts.append("You have experience in a related industry")

        return ". ".join(parts) + "."

    def _generate_role_proximity_insights(
        self,
        title_match: TitleMatchResult,
        trajectory: TrajectoryResult,
        industry_alignment: IndustryAlignmentResult,
    ) -> tuple[list[str], list[str]]:
        """Generate concerns and strengths for role proximity."""
        concerns: list[str] = []
        strengths: list[str] = []

        # Title-related insights
        if not title_match.function_match:
            concerns.append(
                f"Function mismatch: {title_match.resume_function} → {title_match.job_function}"
            )
        elif title_match.title_score >= 80:
            strengths.append("Strong title alignment with target role")

        # Level-related insights
        if title_match.level_gap > 2:
            concerns.append(
                f"Large level gap: {title_match.level_gap} levels between current and target"
            )
        elif title_match.level_gap == 1:
            strengths.append("Target role is a natural next step (one level up)")
        elif title_match.level_gap == 0:
            strengths.append("Target role is at same seniority level")
        elif title_match.level_gap < 0:
            concerns.append(
                f"Step down: target role is {abs(title_match.level_gap)} level(s) below current"
            )

        # Trajectory insights
        if trajectory.is_ascending:
            strengths.append("Career shows clear upward progression")
        if trajectory.trajectory_type == "career_change":
            concerns.append(
                f"Career change from {trajectory.function_match} may require additional positioning"
            )

        # Industry insights
        if industry_alignment.alignment_type == "same":
            strengths.append(f"Direct {industry_alignment.most_recent_industry} industry experience")
        elif industry_alignment.alignment_type == "adjacent":
            strengths.append("Experience in adjacent industry")
        elif industry_alignment.most_recent_industry != "other":
            concerns.append(
                f"Moving from {industry_alignment.most_recent_industry} to "
                f"{industry_alignment.target_industry} industry"
            )

        return concerns, strengths
