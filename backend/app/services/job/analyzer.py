import json
import hashlib
import re
from typing import TypedDict

from app.services.ai.client import AIClient
from app.services.ai.response import AIResponse
from app.services.core.cache import CacheService


class RequiredSkill(TypedDict):
    skill: str
    importance: str  # "required", "preferred", "nice_to_have"
    category: str  # "technical", "soft", "domain"


class Requirement(TypedDict):
    text: str
    type: str  # "experience", "education", "certification", "other"
    years: int | None


class ParsedJob(TypedDict):
    title: str
    company: str
    location: str
    remote_type: str  # "remote", "hybrid", "onsite", "not_specified"
    summary: str
    responsibilities: list[str]
    requirements: list[Requirement]
    skills: list[RequiredSkill]
    benefits: list[str]
    salary_range: str
    keywords: list[str]


JOB_ANALYZER_SYSTEM_PROMPT = """You are an expert job description analyzer. Extract structured information from job postings.

Parse the job description into the following JSON structure:
{
  "title": "Job Title",
  "company": "Company Name",
  "location": "City, State or Remote",
  "remote_type": "remote|hybrid|onsite|not_specified",
  "summary": "Brief summary of the role",
  "responsibilities": [
    "Responsibility 1",
    "Responsibility 2"
  ],
  "requirements": [
    {
      "text": "5+ years of Python experience",
      "type": "experience",
      "years": 5
    },
    {
      "text": "Bachelor's degree in Computer Science",
      "type": "education",
      "years": null
    }
  ],
  "skills": [
    {
      "skill": "Python",
      "importance": "required",
      "category": "technical"
    },
    {
      "skill": "Communication",
      "importance": "required",
      "category": "soft"
    }
  ],
  "benefits": [
    "Health insurance",
    "401k matching"
  ],
  "salary_range": "$120,000 - $150,000",
  "keywords": ["python", "fastapi", "aws", "microservices"]
}

Rules:
- Extract ALL relevant information from the job posting
- Classify skills by importance: "required", "preferred", "nice_to_have"
- Classify skills by category: "technical", "soft", "domain"
- Extract years of experience from requirements when mentioned
- Keywords should be lowercase and include all technical terms, tools, and buzzwords
- Use empty strings for missing text fields
- Use empty arrays for missing list fields"""


class JobAnalyzer:
    """Service for analyzing job descriptions."""

    def __init__(self, ai_client: AIClient, cache: CacheService):
        self.ai = ai_client
        self.cache = cache

    def _content_hash(self, content: str) -> str:
        """Generate a hash of the content for cache keys."""
        return hashlib.sha256(content.encode()).hexdigest()

    async def analyze(
        self, raw_content: str, return_metrics: bool = False
    ) -> ParsedJob | tuple[ParsedJob, AIResponse | None]:
        """Analyze a job description into structured data.

        Args:
            raw_content: The raw job description text to analyze
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            ParsedJob if return_metrics=False, else (ParsedJob, AIResponse | None)
            Metrics are None when result is from cache.
        """
        # Check cache first
        cached = await self.cache.get_parsed_job(raw_content)
        if cached:
            return (cached, None) if return_metrics else cached

        # Call AI to analyze
        ai_response = await self.ai.generate_json_with_metrics(
            system_prompt=JOB_ANALYZER_SYSTEM_PROMPT,
            user_prompt=f"Analyze the following job description:\n\n{raw_content}",
        )

        # Parse and validate JSON
        try:
            parsed = json.loads(ai_response.content)
        except json.JSONDecodeError:
            # Try to extract JSON from response if wrapped in markdown
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', ai_response.content)
            if json_match:
                parsed = json.loads(json_match.group(1))
            else:
                raise ValueError("Failed to parse AI response as JSON")

        # Cache the result
        await self.cache.set_parsed_job(raw_content, parsed)

        return (parsed, ai_response) if return_metrics else parsed

    def get_content_hash(self, raw_content: str) -> str:
        """Get the content hash for a job description."""
        return self._content_hash(raw_content)
