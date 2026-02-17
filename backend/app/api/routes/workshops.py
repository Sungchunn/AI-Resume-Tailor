"""
Workshops Router - Job-specific tailoring workspace API.

Provides CRUD operations for workshops and all related operations:
- Create, read, update, delete workshops
- Pull/remove blocks from Vault
- Generate and manage AI suggestions (diffs)
- Update sections and status
- Export to various formats
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.core.protocols import WorkshopStatus
from app.crud.workshop import workshop_repository
from app.crud.block import block_repository
from app.schemas.workshop import (
    WorkshopCreate,
    WorkshopUpdate,
    WorkshopResponse,
    WorkshopListResponse,
    PullBlocksRequest,
    PullBlocksResponse,
    SuggestRequest,
    SuggestResponse,
    DiffActionRequest,
    DiffActionResponse,
    UpdateSectionsRequest,
    UpdateStatusRequest,
    ExportRequest,
)

router = APIRouter()


@router.post("", response_model=WorkshopResponse, status_code=status.HTTP_201_CREATED)
async def create_workshop(
    workshop_in: WorkshopCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WorkshopResponse:
    """
    Create a new workshop for tailoring a resume to a job.

    The workshop starts in 'draft' status and can be transitioned
    to 'in_progress' when the user begins editing.
    """
    workshop_data = await workshop_repository.create(
        db,
        user_id=current_user_id,
        job_title=workshop_in.job_title,
        job_description=workshop_in.job_description or "",
        job_company=workshop_in.job_company,
    )
    await db.commit()
    return WorkshopResponse.model_validate(workshop_data)


@router.get("", response_model=WorkshopListResponse)
async def list_workshops(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WorkshopListResponse:
    """
    List all workshops for the current user.

    Supports filtering by status and pagination.
    """
    workshop_status = None
    if status_filter:
        try:
            workshop_status = WorkshopStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {[s.value for s in WorkshopStatus]}",
            )

    workshops = await workshop_repository.list(
        db,
        user_id=current_user_id,
        status=workshop_status,
        limit=limit,
        offset=offset,
    )

    total = await workshop_repository.count(
        db,
        user_id=current_user_id,
        status=workshop_status,
    )

    return WorkshopListResponse(
        workshops=[WorkshopResponse.model_validate(w) for w in workshops],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{workshop_id}", response_model=WorkshopResponse)
async def get_workshop(
    workshop_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WorkshopResponse:
    """Get a single workshop by ID."""
    workshop = await workshop_repository.get(
        db, workshop_id=workshop_id, user_id=current_user_id
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )
    return WorkshopResponse.model_validate(workshop)


@router.patch("/{workshop_id}", response_model=WorkshopResponse)
async def update_workshop(
    workshop_id: int,
    workshop_in: WorkshopUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WorkshopResponse:
    """
    Update workshop basic information (job title, company, description).

    For updating sections or status, use the dedicated endpoints.
    """
    workshop = await workshop_repository.get_model(
        db, workshop_id=workshop_id, user_id=current_user_id
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )

    if workshop_in.job_title is not None:
        workshop.job_title = workshop_in.job_title
    if workshop_in.job_company is not None:
        workshop.job_company = workshop_in.job_company
    if workshop_in.job_description is not None:
        workshop.job_description = workshop_in.job_description

    await db.commit()
    await db.refresh(workshop)

    # Convert to data dict manually for response
    workshop_data = await workshop_repository.get(
        db, workshop_id=workshop_id, user_id=current_user_id
    )
    return WorkshopResponse.model_validate(workshop_data)


@router.delete("/{workshop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workshop(
    workshop_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> None:
    """Delete a workshop."""
    deleted = await workshop_repository.delete(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )
    await db.commit()


@router.post("/{workshop_id}/pull", response_model=PullBlocksResponse)
async def pull_blocks(
    workshop_id: int,
    pull_in: PullBlocksRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> PullBlocksResponse:
    """
    Pull blocks from Vault into workshop.

    Blocks are copied by reference (ID) and can be used for building
    the tailored resume.
    """
    # Get current workshop to check existing blocks
    workshop = await workshop_repository.get(
        db, workshop_id=workshop_id, user_id=current_user_id
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )

    existing_ids = set(workshop.get("pulled_block_ids", []))
    already_pulled = [bid for bid in pull_in.block_ids if bid in existing_ids]
    newly_pulled = [bid for bid in pull_in.block_ids if bid not in existing_ids]

    # Pull the blocks
    updated_workshop = await workshop_repository.pull_blocks(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
        block_ids=pull_in.block_ids,
    )
    await db.commit()

    return PullBlocksResponse(
        workshop=WorkshopResponse.model_validate(updated_workshop),
        newly_pulled=newly_pulled,
        already_pulled=already_pulled,
    )


@router.delete("/{workshop_id}/blocks/{block_id}", response_model=WorkshopResponse)
async def remove_block(
    workshop_id: int,
    block_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WorkshopResponse:
    """Remove a block from workshop's pulled blocks."""
    workshop = await workshop_repository.remove_block(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
        block_id=block_id,
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )
    await db.commit()
    return WorkshopResponse.model_validate(workshop)


