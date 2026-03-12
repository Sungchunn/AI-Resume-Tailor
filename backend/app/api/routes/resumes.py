"""Resume API endpoints using MongoDB."""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_mongo_db, get_current_user_id
from app.crud.mongo import resume_crud
from app.db.mongodb import get_mongodb
from app.models.mongo.resume import (
    ResumeCreate as MongoResumeCreate,
    ResumeUpdate as MongoResumeUpdate,
    OriginalFile,
    ParsedContent,
    StyleSettings,
)
from app.schemas import ResumeCreate, ResumeUpdate
from app.schemas.resume import ResumeResponse, OriginalFileInfo
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


def _to_response(doc) -> ResumeResponse:
    """Convert MongoDB document to response model."""
    return ResumeResponse(
        id=str(doc.id) if doc.id else "",
        user_id=doc.user_id,
        title=doc.title,
        raw_content=doc.raw_content,
        html_content=doc.html_content,
        parsed=doc.parsed.model_dump() if doc.parsed else None,
        style=doc.style.model_dump() if doc.style else None,
        original_file=OriginalFileInfo(
            storage_key=doc.original_file.storage_key,
            filename=doc.original_file.filename,
            file_type=doc.original_file.file_type,
            size_bytes=doc.original_file.size_bytes,
        ) if doc.original_file else None,
        is_master=getattr(doc, "is_master", False),
        parsed_verified=getattr(doc, "parsed_verified", False),
        parsed_verified_at=getattr(doc, "parsed_verified_at", None),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.post("", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def create_resume(
    resume_in: ResumeCreate,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Create a new resume."""
    create_data = MongoResumeCreate(
        user_id=current_user_id,
        title=resume_in.title,
        raw_content=resume_in.raw_content,
        html_content=resume_in.html_content,
        original_file=OriginalFile(
            storage_key=resume_in.original_file_key,
            filename=resume_in.original_filename,
            file_type=resume_in.file_type,
            size_bytes=resume_in.file_size_bytes,
        ) if resume_in.original_file_key else None,
    )
    resume = await resume_crud.create(mongo_db, obj_in=create_data)
    return _to_response(resume)


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: str,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Get a resume by ID."""
    resume = await resume_crud.get(mongo_db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )
    return _to_response(resume)


@router.get("", response_model=list[ResumeResponse])
async def list_resumes(
    skip: int = 0,
    limit: int = 100,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ResumeResponse]:
    """List all resumes for the current user."""
    resumes = await resume_crud.get_by_user(
        mongo_db, user_id=current_user_id, skip=skip, limit=limit
    )
    return [_to_response(r) for r in resumes]


@router.put("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: str,
    resume_in: ResumeUpdate,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Update a resume."""
    # Verify ownership
    if not await resume_crud.exists(mongo_db, id=resume_id, user_id=current_user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or not authorized",
        )

    # Build update object
    update_data = MongoResumeUpdate(
        title=resume_in.title,
        raw_content=resume_in.raw_content,
        html_content=resume_in.html_content,
        parsed=ParsedContent(**resume_in.parsed_content) if resume_in.parsed_content else None,
        style=StyleSettings(**resume_in.style) if resume_in.style else None,
    )
    updated_resume = await resume_crud.update(mongo_db, id=resume_id, obj_in=update_data)
    if not updated_resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    return _to_response(updated_resume)


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: str,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> None:
    """Delete a resume."""
    # Verify ownership
    if not await resume_crud.exists(mongo_db, id=resume_id, user_id=current_user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or not authorized",
        )
    await resume_crud.delete(mongo_db, id=resume_id)


@router.patch("/{resume_id}/set-master", response_model=ResumeResponse)
async def set_master_resume(
    resume_id: str,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """
    Set a resume as the master resume for the current user.

    The master resume is the default resume used in tailoring flows.
    Only one resume can be the master at a time - setting a new master
    will automatically unset the previous one.

    Prerequisites:
    - Resume must be verified (parsed_verified = true)
    """
    # First verify ownership and check verification status
    existing = await resume_crud.get(mongo_db, id=resume_id)
    if not existing or existing.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or not authorized",
        )

    # Check if resume is verified
    if not getattr(existing, "parsed_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume must be verified before setting as master. "
                   "Please review and verify your parsed resume first.",
        )

    # set_master handles the atomic update
    resume = await resume_crud.set_master(mongo_db, id=resume_id, user_id=current_user_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set master resume",
        )
    return _to_response(resume)


@router.patch("/{resume_id}/verify-parsed", response_model=ResumeResponse)
async def verify_parsed_resume(
    resume_id: str,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeResponse:
    """Mark a resume's parsed content as verified by the user.

    Prerequisites:
    - Resume must exist and belong to the current user
    - Resume must have parsed content (parsed != None)

    Once verified, the resume can be used in tailoring flows.
    Tailoring will be blocked for unverified resumes.
    """
    # Fetch resume
    resume = await resume_crud.get(mongo_db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    # Verify ownership
    if resume.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )

    # Ensure resume is parsed
    if not resume.parsed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume must be parsed before it can be verified",
        )

    # Already verified - return current state
    if resume.parsed_verified:
        return _to_response(resume)

    # Update verification status
    update_data = MongoResumeUpdate(parsed_verified=True)

    # Note: The CRUD layer automatically sets parsed_verified_at when parsed_verified is True
    updated = await resume_crud.update(mongo_db, id=resume_id, obj_in=update_data)

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify resume",
        )

    return _to_response(updated)


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
    resume_id: str,
    export_in: ResumeExportRequest,
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
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
    resume = await resume_crud.get(mongo_db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.user_id != current_user_id:
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
    resume_id: str,
    raw_content: str,
    force: bool,
) -> None:
    """Background task that performs the actual parsing."""
    task_service = get_parse_task_service()

    try:
        # Stage 1: Extracting (validation)
        await task_service.update_stage(task_id, "extracting", 0)

        # Get services
        ai_client = get_ai_client()
        cache_service = get_cache_service()
        parser = ResumeParser(ai_client=ai_client, cache=cache_service)

        # Invalidate cache if force=True
        if force:
            await cache_service.invalidate_resume(raw_content)

        await task_service.update_stage(task_id, "extracting", 100)

        # Stage 2: AI Parsing
        await task_service.update_stage(task_id, "parsing", 0)

        try:
            parsed_content = await parser.parse(raw_content)
            await task_service.update_stage(task_id, "parsing", 100)
        except Exception as parse_error:
            # AI parsing failed - save without parsed content but continue
            logger.warning(f"AI parsing failed for resume {resume_id}: {parse_error}")
            parsed_content = None
            warning_message = "AI parsing failed. Resume saved without structure analysis."

            # Stage 3: Storing (partial)
            await task_service.update_stage(task_id, "storing", 0)
            mongo_db = get_mongodb()
            # Don't update parsed content since it failed
            await task_service.update_stage(task_id, "storing", 100)

            # Complete with warning
            await task_service.complete_task(task_id, resume_id, warning=warning_message)
            return

        # Stage 3: Storing
        await task_service.update_stage(task_id, "storing", 0)

        # Update database (MongoDB)
        mongo_db = get_mongodb()
        update_data = MongoResumeUpdate(
            parsed=ParsedContent(**parsed_content) if parsed_content else None,
        )
        await resume_crud.update(mongo_db, id=resume_id, obj_in=update_data)

        await task_service.update_stage(task_id, "storing", 100)

        # Mark task completed
        await task_service.complete_task(task_id, resume_id)

    except Exception as e:
        logger.error(f"Parse task {task_id} failed: {e}")
        await task_service.fail_task(task_id, str(e))


@router.post("/{resume_id}/parse", response_model=ParseTaskResponse)
async def parse_resume(
    resume_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    force: bool = Query(False, description="Force re-parse, bypassing cache"),
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
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
    resume = await resume_crud.get(mongo_db, id=resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    if resume.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resume",
        )
    if not resume.raw_content or not resume.raw_content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume has no content to parse",
        )

    # Log AI operation (still uses PostgreSQL for audit logs)
    from app.api.deps import get_db_session
    from sqlalchemy.ext.asyncio import AsyncSession

    # Get a fresh Postgres session for audit logging
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as pg_db:
        await audit_service.log_ai_operation(
            db=pg_db,
            user_id=current_user_id,
            operation="resume_parse",
            resource_type="resume",
            resource_id=resume_id,  # Now a string (MongoDB ObjectId)
            request=request,
            details={"force": force},
        )
        await pg_db.commit()

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
    resume_id: str,
    task_id: str = Query(..., description="Task ID returned from POST /parse"),
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
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
    if not await resume_crud.exists(mongo_db, id=resume_id, user_id=current_user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or not authorized",
        )

    task_service = get_parse_task_service()
    task_status = await task_service.get_task_status(task_id)

    if not task_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or expired",
        )

    return task_status
