"""Schemas for document upload and extraction."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel


class UploadErrorCode(str, Enum):
    """Error codes for upload operations."""

    FILE_TOO_LARGE = "file_too_large"
    INVALID_FILE_TYPE = "invalid_file_type"
    EXTRACTION_FAILED = "extraction_failed"
    STORAGE_FAILED = "storage_failed"
    EMPTY_FILE = "empty_file"


class UploadErrorDetail(BaseModel):
    """Structured error detail for upload operations."""

    error_code: UploadErrorCode
    message: str
    recoverable: bool


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
