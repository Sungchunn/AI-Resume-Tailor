"""
Diff Engine Service - Generate and apply JSON Patch suggestions.

This is the core of the Workshop's AI suggestion system. It generates
diff-based suggestions that are STRICTLY constrained to content from
the user's Vault - no hallucination allowed.
"""

import json
import copy
from functools import lru_cache
from typing import List, Dict, Any, Optional

from app.core.protocols import (
    DiffSuggestionData,
    ExperienceBlockData,
    WorkshopData,
    DiffOperation,
    SuggestionImpact,
)
from app.services.ai.client import get_ai_client


DIFF_SUGGESTION_PROMPT = """You are a precision resume tailoring assistant.

CRITICAL CONSTRAINT: You can ONLY use facts from the user's Vault (provided below).
You CANNOT invent, hallucinate, or fabricate any information.
Every suggestion MUST trace back to a specific block in the Vault.

VAULT CONTENTS (User's verified facts):
{vault_blocks}

JOB REQUIREMENTS:
{job_requirements}

CURRENT WORKSHOP STATE:
{workshop_sections}

Generate diff-based suggestions in JSON Patch format (RFC 6902).
Each suggestion must include:
1. operation: "add" | "replace" | "remove"
2. path: JSON Pointer path (e.g., "/summary", "/experience/0/description")
3. value: The new content (MUST come from Vault blocks)
4. original_value: What's being replaced (if applicable)
5. reason: Why this improves job fit (1-2 sentences)
6. impact: "high" | "medium" | "low"
7. source_block_id: The Vault block ID this content comes from

PATH CONVENTIONS:
- /summary - Resume summary/objective section
- /experience/0/description - First experience item description
- /experience/0/bullets/0 - First bullet of first experience
- /skills/0 - First skill item
- /education/0/description - First education description

IMPACT LEVELS:
- high: Directly addresses a key job requirement
- medium: Improves relevance or clarity
- low: Minor optimization or formatting

If the user doesn't have relevant experience in their Vault for a job requirement,
flag it in the gaps array - DO NOT suggest fake content.

OUTPUT FORMAT (valid JSON):
{{
  "suggestions": [
    {{
      "operation": "replace",
      "path": "/summary",
      "value": "Content from vault block...",
      "original_value": "Current summary text...",
      "reason": "This better highlights the required Python experience",
      "impact": "high",
      "source_block_id": 42
    }}
  ],
  "gaps": [
    "Kubernetes experience mentioned in job but not found in Vault",
    "MBA preferred but user has no matching education"
  ]
}}

Return ONLY valid JSON. Do not wrap in markdown code blocks."""


