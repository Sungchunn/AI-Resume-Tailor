"""
Tests for the HTML-to-Document Export Service (Phase 7).

Tests cover:
- StyleTemplate enum and ExportOptions dataclass
- DOCX generation from HTML content
- PDF generation (mocked for CI environments without WeasyPrint system deps)
- CSS template generation for different styles
- HTML parsing and block conversion for DOCX
- Error handling and edge cases

Note: PDF export tests mock WeasyPrint to avoid system dependency issues in CI.
"""

import sys
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile

import pytest
from unittest.mock import patch, MagicMock

# Add the backend app to the path for direct imports
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

from app.services.export.html_to_document import (
    HTMLToDocumentService,
    get_html_export_service,
    StyleTemplate,
    ExportOptions,
    TEMPLATE_CSS,
    WEASYPRINT_AVAILABLE,
)


class TestStyleTemplate:
    """Tests for the StyleTemplate enum."""

    def test_has_classic_template(self):
        """Test that classic template exists."""
        assert StyleTemplate.CLASSIC == "classic"

    def test_has_modern_template(self):
        """Test that modern template exists."""
        assert StyleTemplate.MODERN == "modern"

    def test_has_minimal_template(self):
        """Test that minimal template exists."""
        assert StyleTemplate.MINIMAL == "minimal"

    def test_template_is_string_enum(self):
        """Test that templates are string enums for JSON serialization."""
        assert isinstance(StyleTemplate.CLASSIC.value, str)
        assert isinstance(StyleTemplate.MODERN.value, str)
        assert isinstance(StyleTemplate.MINIMAL.value, str)

    def test_all_templates_have_css(self):
        """Test that all templates have corresponding CSS definitions."""
        for template in StyleTemplate:
            assert template in TEMPLATE_CSS
            assert len(TEMPLATE_CSS[template]) > 0


class TestExportOptions:
    """Tests for the ExportOptions dataclass."""

    def test_default_values(self):
        """Test default option values."""
        options = ExportOptions()
        assert options.template == StyleTemplate.CLASSIC
        assert options.font_family == "Arial"
        assert options.font_size == 11
        assert options.margin_top == 0.75
        assert options.margin_bottom == 0.75
        assert options.margin_left == 0.75
        assert options.margin_right == 0.75
        assert options.line_spacing == 1.15

    def test_custom_values(self):
        """Test custom option values."""
        options = ExportOptions(
            template=StyleTemplate.MODERN,
            font_family="Times New Roman",
            font_size=12,
            margin_top=1.0,
            margin_bottom=1.0,
            margin_left=0.5,
            margin_right=0.5,
            line_spacing=1.5,
        )
        assert options.template == StyleTemplate.MODERN
        assert options.font_family == "Times New Roman"
        assert options.font_size == 12
        assert options.margin_top == 1.0
        assert options.line_spacing == 1.5


class TestTemplateCss:
    """Tests for CSS template generation."""

    def test_classic_template_has_required_styles(self):
        """Test classic template has all required CSS sections."""
        css = TEMPLATE_CSS[StyleTemplate.CLASSIC]
        assert "@page" in css
        assert "body" in css
        assert "h1" in css
        assert "h2" in css
        assert "h3" in css
        assert "p " in css or "p{" in css
        assert "ul" in css
        assert "li" in css

    def test_modern_template_has_accent_colors(self):
        """Test modern template uses accent colors."""
        css = TEMPLATE_CSS[StyleTemplate.MODERN]
        # Modern template uses blue accent colors
        assert "#2563eb" in css or "2563eb" in css.lower()

    def test_minimal_template_is_clean(self):
        """Test minimal template has fewer decorative elements."""
        css = TEMPLATE_CSS[StyleTemplate.MINIMAL]
        # Minimal should not have borders on h2
        assert "border-bottom:" not in css.split("h2")[1].split("}")[0] if "h2" in css else True

    def test_css_has_format_placeholders(self):
        """Test CSS templates have all required format placeholders."""
        for template in StyleTemplate:
            css = TEMPLATE_CSS[template]
            assert "{font_family}" in css
            assert "{font_size}" in css
            assert "{margin_top}" in css
            assert "{margin_bottom}" in css
            assert "{margin_left}" in css
            assert "{margin_right}" in css
            assert "{line_spacing}" in css


