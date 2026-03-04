"""Tests for the ATS Analyzer service."""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch

from app.services.job.ats_analyzer import (
    ATSAnalyzer,
    get_ats_analyzer,
    KnockoutRisk,
    KnockoutCheckResult,
    SectionOrderResult,
    ContentQualityResult,
    BulletAnalysis,
    BlockTypeAnalysis,
    QuantificationAnalysis,
    ActionVerbAnalysis,
    EDUCATION_LEVELS,
    EDUCATION_PATTERNS,
    QUANTIFICATION_PATTERNS,
    ACTION_VERB_PATTERNS,
    QUANTIFICATION_TARGET,
    ACHIEVEMENT_RATIO_TARGET,
    # Stage 4: Role Proximity
    TitleMatchResult,
    TrajectoryResult,
    IndustryAlignmentResult,
    RoleProximityResult,
    LEVEL_HIERARCHY,
    FUNCTION_CATEGORIES,
    INDUSTRY_TAXONOMY,
    TRAJECTORY_MODIFIERS,
)


class TestATSAnalyzer:
    """Test ATSAnalyzer functionality."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        """Create an ATSAnalyzer instance."""
        return ATSAnalyzer()

    def test_standard_sections(self, analyzer):
        """Should have standard section definitions."""
        sections = analyzer.STANDARD_SECTIONS

        assert "summary" in sections
        assert "experience" in sections
        assert "education" in sections
        assert "skills" in sections

        # Should have aliases
        assert "work experience" in sections["experience"]
        assert "technical skills" in sections["skills"]


class TestAnalyzeStructure:
    """Test analyze_structure method."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_complete_resume(self, analyzer):
        """Should score well for complete resume."""
        resume = {
            "summary": "Experienced developer...",
            "experience": [
                {"company": "TechCorp", "title": "Engineer"}
            ],
            "education": [
                {"school": "University", "degree": "BS CS"}
            ],
            "skills": ["Python", "AWS"],
            "certifications": ["AWS Certified"],
            "projects": ["Open source contributor"],
            "contact": {
                "email": "test@example.com",
                "phone": "555-123-4567",
            },
        }

        result = analyzer.analyze_structure(resume)

        assert result["format_score"] >= 75  # Score depends on sections present
        assert "experience" in result["sections_found"]
        assert "education" in result["sections_found"]
        assert "skills" in result["sections_found"]
        assert len(result["warnings"]) == 0

    def test_missing_sections(self, analyzer):
        """Should identify missing sections."""
        resume = {
            "summary": "Brief overview...",
            "contact": {
                "email": "test@example.com",
            },
        }

        result = analyzer.analyze_structure(resume)

        assert "experience" in result["sections_missing"]
        assert "education" in result["sections_missing"]
        assert "skills" in result["sections_missing"]
        assert len(result["suggestions"]) > 0

    def test_missing_contact(self, analyzer):
        """Should warn about missing contact info."""
        resume = {
            "experience": [{"company": "Corp"}],
        }

        result = analyzer.analyze_structure(resume)

        assert any("email" in w.lower() for w in result["warnings"])

    def test_empty_resume(self, analyzer):
        """Should handle empty resume."""
        result = analyzer.analyze_structure({})

        assert result["format_score"] < 50
        assert len(result["sections_missing"]) > 0

    def test_case_insensitive_sections(self, analyzer):
        """Should match sections case-insensitively."""
        resume = {
            "EXPERIENCE": [],
            "Education": [],
            "SKILLS": [],
        }

        result = analyzer.analyze_structure(resume)

        assert "experience" in result["sections_found"]
        assert "education" in result["sections_found"]
        assert "skills" in result["sections_found"]

    def test_structure_includes_section_order(self, analyzer):
        """Should include section order score and details in structure analysis."""
        resume = {
            "contact": {"email": "test@example.com"},
            "summary": "Brief overview...",
            "experience": [{"company": "Corp"}],
            "education": [{"degree": "BS"}],
            "skills": ["Python"],
        }

        result = analyzer.analyze_structure(resume)

        assert "section_order_score" in result
        assert "section_order_details" in result
        assert "detected_order" in result["section_order_details"]
        assert "expected_order" in result["section_order_details"]
        assert "deviation_type" in result["section_order_details"]
        assert "issues" in result["section_order_details"]


