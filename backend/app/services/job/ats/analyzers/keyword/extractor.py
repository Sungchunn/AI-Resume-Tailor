"""
Keyword Extraction.

AI-powered keyword extraction from job descriptions.
"""

import json
from typing import Any

from app.services.ai.client import get_ai_client

from ..base import basic_keyword_extraction


class KeywordExtractor:
    """
    Extracts keywords from job descriptions using AI.

    Handles:
    - Basic keyword extraction (list of keywords)
    - Detailed extraction with importance levels
    - Enhanced extraction with strongly_preferred tier
    """

    def __init__(self):
        self._ai_client = get_ai_client()

    async def extract_keywords(self, job_description: str) -> list[str]:
        """
        Extract important keywords from job description using AI.

        Focuses on:
        - Technical skills (languages, tools, frameworks)
        - Soft skills
        - Required qualifications
        - Industry-specific terms
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
            response = await self._ai_client.generate_json(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords from this job description:\n\n{job_description}",
                max_tokens=500,
            )

            # Parse the response
            keywords = json.loads(response)
            if isinstance(keywords, list):
                return [str(k).strip() for k in keywords if k]
            return []

        except Exception:
            # Fallback to basic keyword extraction
            return basic_keyword_extraction(job_description)

    async def extract_keywords_with_importance(
        self, job_description: str
    ) -> list[dict[str, Any]]:
        """
        Extract keywords with importance levels from job description using AI.

        Returns list of dicts with:
        - keyword: the keyword/phrase
        - importance: "required", "preferred", or "nice_to_have"
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
            response = await self._ai_client.generate_json(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords with importance levels from this job description:\n\n{job_description}",
                max_tokens=1000,
            )

            # Parse the response
            keywords = json.loads(response)
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
                return result
            return []

        except Exception:
            # Fallback to basic extraction with default importance
            basic_keywords = basic_keyword_extraction(job_description)
            return [
                {"keyword": k, "importance": "preferred"}
                for k in basic_keywords
            ]

    async def extract_keywords_with_importance_enhanced(
        self, job_description: str
    ) -> list[dict[str, Any]]:
        """
        Extract keywords with enhanced importance levels from job description.

        Stage 2.4: Includes "strongly_preferred" tier.

        Returns list of dicts with:
        - keyword: the keyword/phrase
        - importance: "required", "strongly_preferred", "preferred", or "nice_to_have"
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
            response = await self._ai_client.generate_json(
                system_prompt=system_prompt,
                user_prompt=f"Extract keywords with importance levels from this job description:\n\n{job_description}",
                max_tokens=1000,
            )

            # Parse the response
            keywords = json.loads(response)
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
                return result
            return []

        except Exception:
            # Fallback to basic extraction with default importance
            basic_keywords = basic_keyword_extraction(job_description)
            return [
                {"keyword": k, "importance": "preferred"}
                for k in basic_keywords
            ]
