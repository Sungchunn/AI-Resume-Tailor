"""
Diff Engine Facade.

Main DiffEngine class that composes operations and suggestion generation.
"""

from functools import lru_cache
from typing import Any

from app.core.protocols import (
    DiffSuggestionData,
    ExperienceBlockData,
    WorkshopData,
)

from .operations import DiffOperations
from .suggestions import SuggestionGenerator


class DiffEngine:
    """
    Engine for generating and applying diff-based resume suggestions.

    Implements IDiffEngine protocol.

    Key principle: All suggestions MUST trace back to content in the
    user's Vault. The AI cannot hallucinate or invent facts.
    """

    def __init__(self):
        self._operations = DiffOperations()
        self._suggestions = SuggestionGenerator()

    # ============================================================
    # Suggestion Generation
    # ============================================================

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
        return await self._suggestions.generate_suggestions(
            workshop, job_description, available_blocks, max_suggestions, focus_sections
        )

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
        return await self._suggestions.suggest_single_bullet(
            bullet_text, entry_context, job_description
        )

    # ============================================================
    # Diff Operations
    # ============================================================

    def apply_diff(
        self,
        document: dict[str, Any],
        diff: DiffSuggestionData,
    ) -> dict[str, Any]:
        """
        Apply a single diff to a document.

        Args:
            document: Document to modify (not mutated)
            diff: Diff operation to apply

        Returns:
            New document with diff applied
        """
        return self._operations.apply_diff(document, diff)

    def apply_diffs(
        self,
        document: dict[str, Any],
        diffs: list[DiffSuggestionData],
    ) -> dict[str, Any]:
        """
        Apply multiple diffs in order.

        Args:
            document: Starting document
            diffs: List of diffs to apply

        Returns:
            Document with all diffs applied
        """
        return self._operations.apply_diffs(document, diffs)

    def revert_diff(
        self,
        document: dict[str, Any],
        diff: DiffSuggestionData,
    ) -> dict[str, Any]:
        """
        Revert a previously applied diff.

        Args:
            document: Document with diff applied
            diff: Diff to revert

        Returns:
            Document with diff reverted
        """
        return self._operations.revert_diff(document, diff)

    def preview_diff(
        self,
        document: dict[str, Any],
        diff: DiffSuggestionData,
    ) -> dict[str, Any]:
        """
        Preview a diff without applying it.

        Returns information about what would change.

        Args:
            document: Current document
            diff: Diff to preview

        Returns:
            Preview information
        """
        return self._operations.preview_diff(document, diff)


@lru_cache
def get_diff_engine() -> DiffEngine:
    """Get a singleton DiffEngine instance."""
    return DiffEngine()
