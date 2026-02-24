"""
Tests for the Document-to-HTML converter service.

Tests cover:
- PDF to HTML conversion with structure detection
- DOCX to HTML conversion using mammoth
- Section header detection heuristics
- Bullet point parsing
- HTML cleaning and normalization
- Error handling and fallbacks

Note: These tests are standalone and don't require the full app context,
avoiding issues with system library dependencies (e.g., WeasyPrint/gobject).
"""

import sys
from pathlib import Path

import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO

# Add the backend app to the path for direct imports
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

# Import directly from the module to avoid loading the full app
from app.services.document.converter import (
    DocumentConversionError,
    convert_docx_to_html,
    convert_pdf_to_html,
    convert_to_html,
    _clean_html,
    _detect_section_header,
    _text_to_html_paragraphs,
)


class TestDetectSectionHeader:
    """Tests for section header detection heuristics."""

    @pytest.mark.parametrize("header", [
        "Experience",
        "EXPERIENCE",
        "Work Experience",
        "WORK EXPERIENCE",
        "Education",
        "EDUCATION",
        "Skills",
        "SKILLS",
        "Technical Skills",
        "Summary",
        "Professional Summary",
        "Objective",
        "Certifications",
        "Projects",
        "Publications",
        "Awards",
        "Languages",
        "References",
        "Contact",
        "Contact Information",
        "Achievements",
        "Volunteering",
        "Volunteer Experience",
    ])
    def test_detects_common_resume_headers(self, header):
        """Test that common resume section headers are detected."""
        assert _detect_section_header(header) is True

    @pytest.mark.parametrize("non_header", [
        "John Doe",
        "Software Engineer",
        "Led team of 5 engineers",
        "Python, JavaScript, SQL",
        "University of California",
        "2020 - Present",
        "San Francisco, CA",
        "",
        "   ",
    ])
    def test_rejects_non_headers(self, non_header):
        """Test that non-header text is not detected as headers."""
        assert _detect_section_header(non_header) is False

    def test_handles_whitespace(self):
        """Test that headers with extra whitespace are detected."""
        assert _detect_section_header("  Experience  ") is True
        assert _detect_section_header("\tSkills\t") is True


class TestTextToHtmlParagraphs:
    """Tests for plain text to HTML paragraph conversion."""

    def test_converts_simple_paragraph(self):
        """Test converting a single paragraph."""
        text = "This is a simple paragraph."
        html = _text_to_html_paragraphs(text)
        assert "<p>This is a simple paragraph.</p>" in html

    def test_converts_section_header_to_h2(self):
        """Test that section headers become h2 elements."""
        text = "Experience\nWorked at Acme Corp"
        html = _text_to_html_paragraphs(text)
        assert "<h2>Experience</h2>" in html
        assert "<p>Worked at Acme Corp</p>" in html

    def test_first_titlecase_line_becomes_h1(self):
        """Test that the first title-cased line becomes h1 (likely name)."""
        text = "John Doe\nSoftware Engineer"
        html = _text_to_html_paragraphs(text)
        assert "<h1>John Doe</h1>" in html
        assert "<p>Software Engineer</p>" in html

    def test_first_uppercase_line_becomes_h1(self):
        """Test that the first all-caps line becomes h1."""
        text = "JANE SMITH\nProduct Manager"
        html = _text_to_html_paragraphs(text)
        assert "<h1>JANE SMITH</h1>" in html

    def test_converts_bullet_points_to_list(self):
        """Test that bullet points are converted to ul/li."""
        text = "Skills\n• Python\n• JavaScript\n• SQL"
        html = _text_to_html_paragraphs(text)
        assert "<ul>" in html
        assert "<li>Python</li>" in html
        assert "<li>JavaScript</li>" in html
        assert "<li>SQL</li>" in html
        assert "</ul>" in html

    def test_handles_dash_bullets(self):
        """Test that dash bullets are converted."""
        text = "- First item\n- Second item"
        html = _text_to_html_paragraphs(text)
        assert "<li>First item</li>" in html
        assert "<li>Second item</li>" in html

    def test_handles_asterisk_bullets(self):
        """Test that asterisk bullets are converted."""
        text = "* Item one\n* Item two"
        html = _text_to_html_paragraphs(text)
        assert "<li>Item one</li>" in html
        assert "<li>Item two</li>" in html

    def test_escapes_html_entities(self):
        """Test that HTML entities are properly escaped."""
        text = "Skills: Python & JavaScript <3"
        html = _text_to_html_paragraphs(text)
        assert "&amp;" in html
        assert "&lt;3" in html

    def test_handles_empty_lines(self):
        """Test that empty lines don't create empty elements."""
        text = "First paragraph\n\n\nSecond paragraph"
        html = _text_to_html_paragraphs(text)
        assert "<p></p>" not in html
        assert "<p>First paragraph</p>" in html
        assert "<p>Second paragraph</p>" in html

    def test_complex_resume_structure(self):
        """Test a realistic resume structure."""
        text = """John Doe
Senior Software Engineer

Summary
Experienced engineer with 10 years in tech.

Experience
• Led team of 5 engineers
• Reduced costs by 30%

Skills
Python, JavaScript, SQL"""

        html = _text_to_html_paragraphs(text)

        assert "<h1>John Doe</h1>" in html
        assert "<h2>Summary</h2>" in html
        assert "<h2>Experience</h2>" in html
        assert "<h2>Skills</h2>" in html
        assert "<li>Led team of 5 engineers</li>" in html


