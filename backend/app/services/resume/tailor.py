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

from app.models.mongo.resume import ParsedContent
from app.services.ai.client import AIClient, AIServiceError
from app.services.core.cache import CacheService
from app.services.resume.parser import ResumeParser, ParsedResume
from app.services.job.analyzer import JobAnalyzer, ParsedJob

logger = logging.getLogger(__name__)


class TailoringValidationError(Exception):
    """Raised when AI output fails Pydantic validation after retries."""

    def __init__(self, message: str, validation_errors: list[dict] | None = None):
        super().__init__(message)
        self.validation_errors = validation_errors or []


class TailoringResult(TypedDict):
    """Result of tailoring a resume.

    Two Copies Architecture:
    - tailored_content: Complete tailored resume (same structure as ParsedContent)
    - No suggestions array - frontend does diffing client-side
    """

    tailored_content: dict[str, Any]  # Complete tailored resume (ParsedContent structure)
    match_score: float
    skill_matches: list[str]
    skill_gaps: list[str]
    keyword_coverage: float


# System prompt for Two Copies architecture
TAILORING_SYSTEM_PROMPT = """You are an expert resume tailoring assistant. Your job is to create a complete, tailored version of a resume for a specific job description.

CRITICAL: You must output the ENTIRE resume as a complete JSON object, not just the changed sections. The output structure must exactly match the input structure.

Output the following JSON structure (this is the ParsedContent schema):
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
      "bullets": [
        "Rewritten bullet emphasizing relevant skills and achievements"
      ]
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
      "honors": ["Honor 1", "Honor 2"]
    }
  ],
  "skills": ["Prioritized", "Skills", "List", "Most", "Relevant", "First"],
  "certifications": ["Certification 1", "Certification 2"],
  "projects": [
    {
      "id": "PRESERVE FROM ORIGINAL",
      "name": "Project Name",
      "description": "Tailored description emphasizing relevant aspects",
      "technologies": ["Tech 1", "Tech 2"],
      "url": "URL or null"
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
1. PRESERVE IDs - Every experience, education, and project entry MUST keep its original ID. This is critical for the frontend to do section-by-section diffing.
2. PRESERVE TRUTHFULNESS - Never invent experience or skills the candidate doesn't have.
3. OUTPUT THE ENTIRE RESUME - Include ALL sections, even unchanged ones. Do not omit any fields.
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
        result = await self._generate_tailoring(parsed_resume, parsed_job)

        # Cache the result
        await self.cache.set_tailored_result(
            resume_id, job_id, resume_hash, job_hash, result
        )

        return result

    async def _generate_tailoring(
        self,
        parsed_resume: dict[str, Any] | ParsedResume,
        parsed_job: ParsedJob,
    ) -> TailoringResult:
        """Generate tailored content using AI with retry logic.

        Two Copies Architecture:
        - Outputs complete resume document
        - Preserves IDs from original
        - Validates against ParsedContent Pydantic model
        - Retries once if validation fails
        """
        # Convert to dict if ParsedResume TypedDict
        if not isinstance(parsed_resume, dict):
            parsed_resume = dict(parsed_resume)

        # Ensure experience/education/projects have IDs for diffing
        parsed_resume = self._ensure_ids(parsed_resume)

        user_prompt = self._build_tailoring_prompt(parsed_resume, parsed_job)

        # First attempt
        try:
            result = await self._attempt_tailoring(user_prompt)
            tailored = self._validate_and_extract(result, parsed_resume)
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
                result = await self._attempt_tailoring(retry_prompt)
                tailored = self._validate_and_extract(result, parsed_resume)
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
    ) -> str:
        """Build the user prompt for tailoring."""
        return f"""Please tailor the following resume for the job description.

IMPORTANT: Output the COMPLETE tailored resume as a JSON object. Preserve ALL IDs exactly as they appear in the original.

ORIGINAL RESUME (ParsedContent structure):
{json.dumps(parsed_resume, indent=2)}

JOB DESCRIPTION:
{json.dumps(parsed_job, indent=2)}

Generate a complete tailored version that:
1. Keeps ALL IDs exactly as they are in the original
2. Rewrites bullets and descriptions to emphasize relevant experience
3. Prioritizes skills that match the job requirements
4. Maintains truthfulness - do not invent experience

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

    async def _attempt_tailoring(self, user_prompt: str) -> dict[str, Any]:
        """Make a single tailoring attempt and parse the response."""
        response = await self.ai.generate_json(
            system_prompt=TAILORING_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=8192,
        )

        # Parse JSON response
        try:
            result = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response if wrapped in markdown
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                raise ValueError(f"Failed to parse AI response as JSON: {response[:200]}...")

        return result

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

        # Add IDs to experience entries if missing
        if "experience" in result and result["experience"]:
            for i, exp in enumerate(result["experience"]):
                if isinstance(exp, dict) and not exp.get("id"):
                    exp["id"] = f"exp-{i}-{uuid.uuid4().hex[:8]}"

        # Add IDs to education entries if missing
        if "education" in result and result["education"]:
            for i, edu in enumerate(result["education"]):
                if isinstance(edu, dict) and not edu.get("id"):
                    edu["id"] = f"edu-{i}-{uuid.uuid4().hex[:8]}"

        # Add IDs to project entries if missing
        if "projects" in result and result["projects"]:
            for i, proj in enumerate(result["projects"]):
                if isinstance(proj, dict) and not proj.get("id"):
                    proj["id"] = f"proj-{i}-{uuid.uuid4().hex[:8]}"

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

        for field in ["experience", "education", "projects"]:
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
