"""Upload routes for document extraction and HTML conversion."""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.schemas.upload import DocumentExtractionResponse
from app.services.document.converter import DocumentConversionError, convert_to_html
from app.services.export.document_extractor import DocumentExtractionError, extract_text
from app.services.storage.file_storage import (
    FileStorageError,
    get_storage_service,
)

logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()


ALLOWED_CONTENT_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

MAX_UPLOAD_SIZE_BYTES = settings.max_upload_size_mb * 1024 * 1024


@router.post("/extract", response_model=DocumentExtractionResponse)
async def extract_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    store_file: bool = True,
) -> DocumentExtractionResponse:
    """Extract text and convert to HTML from an uploaded PDF or DOCX file.

    This endpoint:
    1. Extracts plain text from the document (for backwards compatibility)
    2. Converts the document to TipTap-compatible HTML for rich editing
    3. Optionally stores the original file in object storage (MinIO/S3)

    The extracted content can then be used with the resume creation endpoint.

    Args:
        file: The uploaded PDF or DOCX file
        current_user: The authenticated user
        store_file: Whether to store the original file (default: True)

    Returns:
        DocumentExtractionResponse with extracted text, HTML, and metadata

    Raises:
        HTTPException: If file validation fails or extraction errors occur
    """
    if not file.content_type or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: PDF, DOCX. Received: {file.content_type}",
        )

    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB",
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    warnings: list[str] = []
    filename = file.filename or "unknown"

    # Step 1: Extract plain text
    try:
        extraction_result = extract_text(
            file_bytes=file_bytes,
            filename=filename,
            content_type=file.content_type,
        )
        warnings.extend(extraction_result.warnings)
    except DocumentExtractionError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    # Step 2: Convert to HTML
    try:
        html_content = convert_to_html(
            file_bytes=file_bytes,
            content_type=file.content_type,
        )
    except DocumentConversionError as e:
        logger.warning(f"HTML conversion failed, using fallback: {e}")
        # Fallback: wrap plain text in basic HTML
        import html as html_escape

        html_content = f"<p>{html_escape.escape(extraction_result.raw_content)}</p>"
        warnings.append(f"HTML conversion used fallback: {str(e)}")

    # Step 3: Store original file in MinIO (optional)
    file_key: str | None = None
    if store_file:
        try:
            storage = get_storage_service()
            file_key = storage.generate_file_key(
                user_id=current_user.id,
                original_filename=filename,
                file_type=extraction_result.file_type,
            )
            await storage.upload(
                file_key=file_key,
                file_data=file_bytes,
                content_type=file.content_type,
            )
        except FileStorageError as e:
            logger.error(f"Failed to store file in MinIO: {e}")
            warnings.append(f"File storage failed: {str(e)}")
            file_key = None

    return DocumentExtractionResponse(
        raw_content=extraction_result.raw_content,
        html_content=html_content,
        source_filename=extraction_result.source_filename,
        file_type=extraction_result.file_type,
        page_count=extraction_result.page_count,
        word_count=extraction_result.word_count,
        file_key=file_key,
        file_size_bytes=file_size if file_key else None,
        warnings=warnings,
    )