class TestCleanHtml:
    """Tests for HTML cleaning and normalization."""

    def test_removes_empty_paragraphs(self):
        """Test that empty paragraphs are removed."""
        html = "<p>Content</p><p></p><p>More content</p>"
        cleaned = _clean_html(html)
        assert "<p></p>" not in cleaned
        assert "<p>Content</p>" in cleaned

    def test_removes_whitespace_only_paragraphs(self):
        """Test that whitespace-only paragraphs are removed."""
        html = "<p>Content</p><p>   </p><p>More</p>"
        cleaned = _clean_html(html)
        assert "<p>   </p>" not in cleaned

    def test_limits_consecutive_line_breaks(self):
        """Test that excessive line breaks are limited."""
        html = "Text<br><br><br><br><br>More text"
        cleaned = _clean_html(html)
        assert "<br><br><br>" not in cleaned

    def test_strips_leading_trailing_whitespace(self):
        """Test that leading/trailing whitespace is stripped."""
        html = "   <p>Content</p>   "
        cleaned = _clean_html(html)
        assert cleaned == "<p>Content</p>"


class TestConvertDocxToHtml:
    """Tests for DOCX to HTML conversion using mammoth."""

    def test_successful_conversion(self):
        """Test successful DOCX conversion with mocked mammoth."""
        with patch("app.services.document.converter.mammoth") as mock_mammoth:
            mock_result = MagicMock()
            mock_result.value = "<p>Hello <strong>World</strong></p>"
            mock_result.messages = []
            mock_mammoth.convert_to_html.return_value = mock_result

            html = convert_docx_to_html(b"fake docx bytes")

            assert "<p>Hello <strong>World</strong></p>" in html
            mock_mammoth.convert_to_html.assert_called_once()

    def test_handles_warnings(self):
        """Test that mammoth warnings are logged but don't fail."""
        with patch("app.services.document.converter.mammoth") as mock_mammoth:
            mock_result = MagicMock()
            mock_result.value = "<p>Content</p>"
            mock_result.messages = ["Warning: Some formatting lost"]
            mock_mammoth.convert_to_html.return_value = mock_result

            html = convert_docx_to_html(b"fake docx bytes")

            assert "<p>Content</p>" in html

    def test_raises_error_for_empty_content(self):
        """Test that empty content raises DocumentConversionError."""
        with patch("app.services.document.converter.mammoth") as mock_mammoth:
            mock_result = MagicMock()
            mock_result.value = ""
            mock_result.messages = []
            mock_mammoth.convert_to_html.return_value = mock_result

            with pytest.raises(DocumentConversionError) as exc_info:
                convert_docx_to_html(b"fake docx bytes")

            assert "empty" in str(exc_info.value).lower()

    def test_raises_error_for_whitespace_only_content(self):
        """Test that whitespace-only content raises error."""
        with patch("app.services.document.converter.mammoth") as mock_mammoth:
            mock_result = MagicMock()
            mock_result.value = "   \n\t  "
            mock_result.messages = []
            mock_mammoth.convert_to_html.return_value = mock_result

            with pytest.raises(DocumentConversionError):
                convert_docx_to_html(b"fake docx bytes")

    def test_handles_mammoth_exception(self):
        """Test that mammoth exceptions are wrapped."""
        with patch("app.services.document.converter.mammoth") as mock_mammoth:
            mock_mammoth.convert_to_html.side_effect = Exception("Corrupt file")

            with pytest.raises(DocumentConversionError) as exc_info:
                convert_docx_to_html(b"fake docx bytes")

            assert "Failed to convert DOCX" in str(exc_info.value)


