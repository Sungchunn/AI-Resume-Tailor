import json
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.crud import resume_crud
from app.crud.tailor import tailored_resume_crud
from app.services.export.service import get_export_service

router = APIRouter()


class ExportFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"


@router.get("/{tailored_id}")
async def export_tailored_resume(
    tailored_id: int,
    format: ExportFormat = ExportFormat.PDF,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> Response:
    """Export a tailored resume in the specified format."""
    # Get the tailored resume
    tailored = await tailored_resume_crud.get(db, id=tailored_id)
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found",
        )

    # Verify ownership through original resume
    resume = await resume_crud.get(db, id=tailored.resume_id)
    if not resume or resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this tailored resume",
        )

    # Parse the stored content
    tailored_content = json.loads(tailored.tailored_content)

    # Generate the export
    export_service = get_export_service()
    filename = f"tailored_resume_{tailored_id}"

    if format == ExportFormat.PDF:
        content = export_service.generate_pdf(tailored_content)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )
    elif format == ExportFormat.DOCX:
        content = export_service.generate_docx(tailored_content)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}.docx"'},
        )
    else:  # TXT
        content = export_service.generate_plain_text(tailored_content)
        return Response(
            content=content,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{filename}.txt"'},
        )
