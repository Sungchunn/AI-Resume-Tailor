import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_resume(client: AsyncClient):
    """Test creating a new resume."""
    response = await client.post(
        "/api/resumes",
        json={
            "title": "Software Engineer Resume",
            "raw_content": "John Doe\nSoftware Engineer\n5 years experience...",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Software Engineer Resume"
    assert data["raw_content"] == "John Doe\nSoftware Engineer\n5 years experience..."
    assert data["owner_id"] == 1
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_resume_validation_error(client: AsyncClient):
    """Test validation error when creating resume with empty title."""
    response = await client.post(
        "/api/resumes",
        json={
            "title": "",
            "raw_content": "Some content",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_resume(client: AsyncClient):
    """Test retrieving a resume by ID."""
    # Create a resume first
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Test Resume",
            "raw_content": "Test content",
        },
    )
    resume_id = create_response.json()["id"]

    # Get the resume
    response = await client.get(f"/api/resumes/{resume_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == resume_id
    assert data["title"] == "Test Resume"


@pytest.mark.asyncio
async def test_get_resume_not_found(client: AsyncClient):
    """Test 404 when resume doesn't exist."""
    response = await client.get("/api/resumes/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Resume not found"


@pytest.mark.asyncio
async def test_list_resumes(client: AsyncClient):
    """Test listing all resumes for a user."""
    # Create multiple resumes
    await client.post(
        "/api/resumes",
        json={"title": "Resume 1", "raw_content": "Content 1"},
    )
    await client.post(
        "/api/resumes",
        json={"title": "Resume 2", "raw_content": "Content 2"},
    )

    response = await client.get("/api/resumes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_update_resume(client: AsyncClient):
    """Test updating a resume."""
    # Create a resume
    create_response = await client.post(
        "/api/resumes",
        json={"title": "Original Title", "raw_content": "Original content"},
    )
    resume_id = create_response.json()["id"]

    # Update the resume
    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={"title": "Updated Title"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["raw_content"] == "Original content"


@pytest.mark.asyncio
async def test_delete_resume(client: AsyncClient):
    """Test deleting a resume."""
    # Create a resume
    create_response = await client.post(
        "/api/resumes",
        json={"title": "To Delete", "raw_content": "Content"},
    )
    resume_id = create_response.json()["id"]

    # Delete the resume
    response = await client.delete(f"/api/resumes/{resume_id}")
    assert response.status_code == 204

    # Verify it's deleted
    get_response = await client.get(f"/api/resumes/{resume_id}")
    assert get_response.status_code == 404