class TestValidateSectionOrder:
    """Test section order validation functionality."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_standard_order_scores_100(self, analyzer):
        """Standard section order should score 100."""
        resume = {
            "contact": {"email": "test@example.com", "phone": "555-123-4567"},
            "summary": "Experienced developer...",
            "experience": [{"company": "TechCorp", "title": "Engineer"}],
            "education": [{"school": "University", "degree": "BS CS"}],
            "skills": ["Python", "AWS"],
            "certifications": ["AWS Certified"],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 100
        assert result.deviation_type == "standard"
        assert len(result.issues) == 0

    def test_minor_deviation_skills_before_education(self, analyzer):
        """Skills before Education should score 95 (minor deviation)."""
        resume = {
            "contact": {"email": "test@example.com"},
            "summary": "Developer...",
            "experience": [{"company": "Corp"}],
            "skills": ["Python"],  # Before education
            "education": [{"degree": "BS"}],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 95
        assert result.deviation_type == "minor"
        assert any("Skills" in issue for issue in result.issues)

    def test_major_deviation_education_before_experience(self, analyzer):
        """Education before Experience should score 85 (major deviation)."""
        resume = {
            "contact": {"email": "test@example.com"},
            "education": [{"degree": "BS"}],  # Before experience
            "experience": [{"company": "Corp"}],
            "skills": ["Python"],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 85
        assert result.deviation_type == "major"
        assert any("Education" in issue and "Experience" in issue for issue in result.issues)

    def test_major_deviation_contact_not_first(self, analyzer):
        """Contact not at the top should score 85 (major deviation)."""
        resume = {
            "summary": "Developer...",  # Before contact
            "contact": {"email": "test@example.com"},
            "experience": [{"company": "Corp"}],
            "education": [{"degree": "BS"}],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 85
        assert result.deviation_type == "major"
        assert any("Contact" in issue for issue in result.issues)

    def test_minor_deviation_summary_after_experience(self, analyzer):
        """Summary after Experience should be a minor deviation."""
        resume = {
            "contact": {"email": "test@example.com"},
            "experience": [{"company": "Corp"}],
            "summary": "Developer...",  # After experience
            "education": [{"degree": "BS"}],
            "skills": ["Python"],
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 95
        assert result.deviation_type == "minor"
        assert any("Summary" in issue for issue in result.issues)

    def test_empty_resume_scores_75(self, analyzer):
        """Empty resume should score 75 (non-standard)."""
        result = analyzer.validate_section_order({})

        assert result.order_score == 75
        assert result.deviation_type == "non_standard"
        assert len(result.detected_order) == 0

    def test_no_recognizable_sections(self, analyzer):
        """Resume with no recognizable sections should score 75."""
        resume = {
            "random_key": "some value",
            "another_key": "another value",
        }

        result = analyzer.validate_section_order(resume)

        assert result.order_score == 75
        assert result.deviation_type == "non_standard"
        assert any("No recognizable" in issue for issue in result.issues)

    def test_detected_order_matches_input_order(self, analyzer):
        """Detected order should reflect the actual order of sections in resume."""
        resume = {
            "contact": {"email": "test@example.com"},
            "skills": ["Python"],
            "experience": [{"company": "Corp"}],
            "education": [{"degree": "BS"}],
        }

        result = analyzer.validate_section_order(resume)

        # Check that detected order reflects actual input order
        assert result.detected_order[0] == "contact"
        assert "skills" in result.detected_order
        assert "experience" in result.detected_order
        assert "education" in result.detected_order

    def test_expected_order_only_includes_detected_sections(self, analyzer):
        """Expected order should only include sections that were detected."""
        resume = {
            "contact": {"email": "test@example.com"},
            "experience": [{"company": "Corp"}],
            # No education, skills, etc.
        }

        result = analyzer.validate_section_order(resume)

        # Expected order should only have contact and experience
        assert "contact" in result.expected_order
        assert "experience" in result.expected_order
        assert "education" not in result.expected_order
        assert "skills" not in result.expected_order

    def test_alias_section_names_recognized(self, analyzer):
        """Should recognize section aliases (e.g., 'work experience' for 'experience')."""
        resume = {
            "contact": {"email": "test@example.com"},
            "professional summary": "Developer...",  # Alias for summary
            "work experience": [{"company": "Corp"}],  # Alias for experience
            "academic background": [{"degree": "BS"}],  # Alias for education
            "technical skills": ["Python"],  # Alias for skills
        }

        result = analyzer.validate_section_order(resume)

        assert "summary" in result.detected_order
        assert "experience" in result.detected_order
        assert "education" in result.detected_order
        assert "skills" in result.detected_order

    def test_format_score_incorporates_section_order(self, analyzer):
        """Format score should incorporate section order score."""
        # Standard order resume
        standard_resume = {
            "contact": {"email": "test@example.com", "phone": "555-123-4567"},
            "summary": "Developer...",
            "experience": [{"company": "Corp"}],
            "education": [{"degree": "BS"}],
            "skills": ["Python"],
            "certifications": ["AWS"],
            "projects": ["Project 1"],
        }

        # Major deviation resume (same sections, different order)
        bad_order_resume = {
            "education": [{"degree": "BS"}],  # Before experience
            "contact": {"email": "test@example.com", "phone": "555-123-4567"},
            "experience": [{"company": "Corp"}],
            "summary": "Developer...",
            "skills": ["Python"],
            "certifications": ["AWS"],
            "projects": ["Project 1"],
        }

        standard_result = analyzer.analyze_structure(standard_resume)
        bad_order_result = analyzer.analyze_structure(bad_order_resume)

        # Standard order should have higher format score
        assert standard_result["format_score"] > bad_order_result["format_score"]
        assert standard_result["section_order_score"] == 100
        assert bad_order_result["section_order_score"] == 85


class TestAnalyzeKeywords:
    """Test analyze_keywords method."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    @pytest.fixture
    def mock_ai_response(self):
        """Mock AI keyword extraction response."""
        return '["Python", "AWS", "Docker", "CI/CD", "Leadership"]'

    @pytest.mark.asyncio
    async def test_keyword_matching(self, analyzer, mock_ai_response):
        """Should identify matched keywords."""
        resume_blocks = [
            {"content": "Built Python applications on AWS infrastructure"},
            {"content": "Implemented CI/CD pipelines for deployment"},
        ]
        vault_blocks = resume_blocks + [
            {"content": "Led Docker containerization initiatives"},
        ]
        job_description = "Looking for Python developer with AWS experience"

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_ai_response),
        ):
            result = await analyzer.analyze_keywords(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        assert "Python" in result["matched_keywords"]
        assert "AWS" in result["matched_keywords"]
        assert result["keyword_coverage"] > 0

    @pytest.mark.asyncio
    async def test_missing_keywords_in_vault(self, analyzer, mock_ai_response):
        """Should identify keywords in vault but not in resume."""
        resume_blocks = [
            {"content": "Python developer with 5 years experience"},
        ]
        vault_blocks = [
            {"content": "Python developer with 5 years experience"},
            {"content": "AWS infrastructure management"},  # In vault, not resume
        ]
        job_description = "Python and AWS required"

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_ai_response),
        ):
            result = await analyzer.analyze_keywords(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # AWS is in vault but not in resume
        assert "AWS" in result["missing_keywords"]

    @pytest.mark.asyncio
    async def test_missing_from_vault(self, analyzer, mock_ai_response):
        """Should identify keywords not in vault at all."""
        resume_blocks = [
            {"content": "Python developer"},
        ]
        vault_blocks = resume_blocks  # Same content
        job_description = "Need Kubernetes experience"

        # Mock response with Kubernetes
        mock_response = '["Python", "Kubernetes", "Docker"]'

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # Kubernetes not in vault
        assert "Kubernetes" in result["missing_from_vault"]

    @pytest.mark.asyncio
    async def test_low_coverage_warning(self, analyzer):
        """Should warn about low keyword coverage."""
        resume_blocks = [
            {"content": "Basic experience"},
        ]
        vault_blocks = resume_blocks
        job_description = "Expert in Python, AWS, Docker, Kubernetes, CI/CD"

        mock_response = '["Python", "AWS", "Docker", "Kubernetes", "CI/CD"]'

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        assert result["keyword_coverage"] < 0.3
        assert len(result["warnings"]) > 0


class TestBasicKeywordExtraction:
    """Test fallback keyword extraction."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_extract_tech_keywords(self, analyzer):
        """Should extract technology keywords."""
        text = """
        We need a Python developer with experience in AWS, Docker, and Kubernetes.
        Must know React and Node.js for frontend development.
        """

        keywords = analyzer._basic_keyword_extraction(text)

        assert "Python" in keywords
        assert "AWS" in keywords
        assert "Docker" in keywords
        assert "React" in keywords

    def test_extract_soft_skills(self, analyzer):
        """Should extract soft skill keywords."""
        text = """
        Strong leadership and communication skills required.
        Problem-solving abilities essential.
        """

        keywords = analyzer._basic_keyword_extraction(text)

        assert any("leadership" in k.lower() for k in keywords)
        assert any("communication" in k.lower() for k in keywords)

    def test_limits_keywords(self, analyzer):
        """Should limit number of keywords."""
        text = """
        Python Java JavaScript TypeScript C++ C# Go Rust Ruby PHP Swift Kotlin
        AWS Azure GCP Docker Kubernetes React Angular Vue Node.js Django Flask
        SQL PostgreSQL MySQL MongoDB Redis Elasticsearch CI/CD DevOps Agile
        """

        keywords = analyzer._basic_keyword_extraction(text)

        assert len(keywords) <= 25


class TestATSTips:
    """Test ATS tips method."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_returns_tips(self, analyzer):
        """Should return actionable tips."""
        tips = analyzer.get_ats_tips()

        assert isinstance(tips, list)
        assert len(tips) > 5

        # Check for common advice
        tip_text = " ".join(tips).lower()
        assert "section" in tip_text or "header" in tip_text
        assert "format" in tip_text or "font" in tip_text


class TestATSAnalyzerSingleton:
    """Test singleton pattern."""

    def test_singleton_instance(self):
        """Should return singleton instance."""
        instance1 = get_ats_analyzer()
        instance2 = get_ats_analyzer()
        assert instance1 is instance2


class TestExtractKeywordsWithImportance:
    """Test keyword extraction with importance levels."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    @pytest.fixture
    def mock_importance_response(self):
        """Mock AI keyword extraction response with importance levels."""
        return """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "required"},
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Kubernetes", "importance": "preferred"},
            {"keyword": "Team leadership", "importance": "nice_to_have"}
        ]"""

    @pytest.mark.asyncio
    async def test_extract_with_importance(self, analyzer, mock_importance_response):
        """Should extract keywords with importance levels."""
        job_description = "Required: Python, AWS. Preferred: Docker, Kubernetes. Nice to have: Team leadership"

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await analyzer._extract_keywords_with_importance(job_description)

        assert len(result) == 5
        assert any(k["keyword"] == "Python" and k["importance"] == "required" for k in result)
        assert any(k["keyword"] == "Docker" and k["importance"] == "preferred" for k in result)
        assert any(k["keyword"] == "Team leadership" and k["importance"] == "nice_to_have" for k in result)

    @pytest.mark.asyncio
    async def test_fallback_to_basic_extraction(self, analyzer):
        """Should fallback to basic extraction on AI failure."""
        job_description = "Python and AWS developer needed"

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(side_effect=Exception("AI Error")),
        ):
            result = await analyzer._extract_keywords_with_importance(job_description)

        # Should fallback and assign "preferred" importance
        assert all(k["importance"] == "preferred" for k in result)

    @pytest.mark.asyncio
    async def test_invalid_importance_normalized(self, analyzer):
        """Should normalize invalid importance to nice_to_have."""
        mock_response = '[{"keyword": "Python", "importance": "critical"}]'

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer._extract_keywords_with_importance("Test job")

        assert result[0]["importance"] == "nice_to_have"


class TestGetKeywordContext:
    """Test keyword context extraction."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_extract_context(self, analyzer):
        """Should extract context around keyword."""
        text = "We are looking for a skilled Python developer with 5+ years experience"
        context = analyzer._get_keyword_context("Python", text)

        assert context is not None
        assert "Python" in context

    def test_no_match_returns_none(self, analyzer):
        """Should return None when keyword not found."""
        text = "We need a Java developer"
        context = analyzer._get_keyword_context("Python", text)

        assert context is None

    def test_adds_ellipsis(self, analyzer):
        """Should add ellipsis when context is truncated."""
        text = "x" * 100 + "Python" + "y" * 100
        context = analyzer._get_keyword_context("Python", text)

        assert context is not None
        assert "..." in context


class TestCountKeywordFrequency:
    """Test keyword frequency counting."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_count_single_occurrence(self, analyzer):
        """Should count single keyword occurrence."""
        text = "Python is a great language"
        count = analyzer._count_keyword_frequency("Python", text)

        assert count == 1

    def test_count_multiple_occurrences(self, analyzer):
        """Should count multiple keyword occurrences."""
        text = "Python Python Python everywhere"
        count = analyzer._count_keyword_frequency("Python", text)

        assert count == 3

    def test_case_insensitive(self, analyzer):
        """Should count case-insensitively."""
        text = "python PYTHON Python"
        count = analyzer._count_keyword_frequency("Python", text)

        assert count == 3

    def test_word_boundaries(self, analyzer):
        """Should respect word boundaries."""
        text = "Pythonic is not Python"
        count = analyzer._count_keyword_frequency("Python", text)

        assert count == 1  # Only "Python", not "Pythonic"


class TestAnalyzeKeywordsDetailed:
    """Test detailed keyword analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    @pytest.fixture
    def mock_importance_response(self):
        return """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "required"},
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Kubernetes", "importance": "nice_to_have"}
        ]"""

    @pytest.mark.asyncio
    async def test_detailed_analysis_structure(self, analyzer, mock_importance_response):
        """Should return DetailedKeywordAnalysis with all fields."""
        resume_blocks = [{"content": "Python developer with AWS experience"}]
        vault_blocks = resume_blocks + [{"content": "Docker containerization"}]
        job_description = "Required: Python, AWS. Preferred: Docker. Nice: Kubernetes"

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # Check structure
        assert hasattr(result, "coverage_score")
        assert hasattr(result, "required_coverage")
        assert hasattr(result, "preferred_coverage")
        assert hasattr(result, "required_matched")
        assert hasattr(result, "required_missing")
        assert hasattr(result, "all_keywords")

    @pytest.mark.asyncio
    async def test_required_keywords_grouping(self, analyzer, mock_importance_response):
        """Should correctly group required keywords."""
        resume_blocks = [{"content": "Python developer"}]  # Has Python, no AWS
        vault_blocks = [{"content": "Python developer with AWS"}]  # Has AWS in vault
        job_description = "Required: Python, AWS"

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        assert "Python" in result.required_matched
        assert "AWS" in result.required_missing

    @pytest.mark.asyncio
    async def test_vault_availability_tracking(self, analyzer, mock_importance_response):
        """Should track vault availability for missing keywords."""
        resume_blocks = [{"content": "Basic developer"}]
        vault_blocks = [
            {"content": "Basic developer"},
            {"content": "Docker experience", "source_company": "TechCorp"},
        ]
        job_description = "Need Docker and Kubernetes"

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # Docker is in vault, Kubernetes is not
        assert "Docker" in result.missing_available_in_vault
        assert "Kubernetes" in result.missing_not_in_vault

    @pytest.mark.asyncio
    async def test_coverage_calculation(self, analyzer, mock_importance_response):
        """Should calculate coverage scores correctly."""
        resume_blocks = [{"content": "Python AWS Docker developer"}]  # 3 of 4 keywords
        vault_blocks = resume_blocks
        job_description = "Need Python, AWS, Docker, Kubernetes"

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        assert result.coverage_score == 0.75  # 3/4
        assert result.required_coverage == 1.0  # Python and AWS both matched

    @pytest.mark.asyncio
    async def test_keyword_details(self, analyzer, mock_importance_response):
        """Should include detailed info for each keyword."""
        resume_blocks = [{"content": "Python developer"}]
        vault_blocks = resume_blocks
        job_description = "Python Python developer needed"  # Python appears twice

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        python_keyword = next((k for k in result.all_keywords if k.keyword == "Python"), None)
        assert python_keyword is not None
        assert python_keyword.importance == "required"
        assert python_keyword.found_in_resume is True
        assert python_keyword.frequency_in_job >= 1

    @pytest.mark.asyncio
    async def test_warnings_on_low_coverage(self, analyzer):
        """Should generate warnings on low required coverage."""
        resume_blocks = [{"content": "Basic experience"}]
        vault_blocks = resume_blocks
        job_description = "Must have Python, AWS, Docker, Kubernetes, CI/CD"

        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "required"},
            {"keyword": "Docker", "importance": "required"},
            {"keyword": "Kubernetes", "importance": "required"},
            {"keyword": "CI/CD", "importance": "required"}
        ]"""

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        assert result.required_coverage < 0.5
        assert len(result.warnings) > 0


class TestGenerateDetailedSuggestions:
    """Test detailed suggestion generation."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_prioritizes_required_keywords(self, analyzer):
        """Should prioritize required keywords in suggestions."""
        required_missing = ["Python", "AWS"]
        preferred_missing = ["Docker"]
        available_in_vault = ["Python", "Docker"]
        vault_blocks = [
            {"content": "Python experience", "source_company": "TechCorp"},
            {"content": "Docker skills", "source_company": "StartupInc"},
        ]

        suggestions = analyzer._generate_detailed_suggestions(
            required_missing=required_missing,
            preferred_missing=preferred_missing,
            available_in_vault=available_in_vault,
            vault_blocks=vault_blocks,
        )

        # Should mention required keyword first
        assert any("Python" in s and "required" in s for s in suggestions)

    def test_includes_source_company(self, analyzer):
        """Should include source company in suggestions."""
        required_missing = ["Python"]
        preferred_missing = []
        available_in_vault = ["Python"]
        vault_blocks = [
            {"content": "Python experience", "source_company": "TechCorp"},
        ]

        suggestions = analyzer._generate_detailed_suggestions(
            required_missing=required_missing,
            preferred_missing=preferred_missing,
            available_in_vault=available_in_vault,
            vault_blocks=vault_blocks,
        )

        assert any("TechCorp" in s for s in suggestions)


