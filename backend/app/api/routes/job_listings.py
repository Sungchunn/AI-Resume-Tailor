"""
API routes for system-wide job listings.

These endpoints allow authenticated users to browse, search, and interact
with job listings populated from external sources (Apify/n8n).
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUserId, DBSessionWithRLS
from app.crud import job_listing_repository, user_job_interaction_repository
from app.schemas.job_listing import (
    ApplicationStatus,
    ApplyJobRequest,
    FilterOption,
    HideJobRequest,
    JobInteractionActionResponse,
    JobListingFilterOptionsResponse,
    JobListingFilters,
    JobListingListResponse,
    JobListingResponse,
    KanbanBoardResponse,
    KanbanColumnResponse,
    ReorderKanbanRequest,
    SaveJobRequest,
    SortBy,
    SortOrder,
    UpdateApplicationStatusRequest,
    UserJobInteractionResponse,
)

router = APIRouter()


def _build_listing_response(
    listing,
    interaction=None,
) -> JobListingResponse:
    """Build a JobListingResponse with user interaction data."""
    response_data = {
        "id": listing.id,
        "external_job_id": listing.external_job_id,
        "job_title": listing.job_title,
        "company_name": listing.company_name,
        "company_logo": listing.company_logo,
        "company_website": listing.company_website,
        "company_description": listing.company_description,
        "company_linkedin_url": listing.company_linkedin_url,
        "company_address_locality": listing.company_address_locality,
        "company_address_country": listing.company_address_country,
        "location": listing.location,
        "city": listing.city,
        "state": listing.state,
        "country": listing.country,
        "is_remote": listing.is_remote,
        "seniority": listing.seniority,
        "job_function": listing.job_function,
        "industry": listing.industry,
        "job_description": listing.job_description,
        "job_description_html": listing.job_description_html,
        "job_url": listing.job_url,
        "job_url_direct": listing.job_url_direct,
        "apply_url": listing.apply_url,
        "job_type": listing.job_type,
        "emails": listing.emails,
        "benefits": listing.benefits,
        "easy_apply": listing.easy_apply,
        "applicants_count": listing.applicants_count,
        "salary_min": listing.salary_min,
        "salary_max": listing.salary_max,
        "salary_currency": listing.salary_currency,
        "salary_period": listing.salary_period,
        "date_posted": listing.date_posted,
        "scraped_at": listing.scraped_at,
        "source_platform": listing.source_platform,
        "region": listing.region,
        "last_synced_at": listing.last_synced_at,
        "is_active": listing.is_active,
        "created_at": listing.created_at,
        "updated_at": listing.updated_at,
        "is_saved": False,
        "is_hidden": False,
        "applied_at": None,
        "application_status": None,
        "status_changed_at": None,
        "column_position": 0,
    }

    if interaction:
        response_data["is_saved"] = interaction.is_saved
        response_data["is_hidden"] = interaction.is_hidden
        response_data["applied_at"] = interaction.applied_at
        response_data["application_status"] = interaction.application_status
        response_data["status_changed_at"] = interaction.status_changed_at
        response_data["column_position"] = interaction.column_position or 0

    return JobListingResponse(**response_data)


@router.get("/filter-options", response_model=JobListingFilterOptionsResponse)
async def get_filter_options(
    db: DBSessionWithRLS,
    _current_user_id: CurrentUserId,
) -> JobListingFilterOptionsResponse:
    """
    Get available filter options based on existing job data.

    Returns distinct countries, regions, and seniority levels
    with counts for each value.
    """
    options = await job_listing_repository.get_filter_options(db, active_only=True)

    return JobListingFilterOptionsResponse(
        countries=[FilterOption(**c) for c in options["countries"]],
        regions=[FilterOption(**r) for r in options["regions"]],
        seniorities=[FilterOption(**s) for s in options["seniorities"]],
        cities=[FilterOption(**c) for c in options["cities"]],
    )


@router.get("", response_model=JobListingListResponse)
async def list_job_listings(
    # Dependencies (must be before parameters with defaults)
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
    # Location filters
    location: Annotated[str | None, Query(description="Location filter (comma-separated, deprecated)")] = None,
    # Region filter
    region: Annotated[str | None, Query(description="Region filter (comma-separated)")] = None,
    # Country filter
    country: Annotated[str | None, Query(description="Country filter (comma-separated)")] = None,
    # City filter
    city: Annotated[str | None, Query(description="City filter (comma-separated)")] = None,
    # Exclusion filters
    exclude_city: Annotated[str | None, Query(description="Cities to exclude (comma-separated)")] = None,
    exclude_country: Annotated[str | None, Query(description="Countries to exclude (comma-separated)")] = None,
    # Company name filter
    company_name: Annotated[str | None, Query(description="Company name filter")] = None,
    # Seniority filters
    seniority: Annotated[str | None, Query(description="Seniority levels (comma-separated)")] = None,
    # Category filters
    job_function: Annotated[str | None, Query(description="Job function filter")] = None,
    industry: Annotated[str | None, Query(description="Industry filter")] = None,
    # Remote filter
    is_remote: Annotated[bool | None, Query(description="Filter by remote status")] = None,
    # Easy Apply filter
    easy_apply: Annotated[bool | None, Query(description="Filter by Easy Apply availability")] = None,
    # Applicant count filters
    applicants_max: Annotated[int | None, Query(ge=0, description="Maximum applicant count")] = None,
    applicants_include_na: Annotated[bool, Query(description="Include jobs with unknown applicant count")] = True,
    # Salary filters
    salary_min: Annotated[int | None, Query(ge=0, description="Minimum salary")] = None,
    salary_max: Annotated[int | None, Query(ge=0, description="Maximum salary")] = None,
    # Date filter
    date_posted_after: Annotated[datetime | None, Query(description="Only jobs posted after")] = None,
    # Search
    search: Annotated[str | None, Query(description="Full-text search")] = None,
    # User filters
    is_saved: Annotated[bool | None, Query(description="Filter by saved status")] = None,
    is_hidden: Annotated[bool | None, Query(description="Filter by hidden status")] = None,
    applied: Annotated[bool | None, Query(description="Filter by applied status")] = None,
    # Sorting
    sort_by: Annotated[SortBy, Query(description="Sort field")] = SortBy.DATE_POSTED,
    sort_order: Annotated[SortOrder, Query(description="Sort order")] = SortOrder.DESC,
    # Pagination
    limit: Annotated[int, Query(ge=1, le=100, description="Results per page")] = 20,
    offset: Annotated[int, Query(ge=0, description="Offset for pagination")] = 0,
) -> JobListingListResponse:
    """
    List job listings with filtering and pagination.

    Supports filtering by location, seniority, salary range, date,
    and full-text search. User interaction filters (saved, hidden, applied)
    are also available.
    """
    filters = JobListingFilters(
        location=location,
        region=region,
        country=country,
        city=city,
        exclude_city=exclude_city,
        exclude_country=exclude_country,
        company_name=company_name,
        seniority=seniority,
        job_function=job_function,
        industry=industry,
        is_remote=is_remote,
        easy_apply=easy_apply,
        applicants_max=applicants_max,
        applicants_include_na=applicants_include_na,
        salary_min=salary_min,
        salary_max=salary_max,
        date_posted_after=date_posted_after,
        search=search,
        is_saved=is_saved,
        is_hidden=is_hidden,
        applied=applied,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )

    listings, total = await job_listing_repository.list(
        db, filters=filters, user_id=current_user_id
    )

    # Batch fetch all interactions in a single query (fixes N+1)
    listing_ids = [listing.id for listing in listings]
    interactions_map = await user_job_interaction_repository.get_batch(
        db, user_id=current_user_id, job_listing_ids=listing_ids
    )

    # Build responses using the pre-fetched interactions
    response_listings = [
        _build_listing_response(listing, interactions_map.get(listing.id))
        for listing in listings
    ]

    return JobListingListResponse(
        listings=response_listings,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/search", response_model=JobListingListResponse)
async def search_job_listings(
    q: Annotated[str, Query(min_length=1, description="Search query")],
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobListingListResponse:
    """
    Full-text search for job listings.

    Searches across job title, company name, and job description.
    """
    filters = JobListingFilters(
        search=q,
        limit=limit,
        offset=offset,
        applicants_max=None,
        salary_min=None,
        salary_max=None,
    )

    listings, total = await job_listing_repository.list(
        db, filters=filters, user_id=current_user_id
    )

    # Batch fetch all interactions in a single query (fixes N+1)
    listing_ids = [listing.id for listing in listings]
    interactions_map = await user_job_interaction_repository.get_batch(
        db, user_id=current_user_id, job_listing_ids=listing_ids
    )

    response_listings = [
        _build_listing_response(listing, interactions_map.get(listing.id))
        for listing in listings
    ]

    return JobListingListResponse(
        listings=response_listings,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/saved", response_model=JobListingListResponse)
async def list_saved_jobs(
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobListingListResponse:
    """Get all saved jobs for the current user."""
    filters = JobListingFilters(
        is_saved=True,
        limit=limit,
        offset=offset,
        applicants_max=None,
        salary_min=None,
        salary_max=None,
    )

    listings, total = await job_listing_repository.list(
        db, filters=filters, user_id=current_user_id
    )

    # Batch fetch all interactions in a single query (fixes N+1)
    listing_ids = [listing.id for listing in listings]
    interactions_map = await user_job_interaction_repository.get_batch(
        db, user_id=current_user_id, job_listing_ids=listing_ids
    )

    response_listings = [
        _build_listing_response(listing, interactions_map.get(listing.id))
        for listing in listings
    ]

    return JobListingListResponse(
        listings=response_listings,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/applied", response_model=JobListingListResponse)
async def list_applied_jobs(
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobListingListResponse:
    """Get all jobs the current user has applied to."""
    filters = JobListingFilters(
        applied=True,
        limit=limit,
        offset=offset,
        applicants_max=None,
        salary_min=None,
        salary_max=None,
    )

    listings, total = await job_listing_repository.list(
        db, filters=filters, user_id=current_user_id
    )

    # Batch fetch all interactions in a single query (fixes N+1)
    listing_ids = [listing.id for listing in listings]
    interactions_map = await user_job_interaction_repository.get_batch(
        db, user_id=current_user_id, job_listing_ids=listing_ids
    )

    response_listings = [
        _build_listing_response(listing, interactions_map.get(listing.id))
        for listing in listings
    ]

    return JobListingListResponse(
        listings=response_listings,
        total=total,
        limit=limit,
        offset=offset,
    )


# ============================================================================
# Kanban Board Endpoints
# ============================================================================


@router.get("/kanban", response_model=KanbanBoardResponse)
async def get_kanban_board(
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> KanbanBoardResponse:
    """
    Get the full Kanban board with all applied jobs grouped by status.

    Returns jobs organized into columns: applied, interview, accepted, rejected, ghosted.
    Each column's jobs are ordered by their column_position.
    """
    board_data = await user_job_interaction_repository.get_kanban_board(
        db, user_id=current_user_id
    )

    columns: dict[str, KanbanColumnResponse] = {}
    for app_status in ApplicationStatus:
        items = board_data.get(app_status.value, [])
        jobs = [
            _build_listing_response(listing, interaction)
            for interaction, listing in items
        ]
        columns[app_status.value] = KanbanColumnResponse(
            status=app_status.value,
            jobs=jobs,
            total=len(jobs),
        )

    return KanbanBoardResponse(columns=columns)


@router.put("/kanban/reorder", response_model=dict)
async def reorder_kanban_column(
    request: ReorderKanbanRequest,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> dict:
    """
    Reorder jobs within a Kanban column.

    The job_listing_ids list defines the new order (index = position).
    """
    await user_job_interaction_repository.reorder_jobs_in_column(
        db,
        user_id=current_user_id,
        status=request.status,
        job_listing_ids=request.job_listing_ids,
    )

    return {"success": True, "message": "Jobs reordered successfully"}


@router.get("/{listing_id}", response_model=JobListingResponse)
async def get_job_listing(
    listing_id: int,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> JobListingResponse:
    """
    Get a single job listing by ID.

    Also records that the user viewed this listing.
    """
    listing = await job_listing_repository.get(db, id=listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job listing not found",
        )

    # Record view
    interaction = await user_job_interaction_repository.record_view(
        db, user_id=current_user_id, job_listing_id=listing_id
    )

    return _build_listing_response(listing, interaction)


@router.post("/{listing_id}/save", response_model=JobInteractionActionResponse)
async def save_job_listing(
    listing_id: int,
    request: SaveJobRequest,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> JobInteractionActionResponse:
    """Save or unsave a job listing."""
    # Verify listing exists
    listing = await job_listing_repository.get(db, id=listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job listing not found",
        )

    interaction = await user_job_interaction_repository.set_saved(
        db, user_id=current_user_id, job_listing_id=listing_id, is_saved=request.save
    )

    action = "saved" if request.save else "unsaved"
    return JobInteractionActionResponse(
        success=True,
        message=f"Job listing {action} successfully",
        interaction=UserJobInteractionResponse.model_validate(interaction),
    )


@router.post("/{listing_id}/hide", response_model=JobInteractionActionResponse)
async def hide_job_listing(
    listing_id: int,
    request: HideJobRequest,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> JobInteractionActionResponse:
    """Hide or unhide a job listing."""
    # Verify listing exists
    listing = await job_listing_repository.get(db, id=listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job listing not found",
        )

    interaction = await user_job_interaction_repository.set_hidden(
        db, user_id=current_user_id, job_listing_id=listing_id, is_hidden=request.hide
    )

    action = "hidden" if request.hide else "unhidden"
    return JobInteractionActionResponse(
        success=True,
        message=f"Job listing {action} successfully",
        interaction=UserJobInteractionResponse.model_validate(interaction),
    )


@router.post("/{listing_id}/applied", response_model=JobInteractionActionResponse)
async def mark_job_applied(
    listing_id: int,
    request: ApplyJobRequest,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> JobInteractionActionResponse:
    """Mark a job listing as applied or unapplied."""
    # Verify listing exists
    listing = await job_listing_repository.get(db, id=listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job listing not found",
        )

    interaction = await user_job_interaction_repository.set_applied(
        db, user_id=current_user_id, job_listing_id=listing_id, applied=request.applied
    )

    action = "marked as applied" if request.applied else "unmarked as applied"
    return JobInteractionActionResponse(
        success=True,
        message=f"Job listing {action} successfully",
        interaction=UserJobInteractionResponse.model_validate(interaction),
    )


@router.patch("/{listing_id}/status", response_model=JobInteractionActionResponse)
async def update_application_status(
    listing_id: int,
    request: UpdateApplicationStatusRequest,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> JobInteractionActionResponse:
    """
    Update the application status for a job listing (Kanban column).

    Valid statuses: applied, interview, accepted, rejected, ghosted.
    This also updates status_changed_at and reorders within the new column.
    """
    # Verify listing exists
    listing = await job_listing_repository.get(db, id=listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job listing not found",
        )

    interaction = await user_job_interaction_repository.update_application_status(
        db,
        user_id=current_user_id,
        job_listing_id=listing_id,
        status=request.status,
    )

    return JobInteractionActionResponse(
        success=True,
        message=f"Application status updated to '{request.status.value}'",
        interaction=UserJobInteractionResponse.model_validate(interaction),
    )
