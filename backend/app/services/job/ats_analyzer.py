"""
ATS Analyzer Service

Provides HONEST, actionable feedback about ATS (Applicant Tracking System)
compatibility. Does NOT claim universal ATS compatibility (which is impossible
since different ATS systems have different parsing behaviors).

Features:
- Structural analysis (section headers, formatting)
- Keyword coverage analysis with importance levels
- Gap identification (keywords missing from user's experience)
- Actionable suggestions

Implements the IATSAnalyzer protocol from app.core.protocols.
"""

import re
from typing import Any, Literal
from functools import lru_cache
from dataclasses import dataclass

from app.core.protocols import ExperienceBlockData, ATSReportData
from app.services.ai.client import get_ai_client


# Importance level type
KeywordImportance = Literal["required", "preferred", "nice_to_have"]


@dataclass
class KeywordDetail:
    """Detailed information about a keyword."""
    keyword: str
    importance: KeywordImportance
    found_in_resume: bool
    found_in_vault: bool
    frequency_in_job: int  # How many times it appears in job description
    context: str | None  # Sample context from job description


@dataclass
class DetailedKeywordAnalysis:
    """Enhanced keyword analysis with importance grouping."""
    coverage_score: float  # Overall coverage 0-1
    required_coverage: float  # Coverage of required keywords 0-1
    preferred_coverage: float  # Coverage of preferred keywords 0-1

    # Grouped by importance
    required_matched: list[str]
    required_missing: list[str]
    preferred_matched: list[str]
    preferred_missing: list[str]
    nice_to_have_matched: list[str]
    nice_to_have_missing: list[str]

    # Vault availability for missing keywords
    missing_available_in_vault: list[str]
    missing_not_in_vault: list[str]

    # Detailed keyword list
    all_keywords: list[KeywordDetail]

    # Suggestions
    suggestions: list[str]
    warnings: list[str]


