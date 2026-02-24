"""Tests for the ATS Analysis API endpoints.

Note: Complex endpoint tests that require database mocking are covered by
integration tests. This file focuses on validation and stateless endpoints.
The service layer logic is thoroughly tested in test_ats_analyzer.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_current_user_id, get_db


# Override dependencies for all tests in this module
@pytest.fixture(autouse=True)
def override_deps():
    """Override auth dependency to return a test user."""
    from unittest.mock import MagicMock

    async def override_get_current_user_id():
        return 1

    async def override_get_db():
        mock_session = MagicMock()
        yield mock_session

    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Create a synchronous test client."""
    return TestClient(app)


class TestATSStructureEndpoint:
    """Test POST /v1/ats/structure endpoint."""

    def test_analyze_structure_success(self, client: TestClient):
        """Should analyze resume structure successfully."""
        response = client.post(
            "/api/v1/ats/structure",
            json={
                "resume_content": {
                    "summary": "Experienced developer with 5+ years experience",
                    "experience": [{"company": "TechCorp", "title": "Senior Engineer"}],
                    "education": [{"school": "University", "degree": "BS CS"}],
                    "skills": ["Python", "AWS", "Docker"],
                    "contact": {"email": "test@example.com", "phone": "555-1234"},
                }
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "format_score" in data
        assert "sections_found" in data
        assert "sections_missing" in data
        assert "warnings" in data
        assert "suggestions" in data
        assert data["format_score"] >= 0
        assert isinstance(data["sections_found"], list)

    def test_analyze_structure_empty(self, client: TestClient):
        """Should handle empty resume content."""
        response = client.post(
            "/api/v1/ats/structure",
            json={"resume_content": {}},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["format_score"] < 50
        assert len(data["sections_missing"]) > 0

    def test_analyze_structure_missing_content(self, client: TestClient):
        """Should require resume_content field."""
        response = client.post(
            "/api/v1/ats/structure",
            json={},
        )

        assert response.status_code == 422

    def test_analyze_structure_with_experience_only(self, client: TestClient):
        """Should identify missing sections when only experience provided."""
        response = client.post(
            "/api/v1/ats/structure",
            json={
                "resume_content": {
                    "experience": [{"company": "Tech Inc"}],
                }
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "experience" in data["sections_found"]
        # Should be missing other sections
        assert len(data["sections_missing"]) > 0


class TestATSTipsEndpoint:
    """Test GET /v1/ats/tips endpoint."""

    def test_get_tips_success(self, client: TestClient):
        """Should return ATS optimization tips."""
        response = client.get("/api/v1/ats/tips")

        assert response.status_code == 200
        data = response.json()
        assert "tips" in data
        assert isinstance(data["tips"], list)
        assert len(data["tips"]) > 5  # Should have several tips

    def test_tips_contain_useful_advice(self, client: TestClient):
        """Tips should contain practical advice about formatting and content."""
        response = client.get("/api/v1/ats/tips")

        assert response.status_code == 200
        tips_text = " ".join(response.json()["tips"]).lower()

        # Should mention common ATS advice topics
        has_relevant_content = any(
            keyword in tips_text
            for keyword in [
                "section",
                "format",
                "keyword",
                "font",
                "header",
                "pdf",
                "contact",
            ]
        )
        assert has_relevant_content

    def test_tips_are_strings(self, client: TestClient):
        """Each tip should be a string."""
        response = client.get("/api/v1/ats/tips")

        assert response.status_code == 200
        for tip in response.json()["tips"]:
            assert isinstance(tip, str)
            assert len(tip) > 0


class TestATSKeywordsDetailedValidation:
    """Test validation for POST /v1/ats/keywords/detailed endpoint."""

    def test_missing_job_description(self, client: TestClient):
        """Should require job_description field."""
        response = client.post(
            "/api/v1/ats/keywords/detailed",
            json={
                "resume_content": "Some content here",
            },
        )

        assert response.status_code == 422

    def test_job_description_too_short(self, client: TestClient):
        """Job description must be at least 50 characters."""
        response = client.post(
            "/api/v1/ats/keywords/detailed",
            json={
                "job_description": "Short",  # Less than 50 chars
                "resume_content": "Some resume content",
            },
        )

        assert response.status_code == 422
        assert "job_description" in str(response.json()).lower()

    def test_job_description_49_chars_fails(self, client: TestClient):
        """Job description with 49 chars should fail validation."""
        response = client.post(
            "/api/v1/ats/keywords/detailed",
            json={
                "job_description": "x" * 49,  # 49 characters - below minimum
                "resume_content": "Python developer",
            },
        )

        assert response.status_code == 422


class TestATSKeywordsValidation:
    """Test validation for POST /v1/ats/keywords endpoint."""

    def test_missing_job_description(self, client: TestClient):
        """Should require job_description field."""
        response = client.post(
            "/api/v1/ats/keywords",
            json={},
        )

        assert response.status_code == 422

    def test_job_description_too_short(self, client: TestClient):
        """Job description must be at least 50 characters."""
        response = client.post(
            "/api/v1/ats/keywords",
            json={
                "job_description": "Too short",
            },
        )

        assert response.status_code == 422


class TestATSEndpointResponseFormats:
    """Test that ATS endpoints return expected response formats."""

    def test_structure_response_format(self, client: TestClient):
        """Structure endpoint should return expected fields."""
        response = client.post(
            "/api/v1/ats/structure",
            json={
                "resume_content": {
                    "summary": "Test summary",
                    "skills": ["Python"],
                }
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Check all expected fields are present
        assert "format_score" in data
        assert "sections_found" in data
        assert "sections_missing" in data
        assert "warnings" in data
        assert "suggestions" in data

        # Check types
        assert isinstance(data["format_score"], (int, float))
        assert isinstance(data["sections_found"], list)
        assert isinstance(data["sections_missing"], list)
        assert isinstance(data["warnings"], list)
        assert isinstance(data["suggestions"], list)

        # Score should be in valid range
        assert 0 <= data["format_score"] <= 100

    def test_tips_response_format(self, client: TestClient):
        """Tips endpoint should return expected format."""
        response = client.get("/api/v1/ats/tips")

        assert response.status_code == 200
        data = response.json()

        assert "tips" in data
        assert isinstance(data["tips"], list)
        assert all(isinstance(tip, str) for tip in data["tips"])
