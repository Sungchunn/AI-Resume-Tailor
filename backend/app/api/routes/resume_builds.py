"""
Resume Builds Router - Job-specific tailoring workspace API.

Provides CRUD operations for resume builds and all related operations:
- Create, read, update, delete resume builds
- Pull/remove blocks from Vault
- Generate and manage AI suggestions (diffs)
- Update sections and status
- Export to various formats
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.core.protocols import ResumeBuildStatus
from app.crud.resume_build import resume_build_repository
from app.crud.block import block_repository
from app.schemas.resume_build import (
    ResumeBuildCreate,
    ResumeBuildUpdate,
    ResumeBuildResponse,
    ResumeBuildListResponse,
    PullBlocksRequest,
    PullBlocksResponse,
    SuggestRequest,
    SuggestResponse,
    DiffActionRequest,
    DiffActionResponse,
    UpdateSectionsRequest,
    UpdateStatusRequest,
    ExportRequest,
    WritebackRequest,
    WritebackProposal,
)
from app.schemas.block import BlockResponse

router = APIRouter()


@router.post("", response_model=ResumeBuildResponse, status_code=status.HTTP_201_CREATED)
async def create_resume_build(
    resume_build_in: ResumeBuildCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
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
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
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

    resume_builds = await resume_build_repository.list(
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
    resume_build_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeBuildResponse:
    """Get a single resume build by ID."""
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )
    return ResumeBuildResponse.model_validate(resume_build)


@router.patch("/{resume_build_id}", response_model=ResumeBuildResponse)
async def update_resume_build(
    resume_build_id: int,
    resume_build_in: ResumeBuildUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeBuildResponse:
    """
    Update resume build basic information (job title, company, description).

    For updating sections or status, use the dedicated endpoints.
    """
    resume_build = await resume_build_repository.get_model(
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

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
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )
    return ResumeBuildResponse.model_validate(resume_build_data)


@router.delete("/{resume_build_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume_build(
    resume_build_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> None:
    """Delete a resume build."""
    deleted = await resume_build_repository.delete(
        db,
        resume_build_id=resume_build_id,
        user_id=current_user_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )
    await db.commit()


@router.post("/{resume_build_id}/pull", response_model=PullBlocksResponse)
async def pull_blocks(
    resume_build_id: int,
    pull_in: PullBlocksRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> PullBlocksResponse:
    """
    Pull blocks from Vault into resume build.

    Blocks are copied by reference (ID) and can be used for building
    the tailored resume.
    """
    # Get current resume build to check existing blocks
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    existing_ids = set(resume_build.get("pulled_block_ids", []))
    already_pulled = [bid for bid in pull_in.block_ids if bid in existing_ids]
    newly_pulled = [bid for bid in pull_in.block_ids if bid not in existing_ids]

    # Pull the blocks
    updated_resume_build = await resume_build_repository.pull_blocks(
        db,
        resume_build_id=resume_build_id,
        user_id=current_user_id,
        block_ids=pull_in.block_ids,
    )
    await db.commit()

    return PullBlocksResponse(
        resume_build=ResumeBuildResponse.model_validate(updated_resume_build),
        newly_pulled=newly_pulled,
        already_pulled=already_pulled,
    )


@router.delete("/{resume_build_id}/blocks/{block_id}", response_model=ResumeBuildResponse)
async def remove_block(
    resume_build_id: int,
    block_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeBuildResponse:
    """Remove a block from resume build's pulled blocks."""
    resume_build = await resume_build_repository.remove_block(
        db,
        resume_build_id=resume_build_id,
        user_id=current_user_id,
        block_id=block_id,
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )
    await db.commit()
    return ResumeBuildResponse.model_validate(resume_build)


@router.post("/{resume_build_id}/suggest", response_model=SuggestResponse)
async def generate_suggestions(
    resume_build_id: int,
    suggest_in: SuggestRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> SuggestResponse:
    """
    Generate AI suggestions for the resume build.

    The AI analyzes the job description and pulled blocks to suggest
    improvements to the resume content. Suggestions are Vault-constrained
    and will only use facts from the user's experience blocks.
    """
    from app.services.job.diff_engine import get_diff_engine

    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    # Get pulled blocks
    pulled_block_ids = resume_build.get("pulled_block_ids", [])
    if not pulled_block_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No blocks pulled into resume build. Pull blocks first.",
        )

    # Get the actual blocks
    blocks = await block_repository.get_by_ids(
        db, block_ids=pulled_block_ids, user_id=current_user_id
    )

    # Generate suggestions
    diff_engine = get_diff_engine()
    result = await diff_engine.generate_suggestions(
        workshop=resume_build,
        job_description=resume_build.get("job_description", ""),
        available_blocks=blocks,
        max_suggestions=suggest_in.max_suggestions,
        focus_sections=suggest_in.focus_sections,
    )

    # Add suggestions to resume build
    if result["suggestions"]:
        await resume_build_repository.add_pending_diffs(
            db,
            resume_build_id=resume_build_id,
            user_id=current_user_id,
            diffs=result["suggestions"],
        )
        await db.commit()

    # Get updated resume build
    updated_resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )

    return SuggestResponse(
        resume_build=ResumeBuildResponse.model_validate(updated_resume_build),
        new_suggestions_count=len(result["suggestions"]),
        gaps_identified=result.get("gaps", []),
    )


