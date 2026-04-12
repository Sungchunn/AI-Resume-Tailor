"""
API routes for system-wide job listings.

These endpoints allow authenticated users to browse, search, and interact
with job listings populated from external sources (Apify/n8n).
"""

import hashlib
import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi_cache import FastAPICache
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId, DBSession, DBSessionWithRLS
from app.crud import job_listing_repository, user_job_interaction_repository
from app.schemas.job_listing import (
    ApplicationStatus,
    ApplyJobRequest,
    FilterOption,
    HideJobRequest,
    JobInteractionActionResponse,
    JobListingFilterOptionsResponse,
    JobListingFilters,
    JobListingListItem,
    JobListingListItemResponse,
    JobListingResponse,
    KanbanBoardResponse,
    KanbanColumnResponse,
    KanbanJobItem,
    ReorderKanbanRequest,
    SaveJobRequest,
    SortBy,
    SortOrder,
    UpdateApplicationStatusRequest,
    UserJobInteractionResponse,
)
from app.services.scraping.schedule_utils import get_cache_ttl_seconds

logger = logging.getLogger(__name__)

router = APIRouter()


# ----------------------------------------------------------------------------
# In-process cache helpers (Phase 2 — see
# /docs/features/infrastructure/110426_jobs-page-caching/phase-2-inmemory-cache.md)
#
# Manual get/set against the FastAPICache backend. fastapi-cache's @cache
# decorator unconditionally rewrites the Cache-Control header on hits and
# misses, which conflicts with the Phase 3 `stale-while-revalidate` / `public`
# directives we want to emit — so we bypass it here and manage keys ourselves.
# ----------------------------------------------------------------------------


def _filter_options_cache_key() -> str:
    """Fixed cache key for the public filter-options response."""
    return f"{FastAPICache.get_prefix()}:job-listings:filter-options"


def _public_list_cache_key(filters: "JobListingFilters") -> str:
    """Build a cache key for the public portion of the list endpoint.

    Excludes user-interaction filters (``is_saved``, ``is_hidden``, ``applied``)
    so the entry can be shared across users.
    """
    public_bits = filters.model_dump(exclude={"is_saved", "is_hidden", "applied"})
    raw = repr(sorted(public_bits.items(), key=lambda kv: kv[0]))
    digest = hashlib.md5(raw.encode()).hexdigest()  # noqa: S324
    return f"{FastAPICache.get_prefix()}:job-listings:public:{digest}"


def _public_count_cache_key(filters: "JobListingFilters") -> str:
    """Cache key for the count portion of a list query.

    Excludes pagination (``limit``, ``offset``) on top of the per-user
    filters so pages 2+ reuse page 1's count under the same filter set.
    """
    public_bits = filters.model_dump(
        exclude={"is_saved", "is_hidden", "applied", "limit", "offset"}
    )
    raw = repr(sorted(public_bits.items(), key=lambda kv: kv[0]))
    digest = hashlib.md5(raw.encode()).hexdigest()  # noqa: S324
    return f"{FastAPICache.get_prefix()}:job-listings:public-count:{digest}"


async def _fetch_public_listings(
    db: AsyncSession,
    filters: "JobListingFilters",
) -> tuple[list["JobListingListItem"], int]:
    """Fetch and cache the public portion of a list query.

    Returns slim list items with default (False/None) interaction fields.
    Callers must merge in per-user interaction state after retrieval.

    Row payloads are cached per ``(filters + limit + offset)`` while counts
    are cached separately per ``filters`` alone — so paginating under the
    same filter set reuses the first page's count and avoids re-running
    ``SELECT COUNT(*)`` on every next-page click.
    """
    rows_key = _public_list_cache_key(filters)
    count_key = _public_count_cache_key(filters)
    backend = FastAPICache.get_backend()
    coder = FastAPICache.get_coder()

    try:
        cached_rows = await backend.get(rows_key)
    except Exception:
        logger.warning("rb-cache: backend get failed for %s", rows_key, exc_info=True)
        cached_rows = None

    if cached_rows is not None:
        logger.debug("rb-cache: HIT %s", rows_key)
        return coder.decode(cached_rows)

    logger.debug("rb-cache: MISS %s", rows_key)

    # Row miss — try to reuse a cached count under the filter-only key before
    # falling back to the full COUNT + SELECT repo path.
    cached_total: int | None = None
    try:
        cached_count_raw = await backend.get(count_key)
    except Exception:
        logger.warning(
            "rb-cache: backend get failed for %s", count_key, exc_info=True
        )
        cached_count_raw = None

    if cached_count_raw is not None:
        try:
            cached_total = coder.decode(cached_count_raw)
            logger.debug("rb-cache: HIT %s", count_key)
        except Exception:
            logger.warning(
                "rb-cache: failed to decode count cache %s",
                count_key,
                exc_info=True,
            )
            cached_total = None
    else:
        logger.debug("rb-cache: MISS %s", count_key)

    listings, total = await job_listing_repository.list(
        db, filters=filters, user_id=None, known_total=cached_total
    )
    items = [_build_list_item_response(listing) for listing in listings]
    payload = (items, total)

    ttl = get_cache_ttl_seconds()
    try:
        await backend.set(rows_key, coder.encode(payload), expire=ttl)
    except Exception:
        logger.warning("rb-cache: backend set failed for %s", rows_key, exc_info=True)

    if cached_total is None:
        try:
            await backend.set(count_key, coder.encode(total), expire=ttl)
        except Exception:
            logger.warning(
                "rb-cache: backend set failed for %s", count_key, exc_info=True
            )

    return payload


