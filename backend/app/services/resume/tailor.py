"""Resume tailoring service using AI.

Two Copies Architecture:
- AI generates a COMPLETE tailored resume document (not individual suggestions)
- Output matches ParsedContent schema from MongoDB resume model
- IDs are preserved from the original for frontend section-by-section diffing
"""

import json
import logging
import re
import uuid
from typing import Any, TypedDict

from pydantic import ValidationError

from app.core.config import get_settings
from app.models.mongo.resume import ParsedContent
from app.services.ai.client import AIClient, AIServiceError
from app.services.ai.response import AIResponse, AccumulatedMetrics
from app.services.core.cache import CacheService
from app.services.resume.parser import ResumeParser, ParsedResume
from app.services.job.analyzer import JobAnalyzer, ParsedJob

logger = logging.getLogger(__name__)


class TailoringValidationError(Exception):
    """Raised when AI output fails Pydantic validation after retries."""

    def __init__(self, message: str, validation_errors: list[dict] | None = None):
        super().__init__(message)
        self.validation_errors = validation_errors or []


class TailoringResult(TypedDict, total=False):
    """Result of tailoring a resume.

    Two Copies Architecture:
    - tailored_content: Complete tailored resume (same structure as ParsedContent)
    - No suggestions array - frontend does diffing client-side
    - ai_metrics: Optional accumulated metrics for usage tracking
    """

    tailored_content: dict[str, Any]  # Complete tailored resume (ParsedContent structure)
    match_score: float
    skill_matches: list[str]
    skill_gaps: list[str]
    keyword_coverage: float
    ai_metrics: AIResponse  # Accumulated metrics for logging (optional)


# System prompt for Two Copies architecture
TAILORING_SYSTEM_PROMPT = """You are an expert resume tailoring assistant. Your job is to create a complete, tailored version of a resume for a specific job description.

CRITICAL: You must output the ENTIRE resume as a complete JSON object, not just the changed sections. The output structure must exactly match the input structure.

Output the following JSON structure (this is the ParsedContent schema with all 16 sections):
{
  "contact": {
    "name": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "linkedin": "string or null",
    "github": "string or null",
    "website": "string or null"
  },
  "summary": "A tailored professional summary highlighting relevant experience for this role",
  "experience": [
    {
      "id": "PRESERVE FROM ORIGINAL - critical for diffing",
      "title": "Job Title",
      "company": "Company",
      "location": "Location",
      "start_date": "Start",
      "end_date": "End",
      "bullets": ["Rewritten bullet emphasizing relevant skills and achievements"]
    }
  ],
  "education": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "degree": "Degree",
      "institution": "Institution",
      "location": "Location",
      "graduation_date": "Date",
      "gpa": "GPA or null",
      "honors": ["Honor 1", "Honor 2"],
      "minor": "Minor or null",
      "relevant_courses": ["Course 1", "Course 2"]
    }
  ],
  "skills": ["Prioritized", "Skills", "List", "Most", "Relevant", "First"],
  "certifications": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Month Year",
      "expiry_date": "Month Year or null",
      "credential_id": "ID or null",
      "url": "URL or null"
    }
  ],
  "projects": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "name": "Project Name",
      "description": "Tailored description emphasizing relevant aspects",
      "technologies": ["Tech 1", "Tech 2"],
      "url": "URL or null",
      "bullets": ["Achievement 1", "Achievement 2"],
      "start_date": "Start or null",
      "end_date": "End or null"
    }
  ],
  "languages": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "language": "Language Name",
      "proficiency": "Proficiency Level"
    }
  ],
  "volunteer": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "role": "Role",
      "organization": "Organization",
      "location": "Location or null",
      "start_date": "Start",
      "end_date": "End",
      "description": "Description or null",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ],
  "publications": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "title": "Title",
      "authors": ["Author 1", "Author 2"],
      "publication": "Journal/Conference",
      "date": "Date",
      "url": "URL or null",
      "doi": "DOI or null"
    }
  ],
  "awards": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "title": "Award Title",
      "issuer": "Issuer",
      "date": "Date",
      "description": "Description or null"
    }
  ],
  "interests": "Hobbies and interests as a string or null",
  "references": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "name": "Name",
      "title": "Title",
      "company": "Company",
      "email": "Email or null",
      "phone": "Phone or null",
      "relationship": "Relationship or null"
    }
  ],
  "courses": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "name": "Course Name",
      "institution": "Institution",
      "date": "Date or null",
      "description": "Description or null"
    }
  ],
  "memberships": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "organization": "Organization",
      "role": "Role or null",
      "start_date": "Start or null",
      "end_date": "End or null"
    }
  ],
  "leadership": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "title": "Title",
      "organization": "Organization",
      "location": "Location or null",
      "start_date": "Start",
      "end_date": "End",
      "description": "Description or null",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ]
}

Also include scoring in a separate object:
{
  "match_score": 75,
  "skill_matches": ["python", "aws", "docker"],
  "skill_gaps": ["kubernetes", "terraform"],
  "keyword_coverage": 0.68
}

Rules for tailoring:
1. PRESERVE IDs - Every entry in experience, education, projects, certifications, languages, volunteer, publications, awards, references, courses, memberships, and leadership MUST keep its original ID. This is critical for frontend diffing.
2. PRESERVE TRUTHFULNESS - Never invent experience or skills the candidate doesn't have.
3. OUTPUT THE ENTIRE RESUME - Include ALL 16 sections, even unchanged ones. Do not omit any fields.
4. REWORD bullet points to emphasize relevant keywords and skills from the job description.
5. PRIORITIZE experiences most relevant to the job (can reorder within sections).
6. MATCH the language and keywords used in the job description where truthful.
7. For match_score: 0-40 = poor fit, 41-60 = moderate fit, 61-80 = good fit, 81-100 = excellent fit.
8. skill_matches are skills from the job that appear in the resume.
9. skill_gaps are required/preferred skills from the job missing from the resume.
10. keyword_coverage is the percentage of job keywords found in the resume (0.0 to 1.0).
11. Keep contact information UNCHANGED - never modify contact details.
12. If a field doesn't exist in the original, keep it null or empty array."""


