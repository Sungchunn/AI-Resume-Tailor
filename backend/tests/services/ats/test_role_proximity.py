"""Tests for ATS role proximity analysis functionality."""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.job.ats import ATSAnalyzer


class TestTitleNormalization:
    """Test title normalization functionality."""

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
        assert analyzer._extract_function("Receptionist") == "other"
        assert analyzer._extract_function("Specialist") == "other"

    def test_management_function(self, analyzer):
        """Should detect management roles."""
        assert analyzer._extract_function("Office Manager") == "management"
        assert analyzer._extract_function("General Manager") == "management"
        # Note: "Engineering Director" is classified as "engineering" because
        # the function prioritizes the specific function over management level


class TestIndustryExtraction:
    """Test industry detection."""

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
        assert analyzer._extract_industry("PharmaCo", "pharma research") == "healthcare"

    def test_other_industry(self, analyzer):
        """Should return 'other' for unknown industries."""
        assert analyzer._extract_industry("Acme Corp", "") == "other"


class TestTrajectoryAnalysis:
    """Test career trajectory analysis."""

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
        # Media is adjacent to tech
        experience = [
            {"company": "MediaCorp", "description": "entertainment streaming"},
        ]

        result = analyzer._calculate_industry_alignment(
            experience,
            "TechStartup",
            "software technology company",
        )

        # Media is adjacent to tech
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
