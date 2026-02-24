"""
Document-to-HTML conversion service.

Converts PDF and DOCX files to TipTap-compatible HTML for rich text editing.
"""

import html
import logging
import re
from io import BytesIO
from typing import Literal

import mammoth
import pdfplumber

logger = logging.getLogger(__name__)


class DocumentConversionError(Exception):
    """Raised when document conversion to HTML fails."""


def _clean_html(html_content: str) -> str:
    """
    Clean and normalize HTML output for TipTap compatibility.

    - Removes empty paragraphs
    - Normalizes whitespace
    - Ensures proper structure
    """
    # Remove empty paragraphs
    html_content = re.sub(r"<p>\s*</p>", "", html_content)

    # Remove multiple consecutive line breaks
    html_content = re.sub(r"(<br\s*/?>){3,}", "<br><br>", html_content)

    # Normalize whitespace while preserving structure
    html_content = re.sub(r"\n\s*\n", "\n", html_content)

    return html_content.strip()


def _detect_section_header(text: str) -> bool:
    """
    Detect if a line is likely a resume section header.

    Common section headers: Experience, Education, Skills, Summary, etc.
    """
    # Common resume section patterns
    section_patterns = [
        r"^(work\s+)?experience$",
        r"^education$",
        r"^skills$",
        r"^(professional\s+)?summary$",
        r"^objective$",
        r"^(work\s+)?history$",
        r"^qualifications$",
        r"^certifications?$",
        r"^projects?$",
        r"^publications?$",
        r"^awards?$",
        r"^languages?$",
        r"^references?$",
        r"^contact(\s+info(rmation)?)?$",
        r"^(technical\s+)?skills?$",
        r"^achievements?$",
        r"^volunteer(ing)?(\s+experience)?$",
    ]

    text_lower = text.strip().lower()

    for pattern in section_patterns:
        if re.match(pattern, text_lower):
            return True

    return False


def _text_to_html_paragraphs(text: str) -> str:
    """
    Convert plain text to HTML with paragraph structure.

    Attempts to detect:
    - Section headers (converts to <h2>)
    - Lists (converts to <ul>/<li>)
    - Regular paragraphs
    """
    lines = text.split("\n")
    html_parts: list[str] = []
    current_list_items: list[str] = []

    def flush_list() -> None:
        """Flush accumulated list items to HTML."""
        if current_list_items:
            html_parts.append("<ul>")
            for item in current_list_items:
                html_parts.append(f"<li>{html.escape(item)}</li>")
            html_parts.append("</ul>")
            current_list_items.clear()

    for line in lines:
        line = line.strip()

        if not line:
            flush_list()
            continue

        # Check for bullet points
        bullet_match = re.match(r"^[•\-\*\u2022\u2023\u25E6\u2043]\s*(.+)$", line)
        if bullet_match:
            current_list_items.append(bullet_match.group(1))
            continue

        # Flush any pending list before other content
        flush_list()

        # Check for section headers
        if _detect_section_header(line):
            html_parts.append(f"<h2>{html.escape(line)}</h2>")
            continue

        # Check if line looks like a name (first line, all caps or title case)
        if not html_parts and (line.isupper() or line.istitle()):
            html_parts.append(f"<h1>{html.escape(line)}</h1>")
            continue

        # Regular paragraph
        html_parts.append(f"<p>{html.escape(line)}</p>")

    # Flush any remaining list items
    flush_list()

    return "\n".join(html_parts)


def convert_pdf_to_html(file_bytes: bytes) -> str:
    """
    Convert a PDF file to TipTap-compatible HTML.

    PDFs don't have native HTML structure, so we:
    1. Extract text with layout awareness using pdfplumber
    2. Detect structure (headers, lists, paragraphs)
    3. Convert to semantic HTML

    Args:
        file_bytes: Raw bytes of the PDF file

    Returns:
        HTML string suitable for TipTap editor

    Raises:
        DocumentConversionError: If conversion fails
    """
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            if not pdf.pages:
                raise DocumentConversionError("PDF contains no pages")

            all_text_parts: list[str] = []

            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    all_text_parts.append(page_text)

            if not all_text_parts:
                raise DocumentConversionError(
                    "Could not extract any text from PDF. "
                    "The file may be image-based or password-protected."
                )

            # Join pages with double newlines
            full_text = "\n\n".join(all_text_parts)

            # Convert to structured HTML
            html_content = _text_to_html_paragraphs(full_text)

            return _clean_html(html_content)

    except DocumentConversionError:
        raise
    except Exception as e:
        logger.error(f"PDF to HTML conversion failed: {e}")
        raise DocumentConversionError(f"Failed to convert PDF to HTML: {e}")


def convert_docx_to_html(file_bytes: bytes) -> str:
    """
    Convert a DOCX file to TipTap-compatible HTML using mammoth.

    Mammoth preserves:
    - Headings (h1-h6)
    - Bold, italic, underline
    - Bullet and numbered lists
    - Tables
    - Links

    Args:
        file_bytes: Raw bytes of the DOCX file

    Returns:
        HTML string suitable for TipTap editor

    Raises:
        DocumentConversionError: If conversion fails
    """
    try:
        result = mammoth.convert_to_html(BytesIO(file_bytes))

        html_content = result.value

        # Log any warnings from mammoth
        if result.messages:
            for msg in result.messages:
                logger.warning(f"DOCX conversion warning: {msg}")

        if not html_content or not html_content.strip():
            raise DocumentConversionError(
                "Could not extract any content from DOCX. "
                "The document appears to be empty."
            )

        return _clean_html(html_content)

    except DocumentConversionError:
        raise
    except Exception as e:
        logger.error(f"DOCX to HTML conversion failed: {e}")
        raise DocumentConversionError(f"Failed to convert DOCX to HTML: {e}")


def convert_to_html(
    file_bytes: bytes,
    content_type: str,
) -> str:
    """
    Convert a document to HTML based on its content type.

    Args:
        file_bytes: Raw bytes of the file
        content_type: MIME type of the file

    Returns:
        HTML string suitable for TipTap editor

    Raises:
        DocumentConversionError: If conversion fails or file type is unsupported
    """
    if content_type == "application/pdf":
        return convert_pdf_to_html(file_bytes)
    elif (
        content_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return convert_docx_to_html(file_bytes)
    else:
        raise DocumentConversionError(
            f"Unsupported file type for HTML conversion: {content_type}. "
            "Only PDF and DOCX files are supported."
        )