class DiffEngine:
    """
    Engine for generating and applying diff-based resume suggestions.

    Implements IDiffEngine protocol.

    Key principle: All suggestions MUST trace back to content in the
    user's Vault. The AI cannot hallucinate or invent facts.
    """

    def __init__(self):
        self.ai_client = get_ai_client()

    async def generate_suggestions(
        self,
        workshop: WorkshopData,
        job_description: str,
        available_blocks: List[ExperienceBlockData],
        max_suggestions: int = 10,
        focus_sections: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
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
            import re
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

    def _format_blocks_for_prompt(
        self,
        blocks: List[ExperienceBlockData],
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
        raw: Dict[str, Any],
        available_blocks: List[ExperienceBlockData],
    ) -> Optional[DiffSuggestionData]:
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

    def apply_diff(
        self,
        document: Dict[str, Any],
        diff: DiffSuggestionData,
    ) -> Dict[str, Any]:
        """
        Apply a single diff to a document.

        Args:
            document: Document to modify (not mutated)
            diff: Diff operation to apply

        Returns:
            New document with diff applied
        """
        result = copy.deepcopy(document)
        operation = diff.get("operation", "replace")
        path = diff.get("path", "")
        value = diff.get("value")

        # Parse JSON Pointer path
        if path.startswith("/"):
            path = path[1:]

        parts = path.split("/") if path else []
        if not parts:
            return result

        # Navigate to parent
        target = result
        for part in parts[:-1]:
            if isinstance(target, dict):
                if part not in target:
                    target[part] = {}
                target = target[part]
            elif isinstance(target, list):
                try:
                    idx = int(part)
                    if 0 <= idx < len(target):
                        target = target[idx]
                    else:
                        return result
                except ValueError:
                    return result

        final_key = parts[-1]

        # Apply operation
        if operation == "add":
            if isinstance(target, dict):
                target[final_key] = value
            elif isinstance(target, list):
                if final_key == "-":
                    target.append(value)
                else:
                    try:
                        idx = int(final_key)
                        target.insert(idx, value)
                    except ValueError:
                        pass

        elif operation == "replace":
            if isinstance(target, dict):
                target[final_key] = value
            elif isinstance(target, list):
                try:
                    idx = int(final_key)
                    if 0 <= idx < len(target):
                        target[idx] = value
                except ValueError:
                    pass

        elif operation == "remove":
            if isinstance(target, dict):
                target.pop(final_key, None)
            elif isinstance(target, list):
                try:
                    idx = int(final_key)
                    if 0 <= idx < len(target):
                        target.pop(idx)
                except ValueError:
                    pass

        return result

    def apply_diffs(
        self,
        document: Dict[str, Any],
        diffs: List[DiffSuggestionData],
    ) -> Dict[str, Any]:
        """
        Apply multiple diffs in order.

        Args:
            document: Starting document
            diffs: List of diffs to apply

        Returns:
            Document with all diffs applied
        """
        result = document
        for diff in diffs:
            result = self.apply_diff(result, diff)
        return result

    def revert_diff(
        self,
        document: Dict[str, Any],
        diff: DiffSuggestionData,
    ) -> Dict[str, Any]:
        """
        Revert a previously applied diff.

        Args:
            document: Document with diff applied
            diff: Diff to revert

        Returns:
            Document with diff reverted
        """
        result = copy.deepcopy(document)
        operation = diff.get("operation", "replace")
        path = diff.get("path", "")
        original_value = diff.get("original_value")

        # Parse path
        if path.startswith("/"):
            path = path[1:]

        parts = path.split("/") if path else []
        if not parts:
            return result

        # Navigate to parent
        target = result
        for part in parts[:-1]:
            if isinstance(target, dict) and part in target:
                target = target[part]
            elif isinstance(target, list):
                try:
                    idx = int(part)
                    if 0 <= idx < len(target):
                        target = target[idx]
                    else:
                        return result
                except ValueError:
                    return result
            else:
                return result

        final_key = parts[-1]

        # Reverse the operation
        if operation == "add":
            # Reverse of add is remove
            if isinstance(target, dict):
                target.pop(final_key, None)
            elif isinstance(target, list):
                try:
                    idx = int(final_key)
                    if 0 <= idx < len(target):
                        target.pop(idx)
                except ValueError:
                    pass

        elif operation == "replace":
            # Reverse of replace is replace with original
            if original_value is not None:
                if isinstance(target, dict):
                    target[final_key] = original_value
                elif isinstance(target, list):
                    try:
                        idx = int(final_key)
                        if 0 <= idx < len(target):
                            target[idx] = original_value
                    except ValueError:
                        pass

        elif operation == "remove":
            # Reverse of remove is add back original
            if original_value is not None:
                if isinstance(target, dict):
                    target[final_key] = original_value
                elif isinstance(target, list):
                    try:
                        idx = int(final_key)
                        target.insert(idx, original_value)
                    except ValueError:
                        pass

        return result

    def preview_diff(
        self,
        document: Dict[str, Any],
        diff: DiffSuggestionData,
    ) -> Dict[str, Any]:
        """
        Preview a diff without applying it.

        Returns information about what would change.

        Args:
            document: Current document
            diff: Diff to preview

        Returns:
            Preview information
        """
        path = diff.get("path", "")
        operation = diff.get("operation", "replace")
        new_value = diff.get("value")

        # Get current value at path
        current_value = self._get_value_at_path(document, path)

        return {
            "path": path,
            "operation": operation,
            "current_value": current_value,
            "new_value": new_value,
            "reason": diff.get("reason", ""),
            "impact": diff.get("impact", "medium"),
            "source_block_id": diff.get("source_block_id"),
        }

    def _get_value_at_path(
        self,
        document: Dict[str, Any],
        path: str,
    ) -> Any:
        """Get value at a JSON Pointer path."""
        if path.startswith("/"):
            path = path[1:]

        parts = path.split("/") if path else []

        target = document
        for part in parts:
            if isinstance(target, dict) and part in target:
                target = target[part]
            elif isinstance(target, list):
                try:
                    idx = int(part)
                    if 0 <= idx < len(target):
                        target = target[idx]
                    else:
                        return None
                except ValueError:
                    return None
            else:
                return None

        return target


@lru_cache
def get_diff_engine() -> DiffEngine:
    """Get a singleton DiffEngine instance."""
    return DiffEngine()