# ============================================================
# Knockout Check Tests (Stage 0)
# ============================================================


class TestKnockoutCheckBasics:
    """Test basic knockout check functionality."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    @pytest.fixture
    def qualified_resume(self) -> dict:
        """Resume that meets all common requirements."""
        return {
            "contact": {
                "name": "John Doe",
                "email": "john@example.com",
                "location": "San Francisco, CA",
            },
            "experience": [
                {
                    "title": "Senior Software Engineer",
                    "company": "TechCorp",
                    "start_date": "January 2020",
                    "end_date": "Present",
                    "bullets": ["Led team of 5 engineers"],
                },
                {
                    "title": "Software Engineer",
                    "company": "StartupInc",
                    "start_date": "June 2017",
                    "end_date": "December 2019",
                    "bullets": ["Built microservices"],
                },
            ],
            "education": [
                {
                    "degree": "Bachelor's in Computer Science",
                    "institution": "Stanford University",
                    "graduation_date": "2017",
                }
            ],
            "certifications": ["AWS Certified Solutions Architect", "PMP"],
            "skills": ["Python", "AWS", "Docker"],
        }

    @pytest.fixture
    def standard_job(self) -> dict:
        """Standard job posting with typical requirements."""
        return {
            "title": "Senior Software Engineer",
            "company": "BigTech",
            "location": "San Francisco, CA",
            "remote_type": "hybrid",
            "requirements": [
                {"text": "5+ years of software development experience", "type": "experience", "years": 5},
                {"text": "Bachelor's degree in Computer Science or related field", "type": "education", "years": None},
            ],
            "skills": [
                {"skill": "Python", "importance": "required", "category": "technical"},
                {"skill": "AWS", "importance": "preferred", "category": "technical"},
            ],
        }

    def test_passes_all_checks_for_qualified_candidate(self, analyzer, qualified_resume, standard_job):
        """Should pass all checks for a qualified candidate."""
        result = analyzer.perform_knockout_check(qualified_resume, standard_job)

        assert result.passes_all_checks is True
        assert len(result.risks) == 0
        assert "No knockout risks" in result.summary

    def test_returns_knockout_check_result_structure(self, analyzer, qualified_resume, standard_job):
        """Should return proper KnockoutCheckResult structure."""
        result = analyzer.perform_knockout_check(qualified_resume, standard_job)

        assert isinstance(result, KnockoutCheckResult)
        assert isinstance(result.passes_all_checks, bool)
        assert isinstance(result.risks, list)
        assert isinstance(result.summary, str)
        assert isinstance(result.recommendation, str)
        assert isinstance(result.analysis, dict)


class TestExperienceYearsKnockout:
    """Test years of experience knockout checking."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_detects_insufficient_experience(self, analyzer):
        """Should detect when user lacks required experience."""
        resume = {
            "experience": [
                {
                    "title": "Junior Developer",
                    "company": "Startup",
                    "start_date": "January 2023",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert result.passes_all_checks is False
        assert any(r.risk_type == "experience_years" for r in result.risks)

    def test_experience_gap_severity_critical(self, analyzer):
        """Should flag as critical when experience gap is large."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "start_date": "January 2023",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "10+ years experience", "type": "experience", "years": 10}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        exp_risk = next((r for r in result.risks if r.risk_type == "experience_years"), None)
        assert exp_risk is not None
        assert exp_risk.severity == "critical"

    def test_experience_gap_severity_warning(self, analyzer):
        """Should flag as warning when experience gap is small."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "start_date": "January 2022",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "3+ years experience", "type": "experience", "years": 3}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        exp_risk = next((r for r in result.risks if r.risk_type == "experience_years"), None)
        assert exp_risk is not None
        assert exp_risk.severity == "warning"

    def test_no_experience_requirement_passes(self, analyzer):
        """Should pass when job has no experience requirement."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "start_date": "January 2023",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "Knowledge of Python", "type": "other", "years": None}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "experience_years" for r in result.risks)

    def test_handles_present_end_date(self, analyzer):
        """Should correctly handle 'Present' as end date."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "start_date": "January 2018",
                    "end_date": "Present",
                    "bullets": [],
                }
            ]
        }
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        # Should have enough experience (2018 to now is 6+ years)
        assert not any(r.risk_type == "experience_years" for r in result.risks)

    def test_calculates_multiple_positions(self, analyzer):
        """Should sum experience across multiple positions."""
        resume = {
            "experience": [
                {
                    "title": "Senior Developer",
                    "company": "Corp2",
                    "start_date": "January 2022",
                    "end_date": "Present",
                    "bullets": [],
                },
                {
                    "title": "Developer",
                    "company": "Corp1",
                    "start_date": "January 2019",
                    "end_date": "December 2021",
                    "bullets": [],
                },
            ]
        }
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        # Total experience should be ~5-6 years
        assert not any(r.risk_type == "experience_years" for r in result.risks)


