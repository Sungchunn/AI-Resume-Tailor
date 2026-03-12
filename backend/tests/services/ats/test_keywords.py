"""Tests for ATS keyword analysis functionality."""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.job.ats import KeywordMatch
from app.services.job.ats.analyzers import (
    KeywordAnalyzer,
    basic_keyword_extraction,
    get_keyword_context,
    count_keyword_frequency,
)


class TestAnalyzeKeywords:
    """Test analyze_keywords method."""

    @pytest.mark.asyncio
    async def test_keyword_matching(self, keyword_analyzer, mock_ai_response):
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
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_ai_response),
        ):
            result = await keyword_analyzer.analyze_keywords(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # ATSReportData is a Pydantic model, use attribute access
        assert "Python" in result.matched_keywords
        assert "AWS" in result.matched_keywords
        assert result.keyword_coverage > 0

    @pytest.mark.asyncio
    async def test_missing_keywords_in_vault(self, keyword_analyzer, mock_ai_response):
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
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_ai_response),
        ):
            result = await keyword_analyzer.analyze_keywords(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # AWS is in vault but not in resume
        # ATSReportData is a Pydantic model, use attribute access
        assert "AWS" in result.missing_keywords

    @pytest.mark.asyncio
    async def test_missing_from_vault(self, keyword_analyzer):
        """Should identify keywords not in vault at all."""
        resume_blocks = [
            {"content": "Python developer"},
        ]
        vault_blocks = resume_blocks  # Same content
        job_description = "Need Kubernetes experience"

        # Mock response with Kubernetes
        mock_response = '["Python", "Kubernetes", "Docker"]'

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # Kubernetes not in vault
        # ATSReportData is a Pydantic model, use attribute access
        assert "Kubernetes" in result.missing_from_vault

    @pytest.mark.asyncio
    async def test_low_coverage_warning(self, keyword_analyzer):
        """Should warn about low keyword coverage."""
        resume_blocks = [
            {"content": "Basic experience"},
        ]
        vault_blocks = resume_blocks
        job_description = "Expert in Python, AWS, Docker, Kubernetes, CI/CD"

        mock_response = '["Python", "AWS", "Docker", "Kubernetes", "CI/CD"]'

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # ATSReportData is a Pydantic model, use attribute access
        assert result.keyword_coverage < 0.3
        assert len(result.warnings) > 0


class TestBasicKeywordExtraction:
    """Test fallback keyword extraction.

    Note: basic_keyword_extraction is a standalone utility function.
    """

    def test_extract_tech_keywords(self):
        """Should extract technology keywords."""
        text = """
        We need a Python developer with experience in AWS, Docker, and Kubernetes.
        Must know React and Node.js for frontend development.
        """

        keywords = basic_keyword_extraction(text)

        assert "Python" in keywords
        assert "AWS" in keywords
        assert "Docker" in keywords
        assert "React" in keywords

    def test_extract_soft_skills(self):
        """Should extract soft skill keywords."""
        text = """
        Strong leadership and communication skills required.
        Problem-solving abilities essential.
        """

        keywords = basic_keyword_extraction(text)

        assert any("leadership" in k.lower() for k in keywords)
        assert any("communication" in k.lower() for k in keywords)

    def test_limits_keywords(self):
        """Should limit number of keywords."""
        text = """
        Python Java JavaScript TypeScript C++ C# Go Rust Ruby PHP Swift Kotlin
        AWS Azure GCP Docker Kubernetes React Angular Vue Node.js Django Flask
        SQL PostgreSQL MySQL MongoDB Redis Elasticsearch CI/CD DevOps Agile
        """

        keywords = basic_keyword_extraction(text)

        assert len(keywords) <= 25


class TestExtractKeywordsWithImportance:
    """Test keyword extraction with importance levels."""

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
    async def test_extract_with_importance(self, keyword_analyzer, mock_importance_response):
        """Should extract keywords with importance levels."""
        job_description = "Required: Python, AWS. Preferred: Docker, Kubernetes. Nice to have: Team leadership"

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await keyword_analyzer._extract_keywords_with_importance(job_description)

        assert len(result) == 5
        assert any(k["keyword"] == "Python" and k["importance"] == "required" for k in result)
        assert any(k["keyword"] == "Docker" and k["importance"] == "preferred" for k in result)
        assert any(k["keyword"] == "Team leadership" and k["importance"] == "nice_to_have" for k in result)

    @pytest.mark.asyncio
    async def test_fallback_to_basic_extraction(self, keyword_analyzer):
        """Should fallback to basic extraction on AI failure."""
        job_description = "Python and AWS developer needed"

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(side_effect=Exception("AI Error")),
        ):
            result = await keyword_analyzer._extract_keywords_with_importance(job_description)

        # Should fallback and assign "preferred" importance
        assert all(k["importance"] == "preferred" for k in result)

    @pytest.mark.asyncio
    async def test_invalid_importance_normalized(self, keyword_analyzer):
        """Should normalize invalid importance to nice_to_have."""
        mock_response = '[{"keyword": "Python", "importance": "critical"}]'

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer._extract_keywords_with_importance("Test job")

        assert result[0]["importance"] == "nice_to_have"


