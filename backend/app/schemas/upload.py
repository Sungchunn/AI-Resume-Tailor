"""Schemas for document upload and extraction."""

from typing import Literal

from pydantic import BaseModel


class DocumentExtractionResponse(BaseModel):
    """Response from document text extraction."""

    raw_content: str
    source_filename: str
    file_type: Literal["pdf", "docx"]
    page_count: int | None
    word_count: int
    warnings: list[str] = []
