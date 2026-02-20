"""
Admin API endpoints for scraper management.

Provides endpoints for monitoring and controlling the background
scraper job that fetches LinkedIn job listings.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.crud.scraper_run import scraper_run_repository
from app.models.job_listing import JobListing
from app.schemas.scraper import (
    ScraperBatchResult,
    ScraperStatsResponse,
    ScraperStatusResponse,
)
from app.services.scraping.scheduler import get_scheduler_service

router = APIRouter()


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
    Manually trigger the scraper job.

    This endpoint allows manual triggering of the scraper for
    testing or on-demand data refresh. The scraper will run
    for all configured regions.

    Note: This is a long-running operation that may take several
    minutes depending on the number of regions and jobs to fetch.

    Uses distributed locking to prevent duplicate runs if another
    instance is already running the scraper.
    """
    scheduler = get_scheduler_service()

    if not scheduler.settings.scraper_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scraper is disabled via configuration",
        )

    result = await scheduler.trigger_scraper_now(triggered_by="api_manual")

    # Check if job was skipped due to lock
    if result.status == "skipped":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Scraper is already running on another instance",
        )

    return result


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