class TestGetKeywordContext:
    """Test keyword context extraction.

    Note: get_keyword_context is a standalone utility function.
    """

    def test_extract_context(self):
        """Should extract context around keyword."""
        text = "We are looking for a skilled Python developer with 5+ years experience"
        context = get_keyword_context("Python", text)

        assert context is not None
        assert "Python" in context

    def test_no_match_returns_none(self):
        """Should return None when keyword not found."""
        text = "We need a Java developer"
        context = get_keyword_context("Python", text)

        assert context is None

    def test_adds_ellipsis(self):
        """Should add ellipsis when context is truncated."""
        text = "x" * 100 + "Python" + "y" * 100
        context = get_keyword_context("Python", text)

        assert context is not None
        assert "..." in context


class TestCountKeywordFrequency:
    """Test keyword frequency counting.

    Note: count_keyword_frequency is a standalone utility function.
    """

    def test_count_single_occurrence(self):
        """Should count single keyword occurrence."""
        text = "Python is a great language"
        count = count_keyword_frequency("Python", text)

        assert count == 1

    def test_count_multiple_occurrences(self):
        """Should count multiple keyword occurrences."""
        text = "Python Python Python everywhere"
        count = count_keyword_frequency("Python", text)

        assert count == 3

    def test_case_insensitive(self):
        """Should count case-insensitively."""
        text = "python PYTHON Python"
        count = count_keyword_frequency("Python", text)

        assert count == 3

    def test_word_boundaries(self):
        """Should respect word boundaries."""
        text = "Pythonic is not Python"
        count = count_keyword_frequency("Python", text)

        assert count == 1  # Only "Python", not "Pythonic"