@router.post("/{resume_build_id}/diffs/accept", response_model=DiffActionResponse)
async def accept_diff(
    resume_build_id: int,
    action_in: DiffActionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> DiffActionResponse:
    """
    Accept a pending diff suggestion.

    The diff is applied to the resume build sections and removed from pending.
    """
    # Get current resume build to capture the diff before it's removed
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
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
        resume_build_id=resume_build_id,
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
    resume_build_id: int,
    action_in: DiffActionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> DiffActionResponse:
    """
    Reject a pending diff suggestion.

    The diff is removed without being applied.
    """
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
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
        resume_build_id=resume_build_id,
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
    resume_build_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeBuildResponse:
    """Clear all pending diff suggestions."""
    resume_build = await resume_build_repository.clear_pending_diffs(
        db,
        resume_build_id=resume_build_id,
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
    resume_build_id: int,
    sections_in: UpdateSectionsRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeBuildResponse:
    """
    Update resume build sections.

    Sections are merged with existing content. Pass null for a key
    to remove that section.
    """
    resume_build = await resume_build_repository.update_sections(
        db,
        resume_build_id=resume_build_id,
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
    resume_build_id: int,
    status_in: UpdateStatusRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> ResumeBuildResponse:
    """Update resume build status."""
    resume_build = await resume_build_repository.update_status(
        db,
        resume_build_id=resume_build_id,
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


@router.post("/{resume_build_id}/writeback/preview", response_model=WritebackProposal)
async def preview_writeback(
    resume_build_id: int,
    writeback_in: WritebackRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WritebackProposal:
    """
    Preview a write-back to the Vault.

    Shows what would happen (create/update) without executing.
    """
    from app.services.resume.writeback import get_writeback_service

    # Verify resume build exists
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    writeback_service = get_writeback_service()

    proposal = await writeback_service.propose_writeback(
        db=db,
        workshop_id=resume_build_id,
        user_id=current_user_id,
        edited_content=writeback_in.edited_content,
        source_block_id=writeback_in.source_block_id,
    )

    return WritebackProposal(
        action=proposal["action"],
        preview=proposal["preview"],
        original=proposal["original"],
        changes=proposal["changes"],
    )


@router.post("/{resume_build_id}/writeback", response_model=BlockResponse)
async def execute_writeback(
    resume_build_id: int,
    writeback_in: WritebackRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockResponse:
    """
    Execute a write-back to the Vault.

    Creates or updates a block based on resume build edits.
    """
    from app.services.resume.writeback import get_writeback_service

    # Verify resume build exists
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    writeback_service = get_writeback_service()

    block = await writeback_service.execute_writeback(
        db=db,
        workshop_id=resume_build_id,
        user_id=current_user_id,
        edited_content=writeback_in.edited_content,
        source_block_id=writeback_in.source_block_id,
        create_new=writeback_in.create_new,
    )

    return BlockResponse.model_validate(block)


@router.get("/{resume_build_id}/blocks", response_model=list[BlockResponse])
async def get_pulled_blocks(
    resume_build_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> list[BlockResponse]:
    """Get all blocks pulled into this resume build."""
    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
    )
    if not resume_build:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume build not found",
        )

    block_ids = resume_build.get("pulled_block_ids", [])
    if not block_ids:
        return []

    blocks = await block_repository.get_by_ids(
        db, block_ids=block_ids, user_id=current_user_id
    )

    return [BlockResponse.model_validate(b) for b in blocks]


@router.post("/{resume_build_id}/export")
async def export_resume_build(
    resume_build_id: int,
    export_in: ExportRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
):
    """
    Export resume build content to PDF, DOCX, TXT, or JSON.

    Returns the file as a download.
    """
    from fastapi.responses import Response
    from app.services.export.service import get_export_service

    resume_build = await resume_build_repository.get(
        db, resume_build_id=resume_build_id, user_id=current_user_id
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
    content = await export_func(sections, template=export_in.template)

    # Update status to exported
    await resume_build_repository.update_status(
        db,
        resume_build_id=resume_build_id,
        user_id=current_user_id,
        status=ResumeBuildStatus.EXPORTED,
    )
    await db.commit()

    # Determine filename
    job_title = resume_build.get("job_title", "resume").replace(" ", "_")
    filename = f"{job_title}.{export_in.format}"

    return Response(
        content=content if isinstance(content, bytes) else content.encode(),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