class TestConvertPdfToHtml:
    """Tests for PDF to HTML conversion."""

    def test_successful_conversion(self):
        """Test successful PDF conversion with mocked pdfplumber."""
        with patch("app.services.document.converter.pdfplumber") as mock_pdfplumber:
            mock_page = MagicMock()
            mock_page.extract_text.return_value = "John Doe\nExperience\n• Led team"

            mock_pdf = MagicMock()
            mock_pdf.pages = [mock_page]
            mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
            mock_pdf.__exit__ = MagicMock(return_value=False)

            mock_pdfplumber.open.return_value = mock_pdf

            html = convert_pdf_to_html(b"fake pdf bytes")

            assert "<h1>John Doe</h1>" in html
            assert "<h2>Experience</h2>" in html
            assert "<li>Led team</li>" in html

    def test_handles_multiple_pages(self):
        """Test that multiple pages are combined."""
        with patch("app.services.document.converter.pdfplumber") as mock_pdfplumber:
            mock_page1 = MagicMock()
            mock_page1.extract_text.return_value = "Page 1 content"

            mock_page2 = MagicMock()
            mock_page2.extract_text.return_value = "Page 2 content"

            mock_pdf = MagicMock()
            mock_pdf.pages = [mock_page1, mock_page2]
            mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
            mock_pdf.__exit__ = MagicMock(return_value=False)

            mock_pdfplumber.open.return_value = mock_pdf

            html = convert_pdf_to_html(b"fake pdf bytes")

            assert "Page 1 content" in html
            assert "Page 2 content" in html

    def test_raises_error_for_no_pages(self):
        """Test that PDFs with no pages raise error."""
        with patch("app.services.document.converter.pdfplumber") as mock_pdfplumber:
            mock_pdf = MagicMock()
            mock_pdf.pages = []
            mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
            mock_pdf.__exit__ = MagicMock(return_value=False)

            mock_pdfplumber.open.return_value = mock_pdf

            with pytest.raises(DocumentConversionError) as exc_info:
                convert_pdf_to_html(b"fake pdf bytes")

            assert "no pages" in str(exc_info.value).lower()

    def test_raises_error_for_no_extractable_text(self):
        """Test that image-based PDFs with no text raise error."""
        with patch("app.services.document.converter.pdfplumber") as mock_pdfplumber:
            mock_page = MagicMock()
            mock_page.extract_text.return_value = None

            mock_pdf = MagicMock()
            mock_pdf.pages = [mock_page]
            mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
            mock_pdf.__exit__ = MagicMock(return_value=False)

            mock_pdfplumber.open.return_value = mock_pdf

            with pytest.raises(DocumentConversionError) as exc_info:
                convert_pdf_to_html(b"fake pdf bytes")

            assert "image-based" in str(exc_info.value).lower()

    def test_handles_pdfplumber_exception(self):
        """Test that pdfplumber exceptions are wrapped."""
        with patch("app.services.document.converter.pdfplumber") as mock_pdfplumber:
            mock_pdfplumber.open.side_effect = Exception("Corrupt PDF")

            with pytest.raises(DocumentConversionError) as exc_info:
                convert_pdf_to_html(b"fake pdf bytes")

            assert "Failed to convert PDF" in str(exc_info.value)


class TestConvertToHtml:
    """Tests for the main convert_to_html dispatcher."""

    def test_routes_pdf_correctly(self):
        """Test that PDF content type routes to PDF converter."""
        with patch("app.services.document.converter.convert_pdf_to_html") as mock_pdf:
            mock_pdf.return_value = "<p>PDF content</p>"

            result = convert_to_html(b"bytes", "application/pdf")

            mock_pdf.assert_called_once_with(b"bytes")
            assert result == "<p>PDF content</p>"

    def test_routes_docx_correctly(self):
        """Test that DOCX content type routes to DOCX converter."""
        docx_content_type = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

        with patch("app.services.document.converter.convert_docx_to_html") as mock_docx:
            mock_docx.return_value = "<p>DOCX content</p>"

            result = convert_to_html(b"bytes", docx_content_type)

            mock_docx.assert_called_once_with(b"bytes")
            assert result == "<p>DOCX content</p>"

    def test_raises_error_for_unsupported_type(self):
        """Test that unsupported content types raise error."""
        with pytest.raises(DocumentConversionError) as exc_info:
            convert_to_html(b"bytes", "text/plain")

        assert "Unsupported file type" in str(exc_info.value)
        assert "text/plain" in str(exc_info.value)

    def test_raises_error_for_image(self):
        """Test that image files are rejected."""
        with pytest.raises(DocumentConversionError):
            convert_to_html(b"bytes", "image/png")


class TestEdgeCases:
    """Tests for edge cases and special scenarios."""

    def test_unicode_content_handling(self):
        """Test that Unicode content is handled correctly."""
        text = "名前: 田中太郎\nSkills\n• Python\n• 日本語"
        html = _text_to_html_paragraphs(text)

        assert "田中太郎" in html
        assert "日本語" in html

    def test_special_characters_in_text(self):
        """Test that special characters don't break conversion."""
        text = "Email: john@example.com\nPhone: (555) 123-4567\nSalary: $100,000+"
        html = _text_to_html_paragraphs(text)

        assert "john@example.com" in html
        assert "(555) 123-4567" in html
        assert "$100,000+" in html

    def test_mixed_bullet_styles(self):
        """Test handling mixed bullet point styles."""
        text = "• Bullet one\n- Dash two\n* Star three"
        html = _text_to_html_paragraphs(text)

        assert "<li>Bullet one</li>" in html
        assert "<li>Dash two</li>" in html
        assert "<li>Star three</li>" in html

    def test_very_long_text(self):
        """Test handling of very long text content."""
        long_paragraph = "Lorem ipsum " * 1000
        html = _text_to_html_paragraphs(long_paragraph)

        assert "<p>" in html
        assert "</p>" in html

    def test_only_whitespace_input(self):
        """Test handling of whitespace-only input."""
        text = "   \n\n\t\t\n   "
        html = _text_to_html_paragraphs(text)

        # Should produce empty or minimal output
        assert "<p></p>" not in html
