from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.crud import resume_crud
from app.schemas import ResumeCreate, ResumeUpdate, ResumeResponse
from app.schemas.export import ResumeExportRequest, ExportTemplatesResponse, ExportTemplateInfo
from app.services.export.html_to_document import get_html_export_service

router = APIRouter()


@router.post("", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def create_resume(
    resume_in: ResumeCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Create a new resume."""
    resume = await resume_crud.create(db, obj_in=resume_in, owner_id=current_user_id)
    return resume


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Get a resume by ID."""
    resume = await resume_crud.get(db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )
    return resume


@router.get("", response_model=list[ResumeResponse])
async def list_resumes(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ResumeResponse]:
    """List all resumes for the current user."""
    resumes = await resume_crud.get_by_owner(
        db, owner_id=current_user_id, skip=skip, limit=limit
    )
    return resumes


@router.put("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: int,
    resume_in: ResumeUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Update a resume."""
    resume = await resume_crud.get(db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this resume",
        )
    updated_resume = await resume_crud.update(db, db_obj=resume, obj_in=resume_in)
    return updated_resume


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> None:
    """Delete a resume."""
    resume = await resume_crud.get(db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this resume",
        )
    await resume_crud.delete(db, id=resume_id)


@router.get("/export/templates", response_model=ExportTemplatesResponse)
async def get_export_templates() -> ExportTemplatesResponse:
    """Get available export style templates."""
    templates = [
        ExportTemplateInfo(
            name="classic",
            description="Traditional professional resume style with serif-inspired formatting, "
            "section dividers, and a timeless appearance.",
        ),
        ExportTemplateInfo(
            name="modern",
            description="Contemporary design with clean lines, accent colors, and modern "
            "typography suitable for tech and creative industries.",
        ),
        ExportTemplateInfo(
            name="minimal",
            description="Ultra-clean design with minimal styling, focusing on content "
            "readability and ATS compatibility.",
        ),
    ]
    return ExportTemplatesResponse(templates=templates)


@router.post("/{resume_id}/export")
async def export_resume(
    resume_id: int,
    export_in: ResumeExportRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> Response:
    """
    Export a resume to PDF or DOCX format.

    Uses the resume's HTML content for rich formatting export.
    Falls back to raw_content if no HTML content is available.

    Style templates:
    - **classic**: Traditional professional style with section dividers
    - **modern**: Contemporary design with accent colors
    - **minimal**: Clean, ATS-friendly formatting
    """
    resume = await resume_crud.get(db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.owner_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )

    # Use HTML content if available, otherwise wrap raw content in basic HTML
    if resume.html_content:
        html_content = resume.html_content
    elif resume.raw_content:
        # Wrap plain text in basic HTML paragraphs
        paragraphs = resume.raw_content.split("\n\n")
        html_parts = []
        for para in paragraphs:
            if para.strip():
                # Escape HTML and convert newlines to <br>
                escaped = para.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                escaped = escaped.replace("\n", "<br>")
                html_parts.append(f"<p>{escaped}</p>")
        html_content = "\n".join(html_parts)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume has no content to export",
        )

    export_service = get_html_export_service()

    # Generate the export
    if export_in.format == "pdf":
        try:
            content = await export_service.export_pdf(
                html_content=html_content,
                template=export_in.template,
                font_family=export_in.font_family,
                font_size=export_in.font_size,
                margin_top=export_in.margin_top,
                margin_bottom=export_in.margin_bottom,
                margin_left=export_in.margin_left,
                margin_right=export_in.margin_right,
            )
        except RuntimeError as e:
            # WeasyPrint not available
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e),
            )
        media_type = "application/pdf"
        extension = "pdf"
    else:  # docx
        content = await export_service.export_docx(
            html_content=html_content,
            template=export_in.template,
            font_family=export_in.font_family,
            font_size=export_in.font_size,
            margin_top=export_in.margin_top,
            margin_bottom=export_in.margin_bottom,
            margin_left=export_in.margin_left,
            margin_right=export_in.margin_right,
        )
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        extension = "docx"

    # Generate filename from resume title
    safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in resume.title)
    safe_title = safe_title.replace(" ", "_")
    filename = f"{safe_title}.{extension}"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
