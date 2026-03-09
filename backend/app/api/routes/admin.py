"""
Admin API endpoints for scraper and job management.

Provides endpoints for monitoring and controlling the background
scraper job that fetches LinkedIn job listings, as well as job
cleanup operations.

Requires admin authentication - user must be logged in and have
the is_admin flag set to True in the database.
"""

import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, require_admin
from app.models.user import User
from app.crud.job_listing import job_listing_repository
from app.crud.scraper_run import scraper_run_repository
from app.crud.scraper_preset import scraper_preset_repository
from app.crud.schedule_settings import schedule_settings_repository
from app.crud.scraper_request import scraper_request_repository
from app.models.job_listing import JobListing
from app.schemas.scraper import (
    AdHocScrapeRequest,
    AdHocScrapeResponse,
    ApifyCostSummary,
    ScraperBatchResult,
    ScraperStatsResponse,
    ScraperStatusResponse,
    ScraperPresetCreate,
    ScraperPresetUpdate,
    ScraperPresetResponse,
    ScraperPresetListResponse,
    ScheduleSettingsUpdate,
    ScheduleSettingsResponse,
    RequestStatus,
    ScraperRequestResponse,
    ScraperRequestAdminResponse,
    ScraperRequestAdminListResponse,
    ScraperRequestApproveRequest,
    ScraperRequestRejectRequest,
)
from app.services.scraping.apify_client import get_apify_client
from app.services.scraping.cost_tracker import get_cost_tracker
from app.services.scraping.scheduler import get_scheduler_service

router = APIRouter(dependencies=[Depends(require_admin)])


class ScraperRunHistoryItem(BaseModel):
    """Summary of a scraper run for history listing."""

    id: int
    run_type: str
    status: str
    started_at: datetime
    completed_at: datetime | None
    duration_seconds: float | None
    total_jobs_found: int
    total_jobs_created: int
    total_jobs_updated: int
    total_errors: int
    triggered_by: str | None


class ScraperRunHistoryResponse(BaseModel):
    """Response for scraper history endpoint."""

    runs: list[ScraperRunHistoryItem]
    total: int


class ScraperHealthResponse(BaseModel):
    """Response for scraper health stats."""

    period_days: int
    total_runs: int
    successful_runs: int
    success_rate: float
    avg_duration_seconds: float
    total_jobs_created: int


class CleanupResponse(BaseModel):
    """Response for job cleanup endpoint."""

    status: str
    deleted_count: int
    duration_seconds: float | None = None
    error: str | None = None


@router.get("/scraper/status", response_model=ScraperStatusResponse)
async def get_scraper_status() -> ScraperStatusResponse:
    """
    Get scheduler status and next run time.

    Returns information about whether the scheduler is running,
    when the next scraper run is scheduled, and results from
    the last run if available. Status is retrieved from persistent
    storage to survive restarts.
    """
    scheduler = get_scheduler_service()
    status_data = await scheduler.get_status()

    # Convert the dict-based last_run_result to the expected format
    last_run_result = None
    if status_data["last_run_result"]:
        # The status is now stored as a dict, need to handle appropriately
        last_run_result = status_data["last_run_result"]

    return ScraperStatusResponse(
        scheduler_running=status_data["scheduler_running"],
        scraper_enabled=status_data["scraper_enabled"],
        next_run_time=status_data["next_run_time"],
        last_run_time=status_data["last_run_time"],
        last_run_result=last_run_result,
    )


@router.post("/scraper/trigger", response_model=ScraperBatchResult)
async def trigger_scraper() -> ScraperBatchResult:
    """
    Manually trigger the scraper job using database presets.

    This endpoint allows manual triggering of the scraper for
    testing or on-demand data refresh. The scraper will run
    for all active presets configured in the database.

    Note: This is a long-running operation that may take several
    minutes depending on the number of presets and jobs to fetch.

    Uses distributed locking to prevent duplicate runs if another
    instance is already running the scraper.
    """
    scheduler = get_scheduler_service()

    if not scheduler.settings.scraper_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scraper is disabled via configuration",
        )

    result = await scheduler.trigger_preset_scraper_now(triggered_by="api_manual")

    # Check if job was skipped due to lock
    if result.status == "skipped":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Scraper is already running on another instance",
        )

    return result


