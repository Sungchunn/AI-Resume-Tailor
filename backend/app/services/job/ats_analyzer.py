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

# ============================================================
# Stage 3: Content Quality Score Constants
# ============================================================

# Block type weights for content quality scoring
BLOCK_TYPE_WEIGHTS = {
    "achievement": 1.0,     # Achievements are highest value
    "project": 0.85,        # Projects with outcomes
    "responsibility": 0.6,  # Duties without metrics
    "skill": 0.5,           # Skills statements
    "education": 0.4,       # Academic items
    "certification": 0.4,   # Certifications
}

# Quantification patterns (regex) for detecting metrics in bullets
# Based on master plan Stage 3 specification
QUANTIFICATION_PATTERNS = [
    r'\d+\s*%',                                  # Percentages: "40%", "40 %"
    r'\d+\s*percent',                            # "40 percent"
    r'\$[\d,]+(?:\.\d{2})?[KMB]?',               # Currency: "$50K", "$1.2M", "$50,000"
    r'£[\d,]+(?:\.\d{2})?[KMB]?',                # Pounds
    r'€[\d,]+(?:\.\d{2})?[KMB]?',                # Euros
    r'\d+[KMB]\b',                               # Abbreviated amounts: "50K users", "1M"
    r'\d+\+?\s*(?:users?|customers?|clients?|members?|subscribers?|employees?|people|team\s*members?)',  # People metrics
    r'\d+\+?\s*(?:projects?|products?|applications?|systems?|features?|services?)',  # Project counts
    r'\d+[xX]\s*(?:improvement|increase|growth|faster|reduction|better)',  # Multiples: "3x improvement"
    r'(?:increased?|decreased?|improved?|reduced?|grew?|boosted?|cut|saved?|generated?|delivered?|achieved?)\s+(?:by\s+)?\d+',  # Action + number
    r'\d+\+?\s*(?:hours?|days?|weeks?|months?|years?)\b',  # Time metrics
    r'(?:top|first|#?\d+(?:st|nd|rd|th)?)\s+(?:ranking|place|position|performer)',  # Rankings
    r'\d+:\d+\s*(?:ratio|ratio)',                # Ratios like "3:1"
    r'\d+\s*(?:to|out\s+of)\s*\d+',              # Fractions: "4 out of 5", "8 to 10"
]

# Strong action verbs that indicate achievement-oriented content
# Organized by category for better detection
ACTION_VERB_PATTERNS = {
    "leadership": [
        r'\b(?:led|lead|managed|directed|supervised|mentored|coached|guided|coordinated)\b',
    ],
    "achievement": [
        r'\b(?:achieved|accomplished|attained|exceeded|surpassed|delivered|completed|won)\b',
    ],
    "creation": [
        r'\b(?:built|created|designed|developed|established|founded|implemented|launched|initiated)\b',
    ],
    "improvement": [
        r'\b(?:improved|enhanced|optimized|streamlined|accelerated|increased|boosted|reduced|decreased|cut)\b',
    ],
    "analysis": [
        r'\b(?:analyzed|evaluated|assessed|identified|researched|investigated|audited)\b',
    ],
    "influence": [
        r'\b(?:negotiated|persuaded|influenced|collaborated|partnered|presented|communicated)\b',
    ],
}

# Weak/passive phrases that indicate responsibility-style writing (lower quality)
WEAK_PHRASE_PATTERNS = [
    r'\b(?:responsible\s+for|duties\s+included?|assisted\s+with|helped\s+with|worked\s+on|involved\s+in)\b',
    r'\b(?:participated\s+in|contributed\s+to|was\s+part\s+of|tasked\s+with)\b',
]

# Content quality thresholds
QUANTIFICATION_TARGET = 0.5       # 50% of achievement bullets should be quantified
ACHIEVEMENT_RATIO_TARGET = 0.6    # 60% achievement vs responsibility ratio target
ACTION_VERB_THRESHOLD = 0.8       # 80% of bullets should start with action verbs

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


# ============================================================
# Stage 3: Content Quality Score Dataclasses
# ============================================================


