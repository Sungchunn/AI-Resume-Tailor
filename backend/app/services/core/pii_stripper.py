"""
PII Stripper Service

Detects and removes Personally Identifiable Information (PII) from text
before embedding generation. This is CRITICAL for security - embeddings
stored in vector databases must never contain real PII.

Implements the IPIIStripper protocol from app.core.protocols.
"""

import re
from typing import List
from functools import lru_cache

from app.core.protocols import PIIEntityData


class PIIStripper:
    """
    Strip PII before embedding to prevent data leakage.

    Uses regex patterns for common PII types. For production at scale,
    consider using a dedicated NER model (spaCy, presidio, etc.).

    Pattern Types Detected:
    - Email addresses
    - Phone numbers (US and international formats)
    - Social Security Numbers
    - Physical addresses (basic patterns)
    - URLs (which may contain PII)
    - IP addresses
    - Credit card numbers
    - Dates of birth patterns
    """

    # Regex patterns for common PII types
    # Order matters - more specific patterns should come first
    PATTERNS = {
        "ssn": (
            r"\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b",
            "[REDACTED]",
        ),
        "credit_card": (
            r"\b(?:\d{4}[-.\s]?){3}\d{4}\b",
            "[REDACTED]",
        ),
        "email": (
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            "[EMAIL]",
        ),
        "phone": (
            # US phone formats: (123) 456-7890, 123-456-7890, +1 123 456 7890, etc.
            r"\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b",
            "[PHONE]",
        ),
        "phone_intl": (
            # International phone: +44 20 7123 4567, +49 30 1234567
            r"\b\+[0-9]{1,3}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}\b",
            "[PHONE]",
        ),
        "ip_address": (
            r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
            "[IP_ADDRESS]",
        ),
        "url": (
            r"https?://[^\s<>\"]+|www\.[^\s<>\"]+",
            "[URL]",
        ),
        "street_address": (
            # Basic US address pattern: 123 Main St, 456 Oak Avenue, etc.
            r"\b\d{1,5}\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\b",
            "[ADDRESS]",
        ),
        "zip_code": (
            # US ZIP codes: 12345 or 12345-6789
            r"\b\d{5}(?:-\d{4})?\b",
            "[ZIP]",
        ),
        "date_of_birth": (
            # DOB patterns: 01/15/1990, 1990-01-15, January 15, 1990
            r"\b(?:DOB|Date of Birth|Birth Date|Born)[:\s]*[\d/\-\s,A-Za-z]+\b",
            "[DOB]",
        ),
    }

    # Patterns that look for labeled PII (e.g., "Email: john@example.com")
    LABELED_PATTERNS = {
        "labeled_email": (
            r"(?:Email|E-mail|Mail)[:\s]+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}",
            "[EMAIL]",
        ),
        "labeled_phone": (
            r"(?:Phone|Tel|Telephone|Mobile|Cell|Fax)[:\s]+[\d\s\-\(\)\+\.]+",
            "[PHONE]",
        ),
        "labeled_address": (
            r"(?:Address)[:\s]+[A-Za-z0-9\s,\.\-]+(?:\d{5}(?:-\d{4})?)?",
            "[ADDRESS]",
        ),
    }

    def __init__(self):
        """Initialize compiled regex patterns for performance."""
        self._compiled_patterns: dict[str, tuple[re.Pattern, str]] = {}

        # Compile all patterns
        for name, (pattern, replacement) in self.PATTERNS.items():
            self._compiled_patterns[name] = (
                re.compile(pattern, re.IGNORECASE),
                replacement,
            )

        for name, (pattern, replacement) in self.LABELED_PATTERNS.items():
            self._compiled_patterns[name] = (
                re.compile(pattern, re.IGNORECASE),
                replacement,
            )

    def strip(self, text: str) -> str:
        """
        Remove PII from text, replacing with placeholders.

        Replacements:
        - Names → [NAME] (note: name detection requires NER, not regex)
        - Email addresses → [EMAIL]
        - Phone numbers → [PHONE]
        - Physical addresses → [ADDRESS]
        - SSN/Credit Cards → [REDACTED]
        - URLs → [URL]
        - IP Addresses → [IP_ADDRESS]

        Args:
            text: Original text that may contain PII

        Returns:
            Text with PII replaced by type-specific placeholders
        """
        if not text:
            return text

        result = text

        # Apply labeled patterns first (more specific)
        for name in self.LABELED_PATTERNS:
            pattern, replacement = self._compiled_patterns[name]
            result = pattern.sub(replacement, result)

        # Apply general patterns
        for name in self.PATTERNS:
            pattern, replacement = self._compiled_patterns[name]
            result = pattern.sub(replacement, result)

        return result

    def detect(self, text: str) -> List[PIIEntityData]:
        """
        Detect PII entities in text without removing them.

        Useful for displaying warnings to users about PII in their content.

        Args:
            text: Text to scan for PII

        Returns:
            List of detected PII entities with positions and values
        """
        if not text:
            return []

        entities: List[PIIEntityData] = []

        # Check all patterns
        all_patterns = {**self.PATTERNS, **self.LABELED_PATTERNS}

        for name, (pattern_str, _) in all_patterns.items():
            pattern = re.compile(pattern_str, re.IGNORECASE)

            for match in pattern.finditer(text):
                # Map pattern names to PII types
                pii_type = self._get_pii_type(name)

                entities.append(
                    {
                        "type": pii_type,
                        "value": match.group(),
                        "start": match.start(),
                        "end": match.end(),
                    }
                )

        # Sort by position and remove duplicates/overlaps
        entities = self._dedupe_overlapping(entities)

        return entities

    def _get_pii_type(self, pattern_name: str) -> str:
        """Map pattern names to simplified PII type names."""
        type_mapping = {
            "ssn": "ssn",
            "credit_card": "credit_card",
            "email": "email",
            "labeled_email": "email",
            "phone": "phone",
            "phone_intl": "phone",
            "labeled_phone": "phone",
            "ip_address": "ip_address",
            "url": "url",
            "street_address": "address",
            "labeled_address": "address",
            "zip_code": "zip_code",
            "date_of_birth": "dob",
        }
        return type_mapping.get(pattern_name, pattern_name)

    def _dedupe_overlapping(
        self, entities: List[PIIEntityData]
    ) -> List[PIIEntityData]:
        """Remove overlapping entity detections, keeping the longer match."""
        if not entities:
            return []

        # Sort by start position, then by length (descending)
        sorted_entities = sorted(
            entities, key=lambda e: (e["start"], -(e["end"] - e["start"]))
        )

        result: List[PIIEntityData] = []
        last_end = -1

        for entity in sorted_entities:
            # Skip if this entity overlaps with the previous one
            if entity["start"] >= last_end:
                result.append(entity)
                last_end = entity["end"]

        return result

    def strip_for_embedding(self, text: str, title: str | None = None) -> str:
        """
        Strip PII specifically for embedding generation.

        This method is convenience wrapper that handles both content and
        optional title, combining them in a format suitable for embedding.

        Args:
            text: Main content to strip
            title: Optional title to strip and prepend

        Returns:
            PII-stripped text ready for embedding
        """
        stripped_text = self.strip(text)

        if title:
            stripped_title = self.strip(title)
            return f"{stripped_title}\n\n{stripped_text}"

        return stripped_text


@lru_cache
def get_pii_stripper() -> PIIStripper:
    """Get a singleton PIIStripper instance."""
    return PIIStripper()