@router.post("/jobs/cleanup", response_model=CleanupResponse)
async def trigger_cleanup() -> CleanupResponse:
    """
    Manually trigger job cleanup.

    This endpoint deletes job listings older than the configured
    retention period (default: 21 days). Uses `created_at` timestamp
    to determine job age.

    Uses distributed locking to prevent duplicate runs if another
    instance is already running cleanup.
    """
    scheduler = get_scheduler_service()
    result = await scheduler.trigger_cleanup_now()

    # Check if job was skipped due to lock
    if result.get("status") == "skipped":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cleanup is already running on another instance",
        )

    return CleanupResponse(
        status=result.get("status", "unknown"),
        deleted_count=result.get("deleted_count", 0),
        duration_seconds=result.get("duration_seconds"),
        error=result.get("error"),
    )


@router.get("/scraper/costs", response_model=ApifyCostSummary)
async def get_apify_cost_summary() -> ApifyCostSummary:
    """
    Get current Apify cost usage and limits.

    Returns daily and weekly cost tracking information including:
    - Amount spent today/this week
    - Configured spending limits
    - Remaining budget
    - Whether any limit has been exceeded
    """
    cost_tracker = get_cost_tracker()
    usage = await cost_tracker.get_current_usage()
    return ApifyCostSummary(**usage)


@router.get("/scraper/stats", response_model=ScraperStatsResponse)
async def get_scraper_stats(
    db: AsyncSession = Depends(get_db_session),
) -> ScraperStatsResponse:
    """
    Get job listing statistics by region and status.

    Returns aggregate counts of job listings including:
    - Total listings
    - Breakdown by region
    - Breakdown by active/inactive status
    - Counts for recently created listings
    """
    # Total listings count
    total_result = await db.execute(select(func.count(JobListing.id)))
    total_listings = total_result.scalar() or 0

    # Count by region
    region_query = select(JobListing.region, func.count(JobListing.id)).group_by(
        JobListing.region
    )
    region_result = await db.execute(region_query)
    listings_by_region = {region or "unknown": count for region, count in region_result.all()}

    # Count by active status
    status_query = select(JobListing.is_active, func.count(JobListing.id)).group_by(
        JobListing.is_active
    )
    status_result = await db.execute(status_query)
    listings_by_status = {
        "active" if is_active else "inactive": count for is_active, count in status_result.all()
    }

    # Last 24 hours count
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_24h_query = select(func.count(JobListing.id)).where(JobListing.created_at >= last_24h)
    last_24h_result = await db.execute(last_24h_query)
    last_24h_created = last_24h_result.scalar() or 0

    # Last 7 days count
    last_7d = now - timedelta(days=7)
    last_7d_query = select(func.count(JobListing.id)).where(JobListing.created_at >= last_7d)
    last_7d_result = await db.execute(last_7d_query)
    last_7d_created = last_7d_result.scalar() or 0

    return ScraperStatsResponse(
        total_listings=total_listings,
        listings_by_region=listings_by_region,
        listings_by_status=listings_by_status,
        last_24h_created=last_24h_created,
        last_7d_created=last_7d_created,
    )


