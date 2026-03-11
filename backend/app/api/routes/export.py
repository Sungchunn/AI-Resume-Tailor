import json
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.crud import resume_crud
from app.crud.tailor import tailored_resume_crud
from app.schemas.export import FitToPageRequest, FitToPageResponse, PageSize, StyleReduction
from app.services.export.service import get_export_service
from app.services.export.fit_to_page import get_fit_to_page_service
from app.services.export.html_to_document import ExportOptions, get_html_export_service

router = APIRouter()


class ExportFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"


@router.get("/{tailored_id}")
async def export_tailored_resume(
    tailored_id: int,
    format: ExportFormat = ExportFormat.PDF,
    # Style parameters
    font_size: int = Query(11, ge=8, le=16, description="Base font size in points"),
    margin_top: float = Query(0.75, ge=0.5, le=2.0, description="Top margin in inches"),
    margin_bottom: float = Query(0.75, ge=0.5, le=2.0, description="Bottom margin in inches"),
    margin_left: float = Query(0.75, ge=0.5, le=2.0, description="Left margin in inches"),
    margin_right: float = Query(0.75, ge=0.5, le=2.0, description="Right margin in inches"),
    line_spacing: float = Query(1.4, ge=1.1, le=2.0, description="Line height multiplier"),
    page_size: PageSize = Query(PageSize.LETTER, description="Page size"),
    template: str = Query("classic", description="Style template"),
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

    # Build export options from query parameters
    options = ExportOptions(
        font_size=font_size,
        margin_top=margin_top,
        margin_bottom=margin_bottom,
        margin_left=margin_left,
        margin_right=margin_right,
        line_spacing=line_spacing,
        page_size=page_size.value,
    )

    if format == ExportFormat.PDF:
        result = export_service.generate_pdf(tailored_content, options=options)
        return Response(
            content=result.content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}.pdf"',
                "X-Page-Count": str(result.page_count),
                "X-Overflows": str(result.overflows).lower(),
            },
        )
    elif format == ExportFormat.DOCX:
        content = export_service.generate_docx(tailored_content, options=options)
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


@router.post("/fit-to-page", response_model=FitToPageResponse)
async def fit_to_page(
    request: FitToPageRequest,
    current_user_id: int = Depends(get_current_user_id),
) -> FitToPageResponse:
    """
    Calculate style adjustments to fit content to one page.

    Iteratively compresses styles (margins, spacing, font size) until
    the content fits on a single page. Returns adjusted styles and
    the resulting page count.
    """
    service = get_fit_to_page_service()

    initial_style = {
        "font_size": request.font_size,
        "margin_top": request.margin_top,
        "margin_bottom": request.margin_bottom,
        "margin_left": request.margin_left,
        "margin_right": request.margin_right,
        "line_spacing": request.line_spacing,
        "section_spacing": request.section_spacing,
        "entry_spacing": request.entry_spacing,
    }

    result = service.fit(
        html_content=request.html_content,
        initial_style=initial_style,
        page_size=request.page_size.value,
        max_iterations=request.max_iterations,
    )

    return FitToPageResponse(
        page_count=result.page_count,
        adjusted_style=result.adjusted_style,
        reductions_applied=[
            StyleReduction(
                property=r["property"],
                from_value=r["from_value"],
                to_value=r["to_value"],
                label=r["label"],
            )
            for r in result.reductions
        ],
        warning=result.warning,
    )
