"""
Bullet Analyzer Service.

Analyzes resume bullet points and suggests ATS-optimized improvements.
"""

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING

from app.schemas.tailor.suggestions import (
    ATSContextInput,
    BulletInput,
    BulletSuggestionResponse,
)
from app.services.ai.response import AccumulatedMetrics, AIResponse
from app.services.job.diff.prompts_ats import (
    BULLET_ANALYSIS_SYSTEM_PROMPT,
    build_bullet_analysis_user_prompt,
)

if TYPE_CHECKING:
    from app.services.ai.client import BaseAIClient


class BulletAnalyzer:
    """
    Analyzes resume bullet points and suggests ATS-optimized improvements.

    Uses ATS context (keyword gaps, content quality hints) to prioritize
    suggestions that address specific weaknesses.
    """

    BATCH_SIZE = 10  # Max bullets per LLM call
    MAX_JOB_DESC_CHARS = 3000  # Truncate long job descriptions

    def __init__(self, ai_client: "BaseAIClient"):
        self._ai_client = ai_client

    async def analyze_batch(
        self,
        bullets: list[BulletInput],
        job_description: str,
        ats_context: ATSContextInput,
        return_metrics: bool = False,
    ) -> list[BulletSuggestionResponse] | tuple[list[BulletSuggestionResponse], AIResponse]:
        """
        Analyze all bullets and return improvement suggestions.

        Batching strategy:
        - 1-10 bullets: Single LLM call
        - 11+ bullets: Chunk into groups of 10, process sequentially

        Args:
            bullets: List of bullets to analyze
            job_description: Full job description text
            ats_context: ATS analysis context with keyword gaps and hints
            return_metrics: If True, return (suggestions, AIResponse) tuple

        Returns:
            List of suggestions (only for bullets needing improvement)
            If return_metrics=True: (suggestions, aggregated AIResponse)
        """
        if not bullets:
            return ([], self._empty_response()) if return_metrics else []

        # Truncate job description if needed
        job_desc_truncated = job_description[: self.MAX_JOB_DESC_CHARS]

        # Process in batches
        all_suggestions: list[BulletSuggestionResponse] = []
        accumulated_metrics = AccumulatedMetrics()

        for i in range(0, len(bullets), self.BATCH_SIZE):
            batch = bullets[i : i + self.BATCH_SIZE]
            suggestions, response = await self._analyze_batch_internal(
                bullets=batch,
                job_description=job_desc_truncated,
                ats_context=ats_context,
            )
            all_suggestions.extend(suggestions)
            accumulated_metrics.add(response)

        if return_metrics:
            return all_suggestions, accumulated_metrics.to_ai_response()
        return all_suggestions

    async def _analyze_batch_internal(
        self,
        bullets: list[BulletInput],
        job_description: str,
        ats_context: ATSContextInput,
    ) -> tuple[list[BulletSuggestionResponse], AIResponse]:
        """Process a single batch of bullets."""
        user_prompt = build_bullet_analysis_user_prompt(
            bullets=bullets,
            job_description=job_description,
            ats_context=ats_context,
        )

        response = await self._ai_client.generate_json_with_metrics(
            system_prompt=BULLET_ANALYSIS_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=4000,
        )

        suggestions = self._parse_response(response.content, bullets)
        return suggestions, response

    def _parse_response(
        self,
        content: str,
        original_bullets: list[BulletInput],
    ) -> list[BulletSuggestionResponse]:
        """Parse AI response into validated suggestions."""
        try:
            # Try direct JSON parse
            data = json.loads(content)
        except json.JSONDecodeError:
            # Fallback: extract JSON from markdown code block
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
            if match:
                try:
                    data = json.loads(match.group(1))
                except json.JSONDecodeError:
                    return []
            else:
                return []

        if not isinstance(data, list):
            return []

        # Build lookup for validation
        bullet_lookup = {b.id: b.text for b in original_bullets}
        suggestions = []

        for item in data:
            if not isinstance(item, dict):
                continue

            bullet_id = item.get("bullet_id")
            if bullet_id not in bullet_lookup:
                continue

            # Validate suggestion is actually different
            suggested = item.get("suggested", "").strip()
            original = bullet_lookup[bullet_id]
            if suggested.lower() == original.lower():
                continue

            # Validate impact level
            impact = item.get("impact", "medium")
            if impact not in ("high", "medium", "low"):
                impact = "medium"

            suggestions.append(
                BulletSuggestionResponse(
                    bullet_id=bullet_id,
                    original=original,
                    suggested=suggested,
                    reason=item.get("reason", "Improved for ATS optimization"),
                    impact=impact,
                    keywords_added=item.get("keywords_added", []),
                    metrics_added=item.get("metrics_added", False),
                )
            )

        return suggestions

    def _empty_response(self) -> AIResponse:
        """Return an empty AIResponse for edge cases."""
        from app.services.ai.response import AIUsageMetrics

        return AIResponse(
            content="[]",
            metrics=AIUsageMetrics(
                input_tokens=0,
                output_tokens=0,
                total_tokens=0,
                latency_ms=0,
            ),
            provider="",
            model="",
        )
