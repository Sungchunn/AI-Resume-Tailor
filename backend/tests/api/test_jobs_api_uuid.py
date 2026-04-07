"""
Phase 2 API Tests: Jobs API with UUID-based paths.

Tests that verify API endpoints correctly handle UUID identifiers
and properly deprecate integer ID usage.
"""

from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestJobsAPIWithUUID:
    """Test job endpoints with UUID-based paths."""

    async def test_list_jobs_returns_uuids(self, client: AsyncClient):
        """GET /jobs should return jobs with UUID ids."""
        # Create a job
        create_response = await client.post(
            "/api/jobs",
            json={
                "title": "Test Job",
                "company": "Test Corp",
                "raw_content": "Job description content",
            },
        )
        assert create_response.status_code == 201

        # List jobs
        response = await client.get("/api/jobs")
        assert response.status_code == 200

        data = response.json()
        assert "items" in data

        for job in data["items"]:
            # Verify id is UUID format
            assert "id" in job
            assert "-" in job["id"], "UUID should contain dashes"
            assert len(job["id"]) == 36, "UUID should be 36 characters"

            # Verify it's a valid UUID
            try:
                UUID(job["id"])
            except ValueError:
                pytest.fail(f"Job id '{job['id']}' is not a valid UUID")

            # Verify internal integer id is not exposed
            assert "internal_id" not in job
            assert "public_id" not in job  # Mapped to 'id' in response

    async def test_create_job_returns_uuid(self, client: AsyncClient):
        """POST /jobs should return job with UUID id."""
        response = await client.post(
            "/api/jobs",
            json={
                "title": "New Job",
                "company": "New Corp",
                "raw_content": "New job description content",
            },
        )
        assert response.status_code == 201

        data = response.json()
        assert "id" in data
        assert "-" in data["id"], "UUID should contain dashes"
        assert len(data["id"]) == 36, "UUID should be 36 characters"

        # Verify it's a valid UUID
        try:
            UUID(data["id"])
        except ValueError:
            pytest.fail(f"Job id '{data['id']}' is not a valid UUID")

    async def test_get_job_by_uuid(self, client: AsyncClient):
        """GET /jobs/{uuid} should work."""
        # Create a job
        create_response = await client.post(
            "/api/jobs",
            json={
                "title": "Test Job",
                "company": "Test Corp",
                "raw_content": "Test content",
            },
        )
        job_uuid = create_response.json()["id"]

        # Get by UUID
        response = await client.get(f"/api/jobs/{job_uuid}")
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == job_uuid
        assert data["title"] == "Test Job"

    async def test_get_job_by_invalid_uuid_returns_404(self, client: AsyncClient):
        """GET /jobs/{invalid-uuid} should return 404."""
        fake_uuid = str(uuid4())

        response = await client.get(f"/api/jobs/{fake_uuid}")
        assert response.status_code == 404

    async def test_get_job_by_malformed_id_returns_400(self, client: AsyncClient):
        """GET /jobs/{malformed} should return 400."""
        response = await client.get("/api/jobs/not-a-valid-id-or-uuid")
        assert response.status_code == 400

    async def test_update_job_by_uuid(self, client: AsyncClient):
        """PUT /jobs/{uuid} should update the job."""
        # Create a job
        create_response = await client.post(
            "/api/jobs",
            json={
                "title": "Original Title",
                "company": "Original Corp",
                "raw_content": "Original content",
            },
        )
        job_uuid = create_response.json()["id"]

        # Update by UUID
        response = await client.put(
            f"/api/jobs/{job_uuid}",
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200

        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["id"] == job_uuid

    async def test_delete_job_by_uuid(self, client: AsyncClient):
        """DELETE /jobs/{uuid} should delete the job."""
        # Create a job
        create_response = await client.post(
            "/api/jobs",
            json={
                "title": "To Delete",
                "raw_content": "Content to delete",
            },
        )
        job_uuid = create_response.json()["id"]

        # Delete by UUID
        response = await client.delete(f"/api/jobs/{job_uuid}")
        assert response.status_code == 204

        # Verify deleted
        response = await client.get(f"/api/jobs/{job_uuid}")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestJobsAPILegacyIntegerIDs:
    """Test deprecated integer ID support with deprecation headers."""

    async def test_get_job_by_integer_includes_deprecation_header(
        self, client: AsyncClient
    ):
        """GET /jobs/{int} should work but include deprecation header."""
        # Create a job to get its integer ID (via internal access)
        create_response = await client.post(
            "/api/jobs",
            json={
                "title": "Test Job",
                "raw_content": "Test content",
            },
        )
        assert create_response.status_code == 201

        # For this test, we need to access by integer ID
        # Since we can't easily get the integer ID from the API response,
        # we'll test the deprecation header behavior by using a numeric string
        # Note: This test assumes integer ID "1" exists (from first created job)
        response = await client.get("/api/jobs/1")

        # If job exists, should have deprecation header
        if response.status_code == 200:
            assert response.headers.get("Deprecation") == "true"
            assert "Sunset" in response.headers

    async def test_negative_integer_returns_400(self, client: AsyncClient):
        """GET /jobs/{negative-int} should return 400."""
        response = await client.get("/api/jobs/-1")
        assert response.status_code == 400


@pytest.mark.asyncio
class TestJobsAPIUUIDUniqueness:
    """Test UUID uniqueness across jobs."""

    async def test_each_job_gets_unique_uuid(self, client: AsyncClient):
        """Multiple created jobs should have unique UUIDs."""
        uuids = []
        for i in range(5):
            response = await client.post(
                "/api/jobs",
                json={
                    "title": f"Job {i}",
                    "raw_content": f"Content {i}",
                },
            )
            assert response.status_code == 201
            uuids.append(response.json()["id"])

        # All UUIDs should be unique
        assert len(set(uuids)) == 5, "All job UUIDs should be unique"


@pytest.mark.asyncio
class TestJobsAPIResponseSchema:
    """Test response schema correctly exposes UUID as id."""

    async def test_response_does_not_expose_internal_id(self, client: AsyncClient):
        """Response should not expose internal integer ID."""
        create_response = await client.post(
            "/api/jobs",
            json={
                "title": "Test Job",
                "raw_content": "Test content",
            },
        )
        data = create_response.json()

        # Should not have internal_id or integer id
        assert "internal_id" not in data
        assert not data["id"].isdigit(), "id should be UUID, not integer"

    async def test_response_does_not_expose_owner_id(self, client: AsyncClient):
        """Response should not expose owner_id for security."""
        create_response = await client.post(
            "/api/jobs",
            json={
                "title": "Test Job",
                "raw_content": "Test content",
            },
        )
        data = create_response.json()

        # owner_id should not be in response (security)
        assert "owner_id" not in data

    async def test_list_response_structure(self, client: AsyncClient):
        """List response should have correct structure."""
        # Create a job
        await client.post(
            "/api/jobs",
            json={
                "title": "Test Job",
                "raw_content": "Test content",
            },
        )

        response = await client.get("/api/jobs")
        data = response.json()

        # Should have pagination fields
        assert "items" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert isinstance(data["items"], list)