def _build_list_item_response(
    listing,
    interaction=None,
) -> JobListingListItem:
    """Build a slim list-item response. Only touches columns loaded by the
    slim list query — accessing TOAST columns here would force a lazy load
    and break in async sessions.
    """
    response_data = {
        "id": listing.id,
        "external_job_id": listing.external_job_id,
        "job_title": listing.job_title,
        "company_name": listing.company_name,
        "company_logo": listing.company_logo,
        "location": listing.location,
        "is_remote": listing.is_remote,
        "salary_min": listing.salary_min,
        "salary_max": listing.salary_max,
        "salary_currency": listing.salary_currency,
        "salary_period": listing.salary_period,
        "date_posted": listing.date_posted,
        "seniority": listing.seniority,
        "job_url": listing.job_url,
        "source_platform": listing.source_platform,
        "scraped_at": listing.scraped_at,
        "is_saved": False,
        "is_hidden": False,
        "applied_at": None,
        "application_status": None,
    }

    if interaction:
        response_data["is_saved"] = interaction.is_saved
        response_data["is_hidden"] = interaction.is_hidden
        response_data["applied_at"] = interaction.applied_at
        response_data["application_status"] = interaction.application_status

    return JobListingListItem(**response_data)


def _merge_interaction_into_item(
    item: JobListingListItem,
    interaction=None,
) -> JobListingListItem:
    """Return a copy of a cached list item with per-user interaction merged in.

    The cached entry is shared across users so we never mutate it; ``model_copy``
    produces a shallow clone with only the interaction fields overridden.
    """
    if interaction is None:
        return item
    return item.model_copy(
        update={
            "is_saved": interaction.is_saved,
            "is_hidden": interaction.is_hidden,
            "applied_at": interaction.applied_at,
            "application_status": interaction.application_status,
        }
    )


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


def _build_kanban_item(listing, interaction) -> KanbanJobItem:
    """Build a slim KanbanJobItem for kanban board cards."""
    return KanbanJobItem(
        id=listing.id,
        job_title=listing.job_title,
        company_name=listing.company_name,
        company_logo=listing.company_logo,
        location=listing.location,
        application_status=interaction.application_status,
        status_changed_at=interaction.status_changed_at,
        applied_at=interaction.applied_at,
        column_position=interaction.column_position or 0,
    )


@router.get("/filter-options", response_model=JobListingFilterOptionsResponse)
async def get_filter_options(
    response: Response,
    db: DBSession,
) -> JobListingFilterOptionsResponse:
    """
    Get available filter options based on existing job data.

    Returns distinct countries, regions, and seniority levels
    with counts for each value. This endpoint is unauthenticated so
    Cloudflare can edge-cache the response — Cloudflare skips caching any
    request that carries an Authorization header. Rate-limited per IP
    under the default bucket in ``RateLimitMiddleware``. The underlying
    ``job_listings`` table is not RLS-protected, so no user context is
    required.
    """
    response.headers["Cache-Control"] = (
        "public, max-age=300, stale-while-revalidate=86400"
    )

    cache_key = _filter_options_cache_key()
    backend = FastAPICache.get_backend()
    coder = FastAPICache.get_coder()

    try:
        cached = await backend.get(cache_key)
    except Exception:
        logger.warning(
            "rb-cache: backend get failed for %s", cache_key, exc_info=True
        )
        cached = None

    if cached is not None:
        logger.debug("rb-cache: HIT %s", cache_key)
        return coder.decode_as_type(cached, type_=JobListingFilterOptionsResponse)

    logger.debug("rb-cache: MISS %s", cache_key)
    options = await job_listing_repository.get_filter_options(db, active_only=True)
    payload = JobListingFilterOptionsResponse(
        countries=[FilterOption(**c) for c in options["countries"]],
        regions=[FilterOption(**r) for r in options["regions"]],
        seniorities=[FilterOption(**s) for s in options["seniorities"]],
        cities=[FilterOption(**c) for c in options["cities"]],
    )

    try:
        await backend.set(
            cache_key, coder.encode(payload), expire=get_cache_ttl_seconds()
        )
    except Exception:
        logger.warning(
            "rb-cache: backend set failed for %s", cache_key, exc_info=True
        )

    return payload


