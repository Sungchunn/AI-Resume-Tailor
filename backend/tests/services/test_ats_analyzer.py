"""Tests for the ATS Analyzer service."""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.job.ats_analyzer import ATSAnalyzer, get_ats_analyzer


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
