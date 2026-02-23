"""
CRUD operations for ScraperPreset model.

Provides repository-style operations for managing scraper presets.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scraper_preset import ScraperPreset


class ScraperPresetRepository:
    """Repository for ScraperPreset operations."""

    async def create(
        self,
        db: AsyncSession,
        *,
        name: str,
        url: str,
        count: int = 100,
        is_active: bool = True,
    ) -> ScraperPreset:
        """
        Create a new scraper preset.

        Args:
            db: Database session
            name: Name for the preset
            url: LinkedIn job search URL
            count: Max jobs to scrape (1-500)
            is_active: Whether the preset is active

        Returns:
            Created ScraperPreset record
        """
        db_obj = ScraperPreset(
            name=name,
            url=url,
            count=count,
            is_active=is_active,
        )

        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get(self, db: AsyncSession, preset_id: int) -> ScraperPreset | None:
        """Get a preset by ID."""
        result = await db.execute(
            select(ScraperPreset).where(ScraperPreset.id == preset_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self, db: AsyncSession) -> list[ScraperPreset]:
        """List all presets, ordered by name."""
        result = await db.execute(
            select(ScraperPreset).order_by(ScraperPreset.name.asc())
        )
        return list(result.scalars().all())

    async def list_active(self, db: AsyncSession) -> list[ScraperPreset]:
        """List all active presets."""
        result = await db.execute(
            select(ScraperPreset)
            .where(ScraperPreset.is_active == True)
            .order_by(ScraperPreset.name.asc())
        )
        return list(result.scalars().all())

    async def update(
        self,
        db: AsyncSession,
        *,
        preset_id: int,
        name: str | None = None,
        url: str | None = None,
        count: int | None = None,
        is_active: bool | None = None,
    ) -> ScraperPreset | None:
        """
        Update a preset.

        Args:
            db: Database session
            preset_id: ID of the preset to update
            name: New name (if provided)
            url: New URL (if provided)
            count: New count (if provided)
            is_active: New active status (if provided)

        Returns:
            Updated ScraperPreset or None if not found
        """
        preset = await self.get(db, preset_id)
        if not preset:
            return None

        if name is not None:
            preset.name = name
        if url is not None:
            preset.url = url
        if count is not None:
            preset.count = count
        if is_active is not None:
            preset.is_active = is_active

        await db.flush()
        await db.refresh(preset)
        return preset

    async def toggle_active(
        self,
        db: AsyncSession,
        preset_id: int,
    ) -> ScraperPreset | None:
        """
        Toggle the active status of a preset.

        Args:
            db: Database session
            preset_id: ID of the preset to toggle

        Returns:
            Updated ScraperPreset or None if not found
        """
        preset = await self.get(db, preset_id)
        if not preset:
            return None

        preset.is_active = not preset.is_active
        await db.flush()
        await db.refresh(preset)
        return preset

    async def delete(self, db: AsyncSession, preset_id: int) -> bool:
        """
        Delete a preset.

        Args:
            db: Database session
            preset_id: ID of the preset to delete

        Returns:
            True if deleted, False if not found
        """
        preset = await self.get(db, preset_id)
        if not preset:
            return False

        await db.delete(preset)
        await db.flush()
        return True


# Module-level singleton
scraper_preset_repository = ScraperPresetRepository()
