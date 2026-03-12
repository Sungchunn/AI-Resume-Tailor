"""
Diff Suggestion Generator.

Handles AI-powered suggestion generation for resume improvements.
"""

import json
import re
from typing import Any

from app.core.protocols import (
    DiffSuggestionData,
    ExperienceBlockData,
    WorkshopData,
)
from app.services.ai.client import get_ai_client

from .prompts import SINGLE_BULLET_SUGGESTION_PROMPT, DIFF_SUGGESTION_PROMPT


class SuggestionGenerator:
    """
    Generates diff-based suggestions for resume improvements.

    Key principle: All suggestions MUST trace back to content in the
    user's Vault. The AI cannot hallucinate or invent facts.
    """

    def __init__(self):
        self.ai_client = get_ai_client()

    async def generate_suggestions(
        self,
        workshop: WorkshopData,
        job_description: str,
        available_blocks: list[ExperienceBlockData],
        max_suggestions: int = 10,
        focus_sections: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Generate diff suggestions for a workshop.

        CRITICAL: Suggestions can ONLY use content from available_blocks.
        The AI cannot hallucinate or invent facts.

        Args:
            workshop: Current workshop state
            job_description: Target job requirements
            available_blocks: User's Vault blocks to draw from
            max_suggestions: Maximum suggestions to generate
            focus_sections: Optional sections to focus on

        Returns:
            Dict with "suggestions" and "gaps" keys
        """
        # Format vault blocks for prompt
        vault_text = self._format_blocks_for_prompt(available_blocks)

        # Format workshop sections
        sections_text = json.dumps(workshop.get("sections", {}), indent=2)

        # Build prompt
        prompt = DIFF_SUGGESTION_PROMPT.format(
            vault_blocks=vault_text,
            job_requirements=job_description[:3000],  # Limit size
            workshop_sections=sections_text[:2000],
        )

        if focus_sections:
            prompt += f"\n\nFOCUS ON THESE SECTIONS: {', '.join(focus_sections)}"

        prompt += f"\n\nGenerate up to {max_suggestions} suggestions."

        # Generate suggestions
        response = await self.ai_client.generate_json(
            system_prompt="",  # Instructions are in the prompt
            user_prompt=prompt,
            max_tokens=4000,
        )

        # Parse response
        try:
            result = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                except json.JSONDecodeError:
                    return {"suggestions": [], "gaps": ["Error parsing AI response"]}
            else:
                return {"suggestions": [], "gaps": ["Error parsing AI response"]}

        # Extract and validate suggestions
        suggestions = []
        raw_suggestions = result.get("suggestions", [])

        for raw in raw_suggestions[:max_suggestions]:
            try:
                suggestion = self._validate_suggestion(raw, available_blocks)
                if suggestion:
                    suggestions.append(suggestion)
            except (KeyError, ValueError):
                continue

        gaps = result.get("gaps", [])
        if isinstance(gaps, list):
            gaps = [str(g) for g in gaps if g]
        else:
            gaps = []

        return {"suggestions": suggestions, "gaps": gaps}

    async def suggest_single_bullet(
        self,
        bullet_text: str,
        entry_context: dict[str, str],
        job_description: str,
    ) -> dict[str, Any]:
        """
        Generate a suggestion for a single bullet point.

        This is a lightweight call optimized for real-time inline suggestions
        during keyboard-driven bullet review.

        Args:
            bullet_text: The current bullet point text
            entry_context: Context about the experience entry (title, company, date_range)
            job_description: Target job requirements

        Returns:
            Dict with original, suggested, reason, and impact fields
        """
        # Skip very short bullet text
        if len(bullet_text.strip()) < 10:
            return {
                "original": bullet_text,
                "suggested": bullet_text,
                "reason": "Bullet too short to suggest improvements",
                "impact": "low",
            }

        # Build prompt
        prompt = SINGLE_BULLET_SUGGESTION_PROMPT.format(
            bullet_text=bullet_text,
            entry_title=entry_context.get("title", "N/A"),
            entry_company=entry_context.get("company", "N/A"),
            entry_date_range=entry_context.get("date_range", "N/A"),
            job_description=job_description[:2000],  # Limit size
        )

        # Generate suggestion
        response = await self.ai_client.generate_json(
            system_prompt="",
            user_prompt=prompt,
            max_tokens=1000,
        )

        # Parse response
        try:
            result = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                except json.JSONDecodeError:
                    return {
                        "original": bullet_text,
                        "suggested": bullet_text,
                        "reason": "Could not parse AI response",
                        "impact": "low",
                    }
            else:
                return {
                    "original": bullet_text,
                    "suggested": bullet_text,
                    "reason": "Could not parse AI response",
                    "impact": "low",
                }

        # Validate and normalize result
        suggested = result.get("suggested", bullet_text)
        reason = result.get("reason", "Improves job fit")
        impact = result.get("impact", "medium").lower()

        if impact not in ["high", "medium", "low"]:
            impact = "medium"

        return {
            "original": bullet_text,
            "suggested": suggested,
            "reason": reason,
            "impact": impact,
        }

    def _format_blocks_for_prompt(
        self,
        blocks: list[ExperienceBlockData],
    ) -> str:
        """Format blocks for inclusion in prompt."""
        formatted = []
        for block in blocks:
            block_text = f"""[Block ID: {block['id']}]
Type: {block['block_type']}
Content: {block['content']}
Tags: {', '.join(block.get('tags', []))}
Source: {block.get('source_company', 'N/A')} - {block.get('source_role', 'N/A')}
---"""
            formatted.append(block_text)

        return "\n".join(formatted)

    def _validate_suggestion(
        self,
        raw: dict[str, Any],
        available_blocks: list[ExperienceBlockData],
    ) -> DiffSuggestionData | None:
        """Validate and normalize a suggestion."""
        # Required fields
        operation = raw.get("operation", "").lower()
        if operation not in ["add", "replace", "remove"]:
            return None

        path = raw.get("path", "")
        if not path or not path.startswith("/"):
            return None

        value = raw.get("value")
        if operation != "remove" and value is None:
            return None

        reason = raw.get("reason", "")
        if not reason:
            reason = "Improves job fit"

        impact = raw.get("impact", "medium").lower()
        if impact not in ["high", "medium", "low"]:
            impact = "medium"

        source_block_id = raw.get("source_block_id")

        # Validate source_block_id exists in available blocks
        if source_block_id is not None:
            block_ids = {b["id"] for b in available_blocks}
            if source_block_id not in block_ids:
                source_block_id = None  # Clear invalid reference

        return {
            "operation": operation,
            "path": path,
            "value": value,
            "original_value": raw.get("original_value"),
            "reason": reason,
            "impact": impact,
            "source_block_id": source_block_id,
        }
