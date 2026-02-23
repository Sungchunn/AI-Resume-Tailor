"""
CRUD operations for ScraperScheduleSettings model.

Provides repository-style operations for managing the global
schedule settings (singleton pattern).
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scraper_schedule_settings import ScraperScheduleSettings


class ScheduleSettingsRepository:
    """Repository for ScraperScheduleSettings operations."""

    async def get(self, db: AsyncSession) -> ScraperScheduleSettings:
        """
        Get the singleton schedule settings.

        Creates default settings if none exist.

        Returns:
            ScraperScheduleSettings record
        """
        result = await db.execute(
            select(ScraperScheduleSettings).where(ScraperScheduleSettings.id == 1)
        )
        settings = result.scalar_one_or_none()

        if not settings:
            # Create default settings
            settings = ScraperScheduleSettings(
                id=1,
                is_enabled=False,
                schedule_type="daily",
                schedule_hour=2,
                schedule_minute=0,
                schedule_day_of_week=None,
            )
            db.add(settings)
            await db.flush()
            await db.refresh(settings)

        return settings

    async def update(
        self,
        db: AsyncSession,
        *,
        is_enabled: bool | None = None,
        schedule_type: str | None = None,
        schedule_hour: int | None = None,
        schedule_minute: int | None = None,
        schedule_day_of_week: int | None = None,
    ) -> ScraperScheduleSettings:
        """
        Update schedule settings.

        Args:
            db: Database session
            is_enabled: Global on/off toggle
            schedule_type: "daily" or "weekly"
            schedule_hour: Hour of day (0-23 UTC)
            schedule_minute: Minute of hour (0-59)
            schedule_day_of_week: Day of week (0-6, Mon=0) for weekly

        Returns:
            Updated ScraperScheduleSettings
        """
        settings = await self.get(db)

        if is_enabled is not None:
            settings.is_enabled = is_enabled
        if schedule_type is not None:
            settings.schedule_type = schedule_type
        if schedule_hour is not None:
            settings.schedule_hour = schedule_hour
        if schedule_minute is not None:
            settings.schedule_minute = schedule_minute
        if schedule_day_of_week is not None:
            settings.schedule_day_of_week = schedule_day_of_week
        # Handle explicit None for day_of_week when switching to daily
        elif schedule_type == "daily":
            settings.schedule_day_of_week = None

        await db.flush()
        await db.refresh(settings)
        return settings

    async def toggle_enabled(self, db: AsyncSession) -> ScraperScheduleSettings:
        """
        Toggle the global enabled status.

        Returns:
            Updated ScraperScheduleSettings
        """
        settings = await self.get(db)
        settings.is_enabled = not settings.is_enabled
        await db.flush()
        await db.refresh(settings)
        return settings

    async def update_last_run(
        self,
        db: AsyncSession,
        *,
        last_run_at: datetime,
        next_run_at: datetime | None = None,
    ) -> ScraperScheduleSettings:
        """
        Update the last run timestamp and optionally the next run time.

        Args:
            db: Database session
            last_run_at: When the last run completed
            next_run_at: When the next run is scheduled

        Returns:
            Updated ScraperScheduleSettings
        """
        settings = await self.get(db)
        settings.last_run_at = last_run_at
        if next_run_at is not None:
            settings.next_run_at = next_run_at
        await db.flush()
        await db.refresh(settings)
        return settings

    async def update_next_run(
        self,
        db: AsyncSession,
        next_run_at: datetime | None,
    ) -> ScraperScheduleSettings:
        """
        Update the next scheduled run time.

        Args:
            db: Database session
            next_run_at: When the next run is scheduled (or None)

        Returns:
            Updated ScraperScheduleSettings
        """
        settings = await self.get(db)
        settings.next_run_at = next_run_at
        await db.flush()
        await db.refresh(settings)
        return settings


# Module-level singleton
schedule_settings_repository = ScheduleSettingsRepository()
