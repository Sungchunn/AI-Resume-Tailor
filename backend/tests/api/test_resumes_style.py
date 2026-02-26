"""
Tests for Resume API style and parsed_content fields.

Tests cover:
- Creating resumes without style (optional field)
- Updating resumes with style settings
- Updating resumes with parsed_content
- Retrieving resumes includes style
- Style settings persistence across updates
- Combined updates with style and parsed_content
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_resume_without_style(client: AsyncClient):
    """Test that style is optional when creating a resume."""
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
    # style should be None when not provided
    assert data.get("style") is None


@pytest.mark.asyncio
async def test_update_resume_with_style(client: AsyncClient):
    """Test updating a resume with style settings."""
    # Create a resume first
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Resume to Style",
            "raw_content": "Original text",
        },
    )
    resume_id = create_response.json()["id"]

    # Update with style settings
    style_settings = {
        "font_family": "Inter",
        "font_size_body": 11,
        "font_size_heading": 16,
        "margin_top": 0.75,
        "margin_bottom": 0.75,
        "margin_left": 0.75,
        "margin_right": 0.75,
        "line_spacing": 1.15,
        "section_spacing": 12,
    }

    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={"style": style_settings},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["style"] == style_settings
    # Original raw_content should be unchanged
    assert data["raw_content"] == "Original text"


@pytest.mark.asyncio
async def test_update_resume_with_parsed_content(client: AsyncClient):
    """Test updating a resume with parsed_content."""
    # Create a resume first
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Resume to Parse",
            "raw_content": "John Doe\nSoftware Engineer",
        },
    )
    resume_id = create_response.json()["id"]

    # Update with parsed_content
    parsed_content = {
        "contact": {
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "555-1234",
        },
        "summary": "Experienced software engineer with 5 years...",
        "experience": [
            {
                "title": "Senior Engineer",
                "company": "Acme Corp",
                "start_date": "2020-01",
                "end_date": "Present",
                "bullets": ["Led team of 5", "Increased performance by 30%"],
            }
        ],
        "skills": ["Python", "JavaScript", "SQL"],
    }

    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={"parsed_content": parsed_content},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["parsed_content"] == parsed_content


@pytest.mark.asyncio
async def test_get_resume_includes_style(client: AsyncClient):
    """Test that retrieving a resume includes style settings."""
    # Create a resume
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Styled Resume",
            "raw_content": "Content",
        },
    )
    resume_id = create_response.json()["id"]

    # Update with style
    style_settings = {
        "font_family": "Georgia",
        "font_size_body": 12,
    }
    await client.put(
        f"/api/resumes/{resume_id}",
        json={"style": style_settings},
    )

    # Retrieve the resume
    response = await client.get(f"/api/resumes/{resume_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["style"] == style_settings


@pytest.mark.asyncio
async def test_update_title_preserves_style(client: AsyncClient):
    """Test that updating title preserves style settings."""
    # Create a resume
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Original Title",
            "raw_content": "Content",
        },
    )
    resume_id = create_response.json()["id"]

    # Update with style
    style_settings = {
        "font_family": "Arial",
        "margin_top": 1.0,
    }
    await client.put(
        f"/api/resumes/{resume_id}",
        json={"style": style_settings},
    )

    # Update title only
    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={"title": "Updated Title"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    # Style should be preserved
    assert data["style"] == style_settings


@pytest.mark.asyncio
async def test_combined_update_style_and_parsed_content(client: AsyncClient):
    """Test updating both style and parsed_content in a single request."""
    # Create a resume
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Combined Update Resume",
            "raw_content": "Content",
        },
    )
    resume_id = create_response.json()["id"]

    # Update with both style and parsed_content
    style_settings = {
        "font_family": "Roboto",
        "line_spacing": 1.5,
    }
    parsed_content = {
        "contact": {"name": "Jane Smith"},
        "skills": ["React", "Node.js"],
    }

    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={
            "style": style_settings,
            "parsed_content": parsed_content,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["style"] == style_settings
    assert data["parsed_content"] == parsed_content


@pytest.mark.asyncio
async def test_style_with_all_settings(client: AsyncClient):
    """Test style with all available settings."""
    # Create a resume
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Fully Styled Resume",
            "raw_content": "Content",
        },
    )
    resume_id = create_response.json()["id"]

    # Update with comprehensive style settings
    full_style = {
        "font_family": "Merriweather",
        "font_size_body": 10,
        "font_size_heading": 14,
        "font_size_subheading": 12,
        "margin_top": 0.5,
        "margin_bottom": 0.5,
        "margin_left": 0.6,
        "margin_right": 0.6,
        "line_spacing": 1.2,
        "section_spacing": 10,
        "entry_spacing": 6,
    }

    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={"style": full_style},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["style"] == full_style


@pytest.mark.asyncio
async def test_update_style_to_null(client: AsyncClient):
    """Test clearing style by setting it to null."""
    # Create a resume
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Resume with Style",
            "raw_content": "Content",
        },
    )
    resume_id = create_response.json()["id"]

    # Add style
    await client.put(
        f"/api/resumes/{resume_id}",
        json={"style": {"font_family": "Arial"}},
    )

    # Clear style by setting to null
    response = await client.put(
        f"/api/resumes/{resume_id}",
        json={"style": None},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["style"] is None


@pytest.mark.asyncio
async def test_list_resumes_includes_style(client: AsyncClient):
    """Test that listing resumes includes style settings."""
    # Create resumes with different styles
    await client.post(
        "/api/resumes",
        json={
            "title": "Resume 1",
            "raw_content": "Content 1",
        },
    )
    create_response = await client.post(
        "/api/resumes",
        json={
            "title": "Resume 2",
            "raw_content": "Content 2",
        },
    )
    resume_2_id = create_response.json()["id"]

    # Add style to second resume
    style_settings = {"font_family": "Helvetica"}
    await client.put(
        f"/api/resumes/{resume_2_id}",
        json={"style": style_settings},
    )

    response = await client.get("/api/resumes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # Find resume 2 and verify style
    resume_2 = next(r for r in data if r["id"] == resume_2_id)
    assert resume_2["style"] == style_settings
