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
from dataclasses import dataclass, field
from datetime import datetime
from dateutil.relativedelta import relativedelta
from dateutil import parser as date_parser

from app.core.protocols import ExperienceBlockData, ATSReportData
from app.services.ai.client import get_ai_client


# Importance level type (Stage 2.4 - Enhanced with strongly_preferred)
KeywordImportance = Literal["required", "strongly_preferred", "preferred", "nice_to_have"]

# Section placement weights (Stage 2.1)
# Keywords in experience sections are weighted higher than skills sections
SECTION_PLACEMENT_WEIGHTS = {
    "experience": 1.0,      # Demonstrated experience - highest weight
    "projects": 0.9,        # Applied knowledge
    "skills": 0.7,          # Listed but not demonstrated
    "summary": 0.6,         # Claims without evidence
    "education": 0.5,       # Academic context
    "certifications": 0.5,  # Certifications section
    "other": 0.5,           # Default for unrecognized sections
}

# Density multipliers with diminishing returns (Stage 2.2)
DENSITY_MULTIPLIERS = {
    1: 1.0,
    2: 1.3,
    3: 1.5,
    # 4+ uses 1.5 (capped)
}
DENSITY_CAP = 1.5

# Recency weights by role position (Stage 2.3)
RECENCY_WEIGHTS = {
    0: 2.0,  # Most recent role (index 0)
    1: 2.0,  # Second most recent
    2: 1.0,  # Third most recent
    # Older roles use 0.8
}
RECENCY_DEFAULT = 0.8

# Importance tier weights (Stage 2.4)
IMPORTANCE_WEIGHTS = {
    "required": 3.0,
    "strongly_preferred": 2.0,
    "preferred": 1.5,
    "nice_to_have": 1.0,
}

# Knockout risk types
KnockoutRiskType = Literal[
    "experience_years",
    "education_level",
    "certification",
    "location",
    "work_authorization",
]

# Severity levels for knockout risks
KnockoutSeverity = Literal["critical", "warning", "info"]

# Education level hierarchy (higher number = higher level)
EDUCATION_LEVELS = {
    "none": 0,
    "high_school": 1,
    "associate": 2,
    "bachelors": 3,
    "masters": 4,
    "phd": 5,
    "doctorate": 5,
}

# Patterns for detecting education requirements
EDUCATION_PATTERNS = {
    "phd": [
        r"\bph\.?d\.?\b",
        r"\bdoctorate\b",
        r"\bdoctoral\b",
    ],
    "masters": [
        r"\bmaster'?s?\b",
        r"\bm\.?s\.?\b",
        r"\bm\.?a\.?\b",
        r"\bm\.?b\.?a\.?\b",
        r"\bmsc\b",
    ],
    "bachelors": [
        r"\bbachelor'?s?\b",
        r"\bb\.?s\.?\b",
        r"\bb\.?a\.?\b",
        r"\bundergraduate\b",
        r"\b4[- ]?year\s+degree\b",
    ],
    "associate": [
        r"\bassociate'?s?\b",
        r"\ba\.?s\.?\b",
        r"\b2[- ]?year\s+degree\b",
    ],
}


@dataclass
class KnockoutRisk:
    """A potential knockout risk that may auto-disqualify the candidate."""
    risk_type: KnockoutRiskType
    severity: KnockoutSeverity
    description: str
    job_requires: str
    user_has: str | None = None


@dataclass
class KnockoutCheckResult:
    """Result of the knockout check analysis."""
    passes_all_checks: bool
    risks: list[KnockoutRisk] = field(default_factory=list)
    summary: str = ""
    recommendation: str = ""
    analysis: dict[str, Any] = field(default_factory=dict)


@dataclass
class KeywordMatch:
    """A single match of a keyword in the resume."""
    section: str  # Which section the match was found in
    role_index: int | None  # Index of the role (0 = most recent) if in experience
    text_snippet: str | None  # Snippet around the match


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
class EnhancedKeywordDetail:
    """
    Enhanced keyword detail with Stage 2 scoring components.

    Includes placement weighting, density scoring, recency weighting,
    and importance tier scoring.
    """
    keyword: str
    importance: KeywordImportance
    found_in_resume: bool
    found_in_vault: bool
    frequency_in_job: int  # How many times it appears in job description
    context: str | None  # Sample context from job description

    # Stage 2 enhancements
    matches: list[KeywordMatch] = field(default_factory=list)  # All matches found
    occurrence_count: int = 0  # Total occurrences in resume

    # Calculated scores
    base_score: float = 0.0  # 0 or 1 based on presence
    placement_score: float = 0.0  # Weighted by section (Stage 2.1)
    density_score: float = 0.0  # With diminishing returns (Stage 2.2)
    recency_score: float = 0.0  # Weighted by role position (Stage 2.3)
    importance_weight: float = 1.0  # Importance tier multiplier (Stage 2.4)

    # Final weighted score for this keyword
    weighted_score: float = 0.0


@dataclass
class EnhancedKeywordAnalysis:
    """
    Enhanced keyword analysis with Stage 2 scoring.

    Provides a weighted keyword score that accounts for:
    - Placement: where keywords appear (experience > skills)
    - Density: repetition with diminishing returns
    - Recency: recent roles weighted higher
    - Importance: required keywords weighted higher than preferred
    """
    # Overall scores (0-100)
    keyword_score: float  # Final weighted keyword score
    raw_coverage: float  # Simple coverage (matched/total)

    # Coverage by importance tier (0-1)
    required_coverage: float
    strongly_preferred_coverage: float
    preferred_coverage: float
    nice_to_have_coverage: float

    # Score breakdown
    placement_contribution: float  # How much placement weighting affected score
    density_contribution: float  # How much density scoring affected score
    recency_contribution: float  # How much recency weighting affected score

    # Grouped by importance
    required_matched: list[str]
    required_missing: list[str]
    strongly_preferred_matched: list[str]
    strongly_preferred_missing: list[str]
    preferred_matched: list[str]
    preferred_missing: list[str]
    nice_to_have_matched: list[str]
    nice_to_have_missing: list[str]

    # Vault availability for missing keywords
    missing_available_in_vault: list[str]
    missing_not_in_vault: list[str]

    # Gap analysis with importance tiers
    gap_list: list[dict[str, Any]]  # [{keyword, importance, in_vault, suggestion}]

    # Detailed keyword list
    all_keywords: list[EnhancedKeywordDetail]

    # Suggestions and warnings
    suggestions: list[str]
    warnings: list[str]


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


