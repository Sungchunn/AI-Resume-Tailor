import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.crud import resume_crud
from app.db.session import AsyncSessionLocal
from app.schemas import ResumeCreate, ResumeUpdate, ResumeResponse
from app.schemas.export import ResumeExportRequest, ExportTemplatesResponse, ExportTemplateInfo
from app.schemas.resume import ParseTaskResponse, ParseStatusResponse
from app.services.core.audit import audit_service
from app.services.core.cache import get_cache_service
from app.services.ai.client import get_ai_client
from app.services.export.html_to_document import get_html_export_service
from app.services.resume.parser import ResumeParser
from app.services.resume.parse_task import get_parse_task_service


logger = logging.getLogger(__name__)

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
    title_str = str(resume.title)
    safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in title_str)
    safe_title = safe_title.replace(" ", "_")
    filename = f"{safe_title}.{extension}"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def run_parse_task(
    task_id: str,
    resume_id: int,
    raw_content: str,
    force: bool,
) -> None:
    """Background task that performs the actual parsing."""
    task_service = get_parse_task_service()

    try:
        # Get services
        ai_client = get_ai_client()
        cache_service = get_cache_service()
        parser = ResumeParser(ai_client=ai_client, cache=cache_service)

        # Invalidate cache if force=True
        if force:
            await cache_service.invalidate_resume(raw_content)

        # Parse the resume
        parsed_content = await parser.parse(raw_content)

        # Update database
        async with AsyncSessionLocal() as db:
            resume = await resume_crud.get(db, id=resume_id)
            if resume:
                update_data = ResumeUpdate.model_validate({"parsed_content": parsed_content})
                await resume_crud.update(
                    db,
                    db_obj=resume,
                    obj_in=update_data,
                )
                await db.commit()

        # Mark task completed
        await task_service.complete_task(task_id, resume_id)

    except Exception as e:
        logger.error(f"Parse task {task_id} failed: {e}")
        await task_service.fail_task(task_id, str(e))


@router.post("/{resume_id}/parse", response_model=ParseTaskResponse)
async def parse_resume(
    resume_id: int,
    background_tasks: BackgroundTasks,
    request: Request,
    force: bool = Query(False, description="Force re-parse, bypassing cache"),
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ParseTaskResponse:
    """
    Trigger async resume parsing.

    Returns a task_id that can be polled for completion status.
    The background task parses the raw_content using AI and stores
    the result in parsed_content.

    - **force**: If True, bypasses the cache and re-parses the content.
    """
    # Validate resume exists and has raw_content
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
    if not resume.raw_content or not resume.raw_content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume has no content to parse",
        )

    # Log AI operation
    await audit_service.log_ai_operation(
        db=db,
        user_id=current_user_id,
        operation="resume_parse",
        resource_type="resume",
        resource_id=resume_id,
        request=request,
        details={"force": force},
    )

    # Create task and spawn background worker
    task_service = get_parse_task_service()
    task_id = await task_service.create_task(resume_id)

    background_tasks.add_task(
        run_parse_task,
        task_id=task_id,
        resume_id=resume_id,
        raw_content=resume.raw_content,
        force=force,
    )

    return ParseTaskResponse(task_id=task_id, status="pending", resume_id=resume_id)


@router.get("/{resume_id}/parse/status", response_model=ParseStatusResponse)
async def get_parse_status(
    resume_id: int,
    task_id: str = Query(..., description="Task ID returned from POST /parse"),
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ParseStatusResponse:
    """
    Poll for parse task completion.

    Returns the current status of the parse task:
    - **pending**: Task is still running
    - **completed**: Parsing finished successfully
    - **failed**: Parsing failed (check error field)
    """
    # Verify ownership
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

    task_service = get_parse_task_service()
    task_status = await task_service.get_task_status(task_id)

    if not task_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or expired",
        )

    return task_status