@router.get("/scraper/history", response_model=ScraperRunHistoryResponse)
async def get_scraper_history(
    limit: int = Query(default=10, ge=1, le=100, description="Number of runs to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db_session),
) -> ScraperRunHistoryResponse:
    """
    Get scraper run history.

    Returns a paginated list of recent scraper runs for audit and monitoring.
    """
    runs = await scraper_run_repository.list_recent(db, limit=limit, offset=offset)

    # Get total count for pagination
    from sqlalchemy import func as sql_func

    from app.models.scraper_run import ScraperRun

    total_result = await db.execute(select(sql_func.count(ScraperRun.id)))
    total = total_result.scalar() or 0

    history_items = [
        ScraperRunHistoryItem(
            id=run.id,
            run_type=run.run_type,
            status=run.status,
            started_at=run.started_at,
            completed_at=run.completed_at,
            duration_seconds=run.duration_seconds,
            total_jobs_found=run.total_jobs_found,
            total_jobs_created=run.total_jobs_created,
            total_jobs_updated=run.total_jobs_updated,
            total_errors=run.total_errors,
            triggered_by=run.triggered_by,
        )
        for run in runs
    ]

    return ScraperRunHistoryResponse(runs=history_items, total=total)


@router.get("/scraper/health", response_model=ScraperHealthResponse)
async def get_scraper_health(
    days: int = Query(default=7, ge=1, le=30, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db_session),
) -> ScraperHealthResponse:
    """
    Get scraper health statistics.

    Returns aggregated statistics about scraper performance over the
    specified time period, useful for monitoring scraper reliability.
    """
    stats = await scraper_run_repository.get_stats(db, days=days)

    return ScraperHealthResponse(
        period_days=stats["period_days"],
        total_runs=stats["total_runs"],
        successful_runs=stats["successful_runs"],
        success_rate=stats["success_rate"],
        avg_duration_seconds=stats["avg_duration_seconds"],
        total_jobs_created=stats["total_jobs_created"],
    )


@router.post("/scraper/adhoc", response_model=AdHocScrapeResponse)
async def trigger_adhoc_scrape(
    request: AdHocScrapeRequest,
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin),
) -> AdHocScrapeResponse:
    """
    Trigger an ad-hoc scrape with a custom LinkedIn URL.

    This endpoint allows admins to scrape jobs from any LinkedIn
    job search URL with custom parameters.

    Note: This is a long-running operation that may take several
    minutes depending on the count parameter.
    """
    started_at = datetime.now(timezone.utc)
    apify_client = get_apify_client()

    # Run the ad-hoc scrape
    jobs, result_meta = await apify_client.run_adhoc_scrape(
        url=request.url,
        count=request.count,
    )

    logger.info(f"Ad-hoc scrape returned {len(jobs)} jobs, status={result_meta.get('status')}")

    jobs_created = 0
    jobs_updated = 0
    upsert_errors: list[dict] = []

    # Upsert jobs to database
    if jobs:
        logger.info(f"Starting database upsert for {len(jobs)} jobs")
        created_count, updated_count, errors = await job_listing_repository.batch_upsert_from_apify(
            db,
            jobs_data=jobs,
            source_platform="linkedin",
        )
        jobs_created = created_count
        jobs_updated = updated_count
        upsert_errors = errors
        logger.info(f"Database upsert complete: {jobs_created} created, {jobs_updated} updated, {len(upsert_errors)} errors")
    else:
        logger.warning("No jobs returned from scraper, skipping database upsert")

    # Combine error details
    all_errors = result_meta.get("error_details", []) + upsert_errors
    completed_at = datetime.now(timezone.utc)
    duration = (completed_at - started_at).total_seconds()

    # Determine final status
    final_status = result_meta.get("status", "error")
    if final_status == "success" and upsert_errors:
        final_status = "partial"

    # Create audit record for this ad-hoc scrape
    # Wrap in try/except to prevent audit record failure from rolling back job listings
    try:
        await scraper_run_repository.create_adhoc(
            db,
            status=final_status,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration,
            jobs_found=result_meta.get("jobs_found", 0),
            jobs_created=jobs_created,
            jobs_updated=jobs_updated,
            errors=len(all_errors),
            error_details=all_errors if all_errors else None,
            triggered_by=f"admin:{admin_user.id}",
            config_snapshot={"url": request.url, "count": request.count},
        )
    except Exception as e:
        logger.error(f"Failed to create scraper audit record: {e}")
        # Don't fail the entire operation if audit record fails

    logger.info(f"Committing transaction: {jobs_created} jobs created, {jobs_updated} updated")
    await db.commit()
    logger.info("Transaction committed successfully")

    return AdHocScrapeResponse(
        status=final_status,
        jobs_found=result_meta.get("jobs_found", 0),
        jobs_created=jobs_created,
        jobs_updated=jobs_updated,
        errors=len(all_errors),
        error_details=all_errors,
        duration_seconds=duration,
    )


# ============================================================================
# Scraper Preset Endpoints
# ============================================================================


