"""
Keyword Extraction.

AI-powered keyword extraction from job descriptions.
"""

import json
import re
from typing import Any, Literal, overload

from app.services.ai.client import get_ai_client
from app.services.ai.response import AIResponse

from ..base import basic_keyword_extraction
from .section_parser import (
    SECTION_IMPORTANCE_MAP,
    JobDescriptionSectionParser,
    ParsedSection,
)


class KeywordExtractor:
    """
    Extracts keywords from job descriptions using AI.

    Handles:
    - Basic keyword extraction (list of keywords)
    - Detailed extraction with importance levels
    - Enhanced extraction with strongly_preferred tier

    The AI client is lazily initialized to allow tests to mock it
    before any actual API calls are made.
    """

    def __init__(self, ai_client=None):
        self._ai_client_instance = ai_client

    @property
    def _ai_client(self):
        """Lazily initialize and return the AI client."""
        if self._ai_client_instance is None:
            self._ai_client_instance = get_ai_client()
        return self._ai_client_instance

    @_ai_client.setter
    def _ai_client(self, value):
        """Allow tests to set a mock AI client."""
        self._ai_client_instance = value

    @overload
    async def extract_keywords(
        self, job_description: str, return_metrics: Literal[False] = False
    ) -> list[str]: ...
    @overload
    async def extract_keywords(
        self, job_description: str, return_metrics: Literal[True]
    ) -> tuple[list[str], AIResponse | None]: ...
    async def extract_keywords(
        self, job_description: str, return_metrics: bool = False
    ) -> list[str] | tuple[list[str], AIResponse | None]:
        """
        Extract important keywords from job description using AI.

        Focuses on:
        - Technical skills (languages, tools, frameworks)
        - Soft skills
        - Required qualifications
        - Industry-specific terms

        Args:
            job_description: The job description text
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            List of keywords if return_metrics=False, else (list, AIResponse | None)
        """
        system_prompt = """You are an expert recruiter analyzing a job description.
Extract the most important keywords that an ATS (Applicant Tracking System) would look for.

Focus on:
1. Hard skills (programming languages, tools, technologies)
2. Soft skills (leadership, communication, etc.)
3. Qualifications and certifications
4. Industry-specific terminology
5. Action verbs and key phrases

Return ONLY a JSON array of keywords, no other text.
Example: ["Python", "AWS", "team leadership", "CI/CD", "Agile"]

Keep the list focused (10-25 most important keywords).
Do not include common words like "experience", "ability", "skills".
"""

        try:
            ai_response = await self._ai_client.generate_json_with_metrics(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords from this job description:\n\n{job_description}",
                max_tokens=500,
            )

            # Parse the response
            keywords = json.loads(ai_response.content)
            if isinstance(keywords, list):
                result = [str(k).strip() for k in keywords if k]
                return (result, ai_response) if return_metrics else result
            return ([], ai_response) if return_metrics else []

        except Exception:
            # Fallback to basic keyword extraction
            fallback = basic_keyword_extraction(job_description)
            return (fallback, None) if return_metrics else fallback

    @overload
    async def extract_keywords_with_importance(
        self, job_description: str, return_metrics: Literal[False] = False
    ) -> list[dict[str, Any]]: ...
    @overload
    async def extract_keywords_with_importance(
        self, job_description: str, return_metrics: Literal[True]
    ) -> tuple[list[dict[str, Any]], AIResponse | None]: ...
    async def extract_keywords_with_importance(
        self, job_description: str, return_metrics: bool = False
    ) -> list[dict[str, Any]] | tuple[list[dict[str, Any]], AIResponse | None]:
        """
        Extract keywords with importance levels from job description using AI.

        Returns list of dicts with:
        - keyword: the keyword/phrase
        - importance: "required", "preferred", or "nice_to_have"

        Args:
            job_description: The job description text
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            List of keyword dicts if return_metrics=False, else (list, AIResponse | None)
        """
        system_prompt = """You are an expert recruiter analyzing a job description.
Extract the most important keywords that an ATS (Applicant Tracking System) would look for.

Categorize each keyword by importance:
- "required": Must-have skills, explicitly stated as required or mandatory
- "preferred": Nice-to-have skills, stated as preferred or bonus
- "nice_to_have": Mentioned but not emphasized, or implied from context

Focus on:
1. Hard skills (programming languages, tools, technologies)
2. Soft skills (leadership, communication, etc.)
3. Qualifications and certifications
4. Industry-specific terminology

Return ONLY a JSON array of objects with "keyword" and "importance" fields.
Example:
[
  {"keyword": "Python", "importance": "required"},
  {"keyword": "AWS", "importance": "preferred"},
  {"keyword": "team leadership", "importance": "nice_to_have"}
]

Keep the list focused (15-30 keywords).
Do not include common generic words like "experience", "ability", "skills".
"""

        try:
            ai_response = await self._ai_client.generate_json_with_metrics(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords with importance levels from this job description:\n\n{job_description}",
                max_tokens=1000,
            )

            # Parse the response
            keywords = json.loads(ai_response.content)
            if isinstance(keywords, list):
                valid_importances = {"required", "preferred", "nice_to_have"}
                result = []
                for k in keywords:
                    if isinstance(k, dict) and "keyword" in k:
                        importance = k.get("importance", "nice_to_have")
                        if importance not in valid_importances:
                            importance = "nice_to_have"
                        result.append({
                            "keyword": str(k["keyword"]).strip(),
                            "importance": importance,
                        })
                return (result, ai_response) if return_metrics else result
            return ([], ai_response) if return_metrics else []

        except Exception:
            # Fallback to basic extraction with default importance
            basic_keywords = basic_keyword_extraction(job_description)
            fallback = [
                {"keyword": k, "importance": "preferred"}
                for k in basic_keywords
            ]
            return (fallback, None) if return_metrics else fallback

    @overload
    async def extract_keywords_with_importance_enhanced(
        self, job_description: str, return_metrics: Literal[False] = False
    ) -> list[dict[str, Any]]: ...
    @overload
    async def extract_keywords_with_importance_enhanced(
        self, job_description: str, return_metrics: Literal[True]
    ) -> tuple[list[dict[str, Any]], AIResponse | None]: ...
    async def extract_keywords_with_importance_enhanced(
        self, job_description: str, return_metrics: bool = False
    ) -> list[dict[str, Any]] | tuple[list[dict[str, Any]], AIResponse | None]:
        """
        Extract keywords with enhanced importance levels from job description.

        Stage 2.4: Includes "strongly_preferred" tier.

        Returns list of dicts with:
        - keyword: the keyword/phrase
        - importance: "required", "strongly_preferred", "preferred", or "nice_to_have"

        Args:
            job_description: The job description text
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            List of keyword dicts if return_metrics=False, else (list, AIResponse | None)
        """
        system_prompt = """You are an expert recruiter analyzing a job description.
Extract the most important keywords that an ATS (Applicant Tracking System) would look for.

Categorize each keyword by importance:
- "required": Must-have skills, explicitly stated as required, mandatory, or "must have"
- "strongly_preferred": Strongly emphasized, stated as "strongly preferred", "highly desired", or "ideal candidate has"
- "preferred": Nice-to-have skills, stated as preferred, bonus, or "plus"
- "nice_to_have": Mentioned but not emphasized, or implied from context

Focus on:
1. Hard skills (programming languages, tools, technologies)
2. Soft skills (leadership, communication, etc.)
3. Qualifications and certifications
4. Industry-specific terminology

Return ONLY a JSON array of objects with "keyword" and "importance" fields.
Example:
[
  {"keyword": "Python", "importance": "required"},
  {"keyword": "AWS", "importance": "strongly_preferred"},
  {"keyword": "Docker", "importance": "preferred"},
  {"keyword": "team leadership", "importance": "nice_to_have"}
]

Keep the list focused (15-30 keywords).
Do not include common generic words like "experience", "ability", "skills".
"""

        try:
            ai_response = await self._ai_client.generate_json_with_metrics(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords with importance levels from this job description:\n\n{job_description}",
                max_tokens=1000,
            )

            # Parse the response
            keywords = json.loads(ai_response.content)
            if isinstance(keywords, list):
                valid_importances = {"required", "strongly_preferred", "preferred", "nice_to_have"}
                result = []
                for k in keywords:
                    if isinstance(k, dict) and "keyword" in k:
                        importance = k.get("importance", "nice_to_have")
                        if importance not in valid_importances:
                            importance = "nice_to_have"
                        result.append({
                            "keyword": str(k["keyword"]).strip(),
                            "importance": importance,
                        })
                return (result, ai_response) if return_metrics else result
            return ([], ai_response) if return_metrics else []

        except Exception:
            # Fallback to basic extraction with default importance
            basic_keywords = basic_keyword_extraction(job_description)
            fallback = [
                {"keyword": k, "importance": "preferred"}
                for k in basic_keywords
            ]
            return (fallback, None) if return_metrics else fallback

    async def extract_keywords_with_context(
        self, job_description: str, return_metrics: bool = False
    ) -> list[dict[str, Any]] | tuple[list[dict[str, Any]], AIResponse | None]:
        """
        Extract keywords with context sentences and section-based importance.

        This method combines:
        1. Deterministic section parsing (Requirements vs Nice to Have)
        2. AI-powered keyword extraction
        3. Context sentence extraction for each keyword
        4. Frequency counting

        Returns list of dicts with:
        - keyword: the keyword/phrase
        - importance: "required", "strongly_preferred", "preferred", or "nice_to_have"
        - context: the sentence where the keyword appears
        - source_section: "requirements", "nice_to_have", "responsibilities", etc.
        - frequency: count of occurrences in the JD

        Args:
            job_description: The job description text
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            List of keyword dicts if return_metrics=False, else (list, AIResponse | None)
        """
        # Parse the job description into sections
        parser = JobDescriptionSectionParser()
        sections = parser.parse(job_description)

        # Extract keywords using AI
        ai_keywords, ai_response = await self.extract_keywords_with_importance_enhanced(
            job_description, return_metrics=True
        )

        # Enrich each keyword with context and section info
        enriched_keywords = []
        for kw_data in ai_keywords:
            keyword = kw_data["keyword"]
            ai_importance = kw_data["importance"]

            # Find context and section for this keyword
            context, source_section, frequency = self._find_keyword_context(
                keyword, job_description, sections
            )

            # Determine final importance:
            # - Use section-based importance if found in a clearly defined section
            # - Otherwise use AI-assigned importance
            if source_section and source_section in SECTION_IMPORTANCE_MAP:
                # Section-based importance overrides AI when the section is explicit
                # "requirements" section → required
                # "nice_to_have" section → nice_to_have
                if source_section in ("requirements", "qualifications"):
                    final_importance = "required"
                elif source_section == "nice_to_have":
                    final_importance = "nice_to_have"
                else:
                    # For other sections, trust AI classification
                    final_importance = ai_importance
            else:
                final_importance = ai_importance

            enriched_keywords.append({
                "keyword": keyword,
                "importance": final_importance,
                "context": context,
                "source_section": source_section,
                "frequency": frequency,
            })

        return (enriched_keywords, ai_response) if return_metrics else enriched_keywords

    def _find_keyword_context(
        self,
        keyword: str,
        job_description: str,
        sections: list[ParsedSection],
    ) -> tuple[str | None, str | None, int]:
        """
        Find context sentence, source section, and frequency for a keyword.

        Args:
            keyword: The keyword to find
            job_description: Full job description text
            sections: Parsed sections of the JD

        Returns:
            Tuple of (context_sentence, source_section, frequency)
        """
        # Count total frequency in the full text
        frequency = self._count_keyword_occurrences(keyword, job_description)

        # Find the first occurrence's context and section
        context = None
        source_section = None

        for section in sections:
            sentences = self._split_into_sentences(section.text)
            for sentence in sentences:
                if self._keyword_in_text(keyword, sentence):
                    context = sentence.strip()
                    source_section = section.type
                    break
            if context:
                break

        # If not found in sections, search the full text
        if not context:
            sentences = self._split_into_sentences(job_description)
            for sentence in sentences:
                if self._keyword_in_text(keyword, sentence):
                    context = sentence.strip()
                    source_section = "other"
                    break

        return (context, source_section, frequency)

    def _count_keyword_occurrences(self, keyword: str, text: str) -> int:
        """Count occurrences of a keyword in text (case-insensitive)."""
        pattern = r"\b" + re.escape(keyword) + r"\b"
        matches = re.findall(pattern, text, re.IGNORECASE)
        return len(matches)

    def _split_into_sentences(self, text: str) -> list[str]:
        """Split text into sentences, preserving bullet points."""
        sentences = []
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
