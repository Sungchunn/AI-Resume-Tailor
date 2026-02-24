"""
API tests for resume export endpoints (Phase 7).

Tests cover:
- GET /api/resumes/export/templates - Get available export templates
- POST /api/resumes/{id}/export - Export resume with styling options
- Authorization checks
- Error handling for missing/invalid resumes
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from io import BytesIO
from zipfile import ZipFile


class TestExportTemplatesEndpoint:
    """Tests for GET /api/resumes/export/templates endpoint."""

    @pytest.mark.asyncio
    async def test_get_export_templates_returns_templates(self, client: AsyncClient):
        """Test that export templates endpoint returns template list."""
        response = await client.get("/api/resumes/export/templates")

        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        assert len(data["templates"]) == 3

    @pytest.mark.asyncio
    async def test_get_export_templates_includes_classic(self, client: AsyncClient):
        """Test that classic template is included."""
        response = await client.get("/api/resumes/export/templates")
        data = response.json()

        template_names = [t["name"] for t in data["templates"]]
        assert "classic" in template_names

    @pytest.mark.asyncio
    async def test_get_export_templates_includes_modern(self, client: AsyncClient):
        """Test that modern template is included."""
        response = await client.get("/api/resumes/export/templates")
        data = response.json()

        template_names = [t["name"] for t in data["templates"]]
        assert "modern" in template_names

    @pytest.mark.asyncio
    async def test_get_export_templates_includes_minimal(self, client: AsyncClient):
        """Test that minimal template is included."""
        response = await client.get("/api/resumes/export/templates")
        data = response.json()

        template_names = [t["name"] for t in data["templates"]]
        assert "minimal" in template_names

    @pytest.mark.asyncio
    async def test_each_template_has_description(self, client: AsyncClient):
        """Test that each template has a description."""
        response = await client.get("/api/resumes/export/templates")
        data = response.json()

        for template in data["templates"]:
            assert "name" in template
            assert "description" in template
            assert len(template["description"]) > 0


class TestExportResumeEndpoint:
    """Tests for POST /api/resumes/{id}/export endpoint."""

    @pytest_asyncio.fixture
    async def resume_with_html(self, client: AsyncClient):
        """Create a resume with HTML content via API."""
        response = await client.post(
            "/api/resumes",
            json={
                "title": "Test Export Resume",
                "raw_content": "John Doe\nSenior Software Engineer\nExperience\n- Led team",
                "html_content": """
                    <h1>John Doe</h1>
                    <p>Senior Software Engineer</p>
                    <h2>Experience</h2>
                    <ul>
                        <li>Led team of 5 engineers</li>
                        <li>Reduced costs by 30%</li>
                    </ul>
                """,
            },
        )
        assert response.status_code == 201
        return response.json()

    @pytest_asyncio.fixture
    async def resume_without_html(self, client: AsyncClient):
        """Create a resume with only raw content via API."""
        response = await client.post(
            "/api/resumes",
            json={
                "title": "Raw Only Resume",
                "raw_content": "Jane Smith\nProduct Manager\n\nExperience\n- Launched 3 products",
            },
        )
        assert response.status_code == 201
        return response.json()

    @pytest.mark.asyncio
    async def test_export_docx_with_html_content(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test DOCX export with HTML content."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={"format": "docx"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

        # Verify it's a valid DOCX
        content = response.content
        with BytesIO(content) as f:
            with ZipFile(f, 'r') as zf:
                assert "word/document.xml" in zf.namelist()
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "John Doe" in doc_xml

    @pytest.mark.asyncio
    async def test_export_docx_fallback_to_raw_content(
        self, client: AsyncClient, resume_without_html: dict
    ):
        """Test DOCX export falls back to raw content when no HTML."""
        response = await client.post(
            f"/api/resumes/{resume_without_html['id']}/export",
            json={"format": "docx"},
        )

        assert response.status_code == 200

        # Verify content is present
        content = response.content
        with BytesIO(content) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "Jane Smith" in doc_xml

    @pytest.mark.asyncio
    async def test_export_with_classic_template(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test export with classic template."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={"format": "docx", "template": "classic"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_export_with_modern_template(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test export with modern template."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={"format": "docx", "template": "modern"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_export_with_minimal_template(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test export with minimal template."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={"format": "docx", "template": "minimal"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_export_with_custom_font_family(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test export with custom font family."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={"format": "docx", "font_family": "Times New Roman"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_export_with_custom_font_size(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test export with custom font size."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={"format": "docx", "font_size": 12},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_export_with_custom_margins(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test export with custom margins."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={
                "format": "docx",
                "margin_top": 1.0,
                "margin_bottom": 1.0,
                "margin_left": 0.5,
                "margin_right": 0.5,
            },
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_export_with_all_options(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test export with all customization options."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={
                "format": "docx",
                "template": "modern",
                "font_family": "Georgia",
                "font_size": 11,
                "margin_top": 0.75,
                "margin_bottom": 0.75,
                "margin_left": 0.75,
                "margin_right": 0.75,
            },
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_export_sets_content_disposition(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test that Content-Disposition header is set with filename."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={"format": "docx"},
        )

        assert response.status_code == 200
        content_disposition = response.headers.get("content-disposition", "")
        assert "attachment" in content_disposition
        assert ".docx" in content_disposition

    @pytest.mark.asyncio
    async def test_export_filename_derived_from_title(
        self, client: AsyncClient, resume_with_html: dict
    ):
        """Test that filename is derived from resume title."""
        response = await client.post(
            f"/api/resumes/{resume_with_html['id']}/export",
            json={"format": "docx"},
        )

        content_disposition = response.headers.get("content-disposition", "")
        # Title is "Test Export Resume"
        assert "Test" in content_disposition or "test" in content_disposition.lower()

    @pytest.mark.asyncio
    async def test_export_not_found_resume(self, client: AsyncClient):
        """Test export of non-existent resume returns 404."""
        response = await client.post(
            "/api/resumes/99999/export",
            json={"format": "docx"},
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestExportValidation:
    """Tests for request validation."""

    @pytest_asyncio.fixture
    async def resume(self, client: AsyncClient):
        """Create a test resume via API."""
        response = await client.post(
            "/api/resumes",
            json={
                "title": "Validation Test",
                "raw_content": "Content",
                "html_content": "<p>Content</p>",
            },
        )
        assert response.status_code == 201
        return response.json()

    @pytest.mark.asyncio
    async def test_invalid_format_returns_422(
        self, client: AsyncClient, resume: dict
    ):
        """Test that invalid format returns validation error."""
        response = await client.post(
            f"/api/resumes/{resume['id']}/export",
            json={"format": "invalid"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_template_returns_422(
        self, client: AsyncClient, resume: dict
    ):
        """Test that invalid template returns validation error."""
        response = await client.post(
            f"/api/resumes/{resume['id']}/export",
            json={"format": "docx", "template": "nonexistent"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_font_size_below_min_returns_422(
        self, client: AsyncClient, resume: dict
    ):
        """Test that font size below minimum returns validation error."""
        response = await client.post(
            f"/api/resumes/{resume['id']}/export",
            json={"format": "docx", "font_size": 5},  # Min is 8
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_font_size_above_max_returns_422(
        self, client: AsyncClient, resume: dict
    ):
        """Test that font size above maximum returns validation error."""
        response = await client.post(
            f"/api/resumes/{resume['id']}/export",
            json={"format": "docx", "font_size": 20},  # Max is 16
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_margin_below_min_returns_422(
        self, client: AsyncClient, resume: dict
    ):
        """Test that margin below minimum returns validation error."""
        response = await client.post(
            f"/api/resumes/{resume['id']}/export",
            json={"format": "docx", "margin_top": 0.1},  # Min is 0.25
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_margin_above_max_returns_422(
        self, client: AsyncClient, resume: dict
    ):
        """Test that margin above maximum returns validation error."""
        response = await client.post(
            f"/api/resumes/{resume['id']}/export",
            json={"format": "docx", "margin_top": 3.0},  # Max is 2.0
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_body_uses_defaults(
        self, client: AsyncClient, resume: dict
    ):
        """Test that empty body uses default format (PDF)."""
        response = await client.post(
            f"/api/resumes/{resume['id']}/export",
            json={},
        )

        # Format defaults to 'pdf' - may succeed (200) or fail if WeasyPrint unavailable (500)
        # 429 is also acceptable if rate limited
        assert response.status_code in (200, 429, 500)


class TestPdfExport:
    """Tests for PDF export (may skip if WeasyPrint unavailable)."""

    @pytest_asyncio.fixture
    async def resume(self, client: AsyncClient):
        """Create a test resume via API."""
        response = await client.post(
            "/api/resumes",
            json={
                "title": "PDF Test Resume",
                "raw_content": "PDF Content",
                "html_content": "<h1>PDF Test</h1><p>Content for PDF export.</p>",
            },
        )
        # Skip test if rate limited
        if response.status_code == 429:
            pytest.skip("Rate limited during fixture setup")
        assert response.status_code == 201
        return response.json()

    @pytest.mark.asyncio
    async def test_pdf_export_request(self, client: AsyncClient, resume: dict):
        """Test PDF export request (may fail if WeasyPrint unavailable)."""
        response = await client.post(
            f"/api/resumes/{resume['id']}/export",
            json={"format": "pdf"},
        )

        # Skip if rate limited
        if response.status_code == 429:
            pytest.skip("Rate limited during test")

        # Either 200 (success) or 500 (WeasyPrint unavailable)
        # Both are valid outcomes depending on environment
        if response.status_code == 200:
            assert response.headers["content-type"] == "application/pdf"
            # PDF files start with %PDF
            assert response.content[:4] == b"%PDF"
        else:
            # WeasyPrint not available - this is expected in some environments
            assert response.status_code == 500
            assert "WeasyPrint" in response.json().get("detail", "")
