"""
Resume Builds Router - Job-specific tailoring workspace API.

Provides CRUD operations for resume builds and all related operations:
- Create, read, update, delete resume builds
- Generate and manage AI suggestions (diffs)
- Update sections and status
- Export to various formats

Supports dual-lookup for resource IDs during migration:
- UUID format (preferred): 550e8400-e29b-41d4-a716-446655440000
- Integer format (deprecated): 123

Security: Uses RLS-aware database sessions. PostgreSQL Row Level Security
policies ensure users can only access their own resume builds at the database level.
"""

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId, DBSessionWithRLS
from app.api.utils.id_resolution import (
    IDResolutionError,
    add_deprecation_headers,
    is_uuid_format,
    resolve_resume_build_id,
)
from app.core.protocols import ResumeBuildStatus
from app.crud.resume_build import resume_build_repository
from app.schemas.resume_build import (
    BulletSuggestionRequest,
    BulletSuggestionResponse,
    DiffActionRequest,
    DiffActionResponse,
    ExportRequest,
    ResumeBuildCreate,
    ResumeBuildListResponse,
    ResumeBuildResponse,
    ResumeBuildUpdate,
    SuggestRequest,
    SuggestResponse,
    UpdateSectionsRequest,
    UpdateStatusRequest,
)
from app.services.ai import get_usage_tracker

router = APIRouter()


async def _resolve_build(
    db: AsyncSession,
    resume_build_id: str,
    user_id: int,
    response: Response | None = None,
):
    """
    Helper to resolve resume build ID and add deprecation headers.

    Returns the SQLAlchemy model for the resume build.
    """
    if response and not is_uuid_format(resume_build_id):
        add_deprecation_headers(response, "resume_build")

    try:
        resume_build = await resolve_resume_build_id(
            db, resume_build_id, user_id, repository=resume_build_repository
        )
    except IDResolutionError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return resume_build