@router.post("/scraper/presets", response_model=ScraperPresetResponse)
async def create_preset(
    request: ScraperPresetCreate,
    db: AsyncSession = Depends(get_db_session),
) -> ScraperPresetResponse:
    """
    Create a new scraper preset.

    Presets allow saving LinkedIn job search URLs for scheduled scraping.
    """
    preset = await scraper_preset_repository.create(
        db,
        name=request.name,
        url=request.url,
        count=request.count,
        is_active=request.is_active,
    )
    await db.commit()
    return ScraperPresetResponse.model_validate(preset)


@router.get("/scraper/presets", response_model=ScraperPresetListResponse)
async def list_presets(
    db: AsyncSession = Depends(get_db_session),
) -> ScraperPresetListResponse:
    """
    List all scraper presets.

    Returns all presets ordered by name, including both active and inactive.
    """
    presets = await scraper_preset_repository.list_all(db)
    return ScraperPresetListResponse(
        presets=[ScraperPresetResponse.model_validate(p) for p in presets],
        total=len(presets),
    )


@router.get("/scraper/presets/{preset_id}", response_model=ScraperPresetResponse)
async def get_preset(
    preset_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> ScraperPresetResponse:
    """
    Get a single scraper preset by ID.
    """
    preset = await scraper_preset_repository.get(db, preset_id)
    if not preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )
    return ScraperPresetResponse.model_validate(preset)


@router.patch("/scraper/presets/{preset_id}", response_model=ScraperPresetResponse)
async def update_preset(
    preset_id: int,
    request: ScraperPresetUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> ScraperPresetResponse:
    """
    Update a scraper preset.

    Only provided fields will be updated.
    """
    preset = await scraper_preset_repository.update(
        db,
        preset_id=preset_id,
        name=request.name,
        url=request.url,
        count=request.count,
        is_active=request.is_active,
    )
    if not preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )
    await db.commit()
    return ScraperPresetResponse.model_validate(preset)


