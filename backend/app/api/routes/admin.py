"""
Admin API endpoints for scraper management.

Provides endpoints for monitoring and controlling the background
scraper job that fetches LinkedIn job listings.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.models.job_listing import JobListing
from app.schemas.scraper import (
    ScraperBatchResult,
    ScraperStatsResponse,
    ScraperStatusResponse,
)
from app.services.scheduler import get_scheduler_service

router = APIRouter()


@router.get("/scraper/status", response_model=ScraperStatusResponse)
async def get_scraper_status() -> ScraperStatusResponse:
    """
    Get scheduler status and next run time.

    Returns information about whether the scheduler is running,
    when the next scraper run is scheduled, and results from
    the last run if available.
    """
    scheduler = get_scheduler_service()
    status = scheduler.get_status()

    return ScraperStatusResponse(
        scheduler_running=status["scheduler_running"],
        scraper_enabled=status["scraper_enabled"],
        next_run_time=status["next_run_time"],
        last_run_time=status["last_run_time"],
        last_run_result=status["last_run_result"],
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
    """
    scheduler = get_scheduler_service()

    if not scheduler.settings.scraper_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scraper is disabled via configuration",
        )

    result = await scheduler.trigger_scraper_now()
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
    region_query = (
        select(JobListing.region, func.count(JobListing.id))
        .group_by(JobListing.region)
    )
    region_result = await db.execute(region_query)
    listings_by_region = {
        region or "unknown": count
        for region, count in region_result.all()
    }

    # Count by active status
    status_query = (
        select(JobListing.is_active, func.count(JobListing.id))
        .group_by(JobListing.is_active)
    )
    status_result = await db.execute(status_query)
    listings_by_status = {
        "active" if is_active else "inactive": count
        for is_active, count in status_result.all()
    }

    # Last 24 hours count
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_24h_query = select(func.count(JobListing.id)).where(
        JobListing.created_at >= last_24h
    )
    last_24h_result = await db.execute(last_24h_query)
    last_24h_created = last_24h_result.scalar() or 0

    # Last 7 days count
    last_7d = now - timedelta(days=7)
    last_7d_query = select(func.count(JobListing.id)).where(
        JobListing.created_at >= last_7d
    )
    last_7d_result = await db.execute(last_7d_query)
    last_7d_created = last_7d_result.scalar() or 0

    return ScraperStatsResponse(
        total_listings=total_listings,
        listings_by_region=listings_by_region,
        listings_by_status=listings_by_status,
        last_24h_created=last_24h_created,
        last_7d_created=last_7d_created,
    )
