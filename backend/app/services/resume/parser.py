import json
import hashlib
import re
from typing import TypedDict

from app.services.ai.client import AIClient
from app.services.ai.response import AIResponse
from app.services.core.cache import CacheService


class ContactInfo(TypedDict, total=False):
    name: str
    email: str
    phone: str
    location: str
    linkedin: str
    github: str
    website: str


class Experience(TypedDict, total=False):
    id: str
    title: str
    company: str
    location: str
    start_date: str
    end_date: str
    bullets: list[str]


class Education(TypedDict, total=False):
    id: str
    degree: str
    institution: str
    location: str
    graduation_date: str
    gpa: str
    honors: list[str]
    minor: str
    relevant_courses: list[str]


class Project(TypedDict, total=False):
    id: str
    name: str
    description: str
    technologies: list[str]
    url: str
    bullets: list[str]
    start_date: str
    end_date: str


class Language(TypedDict, total=False):
    id: str
    language: str
    proficiency: str


class Volunteer(TypedDict, total=False):
    id: str
    role: str
    organization: str
    location: str
    start_date: str
    end_date: str
    description: str
    bullets: list[str]


class Publication(TypedDict, total=False):
    id: str
    title: str
    authors: list[str]
    publication: str
    date: str
    url: str
    doi: str


class Award(TypedDict, total=False):
    id: str
    title: str
    issuer: str
    date: str
    description: str


class Reference(TypedDict, total=False):
    id: str
    name: str
    title: str
    company: str
    email: str
    phone: str
    relationship: str


class Course(TypedDict, total=False):
    id: str
    name: str
    institution: str
    date: str
    description: str


class Membership(TypedDict, total=False):
    id: str
    organization: str
    role: str
    start_date: str
    end_date: str


class Leadership(TypedDict, total=False):
    id: str
    title: str  # Changed from 'role' to align with frontend
    organization: str
    location: str
    start_date: str
    end_date: str
    description: str
    bullets: list[str]


class Certification(TypedDict, total=False):
    id: str
    name: str
    issuer: str
    date: str
    expiry_date: str
    credential_id: str
    url: str


class ParsedResume(TypedDict, total=False):
    contact: ContactInfo
    summary: str
    experience: list[Experience]
    education: list[Education]
    skills: list[str]
    certifications: list[Certification]
    projects: list[Project]
    languages: list[Language]
    volunteer: list[Volunteer]
    publications: list[Publication]
    awards: list[Award]
    interests: str
    references: list[Reference]
    courses: list[Course]
    memberships: list[Membership]
    leadership: list[Leadership]


RESUME_PARSER_SYSTEM_PROMPT = """You are an expert resume parser. Extract structured information from resumes.

Parse the resume into the following JSON structure with all 16 supported sections:

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
      "honors": ["Honor 1", "Honor 2"],
      "minor": "Minor field of study or null",
      "relevant_courses": ["Course 1", "Course 2"]
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Month Year",
      "expiry_date": "Month Year or null",
      "credential_id": "ID or null",
      "url": "verification-url.com or null"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech 1", "Tech 2"],
      "url": "project-url.com or null",
      "bullets": ["Achievement 1", "Achievement 2"],
      "start_date": "Month Year or null",
      "end_date": "Month Year or null"
    }
  ],
  "languages": [
    {
      "language": "Language Name",
      "proficiency": "Native/Fluent/Professional/Conversational/Basic"
    }
  ],
  "volunteer": [
    {
      "role": "Volunteer Role",
      "organization": "Organization Name",
      "location": "City, State",
      "start_date": "Month Year",
      "end_date": "Month Year or Present",
      "description": "Brief description or null",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ],
  "publications": [
    {
      "title": "Publication Title",
      "authors": ["Author 1", "Author 2"],
      "publication": "Journal or Conference Name",
      "date": "Month Year",
      "url": "publication-url.com or null",
      "doi": "DOI or null"
    }
  ],
  "awards": [
    {
      "title": "Award Title",
      "issuer": "Issuing Organization",
      "date": "Month Year",
      "description": "Brief description or null"
    }
  ],
  "interests": "Hobbies, interests, or personal pursuits as a single string or null",
  "references": [
    {
      "name": "Reference Name",
      "title": "Job Title",
      "company": "Company Name",
      "email": "email@example.com or null",
      "phone": "555-555-5555 or null",
      "relationship": "Former Manager/Colleague/etc. or null"
    }
  ],
  "courses": [
    {
      "name": "Course Name",
      "institution": "Provider/Institution",
      "date": "Month Year or null",
      "description": "Brief description or null"
    }
  ],
  "memberships": [
    {
      "organization": "Organization Name",
      "role": "Member/Board Member/etc. or null",
      "start_date": "Month Year or null",
      "end_date": "Month Year or null"
    }
  ],
  "leadership": [
    {
      "title": "Leadership Title",
      "organization": "Organization Name",
      "location": "City, State or null",
      "start_date": "Month Year",
      "end_date": "Month Year or Present",
      "description": "Brief description or null",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ]
}

Rules:
- Extract ALL information present in the resume
- Use null for missing text fields, empty arrays [] for missing list fields
- Preserve the original wording of bullet points exactly
- Parse dates in a consistent format (Month Year)
- If a section doesn't exist in the resume, include it with null or empty array
- Map section headers intelligently: "Work History" → experience, "Honors" → awards, "Professional Affiliations" → memberships, etc.
- Leadership can include club/organization leadership, not just work experience
- Volunteer includes community service, nonprofit work, pro bono activities
- Distinguish between "courses" (professional training) and "education" (formal degrees)"""


class ResumeParser:
    """Service for parsing resumes into structured data."""

    def __init__(self, ai_client: AIClient, cache: CacheService):
        self.ai = ai_client
        self.cache = cache

    def _content_hash(self, content: str) -> str:
        """Generate a hash of the content for cache keys."""
        return hashlib.sha256(content.encode()).hexdigest()

    async def parse(
        self, raw_content: str, return_metrics: bool = False
    ) -> ParsedResume | tuple[ParsedResume, AIResponse | None]:
        """Parse a resume into structured sections.

        Args:
            raw_content: The raw resume text to parse
            return_metrics: If True, return (result, metrics) tuple

        Returns:
            ParsedResume if return_metrics=False, else (ParsedResume, AIResponse | None)
            Metrics are None when result is from cache.
        """
        # Check cache first
        cached = await self.cache.get_parsed_resume(raw_content)
        if cached:
            return (cached, None) if return_metrics else cached

        # Call AI to parse
        ai_response = await self.ai.generate_json_with_metrics(
            system_prompt=RESUME_PARSER_SYSTEM_PROMPT,
            user_prompt=f"Parse the following resume:\n\n{raw_content}",
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
        await self.cache.set_parsed_resume(raw_content, parsed)

        return (parsed, ai_response) if return_metrics else parsed

    def get_content_hash(self, raw_content: str) -> str:
        """Get the content hash for a resume."""
        return self._content_hash(raw_content)