@dataclass
class BulletAnalysis:
    """Analysis of a single resume bullet point."""
    text: str
    has_quantification: bool
    has_action_verb: bool
    has_weak_phrase: bool
    action_verb_categories: list[str]  # e.g., ["leadership", "achievement"]
    detected_metrics: list[str]  # Specific metrics found (e.g., "40%", "$1M")
    quality_score: float  # 0-1 individual bullet quality


@dataclass
class BlockTypeAnalysis:
    """Analysis of block types (achievement vs responsibility)."""
    total_bullets: int
    achievement_count: int
    responsibility_count: int
    project_count: int
    other_count: int
    achievement_ratio: float  # 0-1 ratio of achievements
    quality_score: float  # 0-100 score based on achievement ratio


@dataclass
class QuantificationAnalysis:
    """Analysis of quantification density in content."""
    total_bullets: int
    quantified_bullets: int
    quantification_density: float  # 0-1 ratio
    quality_score: float  # 0-100 score
    metrics_found: list[str]  # All metrics extracted
    bullets_needing_metrics: list[str]  # Bullets without metrics (for suggestions)


@dataclass
class ActionVerbAnalysis:
    """Analysis of action verb usage in content."""
    total_bullets: int
    bullets_with_action_verbs: int
    bullets_with_weak_phrases: int
    action_verb_coverage: float  # 0-1 ratio
    weak_phrase_ratio: float  # 0-1 ratio (lower is better)
    quality_score: float  # 0-100 score
    verb_category_distribution: dict[str, int]  # Count by category


