"""
Keyword Suggestion Generation.

Functions for generating actionable suggestions based on missing keywords.
"""

import re

from app.core.protocols import ExperienceBlockData


def generate_keyword_suggestions(
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


def generate_detailed_suggestions(
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


def generate_enhanced_suggestions(
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