@router.delete("/scraper/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preset(
    preset_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a scraper preset.
    """
    deleted = await scraper_preset_repository.delete(db, preset_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )
    await db.commit()


@router.post("/scraper/presets/{preset_id}/toggle", response_model=ScraperPresetResponse)
async def toggle_preset(
    preset_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> ScraperPresetResponse:
    """
    Toggle the active status of a preset.

    Active presets will be included in scheduled scraper runs.
    """
    preset = await scraper_preset_repository.toggle_active(db, preset_id)
    if not preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found",
        )
    await db.commit()
    return ScraperPresetResponse.model_validate(preset)


# ============================================================================
# Schedule Settings Endpoints
# ============================================================================


@router.get("/scraper/schedule", response_model=ScheduleSettingsResponse)
async def get_schedule_settings(
    db: AsyncSession = Depends(get_db_session),
) -> ScheduleSettingsResponse:
    """
    Get the global schedule settings.

    Returns the current schedule configuration for automated scraper runs.
    """
    settings = await schedule_settings_repository.get(db)
    return ScheduleSettingsResponse.model_validate(settings)


@router.patch("/scraper/schedule", response_model=ScheduleSettingsResponse)
async def update_schedule_settings(
    request: ScheduleSettingsUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> ScheduleSettingsResponse:
    """
    Update the global schedule settings.

    When settings are changed, the scheduler will be reconfigured
    to use the new schedule.
    """
    settings = await schedule_settings_repository.update(
        db,
        is_enabled=request.is_enabled,
        schedule_type=request.schedule_type,
        schedule_hour=request.schedule_hour,
        schedule_minute=request.schedule_minute,
        schedule_day_of_week=request.schedule_day_of_week,
        schedule_timezone=request.schedule_timezone,
    )
    await db.commit()

    # Reconfigure the scheduler with new settings
    scheduler = get_scheduler_service()
    await scheduler.reconfigure_from_db()

    # Update next_run_at based on new schedule
    next_run = scheduler.get_next_run_time()
    if next_run:
        await schedule_settings_repository.update_next_run(db, next_run)
        await db.commit()
        # Refresh to get updated next_run_at
        settings = await schedule_settings_repository.get(db)

    return ScheduleSettingsResponse.model_validate(settings)


@router.post("/scraper/schedule/toggle", response_model=ScheduleSettingsResponse)
async def toggle_schedule(
    db: AsyncSession = Depends(get_db_session),
) -> ScheduleSettingsResponse:
    """
    Toggle the global schedule enabled status.

    When enabled, the scheduler will run all active presets according
    to the configured schedule.
    """
    settings = await schedule_settings_repository.toggle_enabled(db)
    await db.commit()

    # Reconfigure the scheduler
    scheduler = get_scheduler_service()
    await scheduler.reconfigure_from_db()

    # Update next_run_at based on new state
    next_run = scheduler.get_next_run_time()
    await schedule_settings_repository.update_next_run(db, next_run)
    await db.commit()
    # Refresh to get updated next_run_at
    settings = await schedule_settings_repository.get(db)

    return ScheduleSettingsResponse.model_validate(settings)


# ============================================================================
# Scraper Request Endpoints (User-submitted job URL requests)
# ============================================================================


@router.get("/scraper-requests", response_model=ScraperRequestAdminListResponse)
async def list_scraper_requests(
    status: RequestStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
) -> ScraperRequestAdminListResponse:
    """
    List all scraper requests (admin only).

    Returns all user-submitted requests with optional status filtering.
    """
    requests, total = await scraper_request_repository.list_all(
        db, status=status, limit=limit, offset=offset
    )
    return ScraperRequestAdminListResponse(
        requests=[
            ScraperRequestAdminResponse(
                **ScraperRequestResponse.model_validate(r).model_dump(),
                user_id=r.user_id,
                user_email=r.user.email,
                reviewed_by=r.reviewed_by,
                reviewer_email=r.reviewer.email if r.reviewer else None,
            )
            for r in requests
        ],
        total=total,
    )


@router.post("/scraper-requests/{request_id}/approve", response_model=ScraperRequestAdminResponse)
async def approve_scraper_request(
    request_id: int,
    data: ScraperRequestApproveRequest,
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin),
) -> ScraperRequestAdminResponse:
    """
    Approve a scraper request and optionally create a preset.

    When approved with create_preset=True (default), a new scraper
    preset will be created using the URL from the request.
    """
    request = await scraper_request_repository.get_with_user(db, request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    if request.status != RequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request already processed",
        )

    preset_id = None
    if data.create_preset:
        preset = await scraper_preset_repository.create(
            db,
            name=data.preset_name or request.name or f"Request #{request.id}",
            url=request.url,
            count=data.preset_count,
            is_active=data.preset_is_active,
        )
        preset_id = preset.id

    updated = await scraper_request_repository.approve(
        db,
        request_id=request_id,
        admin_id=admin_user.id,
        preset_id=preset_id,
        admin_notes=data.admin_notes,
    )
    await db.commit()
    await db.refresh(updated, ["user", "reviewer"])

    return ScraperRequestAdminResponse(
        **ScraperRequestResponse.model_validate(updated).model_dump(),
        user_id=updated.user_id,
        user_email=updated.user.email,
        reviewed_by=updated.reviewed_by,
        reviewer_email=updated.reviewer.email if updated.reviewer else None,
    )


@router.post("/scraper-requests/{request_id}/reject", response_model=ScraperRequestAdminResponse)
async def reject_scraper_request(
    request_id: int,
    data: ScraperRequestRejectRequest,
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin),
) -> ScraperRequestAdminResponse:
    """
    Reject a scraper request with notes.

    The rejection reason will be visible to the user who submitted
    the request.
    """
    request = await scraper_request_repository.get_with_user(db, request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    if request.status != RequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request already processed",
        )

    updated = await scraper_request_repository.reject(
        db,
        request_id=request_id,
        admin_id=admin_user.id,
        admin_notes=data.admin_notes,
    )
    await db.commit()
    await db.refresh(updated, ["user", "reviewer"])

    return ScraperRequestAdminResponse(
        **ScraperRequestResponse.model_validate(updated).model_dump(),
        user_id=updated.user_id,
        user_email=updated.user.email,
        reviewed_by=updated.reviewed_by,
        reviewer_email=updated.reviewer.email if updated.reviewer else None,
    )
