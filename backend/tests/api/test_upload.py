"""
Tests for Upload API endpoint.

Tests cover:
- Document extraction with HTML content generation
- File storage in MinIO
- Error handling for invalid files
- Response schema validation
"""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock, AsyncMock
from io import BytesIO


class TestUploadExtract:
    """Tests for the /api/upload/extract endpoint."""

    @pytest.mark.asyncio
    async def test_extract_pdf_returns_html_content(self, client: AsyncClient):
        """Test that PDF extraction returns both raw text and HTML content."""
        pdf_content = b"%PDF-1.4 fake pdf content"

        # Mock the extraction and conversion services
        with patch(
            "app.api.routes.upload.extract_text"
        ) as mock_extract, patch(
            "app.api.routes.upload.convert_to_html"
        ) as mock_convert, patch(
            "app.api.routes.upload.get_storage_service"
        ) as mock_storage:
            # Setup mocks
            mock_result = MagicMock()
            mock_result.raw_content = "John Doe\nSoftware Engineer"
            mock_result.source_filename = "resume.pdf"
            mock_result.file_type = "pdf"
            mock_result.page_count = 1
            mock_result.word_count = 3
            mock_result.warnings = []
            mock_extract.return_value = mock_result

            mock_convert.return_value = "<h1>John Doe</h1><p>Software Engineer</p>"

            # Mock storage service
            mock_storage_instance = MagicMock()
            mock_storage_instance.generate_file_key.return_value = "users/1/resumes/abc.pdf"
            mock_storage_instance.upload = AsyncMock()
            mock_storage.return_value = mock_storage_instance

            response = await client.post(
                "/api/upload/extract",
                files={"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["raw_content"] == "John Doe\nSoftware Engineer"
            assert data["html_content"] == "<h1>John Doe</h1><p>Software Engineer</p>"
            assert data["source_filename"] == "resume.pdf"
            assert data["file_type"] == "pdf"
            assert data["page_count"] == 1
            assert data["word_count"] == 3
            assert data["file_key"] == "users/1/resumes/abc.pdf"

    @pytest.mark.asyncio
    async def test_extract_docx_returns_html_content(self, client: AsyncClient):
        """Test that DOCX extraction returns HTML content."""
        docx_content = b"PK fake docx content"
        docx_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        with patch(
            "app.api.routes.upload.extract_text"
        ) as mock_extract, patch(
            "app.api.routes.upload.convert_to_html"
        ) as mock_convert, patch(
            "app.api.routes.upload.get_storage_service"
        ) as mock_storage:
            mock_result = MagicMock()
            mock_result.raw_content = "Resume content from DOCX"
            mock_result.source_filename = "resume.docx"
            mock_result.file_type = "docx"
            mock_result.page_count = None
            mock_result.word_count = 4
            mock_result.warnings = []
            mock_extract.return_value = mock_result

            mock_convert.return_value = "<p>Resume content from DOCX</p>"

            mock_storage_instance = MagicMock()
            mock_storage_instance.generate_file_key.return_value = "users/1/resumes/abc.docx"
            mock_storage_instance.upload = AsyncMock()
            mock_storage.return_value = mock_storage_instance

            response = await client.post(
                "/api/upload/extract",
                files={"file": ("resume.docx", BytesIO(docx_content), docx_mime)},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["html_content"] == "<p>Resume content from DOCX</p>"
            assert data["file_type"] == "docx"
            assert data["page_count"] is None

    @pytest.mark.asyncio
    async def test_extract_fallback_html_on_conversion_error(
        self, client: AsyncClient
    ):
        """Test that conversion errors fall back to wrapped plain text."""
        from app.services.document.converter import DocumentConversionError

        pdf_content = b"%PDF-1.4 fake pdf content"

        with patch(
            "app.api.routes.upload.extract_text"
        ) as mock_extract, patch(
            "app.api.routes.upload.convert_to_html"
        ) as mock_convert, patch(
            "app.api.routes.upload.get_storage_service"
        ) as mock_storage:
            mock_result = MagicMock()
            mock_result.raw_content = "Plain text content"
            mock_result.source_filename = "resume.pdf"
            mock_result.file_type = "pdf"
            mock_result.page_count = 1
            mock_result.word_count = 3
            mock_result.warnings = []
            mock_extract.return_value = mock_result

            # Simulate conversion error
            mock_convert.side_effect = DocumentConversionError("Conversion failed")

            mock_storage_instance = MagicMock()
            mock_storage_instance.generate_file_key.return_value = "users/1/resumes/abc.pdf"
            mock_storage_instance.upload = AsyncMock()
            mock_storage.return_value = mock_storage_instance

            response = await client.post(
                "/api/upload/extract",
                files={"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")},
            )

            assert response.status_code == 200
            data = response.json()
            # Fallback HTML should be plain text wrapped in <p>
            assert "<p>Plain text content</p>" in data["html_content"]
            # Should include warning about fallback
            assert any("fallback" in w.lower() for w in data["warnings"])

    @pytest.mark.asyncio
    async def test_extract_stores_file_in_minio(self, client: AsyncClient):
        """Test that the original file is stored in MinIO."""
        pdf_content = b"%PDF-1.4 fake pdf content"

        with patch(
            "app.api.routes.upload.extract_text"
        ) as mock_extract, patch(
            "app.api.routes.upload.convert_to_html"
        ) as mock_convert, patch(
            "app.api.routes.upload.get_storage_service"
        ) as mock_storage:
            mock_result = MagicMock()
            mock_result.raw_content = "Content"
            mock_result.source_filename = "resume.pdf"
            mock_result.file_type = "pdf"
            mock_result.page_count = 1
            mock_result.word_count = 1
            mock_result.warnings = []
            mock_extract.return_value = mock_result
            mock_convert.return_value = "<p>Content</p>"

            mock_storage_instance = MagicMock()
            mock_storage_instance.generate_file_key.return_value = "users/1/resumes/abc.pdf"
            mock_storage_instance.upload = AsyncMock()
            mock_storage.return_value = mock_storage_instance

            response = await client.post(
                "/api/upload/extract",
                files={"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["file_key"] == "users/1/resumes/abc.pdf"
            assert data["file_size_bytes"] == len(pdf_content)

            # Verify storage was called
            mock_storage_instance.upload.assert_called_once()

    @pytest.mark.asyncio
    async def test_extract_continues_on_storage_error(self, client: AsyncClient):
        """Test that extraction succeeds even if storage fails."""
        from app.services.storage.file_storage import FileStorageError

        pdf_content = b"%PDF-1.4 fake pdf content"

        with patch(
            "app.api.routes.upload.extract_text"
        ) as mock_extract, patch(
            "app.api.routes.upload.convert_to_html"
        ) as mock_convert, patch(
            "app.api.routes.upload.get_storage_service"
        ) as mock_storage:
            mock_result = MagicMock()
            mock_result.raw_content = "Content"
            mock_result.source_filename = "resume.pdf"
            mock_result.file_type = "pdf"
            mock_result.page_count = 1
            mock_result.word_count = 1
            mock_result.warnings = []
            mock_extract.return_value = mock_result
            mock_convert.return_value = "<p>Content</p>"

            # Storage fails
            mock_storage_instance = MagicMock()
            mock_storage_instance.generate_file_key.return_value = "users/1/resumes/abc.pdf"
            mock_storage_instance.upload = AsyncMock(
                side_effect=FileStorageError("MinIO unavailable")
            )
            mock_storage.return_value = mock_storage_instance

            response = await client.post(
                "/api/upload/extract",
                files={"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")},
            )

            assert response.status_code == 200
            data = response.json()
            # Content should still be returned
            assert data["raw_content"] == "Content"
            assert data["html_content"] == "<p>Content</p>"
            # But file_key should be None
            assert data["file_key"] is None
            # Should have warning about storage failure
            assert any("storage" in w.lower() for w in data["warnings"])

    @pytest.mark.asyncio
    async def test_extract_rejects_invalid_file_type(self, client: AsyncClient):
        """Test that invalid file types are rejected."""
        response = await client.post(
            "/api/upload/extract",
            files={"file": ("image.png", BytesIO(b"PNG content"), "image/png")},
        )

        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_extract_rejects_empty_file(self, client: AsyncClient):
        """Test that empty files are rejected."""
        response = await client.post(
            "/api/upload/extract",
            files={"file": ("resume.pdf", BytesIO(b""), "application/pdf")},
        )

        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_extract_handles_extraction_error(self, client: AsyncClient):
        """Test error handling when extraction fails."""
        from app.services.export.document_extractor import DocumentExtractionError

        pdf_content = b"%PDF-1.4 corrupt content"

        with patch("app.api.routes.upload.extract_text") as mock_extract:
            mock_extract.side_effect = DocumentExtractionError(
                "Could not extract text from PDF"
            )

            response = await client.post(
                "/api/upload/extract",
                files={"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")},
            )

            assert response.status_code == 422
            assert "Could not extract" in response.json()["detail"]


class TestUploadResponseSchema:
    """Tests for verifying the upload response schema."""

    @pytest.mark.asyncio
    async def test_response_contains_all_required_fields(self, client: AsyncClient):
        """Test that the response contains all Phase 4 fields."""
        pdf_content = b"%PDF-1.4 content"

        with patch(
            "app.api.routes.upload.extract_text"
        ) as mock_extract, patch(
            "app.api.routes.upload.convert_to_html"
        ) as mock_convert, patch(
            "app.api.routes.upload.get_storage_service"
        ) as mock_storage:
            mock_result = MagicMock()
            mock_result.raw_content = "Content"
            mock_result.source_filename = "test.pdf"
            mock_result.file_type = "pdf"
            mock_result.page_count = 2
            mock_result.word_count = 100
            mock_result.warnings = []
            mock_extract.return_value = mock_result
            mock_convert.return_value = "<p>Content</p>"

            mock_storage_instance = MagicMock()
            mock_storage_instance.generate_file_key.return_value = "key.pdf"
            mock_storage_instance.upload = AsyncMock()
            mock_storage.return_value = mock_storage_instance

            response = await client.post(
                "/api/upload/extract",
                files={"file": ("test.pdf", BytesIO(pdf_content), "application/pdf")},
            )

            assert response.status_code == 200
            data = response.json()

            # Verify all required fields are present
            required_fields = [
                "raw_content",
                "html_content",
                "source_filename",
                "file_type",
                "page_count",
                "word_count",
                "file_key",
                "file_size_bytes",
                "warnings",
            ]
            for field in required_fields:
                assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_response_field_types(self, client: AsyncClient):
        """Test that response fields have correct types."""
        pdf_content = b"%PDF-1.4 content"

        with patch(
            "app.api.routes.upload.extract_text"
        ) as mock_extract, patch(
            "app.api.routes.upload.convert_to_html"
        ) as mock_convert, patch(
            "app.api.routes.upload.get_storage_service"
        ) as mock_storage:
            mock_result = MagicMock()
            mock_result.raw_content = "Content"
            mock_result.source_filename = "test.pdf"
            mock_result.file_type = "pdf"
            mock_result.page_count = 2
            mock_result.word_count = 100
            mock_result.warnings = ["Warning 1"]
            mock_extract.return_value = mock_result
            mock_convert.return_value = "<p>Content</p>"

            mock_storage_instance = MagicMock()
            mock_storage_instance.generate_file_key.return_value = "key.pdf"
            mock_storage_instance.upload = AsyncMock()
            mock_storage.return_value = mock_storage_instance

            response = await client.post(
                "/api/upload/extract",
                files={"file": ("test.pdf", BytesIO(pdf_content), "application/pdf")},
            )

            data = response.json()

            # Verify types
            assert isinstance(data["raw_content"], str)
            assert isinstance(data["html_content"], str)
            assert isinstance(data["source_filename"], str)
            assert data["file_type"] in ["pdf", "docx"]
            assert isinstance(data["page_count"], int) or data["page_count"] is None
            assert isinstance(data["word_count"], int)
            assert isinstance(data["file_key"], str) or data["file_key"] is None
            assert (
                isinstance(data["file_size_bytes"], int)
                or data["file_size_bytes"] is None
            )
            assert isinstance(data["warnings"], list)
