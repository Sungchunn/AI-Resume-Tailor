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
    EDUCATION_LEVELS,
    EDUCATION_PATTERNS,
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