class TestHTMLToDocumentService:
    """Tests for the HTMLToDocumentService class."""

    @pytest.fixture
    def service(self):
        """Create a fresh service instance."""
        return HTMLToDocumentService()

    @pytest.fixture
    def sample_html(self):
        """Sample HTML content for testing."""
        return """
            <h1>John Doe</h1>
            <p>Senior Software Engineer</p>
            <h2>Experience</h2>
            <ul>
                <li>Led team of 5 engineers at Acme Corp</li>
                <li>Reduced deployment time by 50%</li>
            </ul>
            <h2>Skills</h2>
            <p><strong>Languages:</strong> Python, JavaScript, Go</p>
            <p><em>Frameworks:</em> React, FastAPI, Django</p>
        """

    @pytest.fixture
    def simple_html(self):
        """Simple HTML for quick tests."""
        return "<h1>Test Resume</h1><p>This is a test.</p>"


class TestDocxGeneration(TestHTMLToDocumentService):
    """Tests for DOCX generation."""

    def test_generates_valid_docx_bytes(self, service, sample_html):
        """Test that generate_docx returns valid DOCX bytes."""
        result = service.generate_docx(sample_html)

        assert isinstance(result, bytes)
        assert len(result) > 0

        # DOCX files are ZIP archives
        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                # Valid DOCX has these required files
                namelist = zf.namelist()
                assert "[Content_Types].xml" in namelist
                assert "word/document.xml" in namelist

    def test_generates_docx_with_default_options(self, service, simple_html):
        """Test DOCX generation with default options."""
        result = service.generate_docx(simple_html)
        assert isinstance(result, bytes)
        assert len(result) > 1000  # Should be at least 1KB

    def test_generates_docx_with_custom_options(self, service, simple_html):
        """Test DOCX generation with custom options."""
        options = ExportOptions(
            template=StyleTemplate.MODERN,
            font_family="Times New Roman",
            font_size=14,
            margin_top=1.0,
        )
        result = service.generate_docx(simple_html, options)
        assert isinstance(result, bytes)

    def test_handles_empty_html(self, service):
        """Test handling of minimal HTML content."""
        result = service.generate_docx("<p>Minimal</p>")
        assert isinstance(result, bytes)

    def test_handles_complex_html_structure(self, service, sample_html):
        """Test handling of complex HTML with multiple elements."""
        result = service.generate_docx(sample_html)
        assert isinstance(result, bytes)

        # Verify content is in the document
        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "John Doe" in doc_xml
                assert "Experience" in doc_xml
                assert "Skills" in doc_xml

    def test_preserves_bold_formatting(self, service):
        """Test that bold text is preserved."""
        html = "<p><strong>Bold text</strong> and normal text</p>"
        result = service.generate_docx(html)

        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "Bold text" in doc_xml
                # Bold is represented as <w:b/> in DOCX
                assert "<w:b/>" in doc_xml or "<w:b />" in doc_xml

    def test_preserves_italic_formatting(self, service):
        """Test that italic text is preserved."""
        html = "<p><em>Italic text</em> and normal text</p>"
        result = service.generate_docx(html)

        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "Italic text" in doc_xml
                # Italic is represented as <w:i/> in DOCX
                assert "<w:i/>" in doc_xml or "<w:i />" in doc_xml

    def test_handles_bullet_lists(self, service):
        """Test that bullet lists are converted properly."""
        html = "<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>"
        result = service.generate_docx(html)

        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "Item 1" in doc_xml
                assert "Item 2" in doc_xml
                assert "Item 3" in doc_xml

    def test_handles_numbered_lists(self, service):
        """Test that numbered lists are converted properly."""
        html = "<ol><li>First</li><li>Second</li><li>Third</li></ol>"
        result = service.generate_docx(html)

        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "First" in doc_xml
                assert "Second" in doc_xml

    def test_handles_all_heading_levels(self, service):
        """Test that h1, h2, h3 headings are converted."""
        html = "<h1>Level 1</h1><h2>Level 2</h2><h3>Level 3</h3>"
        result = service.generate_docx(html)

        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "Level 1" in doc_xml
                assert "Level 2" in doc_xml
                assert "Level 3" in doc_xml

    def test_handles_blockquotes(self, service):
        """Test that blockquotes are converted."""
        html = "<blockquote>A wise quote</blockquote>"
        result = service.generate_docx(html)

        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "wise quote" in doc_xml


class TestPdfGeneration(TestHTMLToDocumentService):
    """Tests for PDF generation."""

    def test_pdf_raises_error_when_weasyprint_unavailable(self, service, simple_html):
        """Test that PDF generation raises RuntimeError when WeasyPrint is unavailable."""
        if WEASYPRINT_AVAILABLE:
            pytest.skip("WeasyPrint is available, skipping unavailable test")

        with pytest.raises(RuntimeError) as exc_info:
            service.generate_pdf(simple_html)

        assert "WeasyPrint" in str(exc_info.value)
        assert "pango" in str(exc_info.value).lower()

    @pytest.mark.skipif(not WEASYPRINT_AVAILABLE, reason="WeasyPrint not available")
    def test_generates_valid_pdf_bytes(self, service, sample_html):
        """Test that generate_pdf returns valid PDF bytes (when WeasyPrint available)."""
        result = service.generate_pdf(sample_html)

        assert isinstance(result, bytes)
        assert len(result) > 0
        # PDF files start with %PDF
        assert result[:4] == b"%PDF"

    @pytest.mark.skipif(not WEASYPRINT_AVAILABLE, reason="WeasyPrint not available")
    def test_pdf_with_different_templates(self, service, simple_html):
        """Test PDF generation with all templates."""
        for template in StyleTemplate:
            options = ExportOptions(template=template)
            result = service.generate_pdf(simple_html, options)
            assert result[:4] == b"%PDF"