@router.get("", response_model=JobListingListItemResponse)
async def list_job_listings(
    # Dependencies (must be before parameters with defaults)
    response: Response,
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
) -> JobListingListItemResponse:
    """
    List job listings with filtering and pagination.

    Supports filtering by location, seniority, salary range, date,
    and full-text search. User interaction filters (saved, hidden, applied)
    are also available.
    """
    response.headers["Cache-Control"] = (
        "private, max-age=60, stale-while-revalidate=30"
    )

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

    has_user_filter = is_saved is not None or is_hidden is not None or applied is not None

    if has_user_filter:
        # User-interaction filters change the WHERE clause via a UserJobInteraction
        # join — bypass the public cache and fall through to the per-user query.
        listings, total = await job_listing_repository.list(
            db, filters=filters, user_id=current_user_id
        )
        listing_ids = [listing.id for listing in listings]
        interactions_map = await user_job_interaction_repository.get_batch(
            db, user_id=current_user_id, job_listing_ids=listing_ids
        )
        response_listings = [
            _build_list_item_response(listing, interactions_map.get(listing.id))
            for listing in listings
        ]
    else:
        public_items, total = await _fetch_public_listings(db, filters)
        listing_ids = [item.id for item in public_items]
        interactions_map = await user_job_interaction_repository.get_batch(
            db, user_id=current_user_id, job_listing_ids=listing_ids
        )
        response_listings = [
            _merge_interaction_into_item(item, interactions_map.get(item.id))
            for item in public_items
        ]

    return JobListingListItemResponse(
        listings=response_listings,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/search", response_model=JobListingListItemResponse)
async def search_job_listings(
    q: Annotated[str, Query(min_length=1, description="Search query")],
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobListingListItemResponse:
    """
    Full-text search for job listings.

    Searches across job title, company name, and job description.
    """
    response.headers["Cache-Control"] = (
        "private, max-age=60, stale-while-revalidate=30"
    )

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
        _build_list_item_response(listing, interactions_map.get(listing.id))
        for listing in listings
    ]

    return JobListingListItemResponse(
        listings=response_listings,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/saved", response_model=JobListingListItemResponse)
async def list_saved_jobs(
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobListingListItemResponse:
    """Get all saved jobs for the current user."""
    response.headers["Cache-Control"] = "private, no-store"

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
        _build_list_item_response(listing, interactions_map.get(listing.id))
        for listing in listings
    ]

    return JobListingListItemResponse(
        listings=response_listings,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/applied", response_model=JobListingListItemResponse)
async def list_applied_jobs(
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobListingListItemResponse:
    """Get all jobs the current user has applied to."""
    response.headers["Cache-Control"] = "private, no-store"

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
        _build_list_item_response(listing, interactions_map.get(listing.id))
        for listing in listings
    ]

    return JobListingListItemResponse(
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
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> KanbanBoardResponse:
    """
    Get the full Kanban board with all applied jobs grouped by status.

    Returns jobs organized into columns: applied, interview, accepted, rejected, ghosted.
    Each column's jobs are ordered by their column_position.
    """
    response.headers["Cache-Control"] = "private, no-store"

    board_data = await user_job_interaction_repository.get_kanban_board(
        db, user_id=current_user_id
    )

    columns: dict[str, KanbanColumnResponse] = {}
    for app_status in ApplicationStatus:
        items = board_data.get(app_status.value, [])
        jobs = [
            _build_kanban_item(listing, interaction)
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
    response: Response,
    db: DBSessionWithRLS,
    current_user_id: CurrentUserId,
) -> JobListingResponse:
    """
    Get a single job listing by ID.

    Also records that the user viewed this listing.
    """
    response.headers["Cache-Control"] = (
        "private, max-age=60, stale-while-revalidate=30"
    )

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