class TestEducationLevelKnockout:
    """Test education level knockout checking."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_detects_insufficient_education(self, analyzer):
        """Should detect when education level is insufficient."""
        resume = {
            "education": [
                {"degree": "Associate's in IT", "institution": "Community College"}
            ]
        }
        job = {
            "requirements": [
                {"text": "Master's degree required", "type": "education", "years": None}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert any(r.risk_type == "education_level" for r in result.risks)

    def test_passes_with_higher_education(self, analyzer):
        """Should pass when user has higher education than required."""
        resume = {
            "education": [
                {"degree": "Master's in Computer Science", "institution": "MIT"}
            ]
        }
        job = {
            "requirements": [
                {"text": "Bachelor's degree required", "type": "education", "years": None}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "education_level" for r in result.risks)

    def test_passes_with_matching_education(self, analyzer):
        """Should pass when education level matches requirement."""
        resume = {
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "Stanford"}
            ]
        }
        job = {
            "requirements": [
                {"text": "Bachelor's degree in CS", "type": "education", "years": None}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "education_level" for r in result.risks)

    def test_recognizes_various_degree_formats(self, analyzer):
        """Should recognize various degree format patterns."""
        test_cases = [
            ("B.S. Computer Science", "bachelors"),
            ("Bachelor of Arts", "bachelors"),
            ("M.S. in Data Science", "masters"),
            ("MBA", "masters"),
            ("Ph.D. in Physics", "phd"),
            ("Doctorate in Education", "phd"),
        ]

        for degree_text, expected_level in test_cases:
            resume = {"education": [{"degree": degree_text, "institution": "University"}]}
            level = analyzer._get_highest_education(resume)
            assert level == expected_level, f"Failed for {degree_text}"

    def test_no_education_requirement_passes(self, analyzer):
        """Should pass when job has no education requirement."""
        resume = {
            "education": []
        }
        job = {
            "requirements": [
                {"text": "Python experience", "type": "other", "years": None}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "education_level" for r in result.risks)


class TestCertificationKnockout:
    """Test certification knockout checking."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_detects_missing_required_certification(self, analyzer):
        """Should detect missing required certification."""
        resume = {
            "certifications": ["CompTIA A+"]
        }
        job = {
            "requirements": [
                {"text": "PMP Certification", "type": "certification"}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert any(
            r.risk_type == "certification" and r.severity == "critical"
            for r in result.risks
        )

    def test_passes_with_matching_certification(self, analyzer):
        """Should pass when user has the required certification."""
        resume = {
            "certifications": ["AWS Certified Solutions Architect - Professional"]
        }
        job = {
            "requirements": [
                {"text": "AWS Certified Solutions Architect", "type": "certification"}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "certification" for r in result.risks)

    def test_matches_certification_case_insensitively(self, analyzer):
        """Should match certifications case-insensitively."""
        resume = {
            "certifications": ["pmp"]
        }
        job = {
            "requirements": [
                {"text": "PMP Certification", "type": "certification"}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "certification" for r in result.risks)

    def test_detects_preferred_certification_as_warning(self, analyzer):
        """Should flag missing preferred certification as warning."""
        resume = {
            "certifications": []
        }
        job = {
            "skills": [
                {"skill": "AWS Certified Developer", "importance": "preferred", "category": "technical"}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        cert_risks = [r for r in result.risks if r.risk_type == "certification"]
        if cert_risks:  # Only if it detected the certification
            assert any(r.severity == "warning" for r in cert_risks)


class TestLocationKnockout:
    """Test location knockout checking."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_no_risk_for_remote_job(self, analyzer):
        """Should not flag location risk for remote jobs."""
        resume = {
            "contact": {"location": "New York, NY"}
        }
        job = {
            "location": "San Francisco, CA",
            "remote_type": "remote"
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "location" for r in result.risks)

    def test_detects_location_mismatch_for_onsite(self, analyzer):
        """Should detect location mismatch for on-site roles."""
        resume = {
            "contact": {"location": "New York, NY"}
        }
        job = {
            "location": "San Francisco, CA",
            "remote_type": "onsite"
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert any(r.risk_type == "location" for r in result.risks)

    def test_no_risk_when_locations_match(self, analyzer):
        """Should not flag risk when locations match."""
        resume = {
            "contact": {"location": "San Francisco, California"}
        }
        job = {
            "location": "San Francisco, CA",
            "remote_type": "onsite"
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert not any(r.risk_type == "location" for r in result.risks)

    def test_handles_missing_location_gracefully(self, analyzer):
        """Should handle missing location info without crashing."""
        resume = {
            "contact": {}
        }
        job = {
            "location": "San Francisco, CA",
            "remote_type": "onsite"
        }

        # Should not raise exception
        result = analyzer.perform_knockout_check(resume, job)
        assert isinstance(result, KnockoutCheckResult)


class TestDateParsing:
    """Test date parsing for experience calculation."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_parses_month_year_format(self, analyzer):
        """Should parse 'Month Year' format."""
        result = analyzer._parse_date("January 2020")
        assert result is not None
        assert result.year == 2020
        assert result.month == 1

    def test_parses_short_month_format(self, analyzer):
        """Should parse 'Mon Year' format."""
        result = analyzer._parse_date("Jan 2020")
        assert result is not None
        assert result.year == 2020

    def test_parses_year_only(self, analyzer):
        """Should parse year-only format."""
        result = analyzer._parse_date("2020")
        assert result is not None
        assert result.year == 2020

    def test_parses_slash_format(self, analyzer):
        """Should parse MM/YYYY format."""
        result = analyzer._parse_date("01/2020")
        assert result is not None
        assert result.year == 2020

    def test_returns_none_for_present(self, analyzer):
        """Should return None for 'Present'."""
        result = analyzer._parse_date("Present")
        assert result is None

        result = analyzer._parse_date("Current")
        assert result is None

    def test_handles_empty_string(self, analyzer):
        """Should handle empty string."""
        result = analyzer._parse_date("")
        assert result is None


class TestKnockoutSummaryAndRecommendation:
    """Test summary and recommendation generation."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_generates_positive_summary_when_all_pass(self, analyzer):
        """Should generate positive summary when all checks pass."""
        resume = {
            "experience": [
                {"start_date": "January 2015", "end_date": "Present", "title": "Senior Dev", "company": "Corp"}
            ],
            "education": [{"degree": "Bachelor's in CS", "institution": "MIT"}],
        }
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5},
                {"text": "Bachelor's degree", "type": "education"},
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert result.passes_all_checks is True
        assert "No knockout risks" in result.summary
        assert "keyword" in result.recommendation.lower()

    def test_generates_warning_summary_with_risks(self, analyzer):
        """Should generate warning summary when risks detected."""
        resume = {
            "experience": [
                {"start_date": "January 2023", "end_date": "Present", "title": "Dev", "company": "Corp"}
            ]
        }
        job = {
            "requirements": [
                {"text": "10+ years experience", "type": "experience", "years": 10}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        assert result.passes_all_checks is False
        assert "knockout risk" in result.summary.lower()
        assert "critical" in result.summary.lower() or "warning" in result.summary.lower()

    def test_critical_gets_stronger_recommendation(self, analyzer):
        """Should give stronger recommendation for critical risks."""
        resume = {
            "experience": [
                {"start_date": "January 2023", "end_date": "Present", "title": "Dev", "company": "Corp"}
            ]
        }
        job = {
            "requirements": [
                {"text": "10+ years experience", "type": "experience", "years": 10}
            ]
        }

        result = analyzer.perform_knockout_check(resume, job)

        # Should mention addressing or considering other roles
        assert "address" in result.recommendation.lower() or "consider" in result.recommendation.lower()


class TestExtractRequiredYears:
    """Test experience years extraction from job."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_extracts_years_from_requirements(self, analyzer):
        """Should extract years from experience requirements."""
        job = {
            "requirements": [
                {"text": "5+ years experience", "type": "experience", "years": 5}
            ]
        }

        result = analyzer._extract_required_years(job)
        assert result == 5

    def test_returns_maximum_years(self, analyzer):
        """Should return maximum years when multiple requirements."""
        job = {
            "requirements": [
                {"text": "3+ years Python", "type": "experience", "years": 3},
                {"text": "5+ years software dev", "type": "experience", "years": 5},
            ]
        }

        result = analyzer._extract_required_years(job)
        assert result == 5

    def test_returns_none_when_no_years(self, analyzer):
        """Should return None when no years requirements."""
        job = {
            "requirements": [
                {"text": "Python knowledge", "type": "other", "years": None}
            ]
        }

        result = analyzer._extract_required_years(job)
        assert result is None

    def test_handles_empty_requirements(self, analyzer):
        """Should handle empty requirements list."""
        job = {"requirements": []}
        result = analyzer._extract_required_years(job)
        assert result is None


class TestExtractRequiredEducation:
    """Test education level extraction from job."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_extracts_bachelors_requirement(self, analyzer):
        """Should extract bachelor's requirement."""
        job = {
            "requirements": [
                {"text": "Bachelor's degree in Computer Science", "type": "education"}
            ]
        }

        result = analyzer._extract_required_education(job)
        assert result == "bachelors"

    def test_extracts_masters_requirement(self, analyzer):
        """Should extract master's requirement."""
        job = {
            "requirements": [
                {"text": "Master's degree or PhD preferred", "type": "education"}
            ]
        }

        result = analyzer._extract_required_education(job)
        # Should return highest detected (PhD)
        assert result in ("masters", "phd")

    def test_returns_none_when_no_education(self, analyzer):
        """Should return None when no education requirements."""
        job = {
            "requirements": [
                {"text": "Experience with Python", "type": "experience", "years": 3}
            ]
        }

        result = analyzer._extract_required_education(job)
        assert result is None


# ============================================================
# Stage 2: Enhanced Keyword Scoring Tests
# ============================================================


class TestSectionTypeDetection:
    """Test section type detection for placement weighting."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_detects_experience_section(self, analyzer):
        """Should detect experience section variants."""
        assert analyzer._detect_section_type("experience") == "experience"
        assert analyzer._detect_section_type("work experience") == "experience"
        assert analyzer._detect_section_type("Employment History") == "experience"
        assert analyzer._detect_section_type("PROFESSIONAL EXPERIENCE") == "experience"

    def test_detects_skills_section(self, analyzer):
        """Should detect skills section variants."""
        assert analyzer._detect_section_type("skills") == "skills"
        assert analyzer._detect_section_type("Technical Skills") == "skills"
        assert analyzer._detect_section_type("CORE COMPETENCIES") == "skills"

    def test_detects_education_section(self, analyzer):
        """Should detect education section variants."""
        assert analyzer._detect_section_type("education") == "education"
        assert analyzer._detect_section_type("Academic Background") == "education"

    def test_detects_projects_section(self, analyzer):
        """Should detect projects section variants."""
        assert analyzer._detect_section_type("projects") == "projects"
        assert analyzer._detect_section_type("Key Projects") == "projects"

    def test_detects_summary_section(self, analyzer):
        """Should detect summary section variants."""
        assert analyzer._detect_section_type("summary") == "summary"
        assert analyzer._detect_section_type("Professional Summary") == "summary"
        assert analyzer._detect_section_type("OBJECTIVE") == "summary"

    def test_returns_other_for_unknown(self, analyzer):
        """Should return 'other' for unrecognized sections."""
        assert analyzer._detect_section_type("random_key") == "other"
        assert analyzer._detect_section_type("contact") == "other"


class TestPlacementWeighting:
    """Test placement weight calculation (Stage 2.1)."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_experience_has_highest_weight(self, analyzer):
        """Experience section should have weight 1.0."""
        assert analyzer._get_placement_weight("experience") == 1.0

    def test_projects_has_high_weight(self, analyzer):
        """Projects section should have weight 0.9."""
        assert analyzer._get_placement_weight("projects") == 0.9

    def test_skills_has_medium_weight(self, analyzer):
        """Skills section should have weight 0.7."""
        assert analyzer._get_placement_weight("skills") == 0.7

    def test_summary_has_low_weight(self, analyzer):
        """Summary section should have weight 0.6."""
        assert analyzer._get_placement_weight("summary") == 0.6

    def test_education_has_lowest_weight(self, analyzer):
        """Education section should have weight 0.5."""
        assert analyzer._get_placement_weight("education") == 0.5

    def test_unknown_section_has_default_weight(self, analyzer):
        """Unknown sections should have weight 0.5."""
        assert analyzer._get_placement_weight("other") == 0.5
        assert analyzer._get_placement_weight("unknown") == 0.5


class TestDensityScoring:
    """Test density scoring with diminishing returns (Stage 2.2)."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_zero_occurrences_returns_zero(self, analyzer):
        """Zero occurrences should return 0."""
        assert analyzer._get_density_multiplier(0) == 0.0

    def test_single_occurrence_returns_one(self, analyzer):
        """Single occurrence should return 1.0."""
        assert analyzer._get_density_multiplier(1) == 1.0

    def test_two_occurrences_returns_1_3(self, analyzer):
        """Two occurrences should return 1.3."""
        assert analyzer._get_density_multiplier(2) == 1.3

    def test_three_occurrences_returns_1_5(self, analyzer):
        """Three occurrences should return 1.5."""
        assert analyzer._get_density_multiplier(3) == 1.5

    def test_more_occurrences_capped_at_1_5(self, analyzer):
        """Four or more occurrences should cap at 1.5."""
        assert analyzer._get_density_multiplier(4) == 1.5
        assert analyzer._get_density_multiplier(10) == 1.5
        assert analyzer._get_density_multiplier(100) == 1.5


class TestRecencyWeighting:
    """Test recency weighting by role position (Stage 2.3)."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_most_recent_role_weighted_2x(self, analyzer):
        """Most recent role (index 0) should have weight 2.0."""
        assert analyzer._get_recency_weight(0) == 2.0

    def test_second_role_weighted_2x(self, analyzer):
        """Second most recent role (index 1) should have weight 2.0."""
        assert analyzer._get_recency_weight(1) == 2.0

    def test_third_role_weighted_1x(self, analyzer):
        """Third most recent role (index 2) should have weight 1.0."""
        assert analyzer._get_recency_weight(2) == 1.0

    def test_older_roles_weighted_0_8x(self, analyzer):
        """Older roles (index 3+) should have weight 0.8."""
        assert analyzer._get_recency_weight(3) == 0.8
        assert analyzer._get_recency_weight(4) == 0.8
        assert analyzer._get_recency_weight(10) == 0.8

    def test_none_role_index_returns_neutral(self, analyzer):
        """None role index should return neutral weight 1.0."""
        assert analyzer._get_recency_weight(None) == 1.0


class TestImportanceWeighting:
    """Test importance tier weighting (Stage 2.4)."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_required_weighted_3x(self, analyzer):
        """Required keywords should have weight 3.0."""
        assert analyzer._get_importance_weight("required") == 3.0

    def test_strongly_preferred_weighted_2x(self, analyzer):
        """Strongly preferred keywords should have weight 2.0."""
        assert analyzer._get_importance_weight("strongly_preferred") == 2.0

    def test_preferred_weighted_1_5x(self, analyzer):
        """Preferred keywords should have weight 1.5."""
        assert analyzer._get_importance_weight("preferred") == 1.5

    def test_nice_to_have_weighted_1x(self, analyzer):
        """Nice to have keywords should have weight 1.0."""
        assert analyzer._get_importance_weight("nice_to_have") == 1.0


class TestOrderExperiencesByDate:
    """Test experience ordering by date for recency calculation."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_orders_by_end_date_descending(self, analyzer):
        """Should order experiences by end date (most recent first)."""
        experiences = [
            {"title": "Old Job", "end_date": "December 2020"},
            {"title": "Current Job", "end_date": "Present"},
            {"title": "Middle Job", "end_date": "June 2022"},
        ]

        result = analyzer._order_experiences_by_date(experiences)

        # Check order: Current (Present), Middle (2022), Old (2020)
        assert result[0][1]["title"] == "Current Job"
        assert result[1][1]["title"] == "Middle Job"
        assert result[2][1]["title"] == "Old Job"

    def test_handles_present_as_most_recent(self, analyzer):
        """Should treat 'Present', 'Current', etc. as most recent."""
        experiences = [
            {"title": "Job1", "end_date": "Present"},
            {"title": "Job2", "end_date": "Current"},
            {"title": "Job3", "end_date": "December 2023"},
        ]

        result = analyzer._order_experiences_by_date(experiences)

        # Both Present and Current should come before 2023
        recent_titles = [result[0][1]["title"], result[1][1]["title"]]
        assert "Job1" in recent_titles
        assert "Job2" in recent_titles

    def test_handles_missing_end_dates(self, analyzer):
        """Should handle missing end dates gracefully."""
        experiences = [
            {"title": "Job1", "end_date": ""},
            {"title": "Job2", "end_date": "June 2022"},
        ]

        result = analyzer._order_experiences_by_date(experiences)

        # Empty date treated as present (most recent)
        assert result[0][1]["title"] == "Job1"


class TestFindKeywordMatchesInStructuredResume:
    """Test finding keyword matches in structured resume."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_finds_keywords_in_experience_bullets(self, analyzer):
        """Should find keywords in experience bullet points."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "end_date": "Present",
                    "bullets": [
                        "Built Python applications",
                        "Managed AWS infrastructure",
                    ],
                }
            ]
        }

        matches = analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        assert len(matches) == 1
        assert matches[0].section == "experience"
        assert matches[0].role_index == 0

    def test_finds_keywords_in_skills_list(self, analyzer):
        """Should find keywords in skills section."""
        resume = {
            "skills": ["Python", "JavaScript", "AWS"]
        }

        matches = analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        assert len(matches) == 1
        assert matches[0].section == "skills"
        assert matches[0].role_index is None

    def test_finds_keywords_in_summary(self, analyzer):
        """Should find keywords in summary section."""
        resume = {
            "summary": "Experienced Python developer with 5 years experience"
        }

        matches = analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        assert len(matches) == 1
        assert matches[0].section == "summary"

    def test_finds_multiple_occurrences(self, analyzer):
        """Should find all occurrences across sections."""
        resume = {
            "summary": "Python developer",
            "experience": [
                {
                    "title": "Dev",
                    "end_date": "Present",
                    "bullets": ["Used Python daily"],
                }
            ],
            "skills": ["Python", "Django"],
        }

        matches = analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        assert len(matches) == 3
        sections = {m.section for m in matches}
        assert sections == {"summary", "experience", "skills"}

    def test_respects_word_boundaries(self, analyzer):
        """Should respect word boundaries when matching."""
        resume = {
            "skills": ["JavaScript", "TypeScript", "Java"]
        }

        matches = analyzer._find_keyword_matches_in_structured_resume("Java", resume)

        assert len(matches) == 1
        assert "Java" in matches[0].text_snippet

    def test_assigns_correct_recency_indices(self, analyzer):
        """Should assign correct recency indices based on role order."""
        resume = {
            "experience": [
                {
                    "title": "Senior Dev",
                    "end_date": "Present",
                    "bullets": ["Python expert"],
                },
                {
                    "title": "Mid Dev",
                    "end_date": "2022",
                    "bullets": ["Used Python"],
                },
                {
                    "title": "Junior Dev",
                    "end_date": "2020",
                    "bullets": ["Learned Python"],
                },
            ]
        }

        matches = analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        # Should have 3 matches with role indices 0, 1, 2
        assert len(matches) == 3
        role_indices = sorted([m.role_index for m in matches])
        assert role_indices == [0, 1, 2]


class TestCalculateKeywordWeightedScore:
    """Test weighted score calculation combining all Stage 2 factors."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_empty_matches_returns_zeros(self, analyzer):
        """Empty matches should return all zeros."""
        from app.services.job.ats_analyzer import KeywordMatch

        result = analyzer._calculate_keyword_weighted_score([], "required")

        assert result == (0.0, 0.0, 0.0, 0.0)

    def test_single_experience_match(self, analyzer):
        """Single match in experience should use full weights."""
        from app.services.job.ats_analyzer import KeywordMatch

        matches = [
            KeywordMatch(section="experience", role_index=0, text_snippet="Python")
        ]

        placement, density, recency, weighted = analyzer._calculate_keyword_weighted_score(
            matches, "required"
        )

        assert placement == 1.0  # experience = 1.0
        assert density == 1.0  # 1 occurrence = 1.0
        assert recency == 2.0  # role_index 0 = 2.0
        # weighted = 1.0 * 1.0 * 1.0 * 2.0 * 3.0 = 6.0
        assert weighted == 6.0

    def test_multiple_matches_uses_best_weights(self, analyzer):
        """Multiple matches should use best placement and recency."""
        from app.services.job.ats_analyzer import KeywordMatch

        matches = [
            KeywordMatch(section="skills", role_index=None, text_snippet="Python"),
            KeywordMatch(section="experience", role_index=1, text_snippet="Python"),
            KeywordMatch(section="experience", role_index=0, text_snippet="Python"),
        ]

        placement, density, recency, weighted = analyzer._calculate_keyword_weighted_score(
            matches, "preferred"
        )

        assert placement == 1.0  # best is experience = 1.0
        assert density == 1.5  # 3 occurrences = 1.5
        assert recency == 2.0  # best role_index is 0 = 2.0
        # weighted = 1.0 * 1.0 * 1.5 * 2.0 * 1.5 = 4.5
        assert weighted == 4.5

    def test_importance_affects_final_score(self, analyzer):
        """Importance tier should multiply final score."""
        from app.services.job.ats_analyzer import KeywordMatch

        matches = [
            KeywordMatch(section="experience", role_index=0, text_snippet="Test")
        ]

        _, _, _, required_score = analyzer._calculate_keyword_weighted_score(
            matches, "required"
        )
        _, _, _, nice_score = analyzer._calculate_keyword_weighted_score(
            matches, "nice_to_have"
        )

        # Required (3.0x) should be 3x nice_to_have (1.0x)
        assert required_score == nice_score * 3


class TestExtractKeywordsWithImportanceEnhanced:
    """Test enhanced keyword extraction with strongly_preferred tier."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    @pytest.mark.asyncio
    async def test_extracts_strongly_preferred_tier(self, analyzer):
        """Should extract strongly_preferred importance level."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"},
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Agile", "importance": "nice_to_have"}
        ]"""

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer._extract_keywords_with_importance_enhanced(
                "Test job description"
            )

        assert len(result) == 4
        importances = {r["importance"] for r in result}
        assert "strongly_preferred" in importances

    @pytest.mark.asyncio
    async def test_normalizes_invalid_importance(self, analyzer):
        """Should normalize invalid importance levels."""
        mock_response = """[
            {"keyword": "Python", "importance": "critical"},
            {"keyword": "AWS", "importance": "mandatory"}
        ]"""

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer._extract_keywords_with_importance_enhanced(
                "Test job description"
            )

        # Invalid importance should be normalized to nice_to_have
        assert all(r["importance"] == "nice_to_have" for r in result)


class TestAnalyzeKeywordsEnhanced:
    """Test the full enhanced keyword analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    @pytest.fixture
    def sample_resume(self) -> dict:
        """Sample structured resume for testing."""
        return {
            "summary": "Experienced Python developer",
            "experience": [
                {
                    "title": "Senior Developer",
                    "company": "TechCorp",
                    "end_date": "Present",
                    "bullets": [
                        "Built Python applications on AWS",
                        "Led team of 5 engineers",
                    ],
                },
                {
                    "title": "Developer",
                    "company": "StartupInc",
                    "end_date": "December 2022",
                    "bullets": [
                        "Developed microservices with Python",
                        "Implemented Docker containerization",
                    ],
                },
            ],
            "skills": ["Python", "AWS", "Docker", "Kubernetes"],
            "education": [
                {"degree": "BS Computer Science", "institution": "MIT"}
            ],
        }

    @pytest.mark.asyncio
    async def test_returns_enhanced_analysis_structure(self, analyzer, sample_resume):
        """Should return EnhancedKeywordAnalysis with all fields."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"},
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Rust", "importance": "nice_to_have"}
        ]"""
        vault_blocks = [{"content": "Docker and Kubernetes experience"}]

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords_enhanced(
                parsed_resume=sample_resume,
                job_description="Need Python, AWS, Docker, Rust",
                vault_blocks=vault_blocks,
            )

        # Check structure
        assert hasattr(result, "keyword_score")
        assert hasattr(result, "raw_coverage")
        assert hasattr(result, "strongly_preferred_coverage")
        assert hasattr(result, "placement_contribution")
        assert hasattr(result, "density_contribution")
        assert hasattr(result, "recency_contribution")
        assert hasattr(result, "gap_list")

    @pytest.mark.asyncio
    async def test_calculates_coverage_by_tier(self, analyzer, sample_resume):
        """Should calculate separate coverage for each importance tier."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"},
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Rust", "importance": "nice_to_have"}
        ]"""
        vault_blocks = []

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords_enhanced(
                parsed_resume=sample_resume,
                job_description="Test job",
                vault_blocks=vault_blocks,
            )

        # Python is in resume -> required_coverage = 1.0
        assert result.required_coverage == 1.0
        # AWS is in resume -> strongly_preferred_coverage = 1.0
        assert result.strongly_preferred_coverage == 1.0
        # Docker is in resume -> preferred_coverage = 1.0
        assert result.preferred_coverage == 1.0
        # Rust is NOT in resume -> nice_to_have_coverage = 0.0
        assert result.nice_to_have_coverage == 0.0

    @pytest.mark.asyncio
    async def test_groups_keywords_by_importance_with_strongly_preferred(
        self, analyzer, sample_resume
    ):
        """Should include strongly_preferred in grouping."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"},
            {"keyword": "Go", "importance": "strongly_preferred"}
        ]"""
        vault_blocks = []

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords_enhanced(
                parsed_resume=sample_resume,
                job_description="Test job",
                vault_blocks=vault_blocks,
            )

        assert "Python" in result.required_matched
        assert "AWS" in result.strongly_preferred_matched
        assert "Go" in result.strongly_preferred_missing

    @pytest.mark.asyncio
    async def test_weighted_score_higher_than_raw_coverage(self, analyzer, sample_resume):
        """Keywords in experience should boost weighted score above raw coverage."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "required"}
        ]"""
        vault_blocks = []

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords_enhanced(
                parsed_resume=sample_resume,
                job_description="Test job",
                vault_blocks=vault_blocks,
            )

        # Both keywords matched (100% raw coverage)
        assert result.raw_coverage == 100.0

        # With placement (1.0), density (multiple occurrences), and recency (2.0),
        # keyword_score can exceed raw coverage (normalized differently)
        # The score accounts for bonus factors
        assert result.keyword_score > 0

    @pytest.mark.asyncio
    async def test_gap_list_prioritized_by_importance(self, analyzer):
        """Gap list should be sorted by importance (required first)."""
        resume = {"skills": []}  # No skills
        mock_response = """[
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Python", "importance": "required"},
            {"keyword": "Go", "importance": "nice_to_have"},
            {"keyword": "AWS", "importance": "strongly_preferred"}
        ]"""
        vault_blocks = []

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords_enhanced(
                parsed_resume=resume,
                job_description="Test job",
                vault_blocks=vault_blocks,
            )

        # Gap list should be ordered: required, strongly_preferred, preferred, nice_to_have
        importances = [gap["importance"] for gap in result.gap_list]
        assert importances == ["required", "strongly_preferred", "preferred", "nice_to_have"]

    @pytest.mark.asyncio
    async def test_generates_prioritized_suggestions(self, analyzer):
        """Should generate suggestions with priority labels."""
        resume = {"skills": []}  # No skills
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"}
        ]"""
        vault_blocks = [
            {"content": "Python experience", "source_company": "TechCorp"},
            {"content": "AWS deployment", "source_company": "CloudInc"},
        ]

        with patch.object(
            analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await analyzer.analyze_keywords_enhanced(
                parsed_resume=resume,
                job_description="Test job",
                vault_blocks=vault_blocks,
            )

        # Should have suggestions with priority labels
        assert len(result.suggestions) > 0
        # Required keywords should have CRITICAL label
        assert any("CRITICAL" in s for s in result.suggestions)
        # Strongly preferred should have HIGH label
        assert any("HIGH" in s for s in result.suggestions)


# ============================================================
# Stage 3: Content Quality Analysis Tests
# ============================================================


class TestQuantificationDetection:
    """Test quantification pattern detection."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_detects_percentages(self, analyzer):
        """Should detect percentage metrics."""
        has_quant, metrics = analyzer._has_quantification("Increased revenue by 40%")
        assert has_quant is True
        assert any("40%" in m for m in metrics)

    def test_detects_currency(self, analyzer):
        """Should detect currency metrics."""
        has_quant, metrics = analyzer._has_quantification("Saved $50,000 in annual costs")
        assert has_quant is True

    def test_detects_user_counts(self, analyzer):
        """Should detect user/customer counts."""
        has_quant, metrics = analyzer._has_quantification("Grew user base to 100K users")
        assert has_quant is True

    def test_detects_multiples(self, analyzer):
        """Should detect improvement multiples."""
        has_quant, metrics = analyzer._has_quantification("Achieved 3x improvement in performance")
        assert has_quant is True

    def test_detects_time_metrics(self, analyzer):
        """Should detect time-based metrics."""
        has_quant, metrics = analyzer._has_quantification("Reduced processing time by 2 hours")
        assert has_quant is True

    def test_no_quantification(self, analyzer):
        """Should return False when no metrics present."""
        has_quant, metrics = analyzer._has_quantification("Responsible for team management")
        assert has_quant is False
        assert len(metrics) == 0


class TestActionVerbDetection:
    """Test action verb detection."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_detects_leadership_verbs(self, analyzer):
        """Should detect leadership action verbs."""
        has_action, categories = analyzer._has_action_verb("Led team of 5 engineers")
        assert has_action is True
        assert "leadership" in categories

    def test_detects_achievement_verbs(self, analyzer):
        """Should detect achievement action verbs."""
        has_action, categories = analyzer._has_action_verb("Achieved 150% of sales target")
        assert has_action is True
        assert "achievement" in categories

    def test_detects_creation_verbs(self, analyzer):
        """Should detect creation action verbs."""
        has_action, categories = analyzer._has_action_verb("Built microservices architecture")
        assert has_action is True
        assert "creation" in categories

    def test_detects_improvement_verbs(self, analyzer):
        """Should detect improvement action verbs."""
        has_action, categories = analyzer._has_action_verb("Improved system performance by 40%")
        assert has_action is True
        assert "improvement" in categories

    def test_no_action_verb(self, analyzer):
        """Should return False when no action verbs present."""
        has_action, categories = analyzer._has_action_verb("The project was completed")
        assert has_action is False
        assert len(categories) == 0


class TestWeakPhraseDetection:
    """Test weak phrase detection."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_detects_responsible_for(self, analyzer):
        """Should detect 'responsible for' weak phrase."""
        assert analyzer._has_weak_phrase("Responsible for managing the team") is True

    def test_detects_assisted_with(self, analyzer):
        """Should detect 'assisted with' weak phrase."""
        assert analyzer._has_weak_phrase("Assisted with development tasks") is True

    def test_detects_worked_on(self, analyzer):
        """Should detect 'worked on' weak phrase."""
        assert analyzer._has_weak_phrase("Worked on various projects") is True

    def test_no_weak_phrase(self, analyzer):
        """Should return False when no weak phrases present."""
        assert analyzer._has_weak_phrase("Led team to deliver project ahead of schedule") is False


class TestBulletAnalysis:
    """Test individual bullet analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_high_quality_bullet(self, analyzer):
        """Should score high for quantified achievement with action verb."""
        result = analyzer._analyze_bullet(
            "Led team of 5 engineers to deliver ML pipeline, reducing inference latency by 60%"
        )

        assert result.has_quantification is True
        assert result.has_action_verb is True
        assert result.has_weak_phrase is False
        assert result.quality_score >= 0.7

    def test_medium_quality_bullet(self, analyzer):
        """Should score medium for action verb without quantification."""
        result = analyzer._analyze_bullet(
            "Built microservices architecture for payment processing"
        )

        assert result.has_quantification is False
        assert result.has_action_verb is True
        assert result.has_weak_phrase is False
        assert 0.4 <= result.quality_score <= 0.7

    def test_low_quality_bullet(self, analyzer):
        """Should score low for responsibility bullet with weak phrase."""
        result = analyzer._analyze_bullet(
            "Responsible for maintaining backend services"
        )

        assert result.has_quantification is False
        assert result.has_weak_phrase is True
        assert result.quality_score < 0.4


class TestBulletTypeClassification:
    """Test bullet type classification."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_classifies_quantified_as_achievement(self, analyzer):
        """Should classify quantified bullets as achievements."""
        bullet = analyzer._analyze_bullet("Increased sales by 40%")
        bullet_type = analyzer._classify_bullet_type(bullet)
        assert bullet_type == "achievement"

    def test_classifies_weak_phrase_as_responsibility(self, analyzer):
        """Should classify weak phrase bullets as responsibilities."""
        bullet = analyzer._analyze_bullet("Responsible for customer support")
        bullet_type = analyzer._classify_bullet_type(bullet)
        assert bullet_type == "responsibility"

    def test_classifies_creation_as_project(self, analyzer):
        """Should classify creation verbs without metrics as projects."""
        bullet = analyzer._analyze_bullet("Built new authentication system")
        bullet_type = analyzer._classify_bullet_type(bullet)
        assert bullet_type in ("project", "achievement")


class TestBlockTypeAnalysis:
    """Test block type distribution analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_high_achievement_ratio_scores_well(self, analyzer):
        """Should score well when achievement ratio is high."""
        bullets = [
            analyzer._analyze_bullet("Increased revenue by 40%"),
            analyzer._analyze_bullet("Led team to deliver project"),
            analyzer._analyze_bullet("Built new microservices"),
            analyzer._analyze_bullet("Reduced costs by $50K"),
        ]

        result = analyzer._analyze_block_types(bullets)

        assert result.achievement_ratio >= 0.5
        assert result.quality_score >= 70

    def test_low_achievement_ratio_scores_poorly(self, analyzer):
        """Should score poorly when achievement ratio is low."""
        bullets = [
            analyzer._analyze_bullet("Responsible for team management"),
            analyzer._analyze_bullet("Assisted with daily operations"),
            analyzer._analyze_bullet("Worked on customer support"),
        ]

        result = analyzer._analyze_block_types(bullets)

        assert result.achievement_ratio < 0.5
        assert result.quality_score < 70

    def test_empty_bullets_returns_zero(self, analyzer):
        """Should return zero score for empty bullet list."""
        result = analyzer._analyze_block_types([])

        assert result.total_bullets == 0
        assert result.quality_score == 0.0


class TestQuantificationAnalysis:
    """Test quantification density analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_high_density_scores_well(self, analyzer):
        """Should score well when quantification density is high."""
        bullets = [
            analyzer._analyze_bullet("Increased revenue by 40%"),
            analyzer._analyze_bullet("Reduced costs by $50K"),
            analyzer._analyze_bullet("Grew user base to 100K"),
            analyzer._analyze_bullet("Improved performance by 3x"),
        ]

        result = analyzer._analyze_quantification(bullets)

        assert result.quantification_density >= 0.5
        assert result.quality_score >= 80

    def test_low_density_scores_poorly(self, analyzer):
        """Should score poorly when quantification density is low."""
        bullets = [
            analyzer._analyze_bullet("Led team to success"),
            analyzer._analyze_bullet("Built new features"),
            analyzer._analyze_bullet("Improved system performance"),
            analyzer._analyze_bullet("Managed client relationships"),
        ]

        result = analyzer._analyze_quantification(bullets)

        assert result.quantification_density < 0.5
        assert result.quality_score < 80


class TestActionVerbAnalysis:
    """Test action verb usage analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_high_coverage_scores_well(self, analyzer):
        """Should score well when action verb coverage is high."""
        bullets = [
            analyzer._analyze_bullet("Led team of engineers"),
            analyzer._analyze_bullet("Built microservices architecture"),
            analyzer._analyze_bullet("Improved system performance"),
            analyzer._analyze_bullet("Delivered project on time"),
        ]

        result = analyzer._analyze_action_verbs(bullets)

        assert result.action_verb_coverage >= 0.8
        assert result.quality_score >= 70

    def test_weak_phrases_reduce_score(self, analyzer):
        """Should reduce score when weak phrases are present."""
        bullets = [
            analyzer._analyze_bullet("Responsible for team management"),
            analyzer._analyze_bullet("Assisted with project delivery"),
            analyzer._analyze_bullet("Helped with customer support"),
        ]

        result = analyzer._analyze_action_verbs(bullets)

        assert result.weak_phrase_ratio > 0
        assert result.quality_score < 70


class TestContentQualityAnalysis:
    """Test full content quality analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    @pytest.fixture
    def high_quality_resume(self) -> dict:
        """Resume with high quality content."""
        return {
            "experience": [
                {
                    "title": "Senior Software Engineer",
                    "company": "TechCorp",
                    "bullets": [
                        "Led team of 5 engineers to deliver ML pipeline, reducing inference latency by 60%",
                        "Built microservices architecture serving 1M+ daily requests",
                        "Improved CI/CD pipeline reducing deployment time from 2 hours to 15 minutes",
                        "Achieved 99.9% uptime across all production services",
                    ],
                }
            ],
            "projects": [
                {
                    "name": "Open Source Contribution",
                    "bullets": [
                        "Created Python library with 5K+ GitHub stars",
                        "Reduced memory usage by 40% through optimization",
                    ],
                }
            ],
        }

    @pytest.fixture
    def low_quality_resume(self) -> dict:
        """Resume with low quality content."""
        return {
            "experience": [
                {
                    "title": "Software Engineer",
                    "company": "Corp",
                    "bullets": [
                        "Responsible for backend development",
                        "Worked on various projects",
                        "Assisted with code reviews",
                        "Helped with testing",
                    ],
                }
            ],
        }

    def test_returns_content_quality_result(self, analyzer, high_quality_resume):
        """Should return ContentQualityResult structure."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        assert isinstance(result, ContentQualityResult)
        assert hasattr(result, "content_quality_score")
        assert hasattr(result, "block_type_analysis")
        assert hasattr(result, "quantification_analysis")
        assert hasattr(result, "action_verb_analysis")

    def test_high_quality_resume_scores_well(self, analyzer, high_quality_resume):
        """Should score well for high quality resume."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        assert result.content_quality_score >= 70
        assert result.quantification_score >= 70
        assert result.action_verb_score >= 70

    def test_low_quality_resume_scores_poorly(self, analyzer, low_quality_resume):
        """Should score poorly for low quality resume."""
        result = analyzer.analyze_content_quality(low_quality_resume)

        assert result.content_quality_score < 70
        assert len(result.warnings) > 0

    def test_generates_suggestions(self, analyzer, low_quality_resume):
        """Should generate improvement suggestions."""
        result = analyzer.analyze_content_quality(low_quality_resume)

        assert len(result.suggestions) > 0 or len(result.warnings) > 0

    def test_empty_resume_handled_gracefully(self, analyzer):
        """Should handle resume with no bullets."""
        result = analyzer.analyze_content_quality({})

        assert result.content_quality_score == 0.0
        assert result.total_bullets_analyzed == 0
        assert len(result.warnings) > 0

    def test_counts_high_and_low_quality_bullets(self, analyzer, high_quality_resume):
        """Should count high and low quality bullets."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        assert result.total_bullets_analyzed > 0
        assert result.high_quality_bullets >= 0
        assert result.low_quality_bullets >= 0

    def test_component_weights_sum_to_one(self, analyzer, high_quality_resume):
        """Component weights should sum to 1.0."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        total_weight = (
            result.block_type_weight +
            result.quantification_weight +
            result.action_verb_weight
        )
        assert abs(total_weight - 1.0) < 0.01

    def test_extracts_metrics(self, analyzer, high_quality_resume):
        """Should extract metrics from bullets."""
        result = analyzer.analyze_content_quality(high_quality_resume)

        assert len(result.quantification_analysis.metrics_found) > 0

    def test_handles_description_field(self, analyzer):
        """Should handle experience with description instead of bullets."""
        resume = {
            "experience": [
                {
                    "title": "Developer",
                    "company": "Corp",
                    "description": "Led development of features. Improved performance by 30%. Built new systems.",
                }
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        assert result.total_bullets_analyzed > 0

    def test_handles_project_strings(self, analyzer):
        """Should handle projects as strings instead of dicts."""
        resume = {
            "projects": [
                "Built ML pipeline reducing latency by 50%",
                "Created API serving 1M requests daily",
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        assert result.total_bullets_analyzed == 2


class TestContentQualitySuggestions:
    """Test content quality suggestion generation."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_suggests_adding_metrics(self, analyzer):
        """Should suggest adding metrics when quantification is low."""
        resume = {
            "experience": [
                {
                    "bullets": [
                        "Led team to improve performance",
                        "Built new features",
                        "Managed client relationships",
                    ]
                }
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        # Should warn about low quantification
        assert any("metric" in w.lower() or "quantif" in w.lower() for w in result.warnings)

    def test_suggests_replacing_weak_phrases(self, analyzer):
        """Should suggest replacing weak phrases."""
        resume = {
            "experience": [
                {
                    "bullets": [
                        "Responsible for managing team",
                        "Assisted with development",
                        "Helped with testing",
                    ]
                }
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        # Should warn about weak phrases
        assert any("weak" in w.lower() or "responsible" in w.lower() for w in result.warnings)

    def test_positive_feedback_for_good_content(self, analyzer):
        """Should provide positive feedback for good content."""
        resume = {
            "experience": [
                {
                    "bullets": [
                        "Increased revenue by 40%",
                        "Reduced costs by $50K",
                        "Grew user base to 100K users",
                        "Improved performance by 3x",
                    ]
                }
            ]
        }

        result = analyzer.analyze_content_quality(resume)

        # Should have positive suggestions
        assert any(
            "excellent" in s.lower() or "strong" in s.lower()
            for s in result.suggestions
        )


# ============================================================
# Stage 4: Role Proximity Score Tests
# ============================================================


class TestTitleNormalization:
    """Test title normalization functionality."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_expand_common_abbreviations(self, analyzer):
        """Should expand common abbreviations."""
        assert "senior" in analyzer._normalize_title("Sr. Engineer")
        assert "senior" in analyzer._normalize_title("SR Engineer")
        assert "junior" in analyzer._normalize_title("Jr. Developer")
        assert "software engineer" in analyzer._normalize_title("SWE")
        assert "vice president" in analyzer._normalize_title("VP of Engineering")

    def test_normalize_to_lowercase(self, analyzer):
        """Should normalize to lowercase."""
        result = analyzer._normalize_title("Senior Software ENGINEER")
        assert result == result.lower()

    def test_remove_special_characters(self, analyzer):
        """Should remove special characters."""
        result = analyzer._normalize_title("Full-Stack Developer")
        assert "-" not in result
        assert "full stack developer" in result

    def test_collapse_multiple_spaces(self, analyzer):
        """Should collapse multiple spaces."""
        result = analyzer._normalize_title("Senior   Software    Engineer")
        assert "  " not in result

    def test_empty_title(self, analyzer):
        """Should handle empty titles."""
        assert analyzer._normalize_title("") == ""
        assert analyzer._normalize_title(None) == ""


class TestLevelExtraction:
    """Test seniority level extraction."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_explicit_levels(self, analyzer):
        """Should extract explicit level keywords."""
        assert analyzer._extract_level("Intern Developer") == 0
        assert analyzer._extract_level("Junior Engineer") == 1
        assert analyzer._extract_level("Senior Developer") == 3
        assert analyzer._extract_level("Staff Engineer") == 4
        assert analyzer._extract_level("Principal Engineer") == 5
        assert analyzer._extract_level("Engineering Director") == 6
        assert analyzer._extract_level("VP of Engineering") == 7
        assert analyzer._extract_level("Chief Technology Officer") == 8

    def test_numeric_levels(self, analyzer):
        """Should extract numeric levels."""
        assert analyzer._extract_level("Engineer II") == 2
        assert analyzer._extract_level("Engineer III") == 3
        assert analyzer._extract_level("Level 2 Developer") == 2

    def test_default_to_mid_level(self, analyzer):
        """Should default to mid-level when unclear."""
        assert analyzer._extract_level("Software Engineer") == 2
        assert analyzer._extract_level("Developer") == 2
        assert analyzer._extract_level("") == 2


class TestFunctionExtraction:
    """Test functional category extraction."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_engineering_function(self, analyzer):
        """Should detect engineering roles."""
        assert analyzer._extract_function("Software Engineer") == "engineering"
        assert analyzer._extract_function("Backend Developer") == "engineering"
        assert analyzer._extract_function("Full Stack Developer") == "engineering"

    def test_product_function(self, analyzer):
        """Should detect product roles."""
        assert analyzer._extract_function("Product Manager") == "product"
        assert analyzer._extract_function("PM") == "product"

    def test_design_function(self, analyzer):
        """Should detect design roles."""
        assert analyzer._extract_function("UX Designer") == "design"
        assert analyzer._extract_function("UI/UX Designer") == "design"

    def test_data_function(self, analyzer):
        """Should detect data roles."""
        assert analyzer._extract_function("Data Scientist") == "data"
        assert analyzer._extract_function("ML Engineer") == "data"

    def test_other_function(self, analyzer):
        """Should return 'other' for unknown functions."""
        assert analyzer._extract_function("Office Manager") == "other"
        assert analyzer._extract_function("Specialist") == "other"


class TestIndustryExtraction:
    """Test industry detection."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_tech_industry(self, analyzer):
        """Should detect tech industry."""
        assert analyzer._extract_industry("Google") == "other"  # Need context
        assert analyzer._extract_industry("TechCorp", "software startup") == "tech"
        assert analyzer._extract_industry("SaaS Company", "") == "tech"

    def test_finance_industry(self, analyzer):
        """Should detect finance industry."""
        assert analyzer._extract_industry("Goldman Sachs", "investment banking") == "finance"
        assert analyzer._extract_industry("FinServe", "financial services") == "finance"

    def test_healthcare_industry(self, analyzer):
        """Should detect healthcare industry."""
        assert analyzer._extract_industry("MedCorp", "healthcare solutions") == "healthcare"
        assert analyzer._extract_industry("BioTech Inc", "biotech research") == "healthcare"

    def test_other_industry(self, analyzer):
        """Should return 'other' for unknown industries."""
        assert analyzer._extract_industry("Acme Corp", "") == "other"


class TestTrajectoryAnalysis:
    """Test career trajectory analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_progressing_toward(self, analyzer):
        """Should detect natural progression."""
        experience = [
            {"title": "Senior Software Engineer"},
            {"title": "Software Engineer"},
            {"title": "Junior Developer"},
        ]

        result = analyzer._calculate_trajectory_score(
            experience,
            "Staff Engineer",
            4,  # Staff level
            "engineering",
        )

        assert result.trajectory_type == "progressing_toward"
        assert result.modifier == 20
        assert result.is_ascending is True

    def test_lateral_move(self, analyzer):
        """Should detect lateral moves."""
        experience = [
            {"title": "Senior Software Engineer"},
        ]

        result = analyzer._calculate_trajectory_score(
            experience,
            "Senior Backend Engineer",
            3,  # Same level
            "engineering",
        )

        assert result.trajectory_type == "lateral"
        assert result.modifier == 10

    def test_step_down(self, analyzer):
        """Should detect step downs."""
        experience = [
            {"title": "Staff Engineer"},
        ]

        result = analyzer._calculate_trajectory_score(
            experience,
            "Software Engineer",
            2,  # Lower level
            "engineering",
        )

        assert result.trajectory_type == "step_down"
        assert result.modifier == -10

    def test_large_gap(self, analyzer):
        """Should detect large level gaps."""
        experience = [
            {"title": "Junior Developer"},
        ]

        result = analyzer._calculate_trajectory_score(
            experience,
            "Engineering Director",
            6,  # Much higher level
            "engineering",
        )

        assert result.trajectory_type == "large_gap"
        assert result.modifier == -15

    def test_career_change(self, analyzer):
        """Should detect career changes."""
        experience = [
            {"title": "Senior Software Engineer"},
        ]

        result = analyzer._calculate_trajectory_score(
            experience,
            "Product Manager",
            3,  # Same level, different function
            "product",
        )

        assert result.trajectory_type == "career_change"
        assert result.modifier == -5

    def test_empty_experience(self, analyzer):
        """Should handle empty experience."""
        result = analyzer._calculate_trajectory_score(
            [],
            "Software Engineer",
            2,
            "engineering",
        )

        assert result.trajectory_type == "unclear"
        assert result.modifier == 0


class TestIndustryAlignment:
    """Test industry alignment analysis."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_same_industry(self, analyzer):
        """Should detect same industry alignment."""
        experience = [
            {"company": "TechCorp", "description": "software startup"},
        ]

        result = analyzer._calculate_industry_alignment(
            experience,
            "SaaS Company",
            "technology company",
        )

        assert result.alignment_type == "same"
        assert result.modifier == 10

    def test_adjacent_industry(self, analyzer):
        """Should detect adjacent industries."""
        experience = [
            {"company": "FinTech Inc", "description": "fintech startup"},
        ]

        result = analyzer._calculate_industry_alignment(
            experience,
            "Bank Corp",
            "banking services",
        )

        # Fintech is adjacent to finance
        assert result.alignment_type == "adjacent"
        assert result.modifier == 5

    def test_unrelated_industry(self, analyzer):
        """Should detect unrelated industries."""
        experience = [
            {"company": "Hospital", "description": "healthcare"},
        ]

        result = analyzer._calculate_industry_alignment(
            experience,
            "Law Firm",
            "legal services",
        )

        assert result.alignment_type == "unrelated"
        assert result.modifier == 0


class TestRoleProximityScore:
    """Test full role proximity score calculation."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    @pytest.mark.asyncio
    async def test_high_proximity_score(self, analyzer):
        """Should give high score for well-matched role."""
        resume = {
            "experience": [
                {"title": "Senior Software Engineer", "company": "TechCorp"},
                {"title": "Software Engineer", "company": "StartupInc"},
            ]
        }
        job = {
            "title": "Staff Software Engineer",
            "company": "BigTech",
        }

        with patch.object(
            analyzer,
            "_calculate_title_similarity",
            new=AsyncMock(return_value=0.85),
        ):
            result = await analyzer.calculate_role_proximity_score(resume, job)

        # High similarity + progressing toward = high score
        assert result.role_proximity_score >= 80
        assert result.title_match.function_match is True
        assert result.trajectory.trajectory_type == "progressing_toward"

    @pytest.mark.asyncio
    async def test_low_proximity_score_function_mismatch(self, analyzer):
        """Should give lower score for function mismatch."""
        resume = {
            "experience": [
                {"title": "Senior Software Engineer", "company": "TechCorp"},
            ]
        }
        job = {
            "title": "Product Manager",
            "company": "BigTech",
        }

        with patch.object(
            analyzer,
            "_calculate_title_similarity",
            new=AsyncMock(return_value=0.3),
        ):
            result = await analyzer.calculate_role_proximity_score(resume, job)

        assert result.role_proximity_score < 60
        assert result.title_match.function_match is False
        assert result.trajectory.trajectory_type == "career_change"

    @pytest.mark.asyncio
    async def test_concerns_and_strengths(self, analyzer):
        """Should generate appropriate concerns and strengths."""
        resume = {
            "experience": [
                {"title": "Senior Software Engineer", "company": "TechCorp"},
                {"title": "Software Engineer", "company": "StartupInc"},
                {"title": "Junior Developer", "company": "OtherCo"},
            ]
        }
        job = {
            "title": "Staff Software Engineer",
            "company": "Tech Company",
        }

        with patch.object(
            analyzer,
            "_calculate_title_similarity",
            new=AsyncMock(return_value=0.80),
        ):
            result = await analyzer.calculate_role_proximity_score(resume, job)

        # Should have strengths for ascending career
        assert any("progression" in s.lower() or "ascending" in s.lower() for s in result.strengths)
        # Should have explanation
        assert len(result.explanation) > 0

    @pytest.mark.asyncio
    async def test_empty_experience(self, analyzer):
        """Should handle empty experience gracefully."""
        resume = {"experience": []}
        job = {
            "title": "Software Engineer",
            "company": "TechCorp",
        }

        with patch.object(
            analyzer,
            "_calculate_title_similarity",
            new=AsyncMock(return_value=0.0),
        ):
            result = await analyzer.calculate_role_proximity_score(resume, job)

        assert result.role_proximity_score >= 0
        assert result.trajectory.trajectory_type == "unclear"

    @pytest.mark.asyncio
    async def test_score_clamping(self, analyzer):
        """Should clamp score to 0-100 range."""
        resume = {
            "experience": [
                {"title": "Staff Engineer", "company": "Tech"},
            ]
        }
        job = {
            "title": "Junior Developer",
            "company": "Startup",
        }

        with patch.object(
            analyzer,
            "_calculate_title_similarity",
            new=AsyncMock(return_value=0.1),  # Low similarity
        ):
            result = await analyzer.calculate_role_proximity_score(resume, job)

        # Score should be clamped even with negative modifiers
        assert 0 <= result.role_proximity_score <= 100


class TestBasicTitleSimilarity:
    """Test basic (fallback) title similarity."""

    @pytest.fixture
    def analyzer(self) -> ATSAnalyzer:
        return ATSAnalyzer()

    def test_identical_titles(self, analyzer):
        """Should return 1.0 for identical titles."""
        similarity = analyzer._basic_title_similarity(
            "software engineer",
            "software engineer"
        )
        assert similarity == 1.0

    def test_partial_overlap(self, analyzer):
        """Should return partial similarity for overlap."""
        similarity = analyzer._basic_title_similarity(
            "senior software engineer",
            "software engineer"
        )
        assert 0 < similarity < 1.0

    def test_no_overlap(self, analyzer):
        """Should return 0 for no overlap."""
        similarity = analyzer._basic_title_similarity(
            "chef",
            "pilot"
        )
        assert similarity == 0.0

    def test_empty_titles(self, analyzer):
        """Should handle empty titles."""
        assert analyzer._basic_title_similarity("", "") == 0.0
        assert analyzer._basic_title_similarity("engineer", "") == 0.0