@dataclass
class SectionOrderResult:
    """Result of section order validation."""
    order_score: int  # 75-100 based on deviation
    detected_order: list[str]  # Sections in the order they appear
    expected_order: list[str]  # The standard expected order
    deviation_type: str  # "standard", "minor", "major", "non_standard"
    issues: list[str]  # Specific order issues found


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

    # Expected section order (some ATS systems like Taleo penalize non-standard ordering)
    # Optional sections are marked but their presence is not required
    EXPECTED_SECTION_ORDER = [
        "contact",       # 1. Contact Information / Header (always first)
        "summary",       # 2. Summary / Objective (optional)
        "experience",    # 3. Work Experience (required)
        "education",     # 4. Education (required)
        "skills",        # 5. Skills
        "certifications",  # 6. Certifications / Awards (optional)
        "projects",      # 7. Projects (optional)
    ]

    # Section order scoring penalties
    SECTION_ORDER_SCORES = {
        "standard": 100,      # Perfect or acceptable order
        "minor": 95,          # Minor deviation (e.g., Skills before Education)
        "major": 85,          # Major deviation (e.g., Education before Experience)
        "non_standard": 75,   # Completely non-standard order
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

    def validate_section_order(
        self,
        resume_content: dict[str, Any],
    ) -> SectionOrderResult:
        """
        Validate section order against expected ATS-friendly ordering.

        Some ATS systems (notably Taleo) penalize non-standard section ordering.
        This method checks if the resume sections appear in the expected order.

        Expected order:
        1. Contact Information / Header
        2. Summary / Objective (optional)
        3. Work Experience
        4. Education
        5. Skills
        6. Certifications / Awards (optional)
        7. Projects (optional)

        Args:
            resume_content: Parsed resume content as dictionary with section keys

        Returns:
            SectionOrderResult with order score and deviation details
        """
        if not resume_content:
            return SectionOrderResult(
                order_score=75,
                detected_order=[],
                expected_order=self.EXPECTED_SECTION_ORDER,
                deviation_type="non_standard",
                issues=["No resume content provided"],
            )

        # Detect which sections are present and their positions
        detected_sections: list[str] = []
        content_keys = list(resume_content.keys())
        content_keys_lower = [k.lower() for k in content_keys]

        # Map each resume key to a standard section name
        for key_lower in content_keys_lower:
            # Check if this is a contact section
            if key_lower == "contact":
                detected_sections.append("contact")
                continue

            # Check against standard section aliases
            for standard_section, aliases in self.STANDARD_SECTIONS.items():
                if key_lower in [a.lower() for a in aliases]:
                    if standard_section not in detected_sections:
                        detected_sections.append(standard_section)
                    break

        # If no sections detected, return non-standard
        if not detected_sections:
            return SectionOrderResult(
                order_score=75,
                detected_order=[],
                expected_order=self.EXPECTED_SECTION_ORDER,
                deviation_type="non_standard",
                issues=["No recognizable sections detected"],
            )

        # Build the expected order for detected sections only
        expected_for_detected = [
            section for section in self.EXPECTED_SECTION_ORDER
            if section in detected_sections
        ]

        # Check for order issues
        issues: list[str] = []
        deviation_type = "standard"

        # Critical order checks
        exp_idx = {section: i for i, section in enumerate(expected_for_detected)}
        det_idx = {section: i for i, section in enumerate(detected_sections)}

        # Check for major deviations
        if "experience" in det_idx and "education" in det_idx:
            if det_idx["education"] < det_idx["experience"]:
                issues.append(
                    "Education appears before Experience - most ATS expect Experience first"
                )
                deviation_type = "major"

        if "contact" in det_idx and det_idx["contact"] != 0:
            issues.append(
                "Contact information should be at the top of the resume"
            )
            if deviation_type != "major":
                deviation_type = "major"

        # Check for minor deviations (if not already major)
        if deviation_type != "major":
            if "skills" in det_idx and "education" in det_idx:
                if det_idx["skills"] < det_idx["education"]:
                    # Skills before Education is acceptable but slightly non-standard
                    issues.append(
                        "Skills appears before Education - acceptable but non-standard"
                    )
                    deviation_type = "minor"

            if "summary" in det_idx and "experience" in det_idx:
                if det_idx["summary"] > det_idx["experience"]:
                    issues.append(
                        "Summary/Objective appears after Experience - should be near the top"
                    )
                    deviation_type = "minor"

        # Check if order matches expected (only if no issues found yet)
        if not issues:
            # Compare detected order against expected
            if detected_sections != expected_for_detected:
                # Check how different they are
                misplaced = 0
                for section in detected_sections:
                    if section in exp_idx and section in det_idx:
                        if exp_idx[section] != det_idx[section]:
                            misplaced += 1

                if misplaced >= 3:
                    deviation_type = "non_standard"
                    issues.append(
                        "Section ordering is significantly different from standard resume format"
                    )
                elif misplaced >= 1:
                    deviation_type = "minor"
                    issues.append(
                        "Section order differs slightly from standard format"
                    )

        # Get the score based on deviation type
        order_score = self.SECTION_ORDER_SCORES.get(deviation_type, 75)

        return SectionOrderResult(
            order_score=order_score,
            detected_order=detected_sections,
            expected_order=expected_for_detected,
            deviation_type=deviation_type,
            issues=issues,
        )

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
        - Section order validation (NEW - Stage 1 enhancement)
        - Potential formatting issues

        Args:
            resume_content: Parsed resume content as dictionary

        Returns:
            {
                "format_score": 0-100,
                "sections_found": [...],
                "sections_missing": [...],
                "section_order_score": 75-100,
                "section_order_details": {
                    "detected_order": [...],
                    "expected_order": [...],
                    "deviation_type": "standard|minor|major|non_standard",
                    "issues": [...]
                },
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

        # Validate section order (Stage 1 enhancement)
        section_order_result = self.validate_section_order(resume_content)

        # Add section order warnings/suggestions
        for issue in section_order_result.issues:
            if section_order_result.deviation_type == "major":
                warnings.append(issue)
            else:
                suggestions.append(issue)

        # Calculate base format score (sections + contact)
        total_checks = len(self.STANDARD_SECTIONS) + 2  # sections + email + phone
        passed_checks = len(sections_found) + (1 if "email" not in missing_contact else 0) + (1 if "phone" not in missing_contact else 0)
        base_format_score = (passed_checks / total_checks) * 100

        # Incorporate section order score into format score
        # Weight: 70% base format score, 30% section order score
        format_score = int(base_format_score * 0.7 + section_order_result.order_score * 0.3)

        return {
            "format_score": format_score,
            "sections_found": sections_found,
            "sections_missing": sections_missing,
            "section_order_score": section_order_result.order_score,
            "section_order_details": {
                "detected_order": section_order_result.detected_order,
                "expected_order": section_order_result.expected_order,
                "deviation_type": section_order_result.deviation_type,
                "issues": section_order_result.issues,
            },
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

    # ============================================================
    # Stage 2: Enhanced Keyword Scoring Methods
    # ============================================================

    def _detect_section_type(self, key: str) -> str:
        """
        Detect the section type from a resume key.

        Maps resume dictionary keys to standard section types for
        placement weighting.
        """
        key_lower = key.lower()

        # Direct matches
        if key_lower in ("experience", "work experience", "employment history",
                         "work history", "professional experience"):
            return "experience"
        if key_lower in ("projects", "key projects", "notable projects"):
            return "projects"
        if key_lower in ("skills", "technical skills", "core competencies",
                         "competencies", "expertise"):
            return "skills"
        if key_lower in ("summary", "professional summary", "objective",
                         "profile", "about"):
            return "summary"
        if key_lower in ("education", "academic background", "academic history",
                         "qualifications"):
            return "education"
        if key_lower in ("certifications", "certificates", "professional certifications",
                         "licenses"):
            return "certifications"

        return "other"

    def _get_placement_weight(self, section: str) -> float:
        """
        Get the placement weight for a section type.

        Stage 2.1: Keywords in experience sections are weighted higher.
        """
        return SECTION_PLACEMENT_WEIGHTS.get(section, SECTION_PLACEMENT_WEIGHTS["other"])

    def _get_density_multiplier(self, occurrence_count: int) -> float:
        """
        Get the density multiplier with diminishing returns.

        Stage 2.2: Multiple occurrences increase score but with caps.
        """
        if occurrence_count <= 0:
            return 0.0
        return DENSITY_MULTIPLIERS.get(occurrence_count, DENSITY_CAP)

    def _get_recency_weight(self, role_index: int | None) -> float:
        """
        Get the recency weight based on role position.

        Stage 2.3: Recent roles are weighted higher.
        """
        if role_index is None:
            return 1.0  # Not in a role, use neutral weight
        return RECENCY_WEIGHTS.get(role_index, RECENCY_DEFAULT)

    def _get_importance_weight(self, importance: KeywordImportance) -> float:
        """
        Get the importance tier weight.

        Stage 2.4: Required keywords weighted higher than preferred.
        """
        return IMPORTANCE_WEIGHTS.get(importance, 1.0)

    def _order_experiences_by_date(
        self,
        experiences: list[dict[str, Any]],
    ) -> list[tuple[int, dict[str, Any]]]:
        """
        Order experience entries by date (most recent first).

        Returns list of (original_index, experience) tuples.
        """
        dated_experiences = []

        for idx, exp in enumerate(experiences):
            end_date_str = exp.get("end_date", "")

            # "Present" or "Current" should be most recent
            if not end_date_str or end_date_str.lower() in (
                "present", "current", "now", "ongoing"
            ):
                # Use a far future date for sorting
                sort_date = datetime(2099, 12, 31)
            else:
                parsed = self._parse_date(end_date_str)
                sort_date = parsed if parsed else datetime(1900, 1, 1)

            dated_experiences.append((idx, sort_date, exp))

        # Sort by date descending (most recent first)
        dated_experiences.sort(key=lambda x: x[1], reverse=True)

        # Return (new_index, exp) where new_index is position after sorting
        return [(i, exp) for i, (_, _, exp) in enumerate(dated_experiences)]

    def _find_keyword_matches_in_structured_resume(
        self,
        keyword: str,
        parsed_resume: dict[str, Any],
    ) -> list[KeywordMatch]:
        """
        Find all matches of a keyword in a structured resume.

        Returns detailed match information including section and role index
        for placement and recency weighting.
        """
        matches: list[KeywordMatch] = []
        keyword_lower = keyword.lower()
        keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

        # Order experiences for recency calculation
        experiences = parsed_resume.get("experience", [])
        if experiences:
            ordered_experiences = self._order_experiences_by_date(experiences)
        else:
            ordered_experiences = []

        # Create a map from experience content to role index
        exp_role_map: dict[int, int] = {}  # original exp index -> recency index
        for recency_idx, (orig_idx, exp) in enumerate(ordered_experiences):
            exp_role_map[orig_idx] = recency_idx

        # Search each section
        for key, value in parsed_resume.items():
            section_type = self._detect_section_type(key)

            if section_type == "experience" and isinstance(value, list):
                # Handle experience section specially for recency
                for orig_idx, exp in enumerate(value):
                    if isinstance(exp, dict):
                        # Check bullets
                        bullets = exp.get("bullets", [])
                        if isinstance(bullets, list):
                            for bullet in bullets:
                                if isinstance(bullet, str) and re.search(
                                    keyword_pattern, bullet.lower()
                                ):
                                    recency_idx = exp_role_map.get(orig_idx, orig_idx)
                                    matches.append(KeywordMatch(
                                        section="experience",
                                        role_index=recency_idx,
                                        text_snippet=bullet[:100] if len(bullet) > 100 else bullet,
                                    ))

                        # Check other text fields in experience
                        for field in ("title", "description", "responsibilities"):
                            field_value = exp.get(field, "")
                            if isinstance(field_value, str) and re.search(
                                keyword_pattern, field_value.lower()
                            ):
                                recency_idx = exp_role_map.get(orig_idx, orig_idx)
                                matches.append(KeywordMatch(
                                    section="experience",
                                    role_index=recency_idx,
                                    text_snippet=field_value[:100] if len(field_value) > 100 else field_value,
                                ))

            elif isinstance(value, str):
                # Simple string field
                if re.search(keyword_pattern, value.lower()):
                    matches.append(KeywordMatch(
                        section=section_type,
                        role_index=None,
                        text_snippet=value[:100] if len(value) > 100 else value,
                    ))

            elif isinstance(value, list):
                # List of items (skills, certifications, etc.)
                for item in value:
                    if isinstance(item, str):
                        if re.search(keyword_pattern, item.lower()):
                            matches.append(KeywordMatch(
                                section=section_type,
                                role_index=None,
                                text_snippet=item[:100] if len(item) > 100 else item,
                            ))
                    elif isinstance(item, dict):
                        # Dict items (education entries, etc.)
                        for field_value in item.values():
                            if isinstance(field_value, str) and re.search(
                                keyword_pattern, field_value.lower()
                            ):
                                matches.append(KeywordMatch(
                                    section=section_type,
                                    role_index=None,
                                    text_snippet=field_value[:100] if len(field_value) > 100 else field_value,
                                ))

            elif isinstance(value, dict):
                # Dict section (contact, etc.)
                for field_value in value.values():
                    if isinstance(field_value, str) and re.search(
                        keyword_pattern, field_value.lower()
                    ):
                        matches.append(KeywordMatch(
                            section=section_type,
                            role_index=None,
                            text_snippet=field_value[:100] if len(field_value) > 100 else field_value,
                        ))

        return matches

    def _calculate_keyword_weighted_score(
        self,
        matches: list[KeywordMatch],
        importance: KeywordImportance,
    ) -> tuple[float, float, float, float]:
        """
        Calculate weighted score for a keyword based on Stage 2 factors.

        Returns:
            (placement_score, density_score, recency_score, final_weighted_score)
        """
        if not matches:
            return (0.0, 0.0, 0.0, 0.0)

        # Stage 2.1: Placement weighting - use best placement
        placement_weights = [self._get_placement_weight(m.section) for m in matches]
        best_placement = max(placement_weights) if placement_weights else 0.0

        # Stage 2.2: Density scoring - count unique matches
        occurrence_count = len(matches)
        density_multiplier = self._get_density_multiplier(occurrence_count)

        # Stage 2.3: Recency weighting - use best recency
        recency_weights = [
            self._get_recency_weight(m.role_index)
            for m in matches
            if m.role_index is not None
        ]
        best_recency = max(recency_weights) if recency_weights else 1.0

        # Stage 2.4: Importance weight
        importance_weight = self._get_importance_weight(importance)

        # Calculate component scores
        placement_score = best_placement
        density_score = density_multiplier
        recency_score = best_recency

        # Final weighted score combines all factors
        # Base of 1.0 (keyword found) * placement * density * recency * importance
        final_score = 1.0 * placement_score * density_score * recency_score * importance_weight

        return (placement_score, density_score, recency_score, final_score)

    async def _extract_keywords_with_importance_enhanced(
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
            import json
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
            basic_keywords = self._basic_keyword_extraction(job_description)
            return [
                {"keyword": k, "importance": "preferred"}
                for k in basic_keywords
            ]

    async def analyze_keywords_enhanced(
        self,
        parsed_resume: dict[str, Any],
        job_description: str,
        vault_blocks: list[ExperienceBlockData],
    ) -> EnhancedKeywordAnalysis:
        """
        Perform enhanced keyword analysis with Stage 2 scoring.

        This method implements the full Stage 2 keyword scoring pipeline:
        - Stage 2.1: Placement weighting (where keywords appear)
        - Stage 2.2: Density scoring (diminishing returns for repetition)
        - Stage 2.3: Recency weighting (recent roles matter more)
        - Stage 2.4: Importance tiers (required > preferred)

        Args:
            parsed_resume: Parsed resume content as structured dictionary
            job_description: Target job requirements text
            vault_blocks: All user's Vault blocks (for gap analysis)

        Returns:
            EnhancedKeywordAnalysis with weighted scores and detailed breakdown
        """
        # Extract keywords with enhanced importance
        keywords_with_importance = await self._extract_keywords_with_importance_enhanced(
            job_description
        )

        # Build vault text for checking availability
        vault_text = " ".join(
            block.get("content", "") if isinstance(block, dict) else block.content
            for block in vault_blocks
        ).lower()

        # Analyze each keyword
        all_keywords: list[EnhancedKeywordDetail] = []

        # Group by importance
        required_matched: list[str] = []
        required_missing: list[str] = []
        strongly_preferred_matched: list[str] = []
        strongly_preferred_missing: list[str] = []
        preferred_matched: list[str] = []
        preferred_missing: list[str] = []
        nice_to_have_matched: list[str] = []
        nice_to_have_missing: list[str] = []

        # Vault availability
        missing_available_in_vault: list[str] = []
        missing_not_in_vault: list[str] = []

        # Gap analysis
        gap_list: list[dict[str, Any]] = []

        # Track totals for score calculation
        total_weighted_score = 0.0
        max_possible_score = 0.0

        # Track contributions for breakdown
        total_placement_contribution = 0.0
        total_density_contribution = 0.0
        total_recency_contribution = 0.0

        for kw_data in keywords_with_importance:
            keyword = kw_data["keyword"]
            importance: KeywordImportance = kw_data["importance"]
            keyword_lower = keyword.lower()
            keyword_pattern = r"\b" + re.escape(keyword_lower) + r"\b"

            # Find matches in resume
            matches = self._find_keyword_matches_in_structured_resume(keyword, parsed_resume)
            found_in_resume = len(matches) > 0

            # Check vault
            found_in_vault = bool(re.search(keyword_pattern, vault_text))

            # Get frequency in job description
            frequency = self._count_keyword_frequency(keyword, job_description)
            context = self._get_keyword_context(keyword, job_description)

            # Calculate weighted scores
            importance_weight = self._get_importance_weight(importance)
            max_possible_score += importance_weight

            if found_in_resume:
                placement_score, density_score, recency_score, weighted_score = (
                    self._calculate_keyword_weighted_score(matches, importance)
                )
                total_weighted_score += weighted_score

                # Track contributions (normalized by importance)
                base_score = importance_weight  # What score would be without enhancements
                if base_score > 0:
                    total_placement_contribution += (placement_score - 1.0) * importance_weight / len(keywords_with_importance)
                    total_density_contribution += (density_score - 1.0) * importance_weight / len(keywords_with_importance)
                    total_recency_contribution += (recency_score - 1.0) * importance_weight / len(keywords_with_importance)
            else:
                placement_score = 0.0
                density_score = 0.0
                recency_score = 0.0
                weighted_score = 0.0

            # Create enhanced keyword detail
            kw_detail = EnhancedKeywordDetail(
                keyword=keyword,
                importance=importance,
                found_in_resume=found_in_resume,
                found_in_vault=found_in_vault,
                frequency_in_job=frequency,
                context=context,
                matches=matches,
                occurrence_count=len(matches),
                base_score=1.0 if found_in_resume else 0.0,
                placement_score=placement_score,
                density_score=density_score,
                recency_score=recency_score,
                importance_weight=importance_weight,
                weighted_score=weighted_score,
            )
            all_keywords.append(kw_detail)

            # Categorize by importance and match status
            if importance == "required":
                if found_in_resume:
                    required_matched.append(keyword)
                else:
                    required_missing.append(keyword)
            elif importance == "strongly_preferred":
                if found_in_resume:
                    strongly_preferred_matched.append(keyword)
                else:
                    strongly_preferred_missing.append(keyword)
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

            # Track vault availability and build gap list for missing keywords
            if not found_in_resume:
                if found_in_vault:
                    missing_available_in_vault.append(keyword)
                    gap_list.append({
                        "keyword": keyword,
                        "importance": importance,
                        "in_vault": True,
                        "suggestion": f"Add '{keyword}' from your vault",
                    })
                else:
                    missing_not_in_vault.append(keyword)
                    gap_list.append({
                        "keyword": keyword,
                        "importance": importance,
                        "in_vault": False,
                        "suggestion": f"Consider gaining experience with '{keyword}'",
                    })

        # Sort gap list by importance (required first)
        importance_order = {"required": 0, "strongly_preferred": 1, "preferred": 2, "nice_to_have": 3}
        gap_list.sort(key=lambda x: importance_order.get(x["importance"], 4))

        # Calculate final scores
        keyword_score = (total_weighted_score / max_possible_score * 100) if max_possible_score > 0 else 0.0

        # Raw coverage (simple matched/total)
        total_matched = len(required_matched) + len(strongly_preferred_matched) + len(preferred_matched) + len(nice_to_have_matched)
        total_keywords = len(keywords_with_importance)
        raw_coverage = (total_matched / total_keywords * 100) if total_keywords > 0 else 0.0

        # Coverage by tier
        required_total = len(required_matched) + len(required_missing)
        required_coverage = len(required_matched) / required_total if required_total > 0 else 1.0

        strongly_preferred_total = len(strongly_preferred_matched) + len(strongly_preferred_missing)
        strongly_preferred_coverage = len(strongly_preferred_matched) / strongly_preferred_total if strongly_preferred_total > 0 else 1.0

        preferred_total = len(preferred_matched) + len(preferred_missing)
        preferred_coverage = len(preferred_matched) / preferred_total if preferred_total > 0 else 1.0

        nice_to_have_total = len(nice_to_have_matched) + len(nice_to_have_missing)
        nice_to_have_coverage = len(nice_to_have_matched) / nice_to_have_total if nice_to_have_total > 0 else 1.0

        # Generate suggestions
        suggestions = self._generate_enhanced_suggestions(
            required_missing,
            strongly_preferred_missing,
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
        if required_coverage < 0.8 and required_total > 0:
            warnings.append(
                f"Missing {len(required_missing)} required keywords. "
                "Focus on adding these to your resume."
            )
        if len(missing_not_in_vault) > 5:
            warnings.append(
                f"{len(missing_not_in_vault)} keywords not found in your vault. "
                "Consider if you have transferable skills or if this role is a good fit."
            )

        return EnhancedKeywordAnalysis(
            keyword_score=round(keyword_score, 1),
            raw_coverage=round(raw_coverage, 1),
            required_coverage=round(required_coverage, 2),
            strongly_preferred_coverage=round(strongly_preferred_coverage, 2),
            preferred_coverage=round(preferred_coverage, 2),
            nice_to_have_coverage=round(nice_to_have_coverage, 2),
            placement_contribution=round(total_placement_contribution * 100, 1),
            density_contribution=round(total_density_contribution * 100, 1),
            recency_contribution=round(total_recency_contribution * 100, 1),
            required_matched=required_matched,
            required_missing=required_missing,
            strongly_preferred_matched=strongly_preferred_matched,
            strongly_preferred_missing=strongly_preferred_missing,
            preferred_matched=preferred_matched,
            preferred_missing=preferred_missing,
            nice_to_have_matched=nice_to_have_matched,
            nice_to_have_missing=nice_to_have_missing,
            missing_available_in_vault=missing_available_in_vault,
            missing_not_in_vault=missing_not_in_vault,
            gap_list=gap_list,
            all_keywords=all_keywords,
            suggestions=suggestions,
            warnings=warnings,
        )

    def _generate_enhanced_suggestions(
        self,
        required_missing: list[str],
        strongly_preferred_missing: list[str],
        preferred_missing: list[str],
        available_in_vault: list[str],
        vault_blocks: list[ExperienceBlockData],
    ) -> list[str]:
        """Generate suggestions prioritized by importance tier."""
        suggestions: list[str] = []

        # Priority 1: Required keywords that are in vault
        priority_required = [k for k in required_missing if k in available_in_vault]
        for keyword in priority_required[:3]:
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
                        f"CRITICAL: Add '{keyword}' (required) from your {source} experience"
                    )
                    break

        # Priority 2: Strongly preferred keywords that are in vault
        priority_strongly_preferred = [k for k in strongly_preferred_missing if k in available_in_vault]
        for keyword in priority_strongly_preferred[:2]:
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
                        f"HIGH: Add '{keyword}' (strongly preferred) from your {source} experience"
                    )
                    break

        # Priority 3: Preferred keywords that are in vault
        priority_preferred = [k for k in preferred_missing if k in available_in_vault]
        for keyword in priority_preferred[:2]:
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

    def perform_knockout_check(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> KnockoutCheckResult:
        """
        Perform knockout check to identify binary disqualifiers.

        This is Stage 0 of the ATS scoring pipeline. It identifies hard
        disqualifiers that would cause automatic rejection by most ATS systems
        BEFORE calculating the actual match score.

        Checks:
        - Years of experience vs. requirement
        - Education level vs. requirement
        - Required certifications
        - Location/work authorization (if extractable)

        Args:
            parsed_resume: ParsedResume dict with experience, education, certifications
            parsed_job: ParsedJob dict with requirements and skills

        Returns:
            KnockoutCheckResult with pass/fail status and risk details
        """
        risks: list[KnockoutRisk] = []
        analysis: dict[str, Any] = {}

        # 1. Check years of experience
        experience_result = self._check_experience_years(parsed_resume, parsed_job)
        analysis["experience"] = experience_result
        if experience_result.get("risk"):
            risks.append(experience_result["risk"])

        # 2. Check education level
        education_result = self._check_education_level(parsed_resume, parsed_job)
        analysis["education"] = education_result
        if education_result.get("risk"):
            risks.append(education_result["risk"])

        # 3. Check required certifications
        certification_result = self._check_certifications(parsed_resume, parsed_job)
        analysis["certifications"] = certification_result
        for risk in certification_result.get("risks", []):
            risks.append(risk)

        # 4. Check location/work authorization
        location_result = self._check_location(parsed_resume, parsed_job)
        analysis["location"] = location_result
        if location_result.get("risk"):
            risks.append(location_result["risk"])

        # Generate summary
        passes_all = len(risks) == 0
        critical_count = sum(1 for r in risks if r.severity == "critical")
        warning_count = sum(1 for r in risks if r.severity == "warning")

        if passes_all:
            summary = "No knockout risks detected. You meet the basic qualifications."
            recommendation = "Proceed with optimizing your resume for keyword matching."
        else:
            parts = []
            if critical_count > 0:
                parts.append(f"{critical_count} critical")
            if warning_count > 0:
                parts.append(f"{warning_count} warning")
            risk_str = ", ".join(parts)
            summary = f"{len(risks)} potential knockout risk(s) detected ({risk_str})."

            if critical_count > 0:
                recommendation = (
                    "Address the critical risks before applying, or consider roles "
                    "better matched to your current qualifications."
                )
            else:
                recommendation = (
                    "These warnings may affect your application. Consider addressing "
                    "them or highlighting transferable qualifications."
                )

        return KnockoutCheckResult(
            passes_all_checks=passes_all,
            risks=risks,
            summary=summary,
            recommendation=recommendation,
            analysis=analysis,
        )

    def _check_experience_years(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Check if candidate's years of experience meet job requirements.

        Calculates total years from resume experience entries and compares
        against the maximum years requirement in the job posting.
        """
        result: dict[str, Any] = {
            "user_years": None,
            "required_years": None,
            "risk": None,
        }

        # Extract required years from job requirements
        required_years = self._extract_required_years(parsed_job)
        result["required_years"] = required_years

        if required_years is None:
            return result  # No years requirement found

        # Calculate user's years of experience from resume
        user_years = self._calculate_experience_years(parsed_resume)
        result["user_years"] = user_years

        if user_years is None:
            # Can't determine user's experience
            result["risk"] = KnockoutRisk(
                risk_type="experience_years",
                severity="warning",
                description=(
                    f"Unable to determine your years of experience. "
                    f"Role requires {required_years}+ years."
                ),
                job_requires=f"{required_years}+ years",
                user_has="Unable to determine",
            )
            return result

        # Compare years
        if user_years < required_years:
            # Determine severity based on the gap
            gap = required_years - user_years
            if gap >= 2 or (required_years >= 5 and user_years < required_years * 0.6):
                severity: KnockoutSeverity = "critical"
            else:
                severity = "warning"

            result["risk"] = KnockoutRisk(
                risk_type="experience_years",
                severity=severity,
                description=(
                    f"Role requires {required_years}+ years of experience, "
                    f"your resume shows ~{user_years:.1f} years."
                ),
                job_requires=f"{required_years}+ years",
                user_has=f"~{user_years:.1f} years",
            )

        return result

    def _extract_required_years(self, parsed_job: dict[str, Any]) -> int | None:
        """Extract the maximum years of experience required from job requirements."""
        requirements = parsed_job.get("requirements", [])
        max_years = None

        for req in requirements:
            if isinstance(req, dict) and req.get("type") == "experience":
                years = req.get("years")
                if years is not None and isinstance(years, (int, float)):
                    if max_years is None or years > max_years:
                        max_years = int(years)

        return max_years

    def _calculate_experience_years(self, parsed_resume: dict[str, Any]) -> float | None:
        """
        Calculate total years of experience from resume.

        Parses start_date and end_date from each experience entry and
        calculates the total duration. Handles "Present" as current date.
        """
        experiences = parsed_resume.get("experience", [])
        if not experiences:
            return None

        total_months = 0
        now = datetime.now()

        for exp in experiences:
            start_date_str = exp.get("start_date", "")
            end_date_str = exp.get("end_date", "")

            if not start_date_str:
                continue

            try:
                start_date = self._parse_date(start_date_str)
                if start_date is None:
                    continue

                # Handle "Present" or similar for end date
                if not end_date_str or end_date_str.lower() in (
                    "present", "current", "now", "ongoing"
                ):
                    end_date = now
                else:
                    end_date = self._parse_date(end_date_str)
                    if end_date is None:
                        end_date = now

                # Calculate months between dates
                if end_date >= start_date:
                    delta = relativedelta(end_date, start_date)
                    months = delta.years * 12 + delta.months
                    total_months += months

            except (ValueError, TypeError):
                continue

        if total_months == 0:
            return None

        return total_months / 12.0

    def _parse_date(self, date_str: str) -> datetime | None:
        """
        Parse various date formats commonly found in resumes.

        Handles formats like:
        - "January 2020", "Jan 2020"
        - "01/2020", "1/2020"
        - "2020-01", "2020/01"
        - "2020"
        """
        if not date_str:
            return None

        date_str = date_str.strip()

        # Skip "present", "current", etc.
        if date_str.lower() in ("present", "current", "now", "ongoing"):
            return None

        try:
            # Try standard dateutil parsing
            return date_parser.parse(date_str, fuzzy=True)
        except (ValueError, TypeError):
            pass

        # Try year-only format
        year_match = re.match(r"^(\d{4})$", date_str)
        if year_match:
            return datetime(int(year_match.group(1)), 1, 1)

        return None

    def _check_education_level(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Check if candidate's education level meets job requirements.

        Compares the highest education level on the resume against
        the minimum required education level in the job posting.
        """
        result: dict[str, Any] = {
            "user_level": None,
            "required_level": None,
            "risk": None,
        }

        # Extract required education level from job
        required_level = self._extract_required_education(parsed_job)
        result["required_level"] = required_level

        if required_level is None or required_level == "none":
            return result  # No education requirement found

        # Get user's highest education level
        user_level = self._get_highest_education(parsed_resume)
        result["user_level"] = user_level

        if user_level is None:
            result["risk"] = KnockoutRisk(
                risk_type="education_level",
                severity="warning",
                description=(
                    f"Unable to determine your education level. "
                    f"Role may require a {required_level.title().replace('_', ' ')} degree."
                ),
                job_requires=f"{required_level.title().replace('_', ' ')} degree",
                user_has="Unable to determine",
            )
            return result

        # Compare levels
        user_level_num = EDUCATION_LEVELS.get(user_level, 0)
        required_level_num = EDUCATION_LEVELS.get(required_level, 0)

        if user_level_num < required_level_num:
            # Determine severity
            level_gap = required_level_num - user_level_num
            if level_gap >= 2:
                severity: KnockoutSeverity = "critical"
            else:
                severity = "warning"

            result["risk"] = KnockoutRisk(
                risk_type="education_level",
                severity=severity,
                description=(
                    f"Role requires a {required_level.title().replace('_', ' ')} degree, "
                    f"your resume shows {user_level.title().replace('_', ' ')}."
                ),
                job_requires=f"{required_level.title().replace('_', ' ')} degree",
                user_has=f"{user_level.title().replace('_', ' ')}",
            )

        return result

    def _extract_required_education(self, parsed_job: dict[str, Any]) -> str | None:
        """Extract the required education level from job requirements."""
        requirements = parsed_job.get("requirements", [])
        highest_required = None
        highest_level_num = 0

        for req in requirements:
            if isinstance(req, dict) and req.get("type") == "education":
                text = req.get("text", "").lower()

                # Check each education level pattern
                for level, patterns in EDUCATION_PATTERNS.items():
                    for pattern in patterns:
                        if re.search(pattern, text, re.IGNORECASE):
                            level_num = EDUCATION_LEVELS.get(level, 0)
                            if level_num > highest_level_num:
                                highest_level_num = level_num
                                highest_required = level
                            break

        return highest_required

    def _get_highest_education(self, parsed_resume: dict[str, Any]) -> str | None:
        """Get the highest education level from resume."""
        education_list = parsed_resume.get("education", [])
        if not education_list:
            return None

        highest_level = None
        highest_level_num = 0

        for edu in education_list:
            degree = edu.get("degree", "").lower()

            # Check each education level pattern
            for level, patterns in EDUCATION_PATTERNS.items():
                for pattern in patterns:
                    if re.search(pattern, degree, re.IGNORECASE):
                        level_num = EDUCATION_LEVELS.get(level, 0)
                        if level_num > highest_level_num:
                            highest_level_num = level_num
                            highest_level = level
                        break

        return highest_level

    def _check_certifications(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Check if candidate has required certifications.

        Compares certifications listed in the resume against
        required certifications from the job posting.
        """
        result: dict[str, Any] = {
            "user_certifications": [],
            "required_certifications": [],
            "matched": [],
            "missing": [],
            "risks": [],
        }

        # Get required certifications from job
        required_certs = self._extract_required_certifications(parsed_job)
        result["required_certifications"] = required_certs

        if not required_certs:
            return result  # No certification requirements

        # Get user's certifications
        user_certs = parsed_resume.get("certifications", [])
        result["user_certifications"] = user_certs

        # Normalize certifications for matching
        user_certs_lower = {cert.lower() for cert in user_certs if cert}
        user_certs_text = " ".join(user_certs_lower)

        matched = []
        missing = []

        for cert_info in required_certs:
            cert_name = cert_info["name"]
            importance = cert_info["importance"]

            # Check for match using fuzzy matching
            if self._cert_matches(cert_name, user_certs_lower, user_certs_text):
                matched.append(cert_name)
            else:
                missing.append({"name": cert_name, "importance": importance})

        result["matched"] = matched
        result["missing"] = [m["name"] for m in missing]

        # Create risks for missing required/preferred certifications
        for missing_cert in missing:
            if missing_cert["importance"] == "required":
                severity: KnockoutSeverity = "critical"
                desc = f"{missing_cert['name']} is listed as required but not found on your resume."
            elif missing_cert["importance"] == "preferred":
                severity = "warning"
                desc = f"{missing_cert['name']} is strongly preferred but not found on your resume."
            else:
                continue  # Don't create risk for nice-to-have

            result["risks"].append(
                KnockoutRisk(
                    risk_type="certification",
                    severity=severity,
                    description=desc,
                    job_requires=f"{missing_cert['name']} ({missing_cert['importance']})",
                    user_has=None,
                )
            )

        return result

    def _extract_required_certifications(
        self, parsed_job: dict[str, Any]
    ) -> list[dict[str, str]]:
        """Extract required and preferred certifications from job."""
        certifications = []

        # Check requirements for certification type
        requirements = parsed_job.get("requirements", [])
        for req in requirements:
            if isinstance(req, dict) and req.get("type") == "certification":
                certifications.append({
                    "name": req.get("text", ""),
                    "importance": "required",
                })

        # Also check skills marked as required/preferred that look like certifications
        skills = parsed_job.get("skills", [])
        cert_patterns = [
            r"\bcertified\b",
            r"\bcertification\b",
            r"\bpmp\b",
            r"\baws\s+(certified|solutions|associate|professional)\b",
            r"\bazure\s+(certified|administrator|developer)\b",
            r"\bgcp\s+(certified|professional)\b",
            r"\bcka\b",  # Certified Kubernetes Administrator
            r"\bckad\b",  # Certified Kubernetes Application Developer
            r"\bcissp\b",
            r"\bcism\b",
            r"\bccna\b",
            r"\bccnp\b",
        ]

        for skill in skills:
            if isinstance(skill, dict):
                skill_name = skill.get("skill", "")
                importance = skill.get("importance", "nice_to_have")

                # Check if this skill looks like a certification
                for pattern in cert_patterns:
                    if re.search(pattern, skill_name, re.IGNORECASE):
                        if importance in ("required", "preferred"):
                            certifications.append({
                                "name": skill_name,
                                "importance": importance,
                            })
                        break

        return certifications

    def _cert_matches(
        self, required_cert: str, user_certs_set: set[str], user_certs_text: str
    ) -> bool:
        """
        Check if a required certification matches any user certification.

        Uses multiple matching strategies:
        1. Exact match (case-insensitive)
        2. Containment match
        3. Abbreviation expansion
        """
        required_lower = required_cert.lower()

        # Direct match
        if required_lower in user_certs_set:
            return True

        # Check if any user cert contains the required cert or vice versa
        for user_cert in user_certs_set:
            if required_lower in user_cert or user_cert in required_lower:
                return True

        # Check common abbreviations
        abbreviations = {
            "aws certified solutions architect": ["aws csa", "solutions architect"],
            "aws certified developer": ["aws developer", "aws dev"],
            "aws certified sysops": ["aws sysops"],
            "pmp": ["project management professional"],
            "cka": ["certified kubernetes administrator", "kubernetes administrator"],
            "ckad": ["certified kubernetes application developer"],
            "cissp": ["certified information systems security professional"],
        }

        for full_name, abbrevs in abbreviations.items():
            if required_lower in full_name or full_name in required_lower:
                for abbrev in abbrevs:
                    if abbrev in user_certs_text:
                        return True
            for abbrev in abbrevs:
                if required_lower in abbrev or abbrev in required_lower:
                    if full_name in user_certs_text:
                        return True

        return False

    def _check_location(
        self,
        parsed_resume: dict[str, Any],
        parsed_job: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Check location compatibility between resume and job.

        This is a simplified check that looks for obvious mismatches.
        """
        result: dict[str, Any] = {
            "user_location": None,
            "job_location": None,
            "remote_type": None,
            "risk": None,
        }

        # Get job location info
        job_location = parsed_job.get("location", "")
        remote_type = parsed_job.get("remote_type", "not_specified")
        result["job_location"] = job_location
        result["remote_type"] = remote_type

        # If remote, no location risk
        if remote_type == "remote":
            return result

        # Get user location from contact info
        contact = parsed_resume.get("contact", {})
        user_location = contact.get("location", "")
        result["user_location"] = user_location

        # If job requires onsite and we can detect a location mismatch
        if remote_type == "onsite" and user_location and job_location:
            # Simple check - if both locations are specified and clearly different
            # This is intentionally conservative to avoid false positives
            user_loc_lower = user_location.lower()
            job_loc_lower = job_location.lower()

            # Extract state/country info for basic comparison
            us_states = [
                "alabama", "alaska", "arizona", "arkansas", "california",
                "colorado", "connecticut", "delaware", "florida", "georgia",
                "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas",
                "kentucky", "louisiana", "maine", "maryland", "massachusetts",
                "michigan", "minnesota", "mississippi", "missouri", "montana",
                "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
                "new york", "north carolina", "north dakota", "ohio", "oklahoma",
                "oregon", "pennsylvania", "rhode island", "south carolina",
                "south dakota", "tennessee", "texas", "utah", "vermont",
                "virginia", "washington", "west virginia", "wisconsin", "wyoming",
                # Common abbreviations
                "ca", "ny", "tx", "fl", "wa", "co", "ma", "il", "pa", "oh",
            ]

            user_state = None
            job_state = None

            for state in us_states:
                if state in user_loc_lower:
                    user_state = state
                if state in job_loc_lower:
                    job_state = state

            # Only flag if we can clearly identify different states
            if (
                user_state and job_state
                and user_state != job_state
                and remote_type == "onsite"
            ):
                result["risk"] = KnockoutRisk(
                    risk_type="location",
                    severity="warning",
                    description=(
                        f"This is an on-site role in {job_location}. "
                        f"Your resume shows {user_location}. "
                        "Confirm you can relocate or commute."
                    ),
                    job_requires=f"On-site in {job_location}",
                    user_has=user_location,
                )

        return result


@lru_cache
def get_ats_analyzer() -> ATSAnalyzer:
    """Get a singleton ATSAnalyzer instance."""
    return ATSAnalyzer()
