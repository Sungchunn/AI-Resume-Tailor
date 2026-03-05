"""Tests for resume tailoring API endpoints.

Phase 6: Testing & Polish
Tests for the 3-step tailor flow:
1. Happy Path: Job Detail → Step 1 → Step 2 → Step 3 → Edit
2. Error States: API failures, validation errors
3. Edge Cases: No resumes, cache hits vs misses
4. Focus Keywords: User-selected keywords feature (Phase 3)
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_listing import JobListing
from app.models.job import JobDescription


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_resume():
    """Create a mock resume document (MongoDB)."""
    resume = MagicMock()
    resume.id = "67890abcdef123456789abcd"
    resume.user_id = 1
    resume.raw_content = "John Doe\nSoftware Engineer\n5 years experience in Python"
    resume.parsed = MagicMock()
    resume.parsed.model_dump.return_value = {
        "contact": {"name": "John Doe", "email": "john@example.com"},
        "summary": "Experienced software engineer",
        "experience": [
            {
                "id": "exp1",
                "title": "Software Engineer",
                "company": "TechCorp",
                "bullets": ["Built APIs", "Led team of 3"],
            }
        ],
        "skills": ["Python", "FastAPI", "PostgreSQL"],
    }
    return resume


@pytest.fixture
def mock_job_listing(db_session: AsyncSession):
    """Create a mock job listing (PostgreSQL)."""
    return JobListing(
        id=1,
        external_job_id="ext_123",
        job_title="Senior Software Engineer",
        company_name="Acme Corp",
        location="San Francisco, CA",
        job_description="Looking for a senior engineer with Python experience...",
        is_active=True,
    )


@pytest.fixture
def mock_tailored_resume():
    """Create a mock tailored resume document (MongoDB)."""
    tailored = MagicMock()
    tailored.id = "abcdef123456789012345678"
    tailored.resume_id = "67890abcdef123456789abcd"
    tailored.user_id = 1
    tailored.job_source = MagicMock()
    tailored.job_source.type = "job_listing"
    tailored.job_source.id = 1
    tailored.tailored_data = {
        "contact": {"name": "John Doe", "email": "john@example.com"},
        "summary": "Senior software engineer with 5+ years of Python expertise",
        "experience": [
            {
                "id": "exp1",
                "title": "Software Engineer",
                "company": "TechCorp",
                "bullets": ["Built scalable APIs using Python and FastAPI", "Led team of 3 engineers"],
            }
        ],
        "skills": ["Python", "FastAPI", "PostgreSQL", "AWS"],
    }
    tailored.finalized_data = None
    tailored.status = "pending"
    tailored.match_score = 78.5
    tailored.job_title = "Senior Software Engineer"
    tailored.company_name = "Acme Corp"
    tailored.style_settings = {}
    tailored.section_order = ["summary", "experience", "skills", "education"]
    tailored.created_at = datetime(2026, 3, 5, 10, 30, 0)
    tailored.updated_at = datetime(2026, 3, 5, 10, 30, 0)
    tailored.finalized_at = None
    return tailored


@pytest.fixture
def mock_tailoring_result():
    """Mock result from TailoringService.tailor()."""
    return {
        "tailored_content": {
            "contact": {"name": "John Doe", "email": "john@example.com"},
            "summary": "Senior software engineer with 5+ years of Python expertise",
            "experience": [
                {
                    "id": "exp1",
                    "title": "Software Engineer",
                    "company": "TechCorp",
                    "bullets": ["Built scalable APIs", "Led team"],
                }
            ],
            "skills": ["Python", "FastAPI", "AWS"],
        },
        "match_score": 78.5,
        "skill_matches": ["Python", "FastAPI"],
        "skill_gaps": ["Kubernetes"],
        "keyword_coverage": 0.72,
    }


# =============================================================================
# Schema Validation Tests
# =============================================================================


class TestTailorRequestValidation:
    """Test TailorRequest schema validation."""

    def test_valid_job_id(self):
        """Test valid request with job_id."""
        from app.schemas.tailor import TailorRequest

        request = TailorRequest(
            resume_id="67890abcdef123456789abcd",
            job_id=1,
        )
        assert request.job_id == 1
        assert request.job_listing_id is None

    def test_valid_job_listing_id(self):
        """Test valid request with job_listing_id."""
        from app.schemas.tailor import TailorRequest

        request = TailorRequest(
            resume_id="67890abcdef123456789abcd",
            job_listing_id=1,
        )
        assert request.job_listing_id == 1
        assert request.job_id is None

    def test_valid_with_focus_keywords(self):
        """Test valid request with focus_keywords (Phase 3 feature)."""
        from app.schemas.tailor import TailorRequest

        request = TailorRequest(
            resume_id="67890abcdef123456789abcd",
            job_listing_id=1,
            focus_keywords=["Python", "FastAPI", "AWS"],
        )
        assert request.focus_keywords == ["Python", "FastAPI", "AWS"]

    def test_invalid_no_job_source(self):
        """Test that request fails without job source."""
        from app.schemas.tailor import TailorRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            TailorRequest(resume_id="67890abcdef123456789abcd")

        assert "Either job_id or job_listing_id must be provided" in str(exc_info.value)

    def test_invalid_both_job_sources(self):
        """Test that request fails with both job sources."""
        from app.schemas.tailor import TailorRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            TailorRequest(
                resume_id="67890abcdef123456789abcd",
                job_id=1,
                job_listing_id=2,
            )

        assert "Only one of job_id or job_listing_id can be provided" in str(exc_info.value)


class TestQuickMatchRequestValidation:
    """Test QuickMatchRequest schema validation."""

    def test_valid_request(self):
        """Test valid quick match request."""
        from app.schemas.tailor import QuickMatchRequest

        request = QuickMatchRequest(
            resume_id="67890abcdef123456789abcd",
            job_listing_id=1,
        )
        assert request.resume_id == "67890abcdef123456789abcd"
        assert request.job_listing_id == 1


# =============================================================================
# Formatted Name Tests (Phase 1)
# =============================================================================


class TestFormattedName:
    """Test human-readable version name generation (Phase 1 feature)."""

    def test_full_name_with_job_and_company(self):
        """Test formatted name with both job title and company."""
        from app.schemas.tailor import _format_tailored_name

        result = _format_tailored_name(
            job_title="Senior Software Engineer",
            company_name="Acme Corp",
            created_at=datetime(2026, 3, 5, 10, 30, 0),
        )
        assert result == "Senior Software Engineer @ Acme Corp — Mar 5"

    def test_name_with_job_only(self):
        """Test formatted name with job title only."""
        from app.schemas.tailor import _format_tailored_name

        result = _format_tailored_name(
            job_title="Software Engineer",
            company_name=None,
            created_at=datetime(2026, 3, 5, 10, 30, 0),
        )
        assert result == "Software Engineer — Mar 5"

    def test_name_with_company_only(self):
        """Test formatted name with company only."""
        from app.schemas.tailor import _format_tailored_name

        result = _format_tailored_name(
            job_title=None,
            company_name="TechCorp",
            created_at=datetime(2026, 3, 5, 10, 30, 0),
        )
        assert result == "TechCorp — Mar 5"

    def test_fallback_no_job_info(self):
        """Test formatted name fallback when no job info."""
        from app.schemas.tailor import _format_tailored_name

        result = _format_tailored_name(
            job_title=None,
            company_name=None,
            created_at=datetime(2026, 3, 5, 10, 30, 0),
        )
        assert result == "Tailored Resume — Mar 5"

    def test_computed_field_on_list_response(self):
        """Test computed formatted_name field on list response schema."""
        from app.schemas.tailor import TailoredResumeListResponse

        response = TailoredResumeListResponse(
            id="abc123",
            resume_id="def456",
            job_id=None,
            job_listing_id=1,
            status="pending",
            match_score=78.5,
            job_title="Backend Engineer",
            company_name="StartupXYZ",
            created_at=datetime(2026, 3, 5, 14, 0, 0),
        )
        assert response.formatted_name == "Backend Engineer @ StartupXYZ — Mar 5"


# =============================================================================
# ATS Cache Metadata Tests (Phase 5)
# =============================================================================


class TestATSCacheMetadata:
    """Test ATS cache metadata in response schemas (Phase 5 feature)."""

    def test_full_response_with_ats_fields(self):
        """Test TailoredResumeFullResponse includes ATS cache fields."""
        from app.schemas.tailor import TailoredResumeFullResponse

        response = TailoredResumeFullResponse(
            id="abc123",
            resume_id="def456",
            job_id=None,
            job_listing_id=1,
            tailored_data={"summary": "Test summary"},
            finalized_data=None,
            status="pending",
            match_score=78.5,
            job_title="Engineer",
            company_name="Corp",
            section_order=["summary", "experience"],
            created_at=datetime(2026, 3, 5, 10, 0, 0),
            updated_at=datetime(2026, 3, 5, 10, 0, 0),
            # ATS cache metadata
            ats_score=82.5,
            ats_cached_at=datetime(2026, 3, 5, 14, 30, 0),
            is_outdated=False,
        )
        assert response.ats_score == 82.5
        assert response.ats_cached_at == datetime(2026, 3, 5, 14, 30, 0)
        assert response.is_outdated is False

    def test_full_response_without_ats_fields(self):
        """Test TailoredResumeFullResponse with default ATS values."""
        from app.schemas.tailor import TailoredResumeFullResponse

        response = TailoredResumeFullResponse(
            id="abc123",
            resume_id="def456",
            job_id=None,
            job_listing_id=1,
            tailored_data={"summary": "Test"},
            finalized_data=None,
            status="pending",
            match_score=78.5,
            job_title="Engineer",
            company_name="Corp",
            section_order=["summary"],
            created_at=datetime(2026, 3, 5, 10, 0, 0),
            updated_at=None,
        )
        # Defaults
        assert response.ats_score is None
        assert response.ats_cached_at is None
        assert response.is_outdated is False


# =============================================================================
# Focus Keywords Tests (Phase 3)
# =============================================================================


class TestFocusKeywords:
    """Test focus_keywords feature for user-selected keywords (Phase 3)."""

    def test_tailor_response_includes_focus_keywords_used(self):
        """Test TailorResponse includes focus_keywords_used field."""
        from app.schemas.tailor import TailorResponse

        response = TailorResponse(
            id="abc123",
            resume_id="def456",
            job_id=None,
            job_listing_id=1,
            tailored_data={"summary": "Tailored summary"},
            status="pending",
            match_score=78.5,
            skill_matches=["Python", "FastAPI"],
            skill_gaps=["Kubernetes"],
            keyword_coverage=0.72,
            job_title="Engineer",
            company_name="Corp",
            focus_keywords_used=["Python", "FastAPI", "AWS"],
            created_at=datetime(2026, 3, 5, 10, 0, 0),
        )
        assert response.focus_keywords_used == ["Python", "FastAPI", "AWS"]

    def test_tailor_response_focus_keywords_optional(self):
        """Test focus_keywords_used is optional (None by default)."""
        from app.schemas.tailor import TailorResponse

        response = TailorResponse(
            id="abc123",
            resume_id="def456",
            job_id=None,
            job_listing_id=1,
            tailored_data={"summary": "Tailored summary"},
            status="pending",
            match_score=78.5,
            skill_matches=["Python"],
            skill_gaps=[],
            keyword_coverage=0.8,
            job_title="Engineer",
            company_name="Corp",
            created_at=datetime(2026, 3, 5, 10, 0, 0),
        )
        assert response.focus_keywords_used is None


# =============================================================================
# Compare Response Tests (Two Copies Architecture)
# =============================================================================


class TestCompareResponse:
    """Test compare response for Two Copies architecture."""

    def test_compare_response_structure(self):
        """Test TailoredResumeCompareResponse has both original and tailored."""
        from app.schemas.tailor import TailoredResumeCompareResponse

        original_content = {
            "contact": {"name": "John Doe"},
            "summary": "Original summary",
            "skills": ["Python"],
        }
        tailored_content = {
            "contact": {"name": "John Doe"},
            "summary": "Optimized summary for the role",
            "skills": ["Python", "AWS"],
        }

        response = TailoredResumeCompareResponse(
            id="abc123",
            resume_id="def456",
            original=original_content,
            tailored=tailored_content,
            status="pending",
            match_score=78.5,
            job_title="Engineer",
            company_name="Corp",
        )

        assert response.original == original_content
        assert response.tailored == tailored_content
        assert response.original != response.tailored


# =============================================================================
# Finalize Request Tests
# =============================================================================


class TestFinalizeRequest:
    """Test finalize request schema."""

    def test_finalize_request_structure(self):
        """Test TailoredResumeFinalizeRequest accepts finalized_data."""
        from app.schemas.tailor import TailoredResumeFinalizeRequest

        finalized = {
            "contact": {"name": "John Doe"},
            "summary": "User-approved summary",
            "experience": [],
            "skills": ["Python", "FastAPI"],
        }

        request = TailoredResumeFinalizeRequest(finalized_data=finalized)
        assert request.finalized_data == finalized


# =============================================================================
# Integration Tests
# Note: Full API integration tests require MongoDB fixtures.
# These tests validate request/response schemas independent of MongoDB.
# =============================================================================


class TestTailorAPISchemaValidation:
    """Test API request validation at the schema level.

    These tests validate that the API properly rejects invalid requests
    before any database operations occur.
    """

    def test_tailor_resume_validation_error_no_job_source(self):
        """Test validation error when no job source provided in request body."""
        from pydantic import ValidationError
        from app.schemas.tailor import TailorRequest

        with pytest.raises(ValidationError) as exc_info:
            TailorRequest(
                resume_id="67890abcdef123456789abcd",
                # Missing both job_id and job_listing_id
            )

        errors = exc_info.value.errors()
        assert any("job_id" in str(e) or "job_listing_id" in str(e) for e in errors)

    def test_tailor_resume_validation_error_both_job_sources(self):
        """Test validation error when both job sources provided in request body."""
        from pydantic import ValidationError
        from app.schemas.tailor import TailorRequest

        with pytest.raises(ValidationError) as exc_info:
            TailorRequest(
                resume_id="67890abcdef123456789abcd",
                job_id=1,
                job_listing_id=2,
            )

        errors = exc_info.value.errors()
        assert any("Only one of" in str(e) for e in errors)

    def test_focus_keywords_accepted_in_request(self):
        """Test that focus_keywords is properly accepted in request (Phase 3)."""
        from app.schemas.tailor import TailorRequest

        request = TailorRequest(
            resume_id="67890abcdef123456789abcd",
            job_listing_id=1,
            focus_keywords=["Python", "FastAPI", "AWS"],
        )

        assert request.focus_keywords == ["Python", "FastAPI", "AWS"]
        assert request.job_listing_id == 1

    def test_focus_keywords_can_be_empty_list(self):
        """Test that focus_keywords accepts empty list (user deselected all)."""
        from app.schemas.tailor import TailorRequest

        request = TailorRequest(
            resume_id="67890abcdef123456789abcd",
            job_listing_id=1,
            focus_keywords=[],
        )

        assert request.focus_keywords == []

    def test_quick_match_request_validation(self):
        """Test QuickMatchRequest also validates job source requirement."""
        from pydantic import ValidationError
        from app.schemas.tailor import QuickMatchRequest

        with pytest.raises(ValidationError):
            QuickMatchRequest(
                resume_id="67890abcdef123456789abcd",
                # Missing both job_id and job_listing_id
            )


# =============================================================================
# Note on Full API Integration Tests
# =============================================================================
# Full API integration tests that call POST /api/tailor require:
# 1. MongoDB test fixture (mongomock or test MongoDB instance)
# 2. Dependency overrides for get_mongo_db
#
# These would be added when MongoDB test infrastructure is set up.
# For now, the schema validation tests above ensure request validation works.
# =============================================================================


# =============================================================================
# Edge Case Tests
# =============================================================================


class TestEdgeCases:
    """Test edge cases for tailor flow."""

    def test_empty_skills_list(self):
        """Test handling of empty skills list."""
        from app.schemas.tailor import TailorResponse

        response = TailorResponse(
            id="abc123",
            resume_id="def456",
            job_listing_id=1,
            tailored_data={},
            status="pending",
            match_score=0.0,
            skill_matches=[],
            skill_gaps=[],
            keyword_coverage=0.0,
            created_at=datetime(2026, 3, 5, 10, 0, 0),
        )
        assert response.skill_matches == []
        assert response.skill_gaps == []

    def test_zero_match_score(self):
        """Test handling of zero match score."""
        from app.schemas.tailor import QuickMatchResponse

        response = QuickMatchResponse(
            match_score=0,
            keyword_coverage=0.0,
            skill_matches=[],
            skill_gaps=["Python", "AWS", "Kubernetes"],
        )
        assert response.match_score == 0
        assert len(response.skill_gaps) == 3

    def test_high_match_score(self):
        """Test handling of high match score (near 100)."""
        from app.schemas.tailor import QuickMatchResponse

        response = QuickMatchResponse(
            match_score=95,
            keyword_coverage=0.98,
            skill_matches=["Python", "AWS", "FastAPI", "Docker"],
            skill_gaps=[],
        )
        assert response.match_score == 95
        assert response.keyword_coverage == 0.98
