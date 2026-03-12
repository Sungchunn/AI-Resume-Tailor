"""
Keyword Matching Functions.

Functions for finding keyword matches in structured resume data.
"""

import re
from datetime import datetime
from typing import Any

from ...models import KeywordMatch
from ..base import parse_date


def detect_section_type(key: str) -> str:
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


def order_experiences_by_date(
    experiences: list[dict[str, Any]],
) -> list[tuple[int, dict[str, Any]]]:
    """
    Order experience entries by date (most recent first).

    Returns list of (recency_index, experience) tuples where recency_index
    is the position after sorting (0 = most recent).
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


def find_keyword_matches(
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
        ordered_experiences = order_experiences_by_date(experiences)
    else:
        ordered_experiences = []

    # Create a map from experience content to role index
    exp_role_map: dict[int, int] = {}  # original exp index -> recency index
    for recency_idx, (orig_idx, exp) in enumerate(ordered_experiences):
        exp_role_map[orig_idx] = recency_idx

    # Search each section
    for key, value in parsed_resume.items():
        section_type = detect_section_type(key)

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
