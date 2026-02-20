"""
CRUD operations for ScraperRun model.

Provides repository-style operations for tracking scraper execution history.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scraper_run import ScraperRun
from app.schemas.scraper import ScraperBatchResult


class ScraperRunRepository:
    """Repository for ScraperRun operations."""

    async def create(
        self,
        db: AsyncSession,
        *,
        batch_result: ScraperBatchResult,
        run_type: str = "scheduled",
        triggered_by: str | None = None,
        config_snapshot: dict | None = None,
    ) -> ScraperRun:
        """
        Create a new scraper run record from batch result.

        Args:
            db: Database session
            batch_result: Result from scraper execution
            run_type: Type of run (scheduled, manual)
            triggered_by: Who/what triggered the run
            config_snapshot: Snapshot of scraper configs used

        Returns:
            Created ScraperRun record
        """
        # Serialize region results for JSONB storage
        region_results_json = [
            {
                "region": r.region.value if hasattr(r.region, "value") else r.region,
                "status": r.status,
                "jobs_found": r.jobs_found,
                "jobs_created": r.jobs_created,
                "jobs_updated": r.jobs_updated,
                "errors": r.errors,
                "error_details": r.error_details,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "duration_seconds": r.duration_seconds,
            }
            for r in batch_result.region_results
        ]

        # Collect all error details
        all_errors = []
        for r in batch_result.region_results:
            for err in r.error_details:
                all_errors.append(
                    {
                        "region": r.region.value if hasattr(r.region, "value") else r.region,
                        **err,
                    }
                )

        db_obj = ScraperRun(
            run_type=run_type,
            status=batch_result.status,
            started_at=batch_result.started_at,
            completed_at=batch_result.completed_at,
            duration_seconds=batch_result.duration_seconds,
            total_jobs_found=batch_result.total_jobs_found,
            total_jobs_created=batch_result.total_jobs_created,
            total_jobs_updated=batch_result.total_jobs_updated,
            total_errors=batch_result.total_errors,
            region_results=region_results_json,
            error_details=all_errors if all_errors else None,
            triggered_by=triggered_by,
            config_snapshot=config_snapshot,
        )

        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get_latest(self, db: AsyncSession) -> ScraperRun | None:
        """Get the most recent scraper run."""
        result = await db.execute(
            select(ScraperRun)
            .order_by(ScraperRun.started_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_latest_successful(self, db: AsyncSession) -> ScraperRun | None:
        """Get the most recent successful scraper run."""
        result = await db.execute(
            select(ScraperRun)
            .where(ScraperRun.status.in_(["success", "partial"]))
            .order_by(ScraperRun.started_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_recent(
        self,
        db: AsyncSession,
        *,
        limit: int = 10,
        offset: int = 0,
    ) -> list[ScraperRun]:
        """List recent scraper runs."""
        result = await db.execute(
            select(ScraperRun)
            .order_by(ScraperRun.started_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_by_status(
        self,
        db: AsyncSession,
        *,
        since: datetime | None = None,
    ) -> dict[str, int]:
        """Count runs by status, optionally since a given time."""
        query = select(ScraperRun.status, func.count(ScraperRun.id)).group_by(
            ScraperRun.status
        )

        if since:
            query = query.where(ScraperRun.started_at >= since)

        result = await db.execute(query)
        return {status: count for status, count in result.all()}

    async def get_stats(
        self,
        db: AsyncSession,
        *,
        days: int = 7,
    ) -> dict:
        """
        Get scraper statistics for the last N days.

        Returns:
            Dict with total runs, success rate, avg duration, total jobs
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)

        # Total runs
        total_query = select(func.count(ScraperRun.id)).where(
            ScraperRun.started_at >= since
        )
        total_result = await db.execute(total_query)
        total_runs = total_result.scalar() or 0

        # Successful runs
        success_query = select(func.count(ScraperRun.id)).where(
            ScraperRun.started_at >= since,
            ScraperRun.status.in_(["success", "partial"]),
        )
        success_result = await db.execute(success_query)
        successful_runs = success_result.scalar() or 0

        # Average duration
        avg_query = select(func.avg(ScraperRun.duration_seconds)).where(
            ScraperRun.started_at >= since,
            ScraperRun.duration_seconds.isnot(None),
        )
        avg_result = await db.execute(avg_query)
        avg_duration = avg_result.scalar() or 0

        # Total jobs created
        jobs_query = select(func.sum(ScraperRun.total_jobs_created)).where(
            ScraperRun.started_at >= since
        )
        jobs_result = await db.execute(jobs_query)
        total_jobs_created = jobs_result.scalar() or 0

        return {
            "period_days": days,
            "total_runs": total_runs,
            "successful_runs": successful_runs,
            "success_rate": successful_runs / total_runs if total_runs > 0 else 0,
            "avg_duration_seconds": float(avg_duration),
            "total_jobs_created": total_jobs_created,
        }


# Module-level singleton
scraper_run_repository = ScraperRunRepository()
