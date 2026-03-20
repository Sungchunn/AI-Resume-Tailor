"""
Job Description Section Parser.

Deterministically parses job descriptions into structured sections
(Requirements, Nice to Have, Responsibilities) before AI classification.
"""

import re
from dataclasses import dataclass
from typing import Literal

# ============================================================================
# Types
# ============================================================================

SectionType = Literal[
    "requirements",
    "nice_to_have",
    "responsibilities",
    "qualifications",
    "about",
    "benefits",
    "other",
]


@dataclass
class ParsedSection:
    """A section extracted from a job description."""

    type: SectionType
    text: str
    start_index: int
    end_index: int
    header: str | None = None  # The header text that identified this section


# ============================================================================
# Section Patterns
# ============================================================================

# Regex patterns to identify section headers in job descriptions
# Each pattern list is checked in order; first match wins
SECTION_PATTERNS: dict[SectionType, list[str]] = {
    "requirements": [
        # Explicit "requirements" headers
        r"(?i)^\s*(?:minimum\s+)?requirements?\s*[:.]?\s*$",
        r"(?i)^\s*what\s+(?:we(?:'re|\s+are)\s+looking\s+for|you(?:'ll)?\s+need)\s*[:.]?\s*$",
        r"(?i)^\s*must[\s-]+haves?\s*[:.]?\s*$",
        r"(?i)^\s*(?:required|essential)\s+(?:skills?|qualifications?|experience)\s*[:.]?\s*$",
        r"(?i)^\s*you\s+(?:should|must|will)\s+have\s*[:.]?\s*$",
        r"(?i)^\s*(?:key|core)\s+requirements?\s*[:.]?\s*$",
    ],
    "qualifications": [
        # Qualifications (often synonymous with requirements)
        r"(?i)^\s*(?:required\s+)?qualifications?\s*[:.]?\s*$",
        r"(?i)^\s*(?:basic|minimum)\s+qualifications?\s*[:.]?\s*$",
        r"(?i)^\s*who\s+you\s+are\s*[:.]?\s*$",
        r"(?i)^\s*your\s+(?:background|profile)\s*[:.]?\s*$",
    ],
    "nice_to_have": [
        # Nice to have / preferred
        r"(?i)^\s*nice[\s-]+to[\s-]+haves?\s*[:.]?\s*$",
        r"(?i)^\s*(?:preferred|desired|additional)\s+(?:skills?|qualifications?|experience)\s*[:.]?\s*$",
        r"(?i)^\s*bonus\s+(?:points?|skills?|qualifications?)?\s*[:.]?\s*$",
        r"(?i)^\s*(?:it(?:'s|\s+is)\s+a\s+)?plus\s+if\s+you\s+have\s*[:.]?\s*$",
        r"(?i)^\s*ideally,?\s+you(?:'ll)?\s+(?:also\s+)?have\s*[:.]?\s*$",
        r"(?i)^\s*(?:extra|added)\s+(?:points?|bonus)\s+(?:for|if)\s*[:.]?\s*$",
        r"(?i)^\s*what\s+(?:would\s+be\s+)?nice\s+to\s+have\s*[:.]?\s*$",
    ],
    "responsibilities": [
        # Responsibilities / duties
        r"(?i)^\s*(?:job\s+)?responsibilities?\s*[:.]?\s*$",
        r"(?i)^\s*(?:key\s+)?duties\s*[:.]?\s*$",
        r"(?i)^\s*what\s+you(?:'ll)?\s+(?:do|be\s+doing)\s*[:.]?\s*$",
        r"(?i)^\s*your\s+(?:role|responsibilities?)\s*[:.]?\s*$",
        r"(?i)^\s*(?:in\s+this\s+role,?\s+)?you\s+will\s*[:.]?\s*$",
        r"(?i)^\s*(?:day[\s-]+to[\s-]+day|daily)\s+(?:tasks?|activities?)\s*[:.]?\s*$",
        r"(?i)^\s*the\s+(?:role|job|position)\s*[:.]?\s*$",
    ],
    "about": [
        # About the company / team
        r"(?i)^\s*about\s+(?:us|the\s+company|the\s+team|the\s+role)\s*[:.]?\s*$",
        r"(?i)^\s*who\s+we\s+are\s*[:.]?\s*$",
        r"(?i)^\s*(?:company|team)\s+(?:overview|description)\s*[:.]?\s*$",
        r"(?i)^\s*(?:our|the)\s+(?:company|team|mission)\s*[:.]?\s*$",
    ],
    "benefits": [
        # Benefits / perks
        r"(?i)^\s*(?:benefits?|perks?|compensation)\s*[:.]?\s*$",
        r"(?i)^\s*what\s+we\s+offer\s*[:.]?\s*$",
        r"(?i)^\s*(?:why\s+)?(?:join|work\s+(?:with|for))\s+us\s*[:.]?\s*$",
        r"(?i)^\s*(?:our|the)\s+(?:benefits?|perks?)\s*[:.]?\s*$",
    ],
}

# Map section types to keyword importance levels
SECTION_IMPORTANCE_MAP: dict[SectionType, str] = {
    "requirements": "required",
    "qualifications": "required",
    "nice_to_have": "nice_to_have",
    "responsibilities": "preferred",
    "about": "nice_to_have",
    "benefits": "nice_to_have",
    "other": "preferred",
}