@router.post("", response_model=ResumeBuildResponse, status_code=status.HTTP_201_CREATED)
async def create_resume_build(
    resume_build_in: ResumeBuildCreate,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> ResumeBuildResponse:
    """
    Create a new resume build for tailoring a resume to a job.

    The resume build starts in 'draft' status and can be transitioned
    to 'in_progress' when the user begins editing.
    """
    resume_build_data = await resume_build_repository.create(
        db,
        user_id=current_user_id,
        job_title=resume_build_in.job_title,
        job_description=resume_build_in.job_description or "",
        job_company=resume_build_in.job_company,
    )
    await db.commit()
    return ResumeBuildResponse.model_validate(resume_build_data)


@router.get("", response_model=ResumeBuildListResponse)
async def list_resume_builds(
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> ResumeBuildListResponse:
    """
    List all resume builds for the current user.

    Supports filtering by status and pagination.
    """
    resume_build_status = None
    if status_filter:
        try:
            resume_build_status = ResumeBuildStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {[s.value for s in ResumeBuildStatus]}",
            )

    resume_builds = await resume_build_repository.list_builds(
        db,
        user_id=current_user_id,
        status=resume_build_status,
        limit=limit,
        offset=offset,
    )

    total = await resume_build_repository.count(
        db,
        user_id=current_user_id,
        status=resume_build_status,
    )

    return ResumeBuildListResponse(
        resume_builds=[ResumeBuildResponse.model_validate(rb) for rb in resume_builds],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{resume_build_id}", response_model=ResumeBuildResponse)
async def get_resume_build(
    resume_build_id: str,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> ResumeBuildResponse:
    """
    Get a single resume build by ID.

    The resume_build_id can be either:
    - UUID format (preferred): 550e8400-e29b-41d4-a716-446655440000
    - Integer format (deprecated): 123
    """
    resume_build = await _resolve_build(db, resume_build_id, current_user_id, response)

    # Get the data representation for response
    resume_build_data = await resume_build_repository.get(
        db, resume_build_id=resume_build.id, user_id=current_user_id
    )
    return ResumeBuildResponse.model_validate(resume_build_data)


@router.patch("/{resume_build_id}", response_model=ResumeBuildResponse)
async def update_resume_build(
    resume_build_id: str,
    resume_build_in: ResumeBuildUpdate,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> ResumeBuildResponse:
    """
    Update resume build basic information (job title, company, description).

    For updating sections or status, use the dedicated endpoints.
    """
    resume_build = await _resolve_build(db, resume_build_id, current_user_id, response)

    if resume_build_in.job_title is not None:
        resume_build.job_title = resume_build_in.job_title
    if resume_build_in.job_company is not None:
        resume_build.job_company = resume_build_in.job_company
    if resume_build_in.job_description is not None:
        resume_build.job_description = resume_build_in.job_description

    await db.commit()
    await db.refresh(resume_build)

    # Convert to data dict manually for response
    resume_build_data = await resume_build_repository.get(
        db, resume_build_id=resume_build.id, user_id=current_user_id
    )
    return ResumeBuildResponse.model_validate(resume_build_data)


@router.delete("/{resume_build_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume_build(
    resume_build_id: str,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> None:
    """Delete a resume build."""
    resume_build = await _resolve_build(db, resume_build_id, current_user_id, response)

    deleted = await resume_build_repository.delete(
        db,
        resume_build_id=resume_build.id,
        user_id=current_user_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )
    await db.commit()


@router.post("/{resume_build_id}/suggest", response_model=SuggestResponse)
async def generate_suggestions(
    resume_build_id: str,
    suggest_in: SuggestRequest,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> SuggestResponse:
    """
    Generate AI suggestions for the resume build.

    The AI analyzes the job description and resume content to suggest
    improvements to optimize for the target role.
    """
    from app.services.job.diff import get_diff_engine

    resume_build_model = await _resolve_build(db, resume_build_id, current_user_id, response)

    # Get data dict for processing
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_model.id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    # Generate suggestions based on resume content
    diff_engine = get_diff_engine()
    usage_tracker = get_usage_tracker()
    result, ai_response = await diff_engine.generate_suggestions(
        workshop=resume_build,
        job_description=resume_build.get("job_description", ""),
        available_blocks=[],  # No vault blocks, use resume content directly
        max_suggestions=suggest_in.max_suggestions,
        focus_sections=suggest_in.focus_sections,
        return_metrics=True,
    )

    # Add suggestions to resume build
    if result["suggestions"]:
        await resume_build_repository.add_pending_diffs(
            db,
            resume_build_id=resume_build_model.id,
            user_id=current_user_id,
            diffs=result["suggestions"],
        )
        await db.commit()

    if ai_response:
        await usage_tracker.log_generation(
            db=db,
            user_id=current_user_id,
            endpoint=f"/resume-builds/{resume_build_id}/suggest",
            response=ai_response,
        )
        await db.commit()

    # Get updated resume build
    updated_resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_model.id, user_id=current_user_id
    )

    return SuggestResponse(
        resume_build=ResumeBuildResponse.model_validate(updated_resume_build),
        new_suggestions_count=len(result["suggestions"]),
        gaps_identified=result.get("gaps", []),
    )


@router.post("/{resume_build_id}/suggest-bullet", response_model=BulletSuggestionResponse)
async def suggest_bullet(
    resume_build_id: str,
    request: BulletSuggestionRequest,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> BulletSuggestionResponse:
    """
    Generate an AI suggestion for a single bullet point.

    This is a lightweight endpoint optimized for real-time inline suggestions
    during keyboard-driven bullet review. Unlike the full suggest endpoint,
    this doesn't store suggestions as pending diffs - it returns immediately
    for the user to accept or dismiss.
    """
    from app.services.job.diff import get_diff_engine

    resume_build_model = await _resolve_build(db, resume_build_id, current_user_id, response)

    # Get data dict for processing
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_model.id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    # Get job description from resume build if not provided
    job_description = request.job_description or resume_build.get("job_description", "")
    if not job_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job description required for suggestions",
        )

    # Generate suggestion
    diff_engine = get_diff_engine()
    usage_tracker = get_usage_tracker()
    result, ai_response = await diff_engine.suggest_single_bullet(
        bullet_text=request.bullet_text,
        entry_context={
            "title": request.entry_context.title,
            "company": request.entry_context.company,
            "date_range": request.entry_context.date_range,
        },
        job_description=job_description,
        return_metrics=True,
    )

    if ai_response:
        await usage_tracker.log_generation(
            db=db,
            user_id=current_user_id,
            endpoint=f"/resume-builds/{resume_build_id}/suggest-bullet",
            response=ai_response,
        )
        await db.commit()

    return BulletSuggestionResponse(
        original=result["original"],
        suggested=result["suggested"],
        reason=result["reason"],
        impact=result["impact"],
    )


@router.post("/{resume_build_id}/diffs/accept", response_model=DiffActionResponse)
async def accept_diff(
    resume_build_id: str,
    action_in: DiffActionRequest,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> DiffActionResponse:
    """
    Accept a pending diff suggestion.

    The diff is applied to the resume build sections and removed from pending.
    """
    resume_build_model = await _resolve_build(db, resume_build_id, current_user_id, response)

    # Get current resume build to capture the diff before it's removed
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_model.id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    pending = resume_build.get("pending_diffs", [])
    if action_in.diff_index >= len(pending):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid diff index. Resume build has {len(pending)} pending diffs.",
        )

    applied_diff = pending[action_in.diff_index]

    updated_resume_build = await resume_build_repository.accept_diff(
        db,
        resume_build_id=resume_build_model.id,
        user_id=current_user_id,
        diff_index=action_in.diff_index,
    )
    await db.commit()

    return DiffActionResponse(
        resume_build=ResumeBuildResponse.model_validate(updated_resume_build),
        action="accept",
        applied_diff=applied_diff,
    )


@router.post("/{resume_build_id}/diffs/reject", response_model=DiffActionResponse)
async def reject_diff(
    resume_build_id: str,
    action_in: DiffActionRequest,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> DiffActionResponse:
    """
    Reject a pending diff suggestion.

    The diff is removed without being applied.
    """
    resume_build_model = await _resolve_build(db, resume_build_id, current_user_id, response)

    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_model.id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    pending = resume_build.get("pending_diffs", [])
    if action_in.diff_index >= len(pending):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid diff index. Resume build has {len(pending)} pending diffs.",
        )

    updated_resume_build = await resume_build_repository.reject_diff(
        db,
        resume_build_id=resume_build_model.id,
        user_id=current_user_id,
        diff_index=action_in.diff_index,
    )
    await db.commit()

    return DiffActionResponse(
        resume_build=ResumeBuildResponse.model_validate(updated_resume_build),
        action="reject",
        applied_diff=None,
    )


@router.post("/{resume_build_id}/diffs/clear", response_model=ResumeBuildResponse)
async def clear_diffs(
    resume_build_id: str,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> ResumeBuildResponse:
    """Clear all pending diff suggestions."""
    resume_build_model = await _resolve_build(db, resume_build_id, current_user_id, response)

    resume_build = await resume_build_repository.clear_pending_diffs(
        db,
        resume_build_id=resume_build_model.id,
        user_id=current_user_id,
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )
    await db.commit()
    return ResumeBuildResponse.model_validate(resume_build)


@router.patch("/{resume_build_id}/sections", response_model=ResumeBuildResponse)
async def update_sections(
    resume_build_id: str,
    sections_in: UpdateSectionsRequest,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> ResumeBuildResponse:
    """
    Update resume build sections.

    Sections are merged with existing content. Pass null for a key
    to remove that section.
    """
    resume_build_model = await _resolve_build(db, resume_build_id, current_user_id, response)

    resume_build = await resume_build_repository.update_sections(
        db,
        resume_build_id=resume_build_model.id,
        user_id=current_user_id,
        sections=sections_in.sections,
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )
    await db.commit()
    return ResumeBuildResponse.model_validate(resume_build)


@router.patch("/{resume_build_id}/status", response_model=ResumeBuildResponse)
async def update_status(
    resume_build_id: str,
    status_in: UpdateStatusRequest,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> ResumeBuildResponse:
    """Update resume build status."""
    resume_build_model = await _resolve_build(db, resume_build_id, current_user_id, response)

    resume_build = await resume_build_repository.update_status(
        db,
        resume_build_id=resume_build_model.id,
        user_id=current_user_id,
        status=status_in.status,
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )
    await db.commit()
    return ResumeBuildResponse.model_validate(resume_build)


@router.post("/{resume_build_id}/export")
async def export_resume_build(
    resume_build_id: str,
    export_in: ExportRequest,
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
):
    """
    Export resume build content to PDF, DOCX, TXT, or JSON.

    Returns the file as a download.
    """
    from fastapi.responses import Response as FileResponse

    from app.services.export.service import get_export_service

    resume_build_model = await _resolve_build(db, resume_build_id, current_user_id, response)

    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_model.id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    export_service = get_export_service()
    sections = resume_build.get("sections", {})

    # Map format to content type and export function
    format_map = {
        "pdf": ("application/pdf", export_service.export_pdf),
        "docx": (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            export_service.export_docx,
        ),
        "txt": ("text/plain", export_service.export_txt),
        "json": ("application/json", export_service.export_json),
    }

    if export_in.format not in format_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format: {export_in.format}",
        )

    content_type, export_func = format_map[export_in.format]
    result = await export_func(sections, template=export_in.template)

    # Update status to exported
    await resume_build_repository.update_status(
        db,
        resume_build_id=resume_build_model.id,
        user_id=current_user_id,
        status=ResumeBuildStatus.EXPORTED,
    )
    await db.commit()

    # Determine filename
    job_title = resume_build.get("job_title", "resume").replace(" ", "_")
    filename = f"{job_title}.{export_in.format}"

    # Handle PDF result with metadata
    if export_in.format == "pdf":
        from app.services.export.service import PDFResult

        if isinstance(result, PDFResult):
            return FileResponse(
                content=result.content,
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Page-Count": str(result.page_count),
                    "X-Overflows": str(result.overflows).lower(),
                },
            )

    # Other formats return bytes or string directly
    content = result if isinstance(result, bytes) else result.encode()
    return FileResponse(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