class TestAsyncWrappers(TestHTMLToDocumentService):
    """Tests for async wrapper methods."""

    @pytest.mark.asyncio
    async def test_export_docx_async(self, service, simple_html):
        """Test async DOCX export wrapper."""
        result = await service.export_docx(simple_html)
        assert isinstance(result, bytes)

        # Verify it's a valid DOCX
        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                assert "word/document.xml" in zf.namelist()

    @pytest.mark.asyncio
    async def test_export_docx_with_options(self, service, simple_html):
        """Test async DOCX export with all options."""
        result = await service.export_docx(
            html_content=simple_html,
            template="modern",
            font_family="Georgia",
            font_size=12,
            margin_top=1.0,
            margin_bottom=1.0,
            margin_left=0.5,
            margin_right=0.5,
        )
        assert isinstance(result, bytes)

    @pytest.mark.asyncio
    async def test_export_docx_invalid_template_uses_default(self, service, simple_html):
        """Test that invalid template name falls back to classic."""
        result = await service.export_docx(
            html_content=simple_html,
            template="nonexistent",
        )
        assert isinstance(result, bytes)

    @pytest.mark.asyncio
    async def test_export_pdf_async(self, service, simple_html):
        """Test async PDF export wrapper."""
        if not WEASYPRINT_AVAILABLE:
            with pytest.raises(RuntimeError):
                await service.export_pdf(simple_html)
        else:
            result = await service.export_pdf(simple_html)
            assert isinstance(result, bytes)
            assert result[:4] == b"%PDF"


class TestSingletonPattern:
    """Tests for the singleton service getter."""

    def test_get_html_export_service_returns_instance(self):
        """Test that get_html_export_service returns an instance."""
        service = get_html_export_service()
        assert isinstance(service, HTMLToDocumentService)

    def test_get_html_export_service_returns_same_instance(self):
        """Test that get_html_export_service returns the same instance."""
        service1 = get_html_export_service()
        service2 = get_html_export_service()
        assert service1 is service2


class TestHtmlParsing:
    """Tests for internal HTML parsing methods."""

    @pytest.fixture
    def service(self):
        return HTMLToDocumentService()

    def test_clean_html_removes_whitespace(self, service):
        """Test that _clean_html normalizes whitespace."""
        dirty_html = "  <p>  Content   </p>  "
        cleaned = service._clean_html(dirty_html)
        assert cleaned == "<p> Content </p>"

    def test_clean_html_removes_empty_paragraphs(self, service):
        """Test that empty paragraphs are removed."""
        html = "<p>Content</p><p></p><p>More</p>"
        cleaned = service._clean_html(html)
        assert "<p></p>" not in cleaned

    def test_split_html_blocks_extracts_paragraphs(self, service):
        """Test that HTML is split into blocks."""
        html = "<p>First</p><p>Second</p>"
        blocks = service._split_html_blocks(html)

        assert len(blocks) >= 2
        assert any("First" in content for _, content in blocks)
        assert any("Second" in content for _, content in blocks)

    def test_split_html_blocks_extracts_headings(self, service):
        """Test that headings are extracted as blocks."""
        html = "<h1>Title</h1><h2>Section</h2><p>Content</p>"
        blocks = service._split_html_blocks(html)

        tags = [tag for tag, _ in blocks]
        assert "h1" in tags
        assert "h2" in tags
        assert "p" in tags

    def test_split_html_blocks_extracts_lists(self, service):
        """Test that lists are extracted as blocks."""
        html = "<ul><li>Item 1</li><li>Item 2</li></ul>"
        blocks = service._split_html_blocks(html)

        tags = [tag for tag, _ in blocks]
        assert "ul" in tags

    def test_wrap_html_includes_doctype(self, service):
        """Test that _wrap_html creates complete HTML document."""
        options = ExportOptions()
        full_html = service._wrap_html("<p>Content</p>", options)

        assert "<!DOCTYPE html>" in full_html
        assert "<html>" in full_html
        assert "<head>" in full_html
        assert "<body>" in full_html
        assert "Content" in full_html


