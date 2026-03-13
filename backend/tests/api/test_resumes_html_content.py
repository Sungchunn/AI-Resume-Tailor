"""
Tests for Resume API Phase 4 features.

Tests cover:
- Creating resumes with HTML content
- Creating resumes with file storage metadata
- Updating resumes with HTML content
- Retrieving resumes with HTML content fields
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_resume_with_html_content(client: AsyncClient):
    """Test creating a resume with HTML content."""
    response = await client.post(
        "/api/resumes",
        json={
            "title": "Software Engineer Resume",
            "raw_content": "John Doe\nSoftware Engineer",
            "html_content": "<h1>John Doe</h1><p>Software Engineer</p>",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Software Engineer Resume"
    assert data["raw_content"] == "John Doe\nSoftware Engineer"
    assert data["html_content"] == "<h1>John Doe</h1><p>Software Engineer</p>"


@pytest.mark.asyncio
async def test_create_resume_without_html_content(client: AsyncClient):
    """Test that HTML content is optional when creating a resume."""
    response = await client.post(
        "/api/resumes",
        json={
            "title": "Basic Resume",
            "raw_content": "Plain text content",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Basic Resume"
    assert data["raw_content"] == "Plain text content"
    # html_content should be None when not provided
    assert data.get("html_content") is None


@pytest.mark.asyncio
async def test_create_resume_with_file_metadata(client: AsyncClient):
    """Test creating a resume with file storage metadata."""
    response = await client.post(
        "/api/resumes",
        json={
            "title": "Uploaded Resume",
            "raw_content": "Content from uploaded file",
            "html_content": "<p>Content from uploaded file</p>",
            "original_file_key": "users/1/resumes/abc123_resume.pdf",
            "original_filename": "John_Resume_2024.pdf",
            "file_type": "pdf",
            "file_size_bytes": 102400,
        },
    )
    assert response.status_code == 201
    data = response.json()
    # File metadata is nested under original_file
    assert data["original_file"]["storage_key"] == "users/1/resumes/abc123_resume.pdf"
    assert data["original_file"]["filename"] == "John_Resume_2024.pdf"
    assert data["original_file"]["file_type"] == "pdf"
    assert data["original_file"]["size_bytes"] == 102400


@pytest.mark.asyncio
async def test_create_resume_with_docx_file_type(client: AsyncClient):
    """Test creating a resume with DOCX file type."""
    response = await client.post(
        "/api/resumes",
        json={
            "title": "DOCX Resume",
            "raw_content": "Content from DOCX",
            "file_type": "docx",
            "original_filename": "resume.docx",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["original_file"]["file_type"] == "docx"


@pytest.mark.asyncio
async def test_update_resume_html_content(client: AsyncClient):
    """Test updating a resume's HTML content."""
    # Create a resume first
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Original Resume",
            "raw_content": "Original text",
            "html_content": "<p>Original HTML</p>",
        },
    )
    create_data = create_response.json()
    resume_id = create_data["id"]
    version = create_data["version"]

    # Update the HTML content
    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={
            "version": version,
            "html_content": "<p>Updated HTML with <strong>formatting</strong></p>",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert (
        data["html_content"]
        == "<p>Updated HTML with <strong>formatting</strong></p>"
    )
    # Original raw_content should be unchanged
    assert data["raw_content"] == "Original text"


@pytest.mark.asyncio
async def test_update_resume_preserves_file_metadata(client: AsyncClient):
    """Test that updating a resume preserves file metadata."""
    # Create a resume with file metadata
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Resume with File",
            "raw_content": "Content",
            "original_file_key": "users/1/resumes/original.pdf",
            "original_filename": "original.pdf",
            "file_type": "pdf",
            "file_size_bytes": 50000,
        },
    )
    create_data = create_response.json()
    resume_id = create_data["id"]
    version = create_data["version"]

    # Update title only
    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={"version": version, "title": "Updated Title"},
    )
    assert response.status_code == 200
    data = response.json()
    # File metadata should be preserved (via original_file object)
    assert data["original_file"]["storage_key"] == "users/1/resumes/original.pdf"
    assert data["original_file"]["filename"] == "original.pdf"
    assert data["original_file"]["file_type"] == "pdf"
    assert data["original_file"]["size_bytes"] == 50000


@pytest.mark.asyncio
async def test_get_resume_includes_html_content(client: AsyncClient):
    """Test that retrieving a resume includes HTML content."""
    # Create a resume with HTML content
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Full Resume",
            "raw_content": "Plain text",
            "html_content": "<h1>Full Resume</h1><p>Plain text</p>",
            "original_filename": "test.pdf",
            "file_type": "pdf",
        },
    )
    resume_id = create_response.json()["id"]

    # Retrieve the resume
    response = await client.get(f"/api/resumes/{resume_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["html_content"] == "<h1>Full Resume</h1><p>Plain text</p>"
    assert data["original_file"]["filename"] == "test.pdf"
    assert data["original_file"]["file_type"] == "pdf"


@pytest.mark.asyncio
async def test_list_resumes_includes_html_content(client: AsyncClient):
    """Test that listing resumes includes HTML content."""
    # Create multiple resumes with HTML content
    await client.post(
        "/api/resumes",
        json={
            "title": "Resume 1",
            "raw_content": "Content 1",
            "html_content": "<p>Content 1</p>",
        },
    )
    await client.post(
        "/api/resumes",
        json={
            "title": "Resume 2",
            "raw_content": "Content 2",
            "html_content": "<p>Content 2</p>",
        },
    )

    response = await client.get("/api/resumes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # Check that HTML content is included in the list
    html_contents = [r["html_content"] for r in data]
    assert "<p>Content 1</p>" in html_contents
    assert "<p>Content 2</p>" in html_contents


@pytest.mark.asyncio
async def test_html_content_with_complex_formatting(client: AsyncClient):
    """Test that complex HTML formatting is preserved."""
    complex_html = """
    <h1>John Doe</h1>
    <h2>Experience</h2>
    <ul>
        <li><strong>Software Engineer</strong> at Acme Corp</li>
        <li>Led team of <em>5 engineers</em></li>
    </ul>
    <h2>Skills</h2>
    <p>Python, JavaScript, <u>SQL</u></p>
    """

    response = await client.post(
        "/api/resumes",
        json={
            "title": "Complex Resume",
            "raw_content": "John Doe\nExperience\nSoftware Engineer...",
            "html_content": complex_html,
        },
    )
    assert response.status_code == 201
    data = response.json()
    # HTML should be stored exactly as provided
    assert "<h1>John Doe</h1>" in data["html_content"]
    assert "<strong>Software Engineer</strong>" in data["html_content"]
    assert "<em>5 engineers</em>" in data["html_content"]
