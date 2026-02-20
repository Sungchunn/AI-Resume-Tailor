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