@router.post("/{workshop_id}/suggest", response_model=SuggestResponse)
async def generate_suggestions(
    workshop_id: int,
    suggest_in: SuggestRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> SuggestResponse:
    """
    Generate AI suggestions for the workshop.

    The AI analyzes the job description and pulled blocks to suggest
    improvements to the resume content. Suggestions are Vault-constrained
    and will only use facts from the user's experience blocks.
    """
    from app.services.diff_engine import get_diff_engine

    workshop = await workshop_repository.get(
        db, workshop_id=workshop_id, user_id=current_user_id
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )

    # Get pulled blocks
    pulled_block_ids = workshop.get("pulled_block_ids", [])
    if not pulled_block_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No blocks pulled into workshop. Pull blocks first.",
        )

    # Get the actual blocks
    blocks = await block_repository.get_by_ids(
        db, block_ids=pulled_block_ids, user_id=current_user_id
    )

    # Generate suggestions
    diff_engine = get_diff_engine()
    result = await diff_engine.generate_suggestions(
        workshop=workshop,
        job_description=workshop.get("job_description", ""),
        available_blocks=blocks,
        max_suggestions=suggest_in.max_suggestions,
        focus_sections=suggest_in.focus_sections,
    )

    # Add suggestions to workshop
    if result["suggestions"]:
        await workshop_repository.add_pending_diffs(
            db,
            workshop_id=workshop_id,
            user_id=current_user_id,
            diffs=result["suggestions"],
        )
        await db.commit()

    # Get updated workshop
    updated_workshop = await workshop_repository.get(
        db, workshop_id=workshop_id, user_id=current_user_id
    )

    return SuggestResponse(
        workshop=WorkshopResponse.model_validate(updated_workshop),
        new_suggestions_count=len(result["suggestions"]),
        gaps_identified=result.get("gaps", []),
    )


@router.post("/{workshop_id}/diffs/accept", response_model=DiffActionResponse)
async def accept_diff(
    workshop_id: int,
    action_in: DiffActionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> DiffActionResponse:
    """
    Accept a pending diff suggestion.

    The diff is applied to the workshop sections and removed from pending.
    """
    # Get current workshop to capture the diff before it's removed
    workshop = await workshop_repository.get(
        db, workshop_id=workshop_id, user_id=current_user_id
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )

    pending = workshop.get("pending_diffs", [])
    if action_in.diff_index >= len(pending):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid diff index. Workshop has {len(pending)} pending diffs.",
        )

    applied_diff = pending[action_in.diff_index]

    updated_workshop = await workshop_repository.accept_diff(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
        diff_index=action_in.diff_index,
    )
    await db.commit()

    return DiffActionResponse(
        workshop=WorkshopResponse.model_validate(updated_workshop),
        action="accept",
        applied_diff=applied_diff,
    )


@router.post("/{workshop_id}/diffs/reject", response_model=DiffActionResponse)
async def reject_diff(
    workshop_id: int,
    action_in: DiffActionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> DiffActionResponse:
    """
    Reject a pending diff suggestion.

    The diff is removed without being applied.
    """
    workshop = await workshop_repository.get(
        db, workshop_id=workshop_id, user_id=current_user_id
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )

    pending = workshop.get("pending_diffs", [])
    if action_in.diff_index >= len(pending):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid diff index. Workshop has {len(pending)} pending diffs.",
        )

    updated_workshop = await workshop_repository.reject_diff(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
        diff_index=action_in.diff_index,
    )
    await db.commit()

    return DiffActionResponse(
        workshop=WorkshopResponse.model_validate(updated_workshop),
        action="reject",
        applied_diff=None,
    )


@router.post("/{workshop_id}/diffs/clear", response_model=WorkshopResponse)
async def clear_diffs(
    workshop_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WorkshopResponse:
    """Clear all pending diff suggestions."""
    workshop = await workshop_repository.clear_pending_diffs(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )
    await db.commit()
    return WorkshopResponse.model_validate(workshop)


@router.patch("/{workshop_id}/sections", response_model=WorkshopResponse)
async def update_sections(
    workshop_id: int,
    sections_in: UpdateSectionsRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WorkshopResponse:
    """
    Update workshop sections.

    Sections are merged with existing content. Pass null for a key
    to remove that section.
    """
    workshop = await workshop_repository.update_sections(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
        sections=sections_in.sections,
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )
    await db.commit()
    return WorkshopResponse.model_validate(workshop)


@router.patch("/{workshop_id}/status", response_model=WorkshopResponse)
async def update_status(
    workshop_id: int,
    status_in: UpdateStatusRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> WorkshopResponse:
    """Update workshop status."""
    workshop = await workshop_repository.update_status(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
        status=status_in.status,
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )
    await db.commit()
    return WorkshopResponse.model_validate(workshop)


@router.post("/{workshop_id}/export")
async def export_workshop(
    workshop_id: int,
    export_in: ExportRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
):
    """
    Export workshop content to PDF, DOCX, TXT, or JSON.

    Returns the file as a download.
    """
    from fastapi.responses import Response
    from app.services.export import get_export_service

    workshop = await workshop_repository.get(
        db, workshop_id=workshop_id, user_id=current_user_id
    )
    if not workshop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workshop not found",
        )

    export_service = get_export_service()
    sections = workshop.get("sections", {})

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
    await workshop_repository.update_status(
        db,
        workshop_id=workshop_id,
        user_id=current_user_id,
        status=WorkshopStatus.EXPORTED,
    )
    await db.commit()

    # Determine filename
    job_title = workshop.get("job_title", "resume").replace(" ", "_")
    filename = f"{job_title}.{export_in.format}"

    return Response(
        content=content if isinstance(content, bytes) else content.encode(),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
