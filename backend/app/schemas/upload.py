"""Schemas for document upload and extraction."""

from typing import Literal

from pydantic import BaseModel


class DocumentExtractionResponse(BaseModel):
    """Response from document text extraction and HTML conversion."""

    raw_content: str
    html_content: str
    source_filename: str
    file_type: Literal["pdf", "docx"]
    page_count: int | None
    word_count: int
    file_key: str | None = None
    file_size_bytes: int | None = None
    warnings: list[str] = []
