import json
from typing import TypedDict

from app.services.ai_client import AIClient
from app.services.cache import CacheService
from app.services.resume_parser import ResumeParser, ParsedResume
from app.services.job_analyzer import JobAnalyzer, ParsedJob


class Suggestion(TypedDict):
    section: str  # "experience", "skills", "summary", etc.
    type: str  # "rewrite", "add", "remove", "reorder"
    original: str
    suggested: str
    reason: str
    impact: str  # "high", "medium", "low"


class TailoredContent(TypedDict):
    summary: str
    experience: list[dict]
    skills: list[str]
    highlights: list[str]


class TailoringResult(TypedDict):
    tailored_content: TailoredContent
    suggestions: list[Suggestion]
    match_score: float
    skill_matches: list[str]
    skill_gaps: list[str]
    keyword_coverage: float


TAILORING_SYSTEM_PROMPT = """You are an expert resume tailoring assistant. Your job is to optimize resumes for specific job descriptions.

Given a parsed resume and parsed job description, generate:
1. Tailored content that emphasizes relevant experience
2. Specific suggestions for improvements
3. A match score between 0-100

Output the following JSON structure:
{
  "tailored_content": {
    "summary": "A tailored professional summary highlighting relevant experience for this role",
    "experience": [
      {
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
    "skills": ["Prioritized", "Skills", "List", "Most", "Relevant", "First"],
    "highlights": [
      "Key achievement or experience that directly matches job requirements"
    ]
  },
  "suggestions": [
    {
      "section": "experience",
      "type": "rewrite",
      "original": "Original bullet point text",
      "suggested": "Improved bullet point emphasizing relevant skills",
      "reason": "This change highlights your Python experience which is required",
      "impact": "high"
    }
  ],
  "match_score": 75,
  "skill_matches": ["python", "aws", "docker"],
  "skill_gaps": ["kubernetes", "terraform"],
  "keyword_coverage": 0.68
}

Rules for tailoring:
1. PRESERVE truthfulness - never invent experience or skills the candidate doesn't have
2. REWORD bullet points to emphasize relevant keywords and skills
3. PRIORITIZE experiences most relevant to the job
4. ADD quantifiable metrics where possible (if the resume has them)
5. MATCH the language and keywords used in the job description
6. For the match_score: 0-40 = poor fit, 41-60 = moderate fit, 61-80 = good fit, 81-100 = excellent fit
7. Suggestions should be actionable and specific
8. skill_matches are skills from the job that appear in the resume
9. skill_gaps are required/preferred skills from the job missing from the resume
10. keyword_coverage is the percentage of job keywords found in the resume (0.0 to 1.0)"""


class TailoringService:
    """Service for tailoring resumes to job descriptions."""

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
        resume_id: int,
        job_id: int,
        raw_resume: str,
        raw_job: str,
    ) -> TailoringResult:
        """Tailor a resume to a specific job description."""
        # Get content hashes for caching
        resume_hash = self.resume_parser.get_content_hash(raw_resume)
        job_hash = self.job_analyzer.get_content_hash(raw_job)

        # Check cache for existing tailoring result
        cached = await self.cache.get_tailored_result(
            resume_id, job_id, resume_hash, job_hash
        )
        if cached:
            return cached

        # Parse resume and job (these use their own caching)
        parsed_resume = await self.resume_parser.parse(raw_resume)
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
        parsed_resume: ParsedResume,
        parsed_job: ParsedJob,
    ) -> TailoringResult:
        """Generate tailored content using AI."""
        user_prompt = f"""Please tailor the following resume for the job description.

PARSED RESUME:
{json.dumps(parsed_resume, indent=2)}

PARSED JOB DESCRIPTION:
{json.dumps(parsed_job, indent=2)}

Generate a tailored version that emphasizes relevant experience and skills."""

        response = await self.ai.generate_json(
            system_prompt=TAILORING_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=8192,
        )

        # Parse and validate JSON
        try:
            result = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response if wrapped in markdown
            import re
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                raise ValueError("Failed to parse AI response as JSON")

        return result

    async def get_quick_match_score(
        self,
        raw_resume: str,
        raw_job: str,
    ) -> dict:
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
