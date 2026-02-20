import json
import hashlib
from typing import TypedDict

from app.services.ai.client import AIClient
from app.services.core.cache import CacheService


class ContactInfo(TypedDict, total=False):
    name: str
    email: str
    phone: str
    location: str
    linkedin: str
    github: str
    website: str


class Experience(TypedDict):
    title: str
    company: str
    location: str
    start_date: str
    end_date: str
    bullets: list[str]


class Education(TypedDict):
    degree: str
    institution: str
    location: str
    graduation_date: str
    gpa: str
    honors: list[str]


class ParsedResume(TypedDict):
    contact: ContactInfo
    summary: str
    experience: list[Experience]
    education: list[Education]
    skills: list[str]
    certifications: list[str]
    projects: list[dict]


RESUME_PARSER_SYSTEM_PROMPT = """You are an expert resume parser. Extract structured information from resumes.

Parse the resume into the following JSON structure:
{
  "contact": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "555-555-5555",
    "location": "City, State",
    "linkedin": "linkedin.com/in/profile",
    "github": "github.com/username",
    "website": "personal-website.com"
  },
  "summary": "Professional summary or objective statement",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "start_date": "Month Year",
      "end_date": "Month Year or Present",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "University Name",
      "location": "City, State",
      "graduation_date": "Month Year",
      "gpa": "3.8/4.0",
      "honors": ["Honor 1", "Honor 2"]
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": ["Certification 1", "Certification 2"],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech 1", "Tech 2"],
      "url": "project-url.com"
    }
  ]
}

Rules:
- Extract ALL information present in the resume
- Use empty strings for missing text fields
- Use empty arrays for missing list fields
- Preserve the original wording of bullet points
- Parse dates in a consistent format (Month Year)
- If a section doesn't exist, include it with empty values"""


class ResumeParser:
    """Service for parsing resumes into structured data."""

    def __init__(self, ai_client: AIClient, cache: CacheService):
        self.ai = ai_client
        self.cache = cache

    def _content_hash(self, content: str) -> str:
        """Generate a hash of the content for cache keys."""
        return hashlib.sha256(content.encode()).hexdigest()

    async def parse(self, raw_content: str) -> ParsedResume:
        """Parse a resume into structured sections."""
        # Check cache first
        cached = await self.cache.get_parsed_resume(raw_content)
        if cached:
            return cached

        # Call AI to parse
        response = await self.ai.generate_json(
            system_prompt=RESUME_PARSER_SYSTEM_PROMPT,
            user_prompt=f"Parse the following resume:\n\n{raw_content}",
        )

        # Parse and validate JSON
        try:
            parsed = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response if wrapped in markdown
            import re
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
            if json_match:
                parsed = json.loads(json_match.group(1))
            else:
                raise ValueError("Failed to parse AI response as JSON")

        # Cache the result
        await self.cache.set_parsed_resume(raw_content, parsed)

        return parsed

    def get_content_hash(self, raw_content: str) -> str:
        """Get the content hash for a resume."""
        return self._content_hash(raw_content)