@dataclass
class ContentQualityResult:
    """
    Result of Stage 3 content quality analysis.

    Combines:
    - Block type classification (achievement vs responsibility ratio)
    - Quantification density scoring
    - Action verb analysis
    """
    # Overall content quality score (0-100)
    content_quality_score: float

    # Component scores (0-100)
    block_type_score: float
    quantification_score: float
    action_verb_score: float

    # Component weights (how much each contributed)
    block_type_weight: float  # Default 0.4
    quantification_weight: float  # Default 0.35
    action_verb_weight: float  # Default 0.25

    # Detailed analysis
    block_type_analysis: BlockTypeAnalysis
    quantification_analysis: QuantificationAnalysis
    action_verb_analysis: ActionVerbAnalysis

    # Individual bullet analyses
    bullet_analyses: list[BulletAnalysis]

    # Suggestions for improvement
    suggestions: list[str]
    warnings: list[str]

    # Summary stats
    total_bullets_analyzed: int
    high_quality_bullets: int  # Score > 0.7
    low_quality_bullets: int   # Score < 0.4


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

    # ============================================================
    # Stage 3: Content Quality Analysis Methods
    # ============================================================

    def _has_quantification(self, text: str) -> tuple[bool, list[str]]:
        """
        Check if text contains quantified metrics.

        Returns:
            Tuple of (has_quantification, list_of_metrics_found)
        """
        text_lower = text.lower()
        metrics_found = []

        for pattern in QUANTIFICATION_PATTERNS:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                metrics_found.extend(matches)

        # Deduplicate while preserving order
        seen = set()
        unique_metrics = []
        for m in metrics_found:
            m_clean = str(m).strip() if isinstance(m, str) else str(m)
            if m_clean and m_clean not in seen:
                seen.add(m_clean)
                unique_metrics.append(m_clean)

        return len(unique_metrics) > 0, unique_metrics

    def _has_action_verb(self, text: str) -> tuple[bool, list[str]]:
        """
        Check if text starts with or contains strong action verbs.

        Returns:
            Tuple of (has_action_verb, list_of_categories)
        """
        text_lower = text.lower().strip()
        categories_found = []

        for category, patterns in ACTION_VERB_PATTERNS.items():
            for pattern in patterns:
                # Check if bullet starts with action verb (ideal)
                # or contains it anywhere (still counts)
                if re.search(pattern, text_lower, re.IGNORECASE):
                    categories_found.append(category)
                    break  # Only count each category once

        return len(categories_found) > 0, categories_found

    def _has_weak_phrase(self, text: str) -> bool:
        """Check if text contains weak/passive phrases."""
        text_lower = text.lower()
        for pattern in WEAK_PHRASE_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True
        return False

    def _analyze_bullet(self, text: str) -> BulletAnalysis:
        """
        Analyze a single bullet point for quality signals.

        Quality score is calculated as:
        - +0.4 for having quantification
        - +0.3 for having action verb
        - -0.2 for having weak phrases
        - Base of 0.3 for any content
        """
        has_quant, metrics = self._has_quantification(text)
        has_action, verb_categories = self._has_action_verb(text)
        has_weak = self._has_weak_phrase(text)

        # Calculate quality score
        score = 0.3  # Base score for having content
        if has_quant:
            score += 0.4
        if has_action:
            score += 0.3
        if has_weak:
            score -= 0.2

        # Clamp to 0-1 range
        score = max(0.0, min(1.0, score))

        return BulletAnalysis(
            text=text,
            has_quantification=has_quant,
            has_action_verb=has_action,
            has_weak_phrase=has_weak,
            action_verb_categories=verb_categories,
            detected_metrics=metrics,
            quality_score=score,
        )

    def _classify_bullet_type(self, bullet: BulletAnalysis) -> str:
        """
        Classify a bullet as achievement, responsibility, or other.

        Classification heuristics:
        - Achievement: has quantification OR (has action verb + no weak phrases)
        - Responsibility: has weak phrases OR (no quantification + no strong action)
        - Project: has creation verbs but no metrics
        """
        if bullet.has_quantification:
            return "achievement"

        if bullet.has_weak_phrase:
            return "responsibility"

        # Check for achievement-style action verbs
        achievement_categories = {"achievement", "improvement", "leadership"}
        if any(cat in achievement_categories for cat in bullet.action_verb_categories):
            return "achievement"

        # Check for creation verbs (project-style)
        if "creation" in bullet.action_verb_categories:
            return "project"

        # Default to responsibility if no strong signals
        if bullet.has_action_verb:
            return "project"

        return "responsibility"

    def _analyze_block_types(
        self, bullet_analyses: list[BulletAnalysis]
    ) -> BlockTypeAnalysis:
        """
        Analyze the distribution of block types.

        Returns a score based on achievement ratio.
        Target: 60%+ achievements
        """
        if not bullet_analyses:
            return BlockTypeAnalysis(
                total_bullets=0,
                achievement_count=0,
                responsibility_count=0,
                project_count=0,
                other_count=0,
                achievement_ratio=0.0,
                quality_score=0.0,
            )

        achievement_count = 0
        responsibility_count = 0
        project_count = 0
        other_count = 0

        for bullet in bullet_analyses:
            bullet_type = self._classify_bullet_type(bullet)
            if bullet_type == "achievement":
                achievement_count += 1
            elif bullet_type == "responsibility":
                responsibility_count += 1
            elif bullet_type == "project":
                project_count += 1
            else:
                other_count += 1

        total = len(bullet_analyses)
        # Count achievements + projects as "high value" content
        high_value_count = achievement_count + project_count
        achievement_ratio = high_value_count / total if total > 0 else 0.0

        # Score based on achievement ratio
        # 60%+ achievements = 100, 40% = 70, 20% = 40, 0% = 10
        if achievement_ratio >= ACHIEVEMENT_RATIO_TARGET:
            quality_score = 100.0
        else:
            # Linear interpolation from 10 to 100 based on ratio
            quality_score = 10 + (achievement_ratio / ACHIEVEMENT_RATIO_TARGET) * 90

        return BlockTypeAnalysis(
            total_bullets=total,
            achievement_count=achievement_count,
            responsibility_count=responsibility_count,
            project_count=project_count,
            other_count=other_count,
            achievement_ratio=achievement_ratio,
            quality_score=round(quality_score, 1),
        )

    def _analyze_quantification(
        self, bullet_analyses: list[BulletAnalysis]
    ) -> QuantificationAnalysis:
        """
        Analyze quantification density across all bullets.

        Target: 50%+ of bullets should contain metrics.
        """
        if not bullet_analyses:
            return QuantificationAnalysis(
                total_bullets=0,
                quantified_bullets=0,
                quantification_density=0.0,
                quality_score=0.0,
                metrics_found=[],
                bullets_needing_metrics=[],
            )

        quantified_count = 0
        all_metrics: list[str] = []
        bullets_needing_metrics: list[str] = []

        for bullet in bullet_analyses:
            if bullet.has_quantification:
                quantified_count += 1
                all_metrics.extend(bullet.detected_metrics)
            else:
                # Only suggest adding metrics to achievement-style bullets
                if bullet.has_action_verb and not bullet.has_weak_phrase:
                    # Truncate for suggestion
                    truncated = bullet.text[:100] + "..." if len(bullet.text) > 100 else bullet.text
                    bullets_needing_metrics.append(truncated)

        total = len(bullet_analyses)
        density = quantified_count / total if total > 0 else 0.0

        # Score based on quantification density
        # 50%+ = 100, 25% = 60, 0% = 20
        if density >= QUANTIFICATION_TARGET:
            quality_score = 100.0
        else:
            quality_score = 20 + (density / QUANTIFICATION_TARGET) * 80

        return QuantificationAnalysis(
            total_bullets=total,
            quantified_bullets=quantified_count,
            quantification_density=round(density, 3),
            quality_score=round(quality_score, 1),
            metrics_found=all_metrics[:20],  # Limit to top 20 metrics
            bullets_needing_metrics=bullets_needing_metrics[:5],  # Limit suggestions
        )

    def _analyze_action_verbs(
        self, bullet_analyses: list[BulletAnalysis]
    ) -> ActionVerbAnalysis:
        """
        Analyze action verb usage and weak phrase presence.

        Target: 80%+ bullets should have action verbs,
                <20% should have weak phrases.
        """
        if not bullet_analyses:
            return ActionVerbAnalysis(
                total_bullets=0,
                bullets_with_action_verbs=0,
                bullets_with_weak_phrases=0,
                action_verb_coverage=0.0,
                weak_phrase_ratio=0.0,
                quality_score=0.0,
                verb_category_distribution={},
            )

        action_verb_count = 0
        weak_phrase_count = 0
        category_counts: dict[str, int] = {}

        for bullet in bullet_analyses:
            if bullet.has_action_verb:
                action_verb_count += 1
                for cat in bullet.action_verb_categories:
                    category_counts[cat] = category_counts.get(cat, 0) + 1

            if bullet.has_weak_phrase:
                weak_phrase_count += 1

        total = len(bullet_analyses)
        action_coverage = action_verb_count / total if total > 0 else 0.0
        weak_ratio = weak_phrase_count / total if total > 0 else 0.0

        # Calculate quality score
        # Action verb coverage: 80%+ = full points
        action_score = min(1.0, action_coverage / ACTION_VERB_THRESHOLD)
        # Penalty for weak phrases: each 10% reduces score by 10 points
        weak_penalty = weak_ratio * 100

        quality_score = (action_score * 100) - weak_penalty
        quality_score = max(0.0, min(100.0, quality_score))

        return ActionVerbAnalysis(
            total_bullets=total,
            bullets_with_action_verbs=action_verb_count,
            bullets_with_weak_phrases=weak_phrase_count,
            action_verb_coverage=round(action_coverage, 3),
            weak_phrase_ratio=round(weak_ratio, 3),
            quality_score=round(quality_score, 1),
            verb_category_distribution=category_counts,
        )

    def _generate_content_quality_suggestions(
        self,
        block_analysis: BlockTypeAnalysis,
        quant_analysis: QuantificationAnalysis,
        action_analysis: ActionVerbAnalysis,
        bullet_analyses: list[BulletAnalysis],
    ) -> tuple[list[str], list[str]]:
        """Generate suggestions and warnings based on content quality analysis."""
        suggestions: list[str] = []
        warnings: list[str] = []

        # Block type suggestions
        if block_analysis.achievement_ratio < 0.4:
            warnings.append(
                f"Only {block_analysis.achievement_ratio:.0%} of your bullets show measurable achievements. "
                "ATS systems and recruiters favor achievement-oriented content over responsibility lists."
            )
            suggestions.append(
                "Reframe responsibility bullets as achievements by adding outcomes: "
                "'Managed team' → 'Led team of 5 engineers to deliver project 2 weeks ahead of schedule'"
            )

        # Quantification suggestions
        if quant_analysis.quantification_density < QUANTIFICATION_TARGET:
            density_pct = quant_analysis.quantification_density * 100
            target_pct = QUANTIFICATION_TARGET * 100
            warnings.append(
                f"Only {density_pct:.0f}% of your bullets contain quantified metrics. "
                f"Target is {target_pct:.0f}%+ for optimal ATS performance."
            )

            if quant_analysis.bullets_needing_metrics:
                suggestions.append(
                    "Add metrics to these bullets: Consider percentages (%), dollar amounts ($), "
                    "counts (users, projects), or time savings."
                )
                # Add specific examples
                for bullet in quant_analysis.bullets_needing_metrics[:3]:
                    suggestions.append(f"  → \"{bullet}\" - add a measurable outcome")

        # Action verb suggestions
        if action_analysis.action_verb_coverage < 0.6:
            warnings.append(
                f"Only {action_analysis.action_verb_coverage:.0%} of your bullets start with strong action verbs. "
                "Begin bullets with impactful verbs like 'Led', 'Built', 'Increased', 'Delivered'."
            )

        if action_analysis.weak_phrase_ratio > 0.2:
            warnings.append(
                f"{action_analysis.weak_phrase_ratio:.0%} of your bullets contain weak phrases "
                "like 'Responsible for' or 'Assisted with'. Replace with action-oriented language."
            )
            suggestions.append(
                "Replace weak phrases: 'Responsible for managing' → 'Managed', "
                "'Helped with development' → 'Developed'"
            )

        # Verb category diversity suggestion
        if action_analysis.verb_category_distribution:
            dominant_category = max(
                action_analysis.verb_category_distribution.items(),
                key=lambda x: x[1],
                default=(None, 0),
            )
            total_verbs = sum(action_analysis.verb_category_distribution.values())
            if dominant_category[1] > 0.6 * total_verbs:
                suggestions.append(
                    f"Your bullets heavily use '{dominant_category[0]}' verbs. "
                    "Consider diversifying with verbs from other categories "
                    "(leadership, achievement, improvement, analysis)."
                )

        # Positive feedback for good scores
        if block_analysis.quality_score >= 80:
            suggestions.append("Your achievement/responsibility ratio is excellent.")

        if quant_analysis.quality_score >= 80:
            suggestions.append(
                f"Strong quantification: {quant_analysis.quantified_bullets}/{quant_analysis.total_bullets} "
                "bullets contain measurable metrics."
            )

        return suggestions, warnings

    def analyze_content_quality(
        self,
        parsed_resume: dict[str, Any],
        block_type_weight: float = 0.4,
        quantification_weight: float = 0.35,
        action_verb_weight: float = 0.25,
    ) -> ContentQualityResult:
        """
        Perform Stage 3 content quality analysis on a resume.

        Analyzes:
        1. Block type distribution (achievement vs responsibility ratio)
        2. Quantification density (percentage of bullets with metrics)
        3. Action verb usage and weak phrase detection

        Args:
            parsed_resume: Structured resume content
            block_type_weight: Weight for block type score (default 0.4)
            quantification_weight: Weight for quantification score (default 0.35)
            action_verb_weight: Weight for action verb score (default 0.25)

        Returns:
            ContentQualityResult with detailed analysis and suggestions
        """
        # Extract all bullet points from experience section
        bullets: list[str] = []

        # Get bullets from experience section
        experiences = parsed_resume.get("experience", [])
        for exp in experiences:
            exp_bullets = exp.get("bullets", [])
            if isinstance(exp_bullets, list):
                bullets.extend([b for b in exp_bullets if isinstance(b, str) and b.strip()])
            # Also check for 'description' field which some parsers use
            description = exp.get("description", "")
            if description and isinstance(description, str):
                # Split description by common bullet indicators
                desc_bullets = re.split(r'[•\-\*\n]', description)
                bullets.extend([b.strip() for b in desc_bullets if b.strip() and len(b.strip()) > 10])

        # Get bullets from projects section
        projects = parsed_resume.get("projects", [])
        for project in projects:
            if isinstance(project, dict):
                proj_bullets = project.get("bullets", [])
                if isinstance(proj_bullets, list):
                    bullets.extend([b for b in proj_bullets if isinstance(b, str) and b.strip()])
                proj_desc = project.get("description", "")
                if proj_desc and isinstance(proj_desc, str):
                    desc_bullets = re.split(r'[•\-\*\n]', proj_desc)
                    bullets.extend([b.strip() for b in desc_bullets if b.strip() and len(b.strip()) > 10])
            elif isinstance(project, str) and project.strip():
                bullets.append(project.strip())

        # Analyze summary if present (lower weight in overall but still analyzed)
        summary = parsed_resume.get("summary", "")
        if summary and isinstance(summary, str):
            # Split summary into sentences for analysis
            summary_sentences = re.split(r'[.!?]', summary)
            # Only include substantial sentences
            bullets.extend([s.strip() for s in summary_sentences if s.strip() and len(s.strip()) > 20])

        # Handle edge case of no bullets
        if not bullets:
            return ContentQualityResult(
                content_quality_score=0.0,
                block_type_score=0.0,
                quantification_score=0.0,
                action_verb_score=0.0,
                block_type_weight=block_type_weight,
                quantification_weight=quantification_weight,
                action_verb_weight=action_verb_weight,
                block_type_analysis=BlockTypeAnalysis(
                    total_bullets=0,
                    achievement_count=0,
                    responsibility_count=0,
                    project_count=0,
                    other_count=0,
                    achievement_ratio=0.0,
                    quality_score=0.0,
                ),
                quantification_analysis=QuantificationAnalysis(
                    total_bullets=0,
                    quantified_bullets=0,
                    quantification_density=0.0,
                    quality_score=0.0,
                    metrics_found=[],
                    bullets_needing_metrics=[],
                ),
                action_verb_analysis=ActionVerbAnalysis(
                    total_bullets=0,
                    bullets_with_action_verbs=0,
                    bullets_with_weak_phrases=0,
                    action_verb_coverage=0.0,
                    weak_phrase_ratio=0.0,
                    quality_score=0.0,
                    verb_category_distribution={},
                ),
                bullet_analyses=[],
                suggestions=["No bullet points found in resume. Add experience bullets to get content quality feedback."],
                warnings=["Unable to analyze content quality: no bullet points detected."],
                total_bullets_analyzed=0,
                high_quality_bullets=0,
                low_quality_bullets=0,
            )

        # Analyze each bullet
        bullet_analyses = [self._analyze_bullet(bullet) for bullet in bullets]

        # Perform component analyses
        block_analysis = self._analyze_block_types(bullet_analyses)
        quant_analysis = self._analyze_quantification(bullet_analyses)
        action_analysis = self._analyze_action_verbs(bullet_analyses)

        # Calculate overall content quality score
        content_quality_score = (
            block_analysis.quality_score * block_type_weight +
            quant_analysis.quality_score * quantification_weight +
            action_analysis.quality_score * action_verb_weight
        )

        # Count high and low quality bullets
        high_quality = sum(1 for b in bullet_analyses if b.quality_score > 0.7)
        low_quality = sum(1 for b in bullet_analyses if b.quality_score < 0.4)

        # Generate suggestions and warnings
        suggestions, warnings = self._generate_content_quality_suggestions(
            block_analysis, quant_analysis, action_analysis, bullet_analyses
        )

        return ContentQualityResult(
            content_quality_score=round(content_quality_score, 1),
            block_type_score=block_analysis.quality_score,
            quantification_score=quant_analysis.quality_score,
            action_verb_score=action_analysis.quality_score,
            block_type_weight=block_type_weight,
            quantification_weight=quantification_weight,
            action_verb_weight=action_verb_weight,
            block_type_analysis=block_analysis,
            quantification_analysis=quant_analysis,
            action_verb_analysis=action_analysis,
            bullet_analyses=bullet_analyses,
            suggestions=suggestions,
            warnings=warnings,
            total_bullets_analyzed=len(bullet_analyses),
            high_quality_bullets=high_quality,
            low_quality_bullets=low_quality,
        )


@lru_cache
def get_ats_analyzer() -> ATSAnalyzer:
    """Get a singleton ATSAnalyzer instance."""
    return ATSAnalyzer()