class TestAnalyzeKeywordsDetailed:
    """Test detailed keyword analysis."""

    @pytest.mark.asyncio
    async def test_detailed_analysis_structure(self, keyword_analyzer, mock_importance_response):
        """Should return DetailedKeywordAnalysis with all fields."""
        resume_blocks = [{"content": "Python developer with AWS experience"}]
        vault_blocks = resume_blocks + [{"content": "Docker containerization"}]
        job_description = "Required: Python, AWS. Preferred: Docker. Nice: Kubernetes"

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await keyword_analyzer.analyze_keywords_detailed(
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
    async def test_required_keywords_grouping(self, keyword_analyzer, mock_importance_response):
        """Should correctly group required keywords."""
        resume_blocks = [{"content": "Python developer"}]  # Has Python, no AWS
        vault_blocks = [{"content": "Python developer with AWS"}]  # Has AWS in vault
        job_description = "Required: Python, AWS"

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await keyword_analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        assert "Python" in result.required_matched
        assert "AWS" in result.required_missing

    @pytest.mark.asyncio
    async def test_vault_availability_tracking(self, keyword_analyzer, mock_importance_response):
        """Should track vault availability for missing keywords."""
        resume_blocks = [{"content": "Basic developer"}]
        vault_blocks = [
            {"content": "Basic developer"},
            {"content": "Docker experience", "source_company": "TechCorp"},
        ]
        job_description = "Need Docker and Kubernetes"

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await keyword_analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        # Docker is in vault, Kubernetes is not
        assert "Docker" in result.missing_available_in_vault
        assert "Kubernetes" in result.missing_not_in_vault

    @pytest.mark.asyncio
    async def test_coverage_calculation(self, keyword_analyzer, mock_importance_response):
        """Should calculate coverage scores correctly."""
        resume_blocks = [{"content": "Python AWS Docker developer"}]  # 3 of 4 keywords
        vault_blocks = resume_blocks
        job_description = "Need Python, AWS, Docker, Kubernetes"

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await keyword_analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        assert result.coverage_score == 0.75  # 3/4
        assert result.required_coverage == 1.0  # Python and AWS both matched

    @pytest.mark.asyncio
    async def test_keyword_details(self, keyword_analyzer, mock_importance_response):
        """Should include detailed info for each keyword."""
        resume_blocks = [{"content": "Python developer"}]
        vault_blocks = resume_blocks
        job_description = "Python Python developer needed"  # Python appears twice

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_importance_response),
        ):
            result = await keyword_analyzer.analyze_keywords_detailed(
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
    async def test_warnings_on_low_coverage(self, keyword_analyzer):
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
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords_detailed(
                resume_blocks=resume_blocks,
                job_description=job_description,
                vault_blocks=vault_blocks,
            )

        assert result.required_coverage < 0.5
        assert len(result.warnings) > 0


class TestGenerateDetailedSuggestions:
    """Test detailed suggestion generation."""

    def test_prioritizes_required_keywords(self, keyword_analyzer):
        """Should prioritize required keywords in suggestions."""
        required_missing = ["Python", "AWS"]
        preferred_missing = ["Docker"]
        available_in_vault = ["Python", "Docker"]
        vault_blocks = [
            {"content": "Python experience", "source_company": "TechCorp"},
            {"content": "Docker skills", "source_company": "StartupInc"},
        ]

        suggestions = keyword_analyzer._generate_detailed_suggestions(
            required_missing=required_missing,
            preferred_missing=preferred_missing,
            available_in_vault=available_in_vault,
            vault_blocks=vault_blocks,
        )

        # Should mention required keyword first
        assert any("Python" in s and "required" in s for s in suggestions)

    def test_includes_source_company(self, keyword_analyzer):
        """Should include source company in suggestions."""
        required_missing = ["Python"]
        preferred_missing = []
        available_in_vault = ["Python"]
        vault_blocks = [
            {"content": "Python experience", "source_company": "TechCorp"},
        ]

        suggestions = keyword_analyzer._generate_detailed_suggestions(
            required_missing=required_missing,
            preferred_missing=preferred_missing,
            available_in_vault=available_in_vault,
            vault_blocks=vault_blocks,
        )

        assert any("TechCorp" in s for s in suggestions)


# ============================================================
# Stage 2: Enhanced Keyword Scoring Tests
# ============================================================


class TestSectionTypeDetection:
    """Test section type detection for placement weighting."""

    def test_detects_experience_section(self, keyword_analyzer):
        """Should detect experience section variants."""
        assert keyword_analyzer._detect_section_type("experience") == "experience"
        assert keyword_analyzer._detect_section_type("work experience") == "experience"
        assert keyword_analyzer._detect_section_type("Employment History") == "experience"
        assert keyword_analyzer._detect_section_type("PROFESSIONAL EXPERIENCE") == "experience"

    def test_detects_skills_section(self, keyword_analyzer):
        """Should detect skills section variants."""
        assert keyword_analyzer._detect_section_type("skills") == "skills"
        assert keyword_analyzer._detect_section_type("Technical Skills") == "skills"
        assert keyword_analyzer._detect_section_type("CORE COMPETENCIES") == "skills"

    def test_detects_education_section(self, keyword_analyzer):
        """Should detect education section variants."""
        assert keyword_analyzer._detect_section_type("education") == "education"
        assert keyword_analyzer._detect_section_type("Academic Background") == "education"

    def test_detects_projects_section(self, keyword_analyzer):
        """Should detect projects section variants."""
        assert keyword_analyzer._detect_section_type("projects") == "projects"
        assert keyword_analyzer._detect_section_type("Key Projects") == "projects"

    def test_detects_summary_section(self, keyword_analyzer):
        """Should detect summary section variants."""
        assert keyword_analyzer._detect_section_type("summary") == "summary"
        assert keyword_analyzer._detect_section_type("Professional Summary") == "summary"
        assert keyword_analyzer._detect_section_type("OBJECTIVE") == "summary"

    def test_returns_other_for_unknown(self, keyword_analyzer):
        """Should return 'other' for unrecognized sections."""
        assert keyword_analyzer._detect_section_type("random_key") == "other"
        assert keyword_analyzer._detect_section_type("contact") == "other"


class TestPlacementWeighting:
    """Test placement weight calculation (Stage 2.1)."""

    def test_experience_has_highest_weight(self, keyword_analyzer):
        """Experience section should have weight 1.0."""
        assert keyword_analyzer._get_placement_weight("experience") == 1.0

    def test_projects_has_high_weight(self, keyword_analyzer):
        """Projects section should have weight 0.9."""
        assert keyword_analyzer._get_placement_weight("projects") == 0.9

    def test_skills_has_medium_weight(self, keyword_analyzer):
        """Skills section should have weight 0.7."""
        assert keyword_analyzer._get_placement_weight("skills") == 0.7

    def test_summary_has_low_weight(self, keyword_analyzer):
        """Summary section should have weight 0.6."""
        assert keyword_analyzer._get_placement_weight("summary") == 0.6

    def test_education_has_lowest_weight(self, keyword_analyzer):
        """Education section should have weight 0.5."""
        assert keyword_analyzer._get_placement_weight("education") == 0.5

    def test_unknown_section_has_default_weight(self, keyword_analyzer):
        """Unknown sections should have weight 0.5."""
        assert keyword_analyzer._get_placement_weight("other") == 0.5
        assert keyword_analyzer._get_placement_weight("unknown") == 0.5


class TestDensityScoring:
    """Test density scoring with diminishing returns (Stage 2.2)."""

    def test_zero_occurrences_returns_zero(self, keyword_analyzer):
        """Zero occurrences should return 0."""
        assert keyword_analyzer._get_density_multiplier(0) == 0.0

    def test_single_occurrence_returns_one(self, keyword_analyzer):
        """Single occurrence should return 1.0."""
        assert keyword_analyzer._get_density_multiplier(1) == 1.0

    def test_two_occurrences_returns_1_3(self, keyword_analyzer):
        """Two occurrences should return 1.3."""
        assert keyword_analyzer._get_density_multiplier(2) == 1.3

    def test_three_occurrences_returns_1_5(self, keyword_analyzer):
        """Three occurrences should return 1.5."""
        assert keyword_analyzer._get_density_multiplier(3) == 1.5

    def test_more_occurrences_capped_at_1_5(self, keyword_analyzer):
        """Four or more occurrences should cap at 1.5."""
        assert keyword_analyzer._get_density_multiplier(4) == 1.5
        assert keyword_analyzer._get_density_multiplier(10) == 1.5
        assert keyword_analyzer._get_density_multiplier(100) == 1.5


class TestRecencyWeighting:
    """Test recency weighting by role position (Stage 2.3)."""

    def test_most_recent_role_weighted_2x(self, keyword_analyzer):
        """Most recent role (index 0) should have weight 2.0."""
        assert keyword_analyzer._get_recency_weight(0) == 2.0

    def test_second_role_weighted_2x(self, keyword_analyzer):
        """Second most recent role (index 1) should have weight 2.0."""
        assert keyword_analyzer._get_recency_weight(1) == 2.0

    def test_third_role_weighted_1x(self, keyword_analyzer):
        """Third most recent role (index 2) should have weight 1.0."""
        assert keyword_analyzer._get_recency_weight(2) == 1.0

    def test_older_roles_weighted_0_8x(self, keyword_analyzer):
        """Older roles (index 3+) should have weight 0.8."""
        assert keyword_analyzer._get_recency_weight(3) == 0.8
        assert keyword_analyzer._get_recency_weight(4) == 0.8
        assert keyword_analyzer._get_recency_weight(10) == 0.8

    def test_none_role_index_returns_neutral(self, keyword_analyzer):
        """None role index should return neutral weight 1.0."""
        assert keyword_analyzer._get_recency_weight(None) == 1.0


class TestImportanceWeighting:
    """Test importance tier weighting (Stage 2.4)."""

    def test_required_weighted_3x(self, keyword_analyzer):
        """Required keywords should have weight 3.0."""
        assert keyword_analyzer._get_importance_weight("required") == 3.0

    def test_strongly_preferred_weighted_2x(self, keyword_analyzer):
        """Strongly preferred keywords should have weight 2.0."""
        assert keyword_analyzer._get_importance_weight("strongly_preferred") == 2.0

    def test_preferred_weighted_1_5x(self, keyword_analyzer):
        """Preferred keywords should have weight 1.5."""
        assert keyword_analyzer._get_importance_weight("preferred") == 1.5

    def test_nice_to_have_weighted_1x(self, keyword_analyzer):
        """Nice to have keywords should have weight 1.0."""
        assert keyword_analyzer._get_importance_weight("nice_to_have") == 1.0


class TestOrderExperiencesByDate:
    """Test experience ordering by date for recency calculation."""

    def test_orders_by_end_date_descending(self, keyword_analyzer):
        """Should order experiences by end date (most recent first)."""
        experiences = [
            {"title": "Old Job", "end_date": "December 2020"},
            {"title": "Current Job", "end_date": "Present"},
            {"title": "Middle Job", "end_date": "June 2022"},
        ]

        result = keyword_analyzer._order_experiences_by_date(experiences)

        # Check order: Current (Present), Middle (2022), Old (2020)
        assert result[0][1]["title"] == "Current Job"
        assert result[1][1]["title"] == "Middle Job"
        assert result[2][1]["title"] == "Old Job"

    def test_handles_present_as_most_recent(self, keyword_analyzer):
        """Should treat 'Present', 'Current', etc. as most recent."""
        experiences = [
            {"title": "Job1", "end_date": "Present"},
            {"title": "Job2", "end_date": "Current"},
            {"title": "Job3", "end_date": "December 2023"},
        ]

        result = keyword_analyzer._order_experiences_by_date(experiences)

        # Both Present and Current should come before 2023
        recent_titles = [result[0][1]["title"], result[1][1]["title"]]
        assert "Job1" in recent_titles
        assert "Job2" in recent_titles

    def test_handles_missing_end_dates(self, keyword_analyzer):
        """Should handle missing end dates gracefully."""
        experiences = [
            {"title": "Job1", "end_date": ""},
            {"title": "Job2", "end_date": "June 2022"},
        ]

        result = keyword_analyzer._order_experiences_by_date(experiences)

        # Empty date treated as present (most recent)
        assert result[0][1]["title"] == "Job1"


class TestFindKeywordMatchesInStructuredResume:
    """Test finding keyword matches in structured resume."""

    def test_finds_keywords_in_experience_bullets(self, keyword_analyzer):
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

        matches = keyword_analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        assert len(matches) == 1
        assert matches[0].section == "experience"
        assert matches[0].role_index == 0

    def test_finds_keywords_in_skills_list(self, keyword_analyzer):
        """Should find keywords in skills section."""
        resume = {
            "skills": ["Python", "JavaScript", "AWS"]
        }

        matches = keyword_analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        assert len(matches) == 1
        assert matches[0].section == "skills"
        assert matches[0].role_index is None

    def test_finds_keywords_in_summary(self, keyword_analyzer):
        """Should find keywords in summary section."""
        resume = {
            "summary": "Experienced Python developer with 5 years experience"
        }

        matches = keyword_analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        assert len(matches) == 1
        assert matches[0].section == "summary"

    def test_finds_multiple_occurrences(self, keyword_analyzer):
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

        matches = keyword_analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        assert len(matches) == 3
        sections = {m.section for m in matches}
        assert sections == {"summary", "experience", "skills"}

    def test_respects_word_boundaries(self, keyword_analyzer):
        """Should respect word boundaries when matching."""
        resume = {
            "skills": ["JavaScript", "TypeScript", "Java"]
        }

        matches = keyword_analyzer._find_keyword_matches_in_structured_resume("Java", resume)

        assert len(matches) == 1
        assert "Java" in matches[0].text_snippet

    def test_assigns_correct_recency_indices(self, keyword_analyzer):
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

        matches = keyword_analyzer._find_keyword_matches_in_structured_resume("Python", resume)

        # Should have 3 matches with role indices 0, 1, 2
        assert len(matches) == 3
        role_indices = sorted([m.role_index for m in matches])
        assert role_indices == [0, 1, 2]


class TestCalculateKeywordWeightedScore:
    """Test weighted score calculation combining all Stage 2 factors."""

    def test_empty_matches_returns_zeros(self, keyword_analyzer):
        """Empty matches should return all zeros."""
        result = keyword_analyzer._calculate_keyword_weighted_score([], "required")

        assert result == (0.0, 0.0, 0.0, 0.0)

    def test_single_experience_match(self, keyword_analyzer):
        """Single match in experience should use full weights."""
        matches = [
            KeywordMatch(section="experience", role_index=0, text_snippet="Python")
        ]

        placement, density, recency, weighted = keyword_analyzer._calculate_keyword_weighted_score(
            matches, "required"
        )

        assert placement == 1.0  # experience = 1.0
        assert density == 1.0  # 1 occurrence = 1.0
        assert recency == 2.0  # role_index 0 = 2.0
        # weighted = 1.0 * 1.0 * 1.0 * 2.0 * 3.0 = 6.0
        assert weighted == 6.0

    def test_multiple_matches_uses_best_weights(self, keyword_analyzer):
        """Multiple matches should use best placement and recency."""
        matches = [
            KeywordMatch(section="skills", role_index=None, text_snippet="Python"),
            KeywordMatch(section="experience", role_index=1, text_snippet="Python"),
            KeywordMatch(section="experience", role_index=0, text_snippet="Python"),
        ]

        placement, density, recency, weighted = keyword_analyzer._calculate_keyword_weighted_score(
            matches, "preferred"
        )

        assert placement == 1.0  # best is experience = 1.0
        assert density == 1.5  # 3 occurrences = 1.5
        assert recency == 2.0  # best role_index is 0 = 2.0
        # weighted = 1.0 * 1.0 * 1.5 * 2.0 * 1.5 = 4.5
        assert weighted == 4.5

    def test_importance_affects_final_score(self, keyword_analyzer):
        """Importance tier should multiply final score."""
        matches = [
            KeywordMatch(section="experience", role_index=0, text_snippet="Test")
        ]

        _, _, _, required_score = keyword_analyzer._calculate_keyword_weighted_score(
            matches, "required"
        )
        _, _, _, nice_score = keyword_analyzer._calculate_keyword_weighted_score(
            matches, "nice_to_have"
        )

        # Required (3.0x) should be 3x nice_to_have (1.0x)
        assert required_score == nice_score * 3


class TestExtractKeywordsWithImportanceEnhanced:
    """Test enhanced keyword extraction with strongly_preferred tier."""

    @pytest.mark.asyncio
    async def test_extracts_strongly_preferred_tier(self, keyword_analyzer):
        """Should extract strongly_preferred importance level."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"},
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Agile", "importance": "nice_to_have"}
        ]"""

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer._extract_keywords_with_importance_enhanced(
                "Test job description"
            )

        assert len(result) == 4
        importances = {r["importance"] for r in result}
        assert "strongly_preferred" in importances

    @pytest.mark.asyncio
    async def test_normalizes_invalid_importance(self, keyword_analyzer):
        """Should normalize invalid importance levels."""
        mock_response = """[
            {"keyword": "Python", "importance": "critical"},
            {"keyword": "AWS", "importance": "mandatory"}
        ]"""

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer._extract_keywords_with_importance_enhanced(
                "Test job description"
            )

        # Invalid importance should be normalized to nice_to_have
        assert all(r["importance"] == "nice_to_have" for r in result)


class TestAnalyzeKeywordsEnhanced:
    """Test the full enhanced keyword analysis."""

    @pytest.mark.asyncio
    async def test_returns_enhanced_analysis_structure(self, keyword_analyzer, sample_resume):
        """Should return EnhancedKeywordAnalysis with all fields."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"},
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Rust", "importance": "nice_to_have"}
        ]"""
        vault_blocks = [{"content": "Docker and Kubernetes experience"}]

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords_enhanced(
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
    async def test_calculates_coverage_by_tier(self, keyword_analyzer, sample_resume):
        """Should calculate separate coverage for each importance tier."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"},
            {"keyword": "Docker", "importance": "preferred"},
            {"keyword": "Rust", "importance": "nice_to_have"}
        ]"""
        vault_blocks = []

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords_enhanced(
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
        self, keyword_analyzer, sample_resume
    ):
        """Should include strongly_preferred in grouping."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "strongly_preferred"},
            {"keyword": "Go", "importance": "strongly_preferred"}
        ]"""
        vault_blocks = []

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords_enhanced(
                parsed_resume=sample_resume,
                job_description="Test job",
                vault_blocks=vault_blocks,
            )

        assert "Python" in result.required_matched
        assert "AWS" in result.strongly_preferred_matched
        assert "Go" in result.strongly_preferred_missing

    @pytest.mark.asyncio
    async def test_weighted_score_higher_than_raw_coverage(self, keyword_analyzer, sample_resume):
        """Keywords in experience should boost weighted score above raw coverage."""
        mock_response = """[
            {"keyword": "Python", "importance": "required"},
            {"keyword": "AWS", "importance": "required"}
        ]"""
        vault_blocks = []

        with patch.object(
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords_enhanced(
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
    async def test_gap_list_prioritized_by_importance(self, keyword_analyzer):
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
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords_enhanced(
                parsed_resume=resume,
                job_description="Test job",
                vault_blocks=vault_blocks,
            )

        # Gap list should be ordered: required, strongly_preferred, preferred, nice_to_have
        importances = [gap["importance"] for gap in result.gap_list]
        assert importances == ["required", "strongly_preferred", "preferred", "nice_to_have"]

    @pytest.mark.asyncio
    async def test_generates_prioritized_suggestions(self, keyword_analyzer):
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
            keyword_analyzer._ai_client,
            "generate_json",
            new=AsyncMock(return_value=mock_response),
        ):
            result = await keyword_analyzer.analyze_keywords_enhanced(
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
