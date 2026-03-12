"""
ATS Content Quality Analyzer.

Handles content quality analysis (Stage 3).
"""

import re
from typing import Any

from ..constants import (
    QUANTIFICATION_PATTERNS,
    ACTION_VERB_PATTERNS,
    WEAK_PHRASE_PATTERNS,
    QUANTIFICATION_TARGET,
    ACHIEVEMENT_RATIO_TARGET,
    ACTION_VERB_THRESHOLD,
)
from ..models import (
    BulletAnalysis,
    BlockTypeAnalysis,
    QuantificationAnalysis,
    ActionVerbAnalysis,
    ContentQualityResult,
)


class ContentAnalyzer:
    """
    Analyzes content quality for ATS optimization.

    Implements Stage 3 content quality scoring:
    - Block type classification (achievement vs responsibility ratio)
    - Quantification density scoring
    - Action verb analysis
    """

    def analyze_content_quality(
        self,
        parsed_resume: dict[str, Any],
        block_type_weight: float = 0.4,
        quantification_weight: float = 0.35,
        action_verb_weight: float = 0.25,
    ) -> ContentQualityResult:
        """
        Perform Stage 3 content quality analysis on a resume.

        Analyzes:
        1. Block type distribution (achievement vs responsibility ratio)
        2. Quantification density (percentage of bullets with metrics)
        3. Action verb usage and weak phrase detection

        Args:
            parsed_resume: Structured resume content
            block_type_weight: Weight for block type score (default 0.4)
            quantification_weight: Weight for quantification score (default 0.35)
            action_verb_weight: Weight for action verb score (default 0.25)

        Returns:
            ContentQualityResult with detailed analysis and suggestions
        """
        # Extract all bullet points from experience section
        bullets: list[str] = []

        # Get bullets from experience section
        experiences = parsed_resume.get("experience", [])
        for exp in experiences:
            exp_bullets = exp.get("bullets", [])
            if isinstance(exp_bullets, list):
                bullets.extend([b for b in exp_bullets if isinstance(b, str) and b.strip()])
            # Also check for 'description' field which some parsers use
            description = exp.get("description", "")
            if description and isinstance(description, str):
                # Split description by common bullet indicators
                desc_bullets = re.split(r'[•\-\*\n]', description)
                bullets.extend([b.strip() for b in desc_bullets if b.strip() and len(b.strip()) > 10])

        # Get bullets from projects section
        projects = parsed_resume.get("projects", [])
        for project in projects:
            if isinstance(project, dict):
                proj_bullets = project.get("bullets", [])
                if isinstance(proj_bullets, list):
                    bullets.extend([b for b in proj_bullets if isinstance(b, str) and b.strip()])
                proj_desc = project.get("description", "")
                if proj_desc and isinstance(proj_desc, str):
                    desc_bullets = re.split(r'[•\-\*\n]', proj_desc)
                    bullets.extend([b.strip() for b in desc_bullets if b.strip() and len(b.strip()) > 10])
            elif isinstance(project, str) and project.strip():
                bullets.append(project.strip())

        # Analyze summary if present (lower weight in overall but still analyzed)
        summary = parsed_resume.get("summary", "")
        if summary and isinstance(summary, str):
            # Split summary into sentences for analysis
            summary_sentences = re.split(r'[.!?]', summary)
            # Only include substantial sentences
            bullets.extend([s.strip() for s in summary_sentences if s.strip() and len(s.strip()) > 20])

        # Handle edge case of no bullets
        if not bullets:
            return ContentQualityResult(
                content_quality_score=0.0,
                block_type_score=0.0,
                quantification_score=0.0,
                action_verb_score=0.0,
                block_type_weight=block_type_weight,
                quantification_weight=quantification_weight,
                action_verb_weight=action_verb_weight,
                block_type_analysis=BlockTypeAnalysis(
                    total_bullets=0,
                    achievement_count=0,
                    responsibility_count=0,
                    project_count=0,
                    other_count=0,
                    achievement_ratio=0.0,
                    quality_score=0.0,
                ),
                quantification_analysis=QuantificationAnalysis(
                    total_bullets=0,
                    quantified_bullets=0,
                    quantification_density=0.0,
                    quality_score=0.0,
                    metrics_found=[],
                    bullets_needing_metrics=[],
                ),
                action_verb_analysis=ActionVerbAnalysis(
                    total_bullets=0,
                    bullets_with_action_verbs=0,
                    bullets_with_weak_phrases=0,
                    action_verb_coverage=0.0,
                    weak_phrase_ratio=0.0,
                    quality_score=0.0,
                    verb_category_distribution={},
                ),
                bullet_analyses=[],
                suggestions=["No bullet points found in resume. Add experience bullets to get content quality feedback."],
                warnings=["Unable to analyze content quality: no bullet points detected."],
                total_bullets_analyzed=0,
                high_quality_bullets=0,
                low_quality_bullets=0,
            )

        # Analyze each bullet
        bullet_analyses = [self._analyze_bullet(bullet) for bullet in bullets]

        # Perform component analyses
        block_analysis = self._analyze_block_types(bullet_analyses)
        quant_analysis = self._analyze_quantification(bullet_analyses)
        action_analysis = self._analyze_action_verbs(bullet_analyses)

        # Calculate overall content quality score
        content_quality_score = (
            block_analysis.quality_score * block_type_weight +
            quant_analysis.quality_score * quantification_weight +
            action_analysis.quality_score * action_verb_weight
        )

        # Count high and low quality bullets
        high_quality = sum(1 for b in bullet_analyses if b.quality_score > 0.7)
        low_quality = sum(1 for b in bullet_analyses if b.quality_score < 0.4)

        # Generate suggestions and warnings
        suggestions, warnings = self._generate_content_quality_suggestions(
            block_analysis, quant_analysis, action_analysis, bullet_analyses
        )

        return ContentQualityResult(
            content_quality_score=round(content_quality_score, 1),
            block_type_score=block_analysis.quality_score,
            quantification_score=quant_analysis.quality_score,
            action_verb_score=action_analysis.quality_score,
            block_type_weight=block_type_weight,
            quantification_weight=quantification_weight,
            action_verb_weight=action_verb_weight,
            block_type_analysis=block_analysis,
            quantification_analysis=quant_analysis,
            action_verb_analysis=action_analysis,
            bullet_analyses=bullet_analyses,
            suggestions=suggestions,
            warnings=warnings,
            total_bullets_analyzed=len(bullet_analyses),
            high_quality_bullets=high_quality,
            low_quality_bullets=low_quality,
        )

    # ============================================================
    # Private Methods - Bullet Analysis
    # ============================================================

    def _has_quantification(self, text: str) -> tuple[bool, list[str]]:
        """
        Check if text contains quantified metrics.

        Returns:
            Tuple of (has_quantification, list_of_metrics_found)
        """
        text_lower = text.lower()
        metrics_found = []

        for pattern in QUANTIFICATION_PATTERNS:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                metrics_found.extend(matches)

        # Deduplicate while preserving order
        seen = set()
        unique_metrics = []
        for m in metrics_found:
            m_clean = str(m).strip() if isinstance(m, str) else str(m)
            if m_clean and m_clean not in seen:
                seen.add(m_clean)
                unique_metrics.append(m_clean)

        return len(unique_metrics) > 0, unique_metrics

    def _has_action_verb(self, text: str) -> tuple[bool, list[str]]:
        """
        Check if text starts with or contains strong action verbs.

        Returns:
            Tuple of (has_action_verb, list_of_categories)
        """
        text_lower = text.lower().strip()
        categories_found = []

        for category, patterns in ACTION_VERB_PATTERNS.items():
            for pattern in patterns:
                # Check if bullet starts with action verb (ideal)
                # or contains it anywhere (still counts)
                if re.search(pattern, text_lower, re.IGNORECASE):
                    categories_found.append(category)
                    break  # Only count each category once

        return len(categories_found) > 0, categories_found

    def _has_weak_phrase(self, text: str) -> bool:
        """Check if text contains weak/passive phrases."""
        text_lower = text.lower()
        for pattern in WEAK_PHRASE_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True
        return False

    def _analyze_bullet(self, text: str) -> BulletAnalysis:
        """
        Analyze a single bullet point for quality signals.

        Quality score is calculated as:
        - +0.4 for having quantification
        - +0.3 for having action verb
        - -0.2 for having weak phrases
        - Base of 0.3 for any content
        """
        has_quant, metrics = self._has_quantification(text)
        has_action, verb_categories = self._has_action_verb(text)
        has_weak = self._has_weak_phrase(text)

        # Calculate quality score
        score = 0.3  # Base score for having content
        if has_quant:
            score += 0.4
        if has_action:
            score += 0.3
        if has_weak:
            score -= 0.2

        # Clamp to 0-1 range
        score = max(0.0, min(1.0, score))

        return BulletAnalysis(
            text=text,
            has_quantification=has_quant,
            has_action_verb=has_action,
            has_weak_phrase=has_weak,
            action_verb_categories=verb_categories,
            detected_metrics=metrics,
            quality_score=score,
        )

    def _classify_bullet_type(self, bullet: BulletAnalysis) -> str:
        """
        Classify a bullet as achievement, responsibility, or other.

        Classification heuristics:
        - Achievement: has quantification OR (has action verb + no weak phrases)
        - Responsibility: has weak phrases OR (no quantification + no strong action)
        - Project: has creation verbs but no metrics
        """
        if bullet.has_quantification:
            return "achievement"

        if bullet.has_weak_phrase:
            return "responsibility"

        # Check for achievement-style action verbs
        achievement_categories = {"achievement", "improvement", "leadership"}
        if any(cat in achievement_categories for cat in bullet.action_verb_categories):
            return "achievement"

        # Check for creation verbs (project-style)
        if "creation" in bullet.action_verb_categories:
            return "project"

        # Default to responsibility if no strong signals
        if bullet.has_action_verb:
            return "project"

        return "responsibility"

    # ============================================================
    # Private Methods - Component Analysis
    # ============================================================

    def _analyze_block_types(
        self, bullet_analyses: list[BulletAnalysis]
    ) -> BlockTypeAnalysis:
        """
        Analyze the distribution of block types.

        Returns a score based on achievement ratio.
        Target: 60%+ achievements
        """
        if not bullet_analyses:
            return BlockTypeAnalysis(
                total_bullets=0,
                achievement_count=0,
                responsibility_count=0,
                project_count=0,
                other_count=0,
                achievement_ratio=0.0,
                quality_score=0.0,
            )

        achievement_count = 0
        responsibility_count = 0
        project_count = 0
        other_count = 0

        for bullet in bullet_analyses:
            bullet_type = self._classify_bullet_type(bullet)
            if bullet_type == "achievement":
                achievement_count += 1
            elif bullet_type == "responsibility":
                responsibility_count += 1
            elif bullet_type == "project":
                project_count += 1
            else:
                other_count += 1

        total = len(bullet_analyses)
        # Count achievements + projects as "high value" content
        high_value_count = achievement_count + project_count
        achievement_ratio = high_value_count / total if total > 0 else 0.0

        # Score based on achievement ratio
        # 60%+ achievements = 100, 40% = 70, 20% = 40, 0% = 10
        if achievement_ratio >= ACHIEVEMENT_RATIO_TARGET:
            quality_score = 100.0
        else:
            # Linear interpolation from 10 to 100 based on ratio
            quality_score = 10 + (achievement_ratio / ACHIEVEMENT_RATIO_TARGET) * 90

        return BlockTypeAnalysis(
            total_bullets=total,
            achievement_count=achievement_count,
            responsibility_count=responsibility_count,
            project_count=project_count,
            other_count=other_count,
            achievement_ratio=achievement_ratio,
            quality_score=round(quality_score, 1),
        )

    def _analyze_quantification(
        self, bullet_analyses: list[BulletAnalysis]
    ) -> QuantificationAnalysis:
        """
        Analyze quantification density across all bullets.

        Target: 50%+ of bullets should contain metrics.
        """
        if not bullet_analyses:
            return QuantificationAnalysis(
                total_bullets=0,
                quantified_bullets=0,
                quantification_density=0.0,
                quality_score=0.0,
                metrics_found=[],
                bullets_needing_metrics=[],
            )

        quantified_count = 0
        all_metrics: list[str] = []
        bullets_needing_metrics: list[str] = []

        for bullet in bullet_analyses:
            if bullet.has_quantification:
                quantified_count += 1
                all_metrics.extend(bullet.detected_metrics)
            else:
                # Only suggest adding metrics to achievement-style bullets
                if bullet.has_action_verb and not bullet.has_weak_phrase:
                    # Truncate for suggestion
                    truncated = bullet.text[:100] + "..." if len(bullet.text) > 100 else bullet.text
                    bullets_needing_metrics.append(truncated)

        total = len(bullet_analyses)
        density = quantified_count / total if total > 0 else 0.0

        # Score based on quantification density
        # 50%+ = 100, 25% = 60, 0% = 20
        if density >= QUANTIFICATION_TARGET:
            quality_score = 100.0
        else:
            quality_score = 20 + (density / QUANTIFICATION_TARGET) * 80

        return QuantificationAnalysis(
            total_bullets=total,
            quantified_bullets=quantified_count,
            quantification_density=round(density, 3),
            quality_score=round(quality_score, 1),
            metrics_found=all_metrics[:20],  # Limit to top 20 metrics
            bullets_needing_metrics=bullets_needing_metrics[:5],  # Limit suggestions
        )

    def _analyze_action_verbs(
        self, bullet_analyses: list[BulletAnalysis]
    ) -> ActionVerbAnalysis:
        """
        Analyze action verb usage and weak phrase presence.

        Target: 80%+ bullets should have action verbs,
                <20% should have weak phrases.
        """
        if not bullet_analyses:
            return ActionVerbAnalysis(
                total_bullets=0,
                bullets_with_action_verbs=0,
                bullets_with_weak_phrases=0,
                action_verb_coverage=0.0,
                weak_phrase_ratio=0.0,
                quality_score=0.0,
                verb_category_distribution={},
            )

        action_verb_count = 0
        weak_phrase_count = 0
        category_counts: dict[str, int] = {}

        for bullet in bullet_analyses:
            if bullet.has_action_verb:
                action_verb_count += 1
                for cat in bullet.action_verb_categories:
                    category_counts[cat] = category_counts.get(cat, 0) + 1

            if bullet.has_weak_phrase:
                weak_phrase_count += 1

        total = len(bullet_analyses)
        action_coverage = action_verb_count / total if total > 0 else 0.0
        weak_ratio = weak_phrase_count / total if total > 0 else 0.0

        # Calculate quality score
        # Action verb coverage: 80%+ = full points
        action_score = min(1.0, action_coverage / ACTION_VERB_THRESHOLD)
        # Penalty for weak phrases: each 10% reduces score by 10 points
        weak_penalty = weak_ratio * 100

        quality_score = (action_score * 100) - weak_penalty
        quality_score = max(0.0, min(100.0, quality_score))

        return ActionVerbAnalysis(
            total_bullets=total,
            bullets_with_action_verbs=action_verb_count,
            bullets_with_weak_phrases=weak_phrase_count,
            action_verb_coverage=round(action_coverage, 3),
            weak_phrase_ratio=round(weak_ratio, 3),
            quality_score=round(quality_score, 1),
            verb_category_distribution=category_counts,
        )

    def _generate_content_quality_suggestions(
        self,
        block_analysis: BlockTypeAnalysis,
        quant_analysis: QuantificationAnalysis,
        action_analysis: ActionVerbAnalysis,
        bullet_analyses: list[BulletAnalysis],
    ) -> tuple[list[str], list[str]]:
        """Generate suggestions and warnings based on content quality analysis."""
        suggestions: list[str] = []
        warnings: list[str] = []

        # Block type suggestions
        if block_analysis.achievement_ratio < 0.4:
            warnings.append(
                f"Only {block_analysis.achievement_ratio:.0%} of your bullets show measurable achievements. "
                "ATS systems and recruiters favor achievement-oriented content over responsibility lists."
            )
            suggestions.append(
                "Reframe responsibility bullets as achievements by adding outcomes: "
                "'Managed team' → 'Led team of 5 engineers to deliver project 2 weeks ahead of schedule'"
            )

        # Quantification suggestions
        if quant_analysis.quantification_density < QUANTIFICATION_TARGET:
            density_pct = quant_analysis.quantification_density * 100
            target_pct = QUANTIFICATION_TARGET * 100
            warnings.append(
                f"Only {density_pct:.0f}% of your bullets contain quantified metrics. "
                f"Target is {target_pct:.0f}%+ for optimal ATS performance."
            )

            if quant_analysis.bullets_needing_metrics:
                suggestions.append(
                    "Add metrics to these bullets: Consider percentages (%), dollar amounts ($), "
                    "counts (users, projects), or time savings."
                )
                # Add specific examples
                for bullet in quant_analysis.bullets_needing_metrics[:3]:
                    suggestions.append(f"  → \"{bullet}\" - add a measurable outcome")

        # Action verb suggestions
        if action_analysis.action_verb_coverage < 0.6:
            warnings.append(
                f"Only {action_analysis.action_verb_coverage:.0%} of your bullets start with strong action verbs. "
                "Begin bullets with impactful verbs like 'Led', 'Built', 'Increased', 'Delivered'."
            )

        if action_analysis.weak_phrase_ratio > 0.2:
            warnings.append(
                f"{action_analysis.weak_phrase_ratio:.0%} of your bullets contain weak phrases "
                "like 'Responsible for' or 'Assisted with'. Replace with action-oriented language."
            )
            suggestions.append(
                "Replace weak phrases: 'Responsible for managing' → 'Managed', "
                "'Helped with development' → 'Developed'"
            )

        # Verb category diversity suggestion
        if action_analysis.verb_category_distribution:
            dominant_category = max(
                action_analysis.verb_category_distribution.items(),
                key=lambda x: x[1],
                default=(None, 0),
            )
            total_verbs = sum(action_analysis.verb_category_distribution.values())
            if dominant_category[1] > 0.6 * total_verbs:
                suggestions.append(
                    f"Your bullets heavily use '{dominant_category[0]}' verbs. "
                    "Consider diversifying with verbs from other categories "
                    "(leadership, achievement, improvement, analysis)."
                )

        # Positive feedback for good scores
        if block_analysis.quality_score >= 80:
            suggestions.append("Your achievement/responsibility ratio is excellent.")

        if quant_analysis.quality_score >= 80:
            suggestions.append(
                f"Strong quantification: {quant_analysis.quantified_bullets}/{quant_analysis.total_bullets} "
                "bullets contain measurable metrics."
            )

        return suggestions, warnings