class TailoringService:
    """Service for tailoring resumes to job descriptions.

    Two Copies Architecture:
    - Generates a COMPLETE tailored resume document
    - Output matches ParsedContent schema
    - IDs preserved for frontend diffing
    """

    def __init__(
        self,
        ai_client: AIClient,
        cache: CacheService,
        resume_parser: ResumeParser,
        job_analyzer: JobAnalyzer,
    ):
        self.ai = ai_client
        self.cache = cache
        self.resume_parser = resume_parser
        self.job_analyzer = job_analyzer

    async def tailor(
        self,
        resume_id: str | int,  # MongoDB ObjectId string or PostgreSQL int
        job_id: str | int,  # Job source ID (always from PostgreSQL)
        raw_resume: str,
        raw_job: str,
        original_parsed: dict[str, Any] | None = None,
        focus_keywords: list[str] | None = None,
    ) -> TailoringResult:
        """Tailor a resume to a specific job description.

        Two Copies Architecture:
        - Takes original_parsed (the structured resume data)
        - Returns complete tailored_content matching the same structure
        - IDs are preserved for frontend diffing

        Args:
            resume_id: The resume's ID
            job_id: The job's ID
            raw_resume: Raw resume text (for parsing if original_parsed not provided)
            raw_job: Raw job description text
            original_parsed: Pre-parsed resume content (preferred - avoids re-parsing)
            focus_keywords: User-selected keywords to emphasize (if None, uses all vault-backed keywords)
        """
        # Get content hashes for caching
        resume_hash = self.resume_parser.get_content_hash(raw_resume)
        job_hash = self.job_analyzer.get_content_hash(raw_job)

        # Check cache for existing tailoring result
        cached = await self.cache.get_tailored_result(
            resume_id, job_id, resume_hash, job_hash
        )
        if cached:
            return cached

        # Use provided parsed content or parse the resume
        if original_parsed:
            parsed_resume = original_parsed
        else:
            parsed_resume = await self.resume_parser.parse(raw_resume)

        # Parse the job description
        parsed_job = await self.job_analyzer.analyze(raw_job)

        # Generate tailored content
        result = await self._generate_tailoring(parsed_resume, parsed_job, focus_keywords)

        # Cache the result
        await self.cache.set_tailored_result(
            resume_id, job_id, resume_hash, job_hash, result
        )

        return result

    async def _generate_tailoring(
        self,
        parsed_resume: dict[str, Any] | ParsedResume,
        parsed_job: ParsedJob,
        focus_keywords: list[str] | None = None,
    ) -> TailoringResult:
        """Generate tailored content using AI with retry logic.

        Two Copies Architecture:
        - Outputs complete resume document
        - Preserves IDs from original
        - Validates against ParsedContent Pydantic model
        - Retries once if validation fails
        - Tracks AI usage metrics for logging

        Args:
            parsed_resume: Structured resume data
            parsed_job: Parsed job description
            focus_keywords: User-selected keywords to emphasize (if None, uses all job keywords)
        """
        # Convert to dict if ParsedResume TypedDict
        if not isinstance(parsed_resume, dict):
            parsed_resume = dict(parsed_resume)

        # Ensure experience/education/projects have IDs for diffing
        parsed_resume = self._ensure_ids(parsed_resume)

        user_prompt = self._build_tailoring_prompt(parsed_resume, parsed_job, focus_keywords)

        # Track metrics across attempts
        accumulated_metrics = AccumulatedMetrics()

        # First attempt
        try:
            result, response = await self._attempt_tailoring(user_prompt)
            accumulated_metrics.add(response)
            tailored = self._validate_and_extract(result, parsed_resume)
            tailored["ai_metrics"] = accumulated_metrics.to_ai_response()
            return tailored
        except (json.JSONDecodeError, ValueError, ValidationError) as first_error:
            logger.warning(
                f"First tailoring attempt failed: {first_error}. Retrying with error context."
            )

            # Build retry prompt with error context
            retry_prompt = self._build_retry_prompt(
                parsed_resume, parsed_job, first_error
            )

            # Second attempt with error feedback
            try:
                result, response = await self._attempt_tailoring(retry_prompt)
                accumulated_metrics.add(response)
                tailored = self._validate_and_extract(result, parsed_resume)
                tailored["ai_metrics"] = accumulated_metrics.to_ai_response()
                logger.info("Tailoring succeeded on retry attempt")
                return tailored
            except (json.JSONDecodeError, ValueError, ValidationError) as second_error:
                logger.error(
                    f"Both tailoring attempts failed. First: {first_error}, Second: {second_error}"
                )
                validation_errors = []
                if isinstance(second_error, ValidationError):
                    validation_errors = second_error.errors()
                raise TailoringValidationError(
                    f"AI output failed validation after retry: {second_error}",
                    validation_errors=validation_errors,
                ) from second_error

    def _build_tailoring_prompt(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: ParsedJob,
        focus_keywords: list[str] | None = None,
    ) -> str:
        """Build the user prompt for tailoring.

        Args:
            parsed_resume: Structured resume data
            parsed_job: Parsed job description
            focus_keywords: User-selected keywords to emphasize (if None, uses all job keywords)
        """
        # Build keyword focus instructions
        keyword_instructions = ""
        if focus_keywords:
            keyword_instructions = f"""
FOCUS KEYWORDS (User-selected skills to emphasize):
{json.dumps(focus_keywords, indent=2)}

CRITICAL: The user has verified they have these specific skills. ONLY emphasize these keywords in the tailored resume. Do NOT add or emphasize skills that are not in this list - doing so would be dishonest.
"""
        else:
            keyword_instructions = """
Note: No specific keywords were selected, so emphasize all skills from the job description that appear in the original resume.
"""

        return f"""Please tailor the following resume for the job description.

IMPORTANT: Output the COMPLETE tailored resume as a JSON object. Preserve ALL IDs exactly as they appear in the original.

ORIGINAL RESUME (ParsedContent structure):
{json.dumps(parsed_resume, indent=2)}

JOB DESCRIPTION:
{json.dumps(parsed_job, indent=2)}
{keyword_instructions}
Generate a complete tailored version that:
1. Keeps ALL IDs exactly as they are in the original
2. Rewrites bullets and descriptions to emphasize relevant experience
3. Prioritizes skills that match the job requirements
4. Maintains truthfulness - do not invent experience or add skills the candidate doesn't have

Output format:
{{
  "tailored_content": {{ ... complete ParsedContent ... }},
  "match_score": number,
  "skill_matches": ["skill1", "skill2"],
  "skill_gaps": ["skill1", "skill2"],
  "keyword_coverage": number
}}"""

    def _build_retry_prompt(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: ParsedJob,
        previous_error: Exception,
    ) -> str:
        """Build a retry prompt that includes error context."""
        error_details = str(previous_error)
        if isinstance(previous_error, ValidationError):
            # Include specific field errors for the model to correct
            error_details = "Pydantic validation errors:\n"
            for err in previous_error.errors():
                loc = " -> ".join(str(x) for x in err["loc"])
                error_details += f"  - Field '{loc}': {err['msg']}\n"

        return f"""Your previous attempt to tailor this resume failed validation.

ERROR FROM PREVIOUS ATTEMPT:
{error_details}

Please try again, ensuring:
1. All fields match the expected ParsedContent schema
2. 'contact' should be an object with optional string fields (name, email, phone, location, linkedin, github, website)
3. 'experience', 'education', 'projects' should be arrays of objects
4. Each experience/education/project entry MUST include its original 'id' field
5. 'skills' and 'certifications' should be arrays of strings
6. 'summary' should be a string or null
7. All string values should be valid strings, not nested objects

ORIGINAL RESUME (ParsedContent structure):
{json.dumps(parsed_resume, indent=2)}

JOB DESCRIPTION:
{json.dumps(parsed_job, indent=2)}

Output format (ensure valid JSON):
{{
  "tailored_content": {{ ... complete ParsedContent ... }},
  "match_score": number,
  "skill_matches": ["skill1", "skill2"],
  "skill_gaps": ["skill1", "skill2"],
  "keyword_coverage": number
}}"""

    async def _attempt_tailoring(
        self, user_prompt: str
    ) -> tuple[dict[str, Any], AIResponse]:
        """Make a single tailoring attempt and parse the response.

        Returns:
            Tuple of (parsed result dict, AIResponse with metrics)
        """
        settings = get_settings()
        ai_response = await self.ai.generate_json_with_metrics(
            system_prompt=TAILORING_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=settings.ai_max_tokens,
        )

        # Parse JSON response
        try:
            result = json.loads(ai_response.content)
        except json.JSONDecodeError:
            # Try to extract JSON from response if wrapped in markdown
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', ai_response.content)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                raise ValueError(f"Failed to parse AI response as JSON: {ai_response.content[:200]}...")

        return result, ai_response

    def _validate_and_extract(
        self,
        result: dict[str, Any],
        original_resume: dict[str, Any],
    ) -> TailoringResult:
        """Validate the result against Pydantic models and extract TailoringResult."""
        # Validate that required fields exist
        if "tailored_content" not in result:
            raise ValueError("AI response missing 'tailored_content' field")

        tailored_dict = result["tailored_content"]

        # Validate against ParsedContent Pydantic model
        # This will raise ValidationError if the structure is invalid
        validated_content = ParsedContent.model_validate(tailored_dict)

        # Convert back to dict for storage (preserves all fields including ids)
        tailored = validated_content.model_dump()

        # Ensure IDs are present (in case AI didn't include them)
        tailored = self._ensure_ids(tailored)

        # Validate IDs were preserved from original
        self._validate_ids_preserved(original_resume, tailored)

        return TailoringResult(
            tailored_content=tailored,
            match_score=result.get("match_score", 0.0),
            skill_matches=result.get("skill_matches", []),
            skill_gaps=result.get("skill_gaps", []),
            keyword_coverage=result.get("keyword_coverage", 0.0),
        )

    def _ensure_ids(self, parsed: dict[str, Any]) -> dict[str, Any]:
        """Ensure all list items have IDs for diffing.

        If items don't have IDs, generate them based on position.
        """
        result = dict(parsed)

        # Map of section names to their ID prefixes
        entry_sections = {
            "experience": "exp",
            "education": "edu",
            "projects": "proj",
            "certifications": "cert",
            "languages": "lang",
            "volunteer": "vol",
            "publications": "pub",
            "awards": "award",
            "references": "ref",
            "courses": "course",
            "memberships": "mem",
            "leadership": "lead",
        }

        for section, prefix in entry_sections.items():
            if section in result and result[section]:
                for i, item in enumerate(result[section]):
                    if isinstance(item, dict) and not item.get("id"):
                        item["id"] = f"{prefix}-{i}-{uuid.uuid4().hex[:8]}"

        return result

    def _validate_ids_preserved(
        self,
        original: dict[str, Any],
        tailored: dict[str, Any],
    ) -> None:
        """Validate that IDs from original are preserved in tailored.

        Logs warnings if IDs are missing (doesn't raise - AI might legitimately
        remove sections in some cases).
        """
        def get_ids(data: dict[str, Any], field: str) -> set[str]:
            items = data.get(field, [])
            if not items:
                return set()
            return {item.get("id") for item in items if isinstance(item, dict) and item.get("id")}

        # All entry-based sections that have IDs
        entry_sections = [
            "experience",
            "education",
            "projects",
            "certifications",
            "languages",
            "volunteer",
            "publications",
            "awards",
            "references",
            "courses",
            "memberships",
            "leadership",
        ]

        for field in entry_sections:
            original_ids = get_ids(original, field)
            tailored_ids = get_ids(tailored, field)

            missing = original_ids - tailored_ids
            if missing:
                logger.warning(
                    f"IDs missing in tailored {field}: {missing}. "
                    "Frontend diffing may be affected."
                )

    async def get_quick_match_score(
        self,
        raw_resume: str,
        raw_job: str,
    ) -> dict[str, Any]:
        """Get a quick match score without full tailoring."""
        parsed_resume = await self.resume_parser.parse(raw_resume)
        parsed_job = await self.job_analyzer.analyze(raw_job)

        # Extract skills from resume
        resume_skills = set(s.lower() for s in parsed_resume.get("skills", []))

        # Extract keywords from job
        job_keywords = set(k.lower() for k in parsed_job.get("keywords", []))
        required_skills = set(
            s["skill"].lower()
            for s in parsed_job.get("skills", [])
            if s.get("importance") == "required"
        )

        # Calculate matches
        keyword_matches = resume_skills & job_keywords
        skill_matches = resume_skills & required_skills
        skill_gaps = required_skills - resume_skills

        # Calculate coverage
        keyword_coverage = (
            len(keyword_matches) / len(job_keywords) if job_keywords else 0
        )
        skill_coverage = (
            len(skill_matches) / len(required_skills) if required_skills else 1
        )

        # Calculate rough match score
        match_score = int((keyword_coverage * 40) + (skill_coverage * 60))

        return {
            "match_score": min(match_score, 100),
            "keyword_coverage": round(keyword_coverage, 2),
            "skill_matches": list(skill_matches),
            "skill_gaps": list(skill_gaps),
        }