class ATSAnalyzer:
    """
    Honest ATS compatibility analysis.

    Does NOT claim to work with all ATS systems.
    Provides structural checks and keyword analysis.
    """

    # Standard resume section names that ATS systems commonly look for
    STANDARD_SECTIONS = {
        "summary": ["summary", "professional summary", "objective", "profile", "about"],
        "experience": ["experience", "work experience", "employment history", "work history", "professional experience"],
        "education": ["education", "academic background", "academic history", "qualifications"],
        "skills": ["skills", "technical skills", "core competencies", "competencies", "expertise"],
        "certifications": ["certifications", "certificates", "professional certifications", "licenses"],
        "projects": ["projects", "key projects", "notable projects"],
    }

    # Common formatting issues that can cause ATS parsing problems
    FORMATTING_WARNINGS = {
        "multiple_columns": "Multi-column layouts can confuse some ATS systems",
        "tables": "Tables may not parse correctly in all ATS systems",
        "headers_footers": "Content in headers/footers may be ignored",
        "graphics": "Images and graphics are typically ignored by ATS",
        "text_boxes": "Text boxes may not be read in the correct order",
        "unusual_fonts": "Unusual fonts may not render correctly",
        "special_characters": "Special characters may cause parsing issues",
    }

    def __init__(self):
        self._ai_client = get_ai_client()

    def analyze_structure(
        self,
        resume_content: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Analyze structural ATS compatibility.

        Checks:
        - Standard section headers present
        - Contact info placement
        - Section organization
        - Potential formatting issues

        Args:
            resume_content: Parsed resume content as dictionary

        Returns:
            {
                "format_score": 0-100,
                "sections_found": [...],
                "sections_missing": [...],
                "warnings": [...],
                "suggestions": [...]
            }
        """
        warnings: list[str] = []
        suggestions: list[str] = []
        sections_found: list[str] = []
        sections_missing: list[str] = []

        # Get all content keys
        content_keys = set(resume_content.keys()) if resume_content else set()
        content_keys_lower = {k.lower() for k in content_keys}

        # Check for standard sections
        for standard_section, aliases in self.STANDARD_SECTIONS.items():
            found = False
            for alias in aliases:
                if alias.lower() in content_keys_lower:
                    found = True
                    sections_found.append(standard_section)
                    break

            if not found:
                sections_missing.append(standard_section)
                if standard_section in ["experience", "education", "skills"]:
                    suggestions.append(
                        f"Consider adding a '{standard_section.title()}' section "
                        f"with a standard header for better ATS parsing"
                    )

        # Check contact info
        contact_fields = {"email", "phone", "name", "location", "linkedin"}
        contact_found = contact_keys_lower = set()

        if "contact" in resume_content:
            contact_data = resume_content.get("contact", {})
            if isinstance(contact_data, dict):
                contact_keys_lower = {k.lower() for k in contact_data.keys()}

        for field in contact_fields:
            if field in contact_keys_lower or field in content_keys_lower:
                contact_found.add(field)

        missing_contact = contact_fields - contact_found
        if "email" in missing_contact:
            warnings.append("No email detected - most ATS require email for contact")
        if "phone" in missing_contact:
            suggestions.append("Consider adding a phone number for recruiter contact")

        # Calculate format score
        total_checks = len(self.STANDARD_SECTIONS) + 2  # sections + email + phone
        passed_checks = len(sections_found) + (1 if "email" not in missing_contact else 0) + (1 if "phone" not in missing_contact else 0)
        format_score = int((passed_checks / total_checks) * 100)

        return {
            "format_score": format_score,
            "sections_found": sections_found,
            "sections_missing": sections_missing,
            "warnings": warnings,
            "suggestions": suggestions,
        }

    async def analyze_keywords(
        self,
        resume_blocks: list[ExperienceBlockData],
        job_description: str,
        vault_blocks: list[ExperienceBlockData],
    ) -> ATSReportData:
        """
        Analyze keyword coverage.

        Provides honest report showing:
        - Keywords matched
        - Keywords missing but available in Vault (user can add these)
        - Keywords missing entirely (user doesn't have this experience)

        Args:
            resume_blocks: Blocks currently in the resume
            job_description: Target job requirements
            vault_blocks: All user's Vault blocks (for gap analysis)

        Returns:
            ATSReportData with keyword analysis
        """
        # Extract keywords from job description
        job_keywords = await self._extract_keywords(job_description)

        # Build text content for comparison
        resume_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in resume_blocks
        ).lower()

        vault_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in vault_blocks
        ).lower()

        # Categorize keywords
        matched_keywords: list[str] = []
        missing_keywords: list[str] = []
        missing_from_vault: list[str] = []

        for keyword in job_keywords:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            if re.search(keyword_pattern, resume_text):
                matched_keywords.append(keyword)
            elif re.search(keyword_pattern, vault_text):
                missing_keywords.append(keyword)  # In vault but not in resume
            else:
                missing_from_vault.append(keyword)  # Not in vault at all

        # Calculate coverage
        total_keywords = len(job_keywords) if job_keywords else 1
        keyword_coverage = len(matched_keywords) / total_keywords

        # Generate suggestions
        suggestions = self._generate_keyword_suggestions(
            missing_keywords, vault_blocks
        )

        # Generate warnings
        warnings: list[str] = []
        if keyword_coverage < 0.3:
            warnings.append(
                "Low keyword match - your resume may not pass ATS keyword filters"
            )
        if len(missing_from_vault) > len(job_keywords) * 0.3:
            warnings.append(
                f"{len(missing_from_vault)} job requirements not found in your experience. "
                "Consider whether this role is a good fit or if you have transferable skills."
            )

        return {
            "format_score": 100,  # Not calculating format here, just keywords
            "keyword_coverage": round(keyword_coverage, 2),
            "matched_keywords": matched_keywords,
            "missing_keywords": missing_keywords,
            "missing_from_vault": missing_from_vault,
            "warnings": warnings,
            "suggestions": suggestions,
        }

    async def _extract_keywords(self, job_description: str) -> list[str]:
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
            import json
            keywords = json.loads(response)
            if isinstance(keywords, list):
                return [str(k).strip() for k in keywords if k]
            return []

        except Exception:
            # Fallback to basic keyword extraction
            return self._basic_keyword_extraction(job_description)

    async def _extract_keywords_with_importance(
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
            import json
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
            basic_keywords = self._basic_keyword_extraction(job_description)
            return [
                {"keyword": k, "importance": "preferred"}
                for k in basic_keywords
            ]

    def _get_keyword_context(
        self, keyword: str, text: str, max_length: int = 100
    ) -> str | None:
        """Extract context around where a keyword appears in text."""
        keyword_lower = keyword.lower()
        text_lower = text.lower()

        idx = text_lower.find(keyword_lower)
        if idx == -1:
            return None

        # Get surrounding context
        start = max(0, idx - 40)
        end = min(len(text), idx + len(keyword) + 40)

        context = text[start:end].strip()
        if start > 0:
            context = "..." + context
        if end < len(text):
            context = context + "..."

        return context

    def _count_keyword_frequency(self, keyword: str, text: str) -> int:
        """Count how many times a keyword appears in text."""
        keyword_lower = keyword.lower()
        keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
        return len(re.findall(keyword_pattern, text.lower()))

    async def analyze_keywords_detailed(
        self,
        resume_blocks: list[ExperienceBlockData],
        job_description: str,
        vault_blocks: list[ExperienceBlockData],
    ) -> DetailedKeywordAnalysis:
        """
        Perform detailed keyword analysis with importance levels.

        Args:
            resume_blocks: Blocks currently in the resume
            job_description: Target job requirements
            vault_blocks: All user's Vault blocks (for gap analysis)

        Returns:
            DetailedKeywordAnalysis with importance-grouped keywords
        """
        # Extract keywords with importance
        keywords_with_importance = await self._extract_keywords_with_importance(
            job_description
        )

        # Build text content for comparison
        resume_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in resume_blocks
        ).lower()

        vault_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in vault_blocks
        ).lower()

        # Categorize keywords
        all_keywords: list[KeywordDetail] = []
        required_matched: list[str] = []
        required_missing: list[str] = []
        preferred_matched: list[str] = []
        preferred_missing: list[str] = []
        nice_to_have_matched: list[str] = []
        nice_to_have_missing: list[str] = []
        missing_available_in_vault: list[str] = []
        missing_not_in_vault: list[str] = []

        for kw_data in keywords_with_importance:
            keyword = kw_data["keyword"]
            importance: KeywordImportance = kw_data["importance"]
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            found_in_resume = bool(re.search(keyword_pattern, resume_text))
            found_in_vault = bool(re.search(keyword_pattern, vault_text))
            frequency = self._count_keyword_frequency(keyword, job_description)
            context = self._get_keyword_context(keyword, job_description)

            all_keywords.append(KeywordDetail(
                keyword=keyword,
                importance=importance,
                found_in_resume=found_in_resume,
                found_in_vault=found_in_vault,
                frequency_in_job=frequency,
                context=context,
            ))

            # Categorize by importance and match status
            if importance == "required":
                if found_in_resume:
                    required_matched.append(keyword)
                else:
                    required_missing.append(keyword)
            elif importance == "preferred":
                if found_in_resume:
                    preferred_matched.append(keyword)
                else:
                    preferred_missing.append(keyword)
            else:  # nice_to_have
                if found_in_resume:
                    nice_to_have_matched.append(keyword)
                else:
                    nice_to_have_missing.append(keyword)

            # Track vault availability for missing keywords
            if not found_in_resume:
                if found_in_vault:
                    missing_available_in_vault.append(keyword)
                else:
                    missing_not_in_vault.append(keyword)

        # Calculate coverage scores
        total_keywords = len(keywords_with_importance)
        total_matched = (
            len(required_matched) + len(preferred_matched) + len(nice_to_have_matched)
        )
        coverage_score = total_matched / total_keywords if total_keywords > 0 else 0

        required_total = len(required_matched) + len(required_missing)
        required_coverage = (
            len(required_matched) / required_total if required_total > 0 else 1.0
        )

        preferred_total = len(preferred_matched) + len(preferred_missing)
        preferred_coverage = (
            len(preferred_matched) / preferred_total if preferred_total > 0 else 1.0
        )

        # Generate suggestions
        suggestions = self._generate_detailed_suggestions(
            required_missing,
            preferred_missing,
            missing_available_in_vault,
            vault_blocks,
        )

        # Generate warnings
        warnings: list[str] = []
        if required_coverage < 0.5:
            warnings.append(
                f"Only {int(required_coverage * 100)}% of required keywords found. "
                "This may significantly reduce your chances."
            )
        if len(missing_not_in_vault) > 5:
            warnings.append(
                f"{len(missing_not_in_vault)} keywords not found in your vault. "
                "Consider if you have transferable skills or if this role is a good fit."
            )

        return DetailedKeywordAnalysis(
            coverage_score=round(coverage_score, 2),
            required_coverage=round(required_coverage, 2),
            preferred_coverage=round(preferred_coverage, 2),
            required_matched=required_matched,
            required_missing=required_missing,
            preferred_matched=preferred_matched,
            preferred_missing=preferred_missing,
            nice_to_have_matched=nice_to_have_matched,
            nice_to_have_missing=nice_to_have_missing,
            missing_available_in_vault=missing_available_in_vault,
            missing_not_in_vault=missing_not_in_vault,
            all_keywords=all_keywords,
            suggestions=suggestions,
            warnings=warnings,
        )

    def _generate_detailed_suggestions(
        self,
        required_missing: list[str],
        preferred_missing: list[str],
        available_in_vault: list[str],
        vault_blocks: list[ExperienceBlockData],
    ) -> list[str]:
        """Generate suggestions for adding missing keywords."""
        suggestions: list[str] = []

        # Prioritize required keywords that are in vault
        priority_keywords = [k for k in required_missing if k in available_in_vault]
        for keyword in priority_keywords[:3]:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
            for block in vault_blocks:
                content = (
                    block.get("content", "") if isinstance(block, dict) else block.content
                )
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"Add '{keyword}' (required) from your {source} experience"
                    )
                    break

        # Then preferred keywords
        preferred_in_vault = [k for k in preferred_missing if k in available_in_vault]
        for keyword in preferred_in_vault[:2]:
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"
            for block in vault_blocks:
                content = (
                    block.get("content", "") if isinstance(block, dict) else block.content
                )
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"Add '{keyword}' (preferred) from your {source} experience"
                    )
                    break

        return suggestions

    def _basic_keyword_extraction(self, text: str) -> list[str]:
        """
        Fallback keyword extraction using pattern matching.
        """
        # Common technical keywords to look for
        tech_patterns = [
            r"\b(Python|Java|JavaScript|TypeScript|C\+\+|C#|Go|Rust|Ruby|PHP|Swift|Kotlin)\b",
            r"\b(AWS|Azure|GCP|Google Cloud|Docker|Kubernetes|K8s)\b",
            r"\b(React|Angular|Vue|Node\.js|Django|Flask|FastAPI|Spring)\b",
            r"\b(SQL|PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch)\b",
            r"\b(CI/CD|DevOps|Agile|Scrum|Git|Jenkins|GitHub Actions)\b",
            r"\b(Machine Learning|ML|AI|Data Science|Deep Learning)\b",
            r"\b(REST|API|GraphQL|Microservices)\b",
            r"\b(Leadership|Management|Communication|Problem.solving)\b",
        ]

        keywords: set[str] = set()

        for pattern in tech_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            keywords.update(match if isinstance(match, str) else match[0] for match in matches)

        return list(keywords)[:25]

    def _generate_keyword_suggestions(
        self,
        missing_keywords: list[str],
        vault_blocks: list[ExperienceBlockData],
    ) -> list[str]:
        """
        Generate actionable suggestions for adding missing keywords.
        """
        suggestions: list[str] = []

        # Find which vault blocks contain the missing keywords
        for keyword in missing_keywords[:5]:  # Limit to top 5
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            for block in vault_blocks:
                content = block.get("content", "") if isinstance(block, dict) else block.content
                if re.search(keyword_pattern, content.lower()):
                    source = (
                        block.get("source_company", "your vault")
                        if isinstance(block, dict)
                        else (block.source_company or "your vault")
                    )
                    suggestions.append(
                        f"Add your '{keyword}' experience from {source}"
                    )
                    break

        return suggestions

    def get_ats_tips(self) -> list[str]:
        """
        Return general ATS optimization tips.
        """
        return [
            "Use standard section headers (Experience, Education, Skills)",
            "Avoid tables, graphics, and multi-column layouts",
            "Use standard fonts (Arial, Calibri, Times New Roman)",
            "Include keywords from the job description naturally in your content",
            "Use full spellings alongside acronyms (e.g., 'Application Programming Interface (API)')",
            "Save your resume as a .docx or .pdf file",
            "Put important information in the main body, not headers/footers",
            "Use standard date formats (MM/YYYY or Month YYYY)",
            "Avoid using text boxes or shapes",
            "Keep formatting simple and consistent",
        ]


@lru_cache
def get_ats_analyzer() -> ATSAnalyzer:
    """Get a singleton ATSAnalyzer instance."""
    return ATSAnalyzer()
