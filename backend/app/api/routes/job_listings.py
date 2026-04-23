"""
API routes for system-wide job listings.

These endpoints allow authenticated users to browse, search, and interact
with job listings populated from external sources (Apify/n8n).
"""

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi_cache import FastAPICache
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    CurrentUserId,
    DatabaseSessionsWithRLS,
    DBSession,
    DBSessionWithRLS,
    resolve_ai_model,
)
from app.crud import job_listing_repository, user_job_interaction_repository
from app.crud.mongo.resume import resume_crud
from app.db.mongodb import get_mongodb
from app.models.ai_usage_log import AIUsageLog
from app.models.fit_score_batch_run import FitScoreBatchRun
from app.schemas.job_listing import (
    ApplicationStatus,
    ApplyJobRequest,
    FilterOption,
    FitScoreBreakdown,
    FitScoreMetaResponse,
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
from app.schemas.job_listing_analysis import (
    AIUsageSummary,
    JobDeepAnalysisResponse,
)
from app.services.ai import get_usage_tracker
from app.services.ai.client import get_ai_client_for_model
from app.services.core.cache import get_cache_service
from app.services.job_listings import (
    DeepAnalysisCriticalError,
    DeepAnalysisService,
)
from app.services.scraping.schedule_utils import get_cache_ttl_seconds

logger = logging.getLogger(__name__)

# Per-user daily quota for POST /{id}/analyze. Enforced by counting
# successful ai_usage_log rows in the trailing 24h window.
DEEP_ANALYSIS_QUOTA_LIMIT = 5
DEEP_ANALYSIS_QUOTA_WINDOW = timedelta(days=1)
DEEP_ANALYSIS_ENDPOINT = "/job-listings/analyze"

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


_PER_USER_FILTER_KEYS = frozenset({"is_saved", "is_hidden", "applied", "hide_capped"})


def _public_list_cache_key(filters: "JobListingFilters") -> str:
    """Build a cache key for the public portion of the list endpoint.

    Excludes per-user filters (saved/hidden/applied and the new
    ``hide_capped`` which depends on user-specific cap state) so the entry
    can be shared across users.
    """
    public_bits = filters.model_dump(exclude=set(_PER_USER_FILTER_KEYS))
    raw = repr(sorted(public_bits.items(), key=lambda kv: kv[0]))
    digest = hashlib.md5(raw.encode()).hexdigest()  # noqa: S324
    return f"{FastAPICache.get_prefix()}:job-listings:public:{digest}"


def _public_count_cache_key(filters: "JobListingFilters") -> str:
    """Cache key for the count portion of a list query.

    Excludes pagination (``limit``, ``offset``) on top of the per-user
    filters so pages 2+ reuse page 1's count under the same filter set.
    """
    public_bits = filters.model_dump(
        exclude=set(_PER_USER_FILTER_KEYS) | {"limit", "offset"}
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


async def _get_current_master_resume_hash(user_id: int) -> str | None:
    """Fetch the content hash of the user's starred (master) resume.

    Used to flag ``is_score_stale`` on pre-scored job interactions: if the
    interaction's ``scored_resume_hash`` doesn't match this, the score was
    computed against an older version of the resume and will be refreshed
    on the next daily batch.
    """
    try:
        mongo = get_mongodb()
    except RuntimeError:
        return None
    doc = await mongo.resumes.find_one(
        {"user_id": user_id, "is_master": True},
        {"keywords_content_hash": 1},
    )
    if not doc:
        return None
    return doc.get("keywords_content_hash")


def _compute_is_stale(
    scored_hash: str | None,
    current_hash: str | None,
) -> bool:
    """True when a score exists but was computed against an older resume."""
    if scored_hash is None or current_hash is None:
        return False
    return scored_hash != current_hash


def _build_list_item_response(
    listing,
    interaction=None,
    current_resume_hash: str | None = None,
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
        "fit_score_raw": None,
        "is_score_stale": False,
        "fit_score_breakdown": None,
        "fit_score_is_capped": False,
    }

    if interaction:
        response_data["is_saved"] = interaction.is_saved
        response_data["is_hidden"] = interaction.is_hidden
        response_data["applied_at"] = interaction.applied_at
        response_data["application_status"] = interaction.application_status
        response_data["fit_score_raw"] = interaction.fit_score_raw
        response_data["is_score_stale"] = _compute_is_stale(
            interaction.scored_resume_hash, current_resume_hash
        )
        if interaction.fit_score_breakdown is not None:
            response_data["fit_score_breakdown"] = FitScoreBreakdown.model_validate(
                interaction.fit_score_breakdown
            )
        response_data["fit_score_is_capped"] = bool(interaction.fit_score_is_capped)

    return JobListingListItem(**response_data)


def _merge_interaction_into_item(
    item: JobListingListItem,
    interaction=None,
    current_resume_hash: str | None = None,
) -> JobListingListItem:
    """Return a copy of a cached list item with per-user interaction merged in.

    The cached entry is shared across users so we never mutate it; ``model_copy``
    produces a shallow clone with only the interaction fields overridden.
    """
    if interaction is None:
        return item
    breakdown: FitScoreBreakdown | None = None
    if interaction.fit_score_breakdown is not None:
        breakdown = FitScoreBreakdown.model_validate(interaction.fit_score_breakdown)
    return item.model_copy(
        update={
            "is_saved": interaction.is_saved,
            "is_hidden": interaction.is_hidden,
            "applied_at": interaction.applied_at,
            "application_status": interaction.application_status,
            "fit_score_raw": interaction.fit_score_raw,
            "is_score_stale": _compute_is_stale(
                interaction.scored_resume_hash, current_resume_hash
            ),
            "fit_score_breakdown": breakdown,
            "fit_score_is_capped": bool(interaction.fit_score_is_capped),
        }
    )


def _build_listing_response(
    listing,
    interaction=None,
    current_resume_hash: str | None = None,
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
        "fit_score_raw": None,
        "is_score_stale": False,
        "fit_score_breakdown": None,
        "fit_score_is_capped": False,
    }

    if interaction:
        response_data["is_saved"] = interaction.is_saved
        response_data["is_hidden"] = interaction.is_hidden
        response_data["applied_at"] = interaction.applied_at
        response_data["application_status"] = interaction.application_status
        response_data["status_changed_at"] = interaction.status_changed_at
        response_data["column_position"] = interaction.column_position or 0
        response_data["fit_score_raw"] = interaction.fit_score_raw
        response_data["is_score_stale"] = _compute_is_stale(
            interaction.scored_resume_hash, current_resume_hash
        )
        if interaction.fit_score_breakdown is not None:
            response_data["fit_score_breakdown"] = FitScoreBreakdown.model_validate(
                interaction.fit_score_breakdown
            )
        response_data["fit_score_is_capped"] = bool(interaction.fit_score_is_capped)

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


@router.get("/fit-score-meta", response_model=FitScoreMetaResponse)
async def get_fit_score_meta(
    response: Response,
    db: DBSession,
    current_user_id: CurrentUserId,
) -> FitScoreMetaResponse:
    """Return metadata about the most recent fit-score batch run.

    Drives the "Scores refreshed Xh ago (daily batch)" header on /jobs.
    Returns the latest row from ``fit_score_batch_runs``; ``last_run_at``
    is ``None`` before the first batch has ever completed.
    """
    # Short cache — batch runs daily, so 5 minutes is plenty and avoids
    # hammering the DB when every /jobs page render calls this.
    response.headers["Cache-Control"] = "private, max-age=300"

    stmt = (
        select(
            FitScoreBatchRun.started_at,
            FitScoreBatchRun.completed_at,
            FitScoreBatchRun.users_count,
            FitScoreBatchRun.rows_written,
            FitScoreBatchRun.status,
        )
        .order_by(FitScoreBatchRun.started_at.desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return FitScoreMetaResponse()

    # Prefer completed_at when available; fall back to started_at so the UI
    # still shows a timestamp while a batch is in progress.
    last_run_at = row.completed_at or row.started_at
    return FitScoreMetaResponse(
        last_run_at=last_run_at,
        users_count=row.users_count,
        rows_written=row.rows_written,
        status=row.status,
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
    try:
        backend = FastAPICache.get_backend()
        coder = FastAPICache.get_coder()
    except Exception:
        logger.warning(
            "rb-cache: FastAPICache unavailable, skipping cache for %s",
            cache_key,
            exc_info=True,
        )
        backend = None
        coder = None

    cached = None
    if backend is not None:
        try:
            cached = await backend.get(cache_key)
        except Exception:
            logger.warning(
                "rb-cache: backend get failed for %s", cache_key, exc_info=True
            )
            cached = None

    if cached is not None and coder is not None:
        try:
            decoded = coder.decode_as_type(
                cached, type_=JobListingFilterOptionsResponse
            )
            logger.debug("rb-cache: HIT %s", cache_key)
            return decoded
        except Exception:
            # Stale/incompatible payload (e.g. schema changed since it was
            # written). Evict and fall through to a fresh DB read so the
            # endpoint self-heals instead of 500ing.
            logger.warning(
                "rb-cache: decode failed for %s, evicting and rebuilding",
                cache_key,
                exc_info=True,
            )
            try:
                await backend.clear(key=cache_key) # type: ignore
            except Exception:
                logger.warning(
                    "rb-cache: evict failed for %s", cache_key, exc_info=True
                )

    logger.debug("rb-cache: MISS %s", cache_key)
    options = await job_listing_repository.get_filter_options(db, active_only=True)
    payload = JobListingFilterOptionsResponse(
        countries=[FilterOption(**c) for c in options["countries"]],
        regions=[FilterOption(**r) for r in options["regions"]],
        seniorities=[FilterOption(**s) for s in options["seniorities"]],
        cities=[FilterOption(**c) for c in options["cities"]],
    )

    if backend is not None and coder is not None:
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
    # Hide rows where the required-skill gate capped the score at 60.
    hide_capped: Annotated[bool, Query(description="Hide rows where the required-skill gate capped the score")] = False,
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
        hide_capped=hide_capped,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )

    has_user_filter = (
        is_saved is not None
        or is_hidden is not None
        or applied is not None
        or hide_capped
    )

    current_resume_hash = await _get_current_master_resume_hash(current_user_id)

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
            _build_list_item_response(
                listing,
                interactions_map.get(listing.id),
                current_resume_hash=current_resume_hash,
            )
            for listing in listings
        ]
    else:
        public_items, total = await _fetch_public_listings(db, filters)
        listing_ids = [item.id for item in public_items]
        interactions_map = await user_job_interaction_repository.get_batch(
            db, user_id=current_user_id, job_listing_ids=listing_ids
        )
        response_listings = [
            _merge_interaction_into_item(
                item,
                interactions_map.get(item.id),
                current_resume_hash=current_resume_hash,
            )
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
    current_resume_hash = await _get_current_master_resume_hash(current_user_id)

    response_listings = [
        _build_list_item_response(
            listing,
            interactions_map.get(listing.id),
            current_resume_hash=current_resume_hash,
        )
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
    current_resume_hash = await _get_current_master_resume_hash(current_user_id)

    response_listings = [
        _build_list_item_response(
            listing,
            interactions_map.get(listing.id),
            current_resume_hash=current_resume_hash,
        )
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
    current_resume_hash = await _get_current_master_resume_hash(current_user_id)

    response_listings = [
        _build_list_item_response(
            listing,
            interactions_map.get(listing.id),
            current_resume_hash=current_resume_hash,
        )
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
    current_resume_hash = await _get_current_master_resume_hash(current_user_id)

    return _build_listing_response(
        listing, interaction, current_resume_hash=current_resume_hash
    )


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


# ============================================================================
# Fit-score deep analysis (Wave 2)
# ============================================================================


async def _deep_analysis_quota_used(
    db: AsyncSession, user_id: int
) -> tuple[int, datetime | None]:
    """Count successful deep-analysis runs in the trailing 24h for this user,
    and return the oldest-counted timestamp (used to compute ``resets_at``).

    Cache hits are not logged to ``ai_usage_log``, so they do not consume
    quota. Failed runs (``success=false``) likewise don't count.
    """

    since = datetime.now(timezone.utc) - DEEP_ANALYSIS_QUOTA_WINDOW

    count_stmt = select(func.count(AIUsageLog.id)).where(
        AIUsageLog.user_id == user_id,
        AIUsageLog.endpoint == DEEP_ANALYSIS_ENDPOINT,
        AIUsageLog.success == True,  # noqa: E712
        AIUsageLog.created_at >= since,
    )
    used = (await db.execute(count_stmt)).scalar_one()
    if used == 0:
        return 0, None

    oldest_stmt = (
        select(AIUsageLog.created_at)
        .where(
            AIUsageLog.user_id == user_id,
            AIUsageLog.endpoint == DEEP_ANALYSIS_ENDPOINT,
            AIUsageLog.success == True,  # noqa: E712
            AIUsageLog.created_at >= since,
        )
        .order_by(AIUsageLog.created_at.asc())
        .limit(1)
    )
    oldest = (await db.execute(oldest_stmt)).scalar_one_or_none()
    return used, oldest


@router.post(
    "/{listing_id}/analyze",
    response_model=JobDeepAnalysisResponse,
    responses={
        400: {"description": "No master resume set or empty job description"},
        404: {"description": "Job listing not found"},
        429: {"description": "Daily limit reached"},
    },
)
async def run_deep_analysis(
    listing_id: int,
    dbs: DatabaseSessionsWithRLS,
    current_user_id: CurrentUserId,
) -> JobDeepAnalysisResponse:
    """Run deep analysis for the current user's master resume against a job
    listing. Composes knockout + detailed keyword + per-bullet analyzers.

    Quota: 5 successful runs per user per rolling 24h window. Cache hits
    (same ``resume_content_hash`` + ``listing_id`` within 24h) do not
    consume quota.
    """

    pg = dbs["pg"]
    mongo = dbs["mongo"]

    # Load job listing first — cheap Postgres lookup, lets us 404 early.
    listing = await job_listing_repository.get(pg, id=listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job listing not found",
        )

    # Load master resume (raw_content + parsed + hash).
    resume = await resume_crud.get_master(mongo, user_id=current_user_id)
    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No master resume set. Star a resume as your master to run deep analysis.",
        )
    if resume.parsed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Master resume has not been parsed yet. Open it once to trigger parsing.",
        )

    cache = get_cache_service()
    resume_hash = cache.hash_content(resume.raw_content or "")

    # Serve from cache before checking the quota — cached replays are free.
    cached = await cache.get_deep_analysis_result(resume_hash, listing_id)
    if cached:
        cached["cached"] = True
        # cached_at tracks when the run was produced; on replay it's the same
        # as generated_at from the original fresh run.
        if not cached.get("cached_at"):
            cached["cached_at"] = cached.get("generated_at")
        cached["ai_usage"] = AIUsageSummary().model_dump()
        return JobDeepAnalysisResponse.model_validate(cached)

    # Gate fresh runs on the daily quota.
    used, oldest_counted_at = await _deep_analysis_quota_used(pg, current_user_id)
    if used >= DEEP_ANALYSIS_QUOTA_LIMIT:
        resets_at = (
            (oldest_counted_at + DEEP_ANALYSIS_QUOTA_WINDOW)
            if oldest_counted_at is not None
            else datetime.now(timezone.utc) + DEEP_ANALYSIS_QUOTA_WINDOW
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "detail": "Daily limit reached",
                "limit": DEEP_ANALYSIS_QUOTA_LIMIT,
                "used": used,
                "resets_at": resets_at.isoformat(),
            },
        )

    # Run the orchestrator.
    model = await resolve_ai_model(current_user_id, pg, "ats")
    ai_client = get_ai_client_for_model(model)
    service = DeepAnalysisService(ai_client=ai_client, cache=cache)

    try:
        result = await service.run(resume=resume, job=listing)
    except DeepAnalysisCriticalError as exc:
        logger.exception("deep_analysis critical path failed: %s", exc)
        # Log the failed run so we can observe it, but don't consume quota.
        # (AIUsageTracker requires an AIResponse; nothing to log here since
        # the failure happened before or during the AI calls themselves.)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deep analysis failed: {exc}",
        )

    # Cache the result before logging so subsequent calls short-circuit even
    # if the usage-log insert fails.
    payload = result.response.model_dump(mode="json")
    await cache.set_deep_analysis_result(resume_hash, listing_id, payload)

    # Log a single aggregated ai_usage_log row — one run = one quota slot.
    if result.ai_responses:
        acc_response = _aggregate_ai_responses(result.ai_responses)
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=pg,
            user_id=current_user_id,
            endpoint=DEEP_ANALYSIS_ENDPOINT,
            response=acc_response,
            success=True,
        )
        await pg.commit()

    return result.response


def _aggregate_ai_responses(responses):
    """Fold the per-stage ``AIResponse`` objects into a single aggregate for
    ``AIUsageTracker.log_generation``. Picks the last stage's provider/model
    so pricing lookup hits a real row.
    """
    from app.services.ai.response import AccumulatedMetrics

    acc = AccumulatedMetrics()
    for r in responses:
        acc.add(r)
    return acc.to_ai_response()
