"""
ATS Analyzer Base Utilities.

Shared utility functions and base configuration used across analyzers.
"""

import re
from datetime import datetime

from dateutil import parser as date_parser

from ..constants import TECH_KEYWORD_PATTERNS


def parse_date(date_str: str) -> datetime | None:
    """
    Parse various date formats commonly found in resumes.

    Handles formats like:
    - "January 2020", "Jan 2020"
    - "01/2020", "1/2020"
    - "2020-01", "2020/01"
    - "2020"
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    # Skip "present", "current", etc.
    if date_str.lower() in ("present", "current", "now", "ongoing"):
        return None

    try:
        # Try standard dateutil parsing
        return date_parser.parse(date_str, fuzzy=True)
    except (ValueError, TypeError):
        pass

    # Try year-only format
    year_match = re.match(r"^(\d{4})$", date_str)
    if year_match:
        return datetime(int(year_match.group(1)), 1, 1)

    return None


def basic_keyword_extraction(text: str) -> list[str]:
    """
    Fallback keyword extraction using pattern matching.

    Used when AI extraction fails or is unavailable.
    """
    keywords: set[str] = set()

    for pattern in TECH_KEYWORD_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        keywords.update(match if isinstance(match, str) else match[0] for match in matches)

    return list(keywords)[:25]


def get_keyword_context(keyword: str, text: str, max_length: int = 100) -> str | None:
    """Extract context around where a keyword appears in text."""
    keyword_lower = keyword.lower()
    text_lower = text.lower()

    idx = text_lower.find(keyword_lower)
    if idx == -1:
        return None

    # Get surrounding context
    start = max(0, idx - 40)
    end = min(len(text), idx + len(keyword) + 40)

    context = text[start:end].strip()
    if start > 0:
        context = "..." + context
    if end < len(text):
        context = context + "..."

    return context


def count_keyword_frequency(keyword: str, text: str) -> int:
    """Count how many times a keyword appears in text."""
    keyword_lower = keyword.lower()
    keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
    return len(re.findall(keyword_pattern, text.lower()))


# Standard resume section names that ATS systems commonly look for
STANDARD_SECTIONS = {
    "summary": ["summary", "professional summary", "objective", "profile", "about"],
    "experience": ["experience", "work experience", "employment history", "work history", "professional experience"],
    "education": ["education", "academic background", "academic history", "qualifications"],
    "skills": ["skills", "technical skills", "core competencies", "competencies", "expertise"],
    "certifications": ["certifications", "certificates", "professional certifications", "licenses"],
    "projects": ["projects", "key projects", "notable projects"],
}

# Expected section order (some ATS systems like Taleo penalize non-standard ordering)
EXPECTED_SECTION_ORDER = [
    "contact",       # 1. Contact Information / Header (always first)
    "summary",       # 2. Summary / Objective (optional)
    "experience",    # 3. Work Experience (required)
    "education",     # 4. Education (required)
    "skills",        # 5. Skills
    "certifications",  # 6. Certifications / Awards (optional)
    "projects",      # 7. Projects (optional)
]

# Section order scoring penalties
SECTION_ORDER_SCORES = {
    "standard": 100,      # Perfect or acceptable order
    "minor": 95,          # Minor deviation (e.g., Skills before Education)
    "major": 85,          # Major deviation (e.g., Education before Experience)
    "non_standard": 75,   # Completely non-standard order
}

# Common formatting issues that can cause ATS parsing problems
FORMATTING_WARNINGS = {
    "multiple_columns": "Multi-column layouts can confuse some ATS systems",
    "tables": "Tables may not parse correctly in all ATS systems",
    "headers_footers": "Content in headers/footers may be ignored",
    "graphics": "Images and graphics are typically ignored by ATS",
    "text_boxes": "Text boxes may not be read in the correct order",
    "unusual_fonts": "Unusual fonts may not render correctly",
    "special_characters": "Special characters may cause parsing issues",
}


def get_ats_tips() -> list[str]:
    """
    Return general ATS optimization tips.
    """
    return [
        "Use standard section headers (Experience, Education, Skills)",
        "Avoid tables, graphics, and multi-column layouts",
        "Use standard fonts (Arial, Calibri, Times New Roman)",
        "Include keywords from the job description naturally in your content",
        "Use full spellings alongside acronyms (e.g., 'Application Programming Interface (API)')",
        "Save your resume as a .docx or .pdf file",
        "Put important information in the main body, not headers/footers",
        "Use standard date formats (MM/YYYY or Month YYYY)",
        "Avoid using text boxes or shapes",
        "Keep formatting simple and consistent",
    ]