class TestInlineFormatting:
    """Tests for inline formatting parsing."""

    @pytest.fixture
    def service(self):
        return HTMLToDocumentService()

    def test_split_inline_formatting_plain_text(self, service):
        """Test parsing plain text without formatting."""
        result = service._split_inline_formatting("Plain text")
        assert len(result) == 1
        text, styles = result[0]
        assert "Plain text" in text
        assert len(styles) == 0

    def test_split_inline_formatting_bold(self, service):
        """Test parsing bold text."""
        result = service._split_inline_formatting("<strong>Bold</strong>")
        found_bold = False
        for text, styles in result:
            if "Bold" in text and "bold" in styles:
                found_bold = True
                break
        assert found_bold

    def test_split_inline_formatting_italic(self, service):
        """Test parsing italic text."""
        result = service._split_inline_formatting("<em>Italic</em>")
        found_italic = False
        for text, styles in result:
            if "Italic" in text and "italic" in styles:
                found_italic = True
                break
        assert found_italic

    def test_split_inline_formatting_nested(self, service):
        """Test parsing nested formatting."""
        result = service._split_inline_formatting("<strong><em>Bold Italic</em></strong>")
        found_both = False
        for text, styles in result:
            if "Bold Italic" in text and "bold" in styles and "italic" in styles:
                found_both = True
                break
        assert found_both

    def test_split_inline_formatting_mixed(self, service):
        """Test parsing mixed content."""
        result = service._split_inline_formatting(
            "Normal <strong>bold</strong> and <em>italic</em> text"
        )
        # Should have multiple segments
        assert len(result) >= 3


class TestHeadingColors:
    """Tests for template-specific heading colors."""

    @pytest.fixture
    def service(self):
        return HTMLToDocumentService()

    def test_classic_heading_colors(self, service):
        """Test classic template heading colors."""
        colors = service._get_heading_colors(StyleTemplate.CLASSIC)
        assert "h1" in colors
        assert "h2" in colors
        assert "h3" in colors

    def test_modern_heading_colors(self, service):
        """Test modern template heading colors are different."""
        classic = service._get_heading_colors(StyleTemplate.CLASSIC)
        modern = service._get_heading_colors(StyleTemplate.MODERN)

        # Modern should have distinct colors
        assert classic["h2"] != modern["h2"]

    def test_minimal_heading_colors(self, service):
        """Test minimal template heading colors."""
        colors = service._get_heading_colors(StyleTemplate.MINIMAL)
        assert "h1" in colors
        assert "h2" in colors
        assert "h3" in colors


class TestEdgeCases:
    """Tests for edge cases and special scenarios."""

    @pytest.fixture
    def service(self):
        return HTMLToDocumentService()

    def test_handles_unicode_content(self, service):
        """Test handling of Unicode characters."""
        html = "<p>名前: 田中太郎</p><p>Résumé: développeur</p>"
        result = service.generate_docx(html)

        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "田中太郎" in doc_xml
                assert "développeur" in doc_xml

    def test_handles_special_characters(self, service):
        """Test handling of special characters."""
        html = "<p>Skills: Python &amp; JavaScript &lt;3</p>"
        result = service.generate_docx(html)
        assert isinstance(result, bytes)

    def test_handles_empty_elements(self, service):
        """Test handling of empty elements."""
        html = "<p></p><h1>Title</h1><p></p><p>Content</p><p></p>"
        result = service.generate_docx(html)
        assert isinstance(result, bytes)

    def test_handles_deeply_nested_html(self, service):
        """Test handling of deeply nested HTML."""
        html = "<div><div><div><p><strong><em>Deep content</em></strong></p></div></div></div>"
        result = service.generate_docx(html)
        assert isinstance(result, bytes)

    def test_handles_very_long_content(self, service):
        """Test handling of very long content."""
        long_text = "Lorem ipsum dolor sit amet. " * 500
        html = f"<p>{long_text}</p>"
        result = service.generate_docx(html)
        assert isinstance(result, bytes)
        assert len(result) > 10000  # Should be substantial

    def test_handles_many_list_items(self, service):
        """Test handling of many list items."""
        items = "".join(f"<li>Item {i}</li>" for i in range(100))
        html = f"<ul>{items}</ul>"
        result = service.generate_docx(html)

        with BytesIO(result) as f:
            with ZipFile(f, 'r') as zf:
                doc_xml = zf.read("word/document.xml").decode("utf-8")
                assert "Item 1" in doc_xml
                assert "Item 99" in doc_xml

    def test_handles_html_entities(self, service):
        """Test handling of HTML entities."""
        html = "<p>Copyright &copy; 2024 &mdash; All rights reserved &trade;</p>"
        result = service.generate_docx(html)
        assert isinstance(result, bytes)