# ============================================================================
# Section Parser
# ============================================================================


class JobDescriptionSectionParser:
    """
    Deterministically parses job descriptions into structured sections.

    Uses regex patterns to identify section headers, then extracts
    the text between headers as section content.
    """

    def __init__(self):
        # Compile all patterns for efficiency
        self._compiled_patterns: dict[SectionType, list[re.Pattern]] = {
            section_type: [re.compile(pattern, re.MULTILINE) for pattern in patterns]
            for section_type, patterns in SECTION_PATTERNS.items()
        }

    def parse(self, job_description: str) -> list[ParsedSection]:
        """
        Parse a job description into structured sections.

        Args:
            job_description: The raw job description text

        Returns:
            List of ParsedSection objects, ordered by position in the text
        """
        if not job_description or not job_description.strip():
            return []

        # Find all section headers with their positions
        headers = self._find_headers(job_description)

        if not headers:
            # No headers found - return entire text as "other"
            return [
                ParsedSection(
                    type="other",
                    text=job_description.strip(),
                    start_index=0,
                    end_index=len(job_description),
                    header=None,
                )
            ]

        # Sort headers by position
        headers.sort(key=lambda h: h[2])  # Sort by start_index

        # Build sections from headers
        sections = []
        for i, (section_type, header_text, start_idx, end_idx) in enumerate(headers):
            # Text starts after the header
            text_start = end_idx

            # Text ends at the next header or end of document
            if i + 1 < len(headers):
                text_end = headers[i + 1][2]  # Start of next header
            else:
                text_end = len(job_description)

            section_text = job_description[text_start:text_end].strip()

            if section_text:  # Only add non-empty sections
                sections.append(
                    ParsedSection(
                        type=section_type,
                        text=section_text,
                        start_index=text_start,
                        end_index=text_end,
                        header=header_text.strip(),
                    )
                )

        # Handle text before the first header (often job summary)
        if headers and headers[0][2] > 0:
            preamble = job_description[: headers[0][2]].strip()
            if preamble:
                sections.insert(
                    0,
                    ParsedSection(
                        type="about",
                        text=preamble,
                        start_index=0,
                        end_index=headers[0][2],
                        header=None,
                    ),
                )

        return sections

    def _find_headers(
        self, text: str
    ) -> list[tuple[SectionType, str, int, int]]:
        """
        Find all section headers in the text.

        Returns:
            List of tuples: (section_type, header_text, start_index, end_index)
        """
        headers = []

        # Split into lines for line-by-line header detection
        lines = text.split("\n")
        current_pos = 0

        for line in lines:
            line_start = current_pos
            line_end = current_pos + len(line)

            # Check each section type's patterns
            for section_type, patterns in self._compiled_patterns.items():
                for pattern in patterns:
                    if pattern.match(line):
                        headers.append((section_type, line, line_start, line_end))
                        break
                else:
                    continue
                break  # Found a match, move to next line

            current_pos = line_end + 1  # +1 for newline

        return headers

    def get_importance_for_section(self, section_type: SectionType) -> str:
        """
        Get the keyword importance level for a section type.

        Args:
            section_type: The type of section

        Returns:
            Importance level: "required", "preferred", or "nice_to_have"
        """
        return SECTION_IMPORTANCE_MAP.get(section_type, "preferred")

    def extract_keywords_context(
        self, keyword: str, job_description: str
    ) -> tuple[str | None, SectionType | None]:
        """
        Find the context sentence and section for a keyword.

        Args:
            keyword: The keyword to find
            job_description: The job description text

        Returns:
            Tuple of (context_sentence, section_type) or (None, None) if not found
        """
        sections = self.parse(job_description)

        for section in sections:
            # Split section text into sentences
            sentences = self._split_into_sentences(section.text)

            for sentence in sentences:
                if self._keyword_in_text(keyword, sentence):
                    return (sentence.strip(), section.type)

        return (None, None)

    def _split_into_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        # Simple sentence splitting - handles common cases
        # Preserves bullet points as individual sentences
        sentences = []

        # First, split by bullet points
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if it's a bullet point
            if line.startswith(("-", "*", "•", "·")) or re.match(r"^\d+[\.\)]\s", line):
                sentences.append(line)
            else:
                # Split by sentence-ending punctuation
                sub_sentences = re.split(r"(?<=[.!?])\s+", line)
                sentences.extend(sub_sentences)

        return sentences

    def _keyword_in_text(self, keyword: str, text: str) -> bool:
        """Check if keyword exists in text (case-insensitive, word boundary)."""
        pattern = r"\b" + re.escape(keyword) + r"\b"
        return bool(re.search(pattern, text, re.IGNORECASE))


# ============================================================================
# Convenience Functions
# ============================================================================


def parse_job_description(job_description: str) -> list[ParsedSection]:
    """
    Parse a job description into structured sections.

    Convenience function that creates a parser and parses the text.

    Args:
        job_description: The raw job description text

    Returns:
        List of ParsedSection objects
    """
    parser = JobDescriptionSectionParser()
    return parser.parse(job_description)


def get_section_importance(section_type: SectionType) -> str:
    """
    Get the keyword importance level for a section type.

    Args:
        section_type: The type of section

    Returns:
        Importance level: "required", "preferred", or "nice_to_have"
    """
    return SECTION_IMPORTANCE_MAP.get(section_type, "preferred")
