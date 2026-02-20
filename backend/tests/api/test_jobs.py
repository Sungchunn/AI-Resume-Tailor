import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_job(client: AsyncClient):
    """Test creating a new job description."""
    response = await client.post(
        "/api/jobs",
        json={
            "title": "Senior Software Engineer",
            "company": "Tech Corp",
            "raw_content": "We are looking for a senior engineer...",
            "url": "https://example.com/job/123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Senior Software Engineer"
    assert data["company"] == "Tech Corp"
    assert data["raw_content"] == "We are looking for a senior engineer..."
    assert data["url"] == "https://example.com/job/123"
    assert data["owner_id"] == 1
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_job_minimal(client: AsyncClient):
    """Test creating a job with only required fields."""
    response = await client.post(
        "/api/jobs",
        json={
            "title": "Developer",
            "raw_content": "Job description here",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Developer"
    assert data["company"] is None
    assert data["url"] is None


@pytest.mark.asyncio
async def test_create_job_validation_error(client: AsyncClient):
    """Test validation error when creating job with empty title."""
    response = await client.post(
        "/api/jobs",
        json={
            "title": "",
            "raw_content": "Some content",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_job(client: AsyncClient):
    """Test retrieving a job description by ID."""
    # Create a job first
    create_response = await client.post(
        "/api/jobs",
        json={
            "title": "Test Job",
            "raw_content": "Test content",
        },
    )
    job_id = create_response.json()["id"]

    # Get the job
    response = await client.get(f"/api/jobs/{job_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job_id
    assert data["title"] == "Test Job"


@pytest.mark.asyncio
async def test_get_job_not_found(client: AsyncClient):
    """Test 404 when job doesn't exist."""
    response = await client.get("/api/jobs/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Job description not found"


@pytest.mark.asyncio
async def test_list_jobs(client: AsyncClient):
    """Test listing all job descriptions for a user."""
    # Create multiple jobs
    await client.post(
        "/api/jobs",
        json={"title": "Job 1", "raw_content": "Content 1"},
    )
    await client.post(
        "/api/jobs",
        json={"title": "Job 2", "raw_content": "Content 2"},
    )

    response = await client.get("/api/jobs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_update_job(client: AsyncClient):
    """Test updating a job description."""
    # Create a job
    create_response = await client.post(
        "/api/jobs",
        json={"title": "Original Job", "raw_content": "Original content"},
    )
    job_id = create_response.json()["id"]

    # Update the job
    response = await client.put(
        f"/api/jobs/{job_id}",
        json={"title": "Updated Job", "company": "New Company"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Job"
    assert data["company"] == "New Company"
    assert data["raw_content"] == "Original content"


@pytest.mark.asyncio
async def test_delete_job(client: AsyncClient):
    """Test deleting a job description."""
    # Create a job
    create_response = await client.post(
        "/api/jobs",
        json={"title": "To Delete", "raw_content": "Content"},
    )
    job_id = create_response.json()["id"]

    # Delete the job
    response = await client.delete(f"/api/jobs/{job_id}")
    assert response.status_code == 204

    # Verify it's deleted
    get_response = await client.get(f"/api/jobs/{job_id}")
    assert get_response.status_code == 404
