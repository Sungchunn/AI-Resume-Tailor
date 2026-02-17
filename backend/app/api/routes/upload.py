"""Upload routes for document extraction."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.schemas.upload import DocumentExtractionResponse
from app.services.document_extractor import DocumentExtractionError, extract_text

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
) -> DocumentExtractionResponse:
    """Extract text from an uploaded PDF or DOCX file.

    The extracted text can then be used with the resume creation endpoint.

    Args:
        file: The uploaded PDF or DOCX file
        current_user: The authenticated user

    Returns:
        DocumentExtractionResponse with extracted text and metadata

    Raises:
        HTTPException: If file validation fails or extraction errors occur
    """
    if not file.content_type or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: PDF, DOCX. Received: {file.content_type}",
        )

    file_bytes = await file.read()

    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    try:
        result = extract_text(
            file_bytes=file_bytes,
            filename=file.filename or "unknown",
            content_type=file.content_type,
        )

        return DocumentExtractionResponse(
            raw_content=result.raw_content,
            source_filename=result.source_filename,
            file_type=result.file_type,
            page_count=result.page_count,
            word_count=result.word_count,
            warnings=result.warnings,
        )

    except DocumentExtractionError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
