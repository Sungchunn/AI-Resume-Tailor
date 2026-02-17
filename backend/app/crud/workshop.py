"""
Workshop Repository - Data access layer for Workshops.

Implements the IWorkshopRepository protocol for all database operations
related to workshop management.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workshop import Workshop
from app.core.protocols import (
    WorkshopStatus,
    WorkshopData,
    DiffSuggestionData,
)


def _workshop_to_data(workshop: Workshop) -> WorkshopData:
    """Convert Workshop model to WorkshopData TypedDict."""
    return {
        "id": workshop.id,
        "user_id": workshop.user_id,
        "job_title": workshop.job_title,
        "job_company": workshop.job_company,
        "job_description": workshop.job_description,
        "status": workshop.status,
        "pulled_block_ids": workshop.pulled_block_ids or [],
        "pending_diffs": workshop.pending_diffs or [],
        "sections": workshop.sections or {},
        "created_at": workshop.created_at.isoformat() if workshop.created_at else None,
        "updated_at": workshop.updated_at.isoformat() if workshop.updated_at else None,
    }


class WorkshopRepository:
    """
    Repository for Workshop CRUD operations.

    Implements IWorkshopRepository protocol.
    All methods include user_id checks for authorization.
    """

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        job_title: str,
        job_description: str,
        job_company: Optional[str] = None,
    ) -> WorkshopData:
        """Create a new workshop for a job."""
        db_obj = Workshop(
            user_id=user_id,
            job_title=job_title,
            job_description=job_description,
            job_company=job_company,
            status=WorkshopStatus.DRAFT.value,
            sections={},
            pulled_block_ids=[],
            pending_diffs=[],
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return _workshop_to_data(db_obj)

    async def get(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
    ) -> Optional[WorkshopData]:
        """Get workshop by ID with user ownership check."""
        result = await db.execute(
            select(Workshop).where(
                and_(
                    Workshop.id == workshop_id,
                    Workshop.user_id == user_id,
                )
            )
        )
        workshop = result.scalar_one_or_none()
        return _workshop_to_data(workshop) if workshop else None

    async def get_model(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
    ) -> Optional[Workshop]:
        """Get the raw SQLAlchemy model (for internal use)."""
        result = await db.execute(
            select(Workshop).where(
                and_(
                    Workshop.id == workshop_id,
                    Workshop.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        status: Optional[WorkshopStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WorkshopData]:
        """List user's workshops with optional status filter."""
        conditions = [Workshop.user_id == user_id]

        if status is not None:
            status_value = status.value if isinstance(status, WorkshopStatus) else status
            conditions.append(Workshop.status == status_value)

        result = await db.execute(
            select(Workshop)
            .where(and_(*conditions))
            .order_by(Workshop.updated_at.desc().nullsfirst(), Workshop.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        workshops = result.scalars().all()
        return [_workshop_to_data(w) for w in workshops]

    async def count(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        status: Optional[WorkshopStatus] = None,
    ) -> int:
        """Count workshops matching filters."""
        conditions = [Workshop.user_id == user_id]

        if status is not None:
            status_value = status.value if isinstance(status, WorkshopStatus) else status
            conditions.append(Workshop.status == status_value)

        result = await db.execute(
            select(func.count(Workshop.id)).where(and_(*conditions))
        )
        return result.scalar() or 0

    async def update_sections(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
        sections: Dict[str, Any],
    ) -> Optional[WorkshopData]:
        """Update workshop content sections (merge with existing)."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        # Merge new sections with existing
        current_sections = dict(workshop.sections or {})
        current_sections.update(sections)
        workshop.sections = current_sections

        # Auto-transition to in_progress when editing
        if workshop.status == WorkshopStatus.DRAFT.value:
            workshop.status = WorkshopStatus.IN_PROGRESS.value

        db.add(workshop)
        await db.flush()
        await db.refresh(workshop)
        return _workshop_to_data(workshop)

    async def pull_blocks(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
        block_ids: List[int],
    ) -> Optional[WorkshopData]:
        """Pull blocks from Vault into workshop."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        # Add new block IDs, avoiding duplicates
        current_ids = set(workshop.pulled_block_ids or [])
        new_ids = current_ids | set(block_ids)
        workshop.pulled_block_ids = list(new_ids)

        # Auto-transition to in_progress when pulling blocks
        if workshop.status == WorkshopStatus.DRAFT.value:
            workshop.status = WorkshopStatus.IN_PROGRESS.value

        db.add(workshop)
        await db.flush()
        await db.refresh(workshop)
        return _workshop_to_data(workshop)

    async def remove_block(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
        block_id: int,
    ) -> Optional[WorkshopData]:
        """Remove a block from workshop's pulled blocks."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        if workshop.pulled_block_ids and block_id in workshop.pulled_block_ids:
            workshop.pulled_block_ids = [
                bid for bid in workshop.pulled_block_ids if bid != block_id
            ]
            db.add(workshop)
            await db.flush()
            await db.refresh(workshop)

        return _workshop_to_data(workshop)

    async def add_pending_diffs(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
        diffs: List[DiffSuggestionData],
    ) -> Optional[WorkshopData]:
        """Add AI-generated diff suggestions."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        # Append new diffs to existing
        current_diffs = list(workshop.pending_diffs or [])
        current_diffs.extend(diffs)
        workshop.pending_diffs = current_diffs

        db.add(workshop)
        await db.flush()
        await db.refresh(workshop)
        return _workshop_to_data(workshop)

    async def accept_diff(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
        diff_index: int,
    ) -> Optional[WorkshopData]:
        """
        Accept a pending diff and apply it to sections.

        Applies the diff to sections and removes from pending.
        """
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        if not workshop.pending_diffs or diff_index >= len(workshop.pending_diffs):
            return _workshop_to_data(workshop)

        # Get the diff to apply
        diff = workshop.pending_diffs[diff_index]

        # Apply the diff to sections (basic JSON Patch support)
        sections = dict(workshop.sections or {})
        sections = self._apply_diff(sections, diff)
        workshop.sections = sections

        # Remove the diff from pending
        workshop.pending_diffs = (
            workshop.pending_diffs[:diff_index] + workshop.pending_diffs[diff_index + 1:]
        )

        db.add(workshop)
        await db.flush()
        await db.refresh(workshop)
        return _workshop_to_data(workshop)

    async def reject_diff(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
        diff_index: int,
    ) -> Optional[WorkshopData]:
        """Reject a pending diff (remove without applying)."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        if not workshop.pending_diffs or diff_index >= len(workshop.pending_diffs):
            return _workshop_to_data(workshop)

        # Remove the diff without applying
        workshop.pending_diffs = (
            workshop.pending_diffs[:diff_index] + workshop.pending_diffs[diff_index + 1:]
        )

        db.add(workshop)
        await db.flush()
        await db.refresh(workshop)
        return _workshop_to_data(workshop)

    async def update_status(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
        status: WorkshopStatus,
    ) -> Optional[WorkshopData]:
        """Update workshop status."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        status_value = status.value if isinstance(status, WorkshopStatus) else status
        workshop.status = status_value

        if status == WorkshopStatus.EXPORTED:
            workshop.exported_at = datetime.utcnow()

        db.add(workshop)
        await db.flush()
        await db.refresh(workshop)
        return _workshop_to_data(workshop)

    async def delete(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
    ) -> bool:
        """Delete workshop (hard delete)."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return False

        await db.delete(workshop)
        await db.flush()
        return True

    async def update_job_embedding(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
        embedding: List[float],
    ) -> Optional[WorkshopData]:
        """Update workshop's job description embedding."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        workshop.job_embedding = embedding
        db.add(workshop)
        await db.flush()
        await db.refresh(workshop)
        return _workshop_to_data(workshop)

    async def clear_pending_diffs(
        self,
        db: AsyncSession,
        *,
        workshop_id: int,
        user_id: int,
    ) -> Optional[WorkshopData]:
        """Clear all pending diffs from workshop."""
        workshop = await self.get_model(db, workshop_id=workshop_id, user_id=user_id)
        if not workshop:
            return None

        workshop.pending_diffs = []
        db.add(workshop)
        await db.flush()
        await db.refresh(workshop)
        return _workshop_to_data(workshop)

    def _apply_diff(
        self,
        document: Dict[str, Any],
        diff: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Apply a single JSON Patch diff to a document.

        Basic implementation supporting add, replace, and remove operations.
        For more complex operations, use the DiffEngine service.
        """
        result = dict(document)
        operation = diff.get("operation", "replace")
        path = diff.get("path", "")
        value = diff.get("value")

        # Parse JSON Pointer path (e.g., "/summary" or "/experience/0/description")
        if path.startswith("/"):
            path = path[1:]

        parts = path.split("/") if path else []

        if not parts:
            return result

        # Navigate to the parent of the target
        target = result
        for part in parts[:-1]:
            if isinstance(target, dict):
                if part not in target:
                    target[part] = {}
                target = target[part]
            elif isinstance(target, list):
                idx = int(part)
                if idx < len(target):
                    target = target[idx]
                else:
                    return result

        final_key = parts[-1]

        # Apply the operation
        if operation == "add":
            if isinstance(target, dict):
                target[final_key] = value
            elif isinstance(target, list):
                idx = int(final_key) if final_key != "-" else len(target)
                target.insert(idx, value)

        elif operation == "replace":
            if isinstance(target, dict):
                target[final_key] = value
            elif isinstance(target, list):
                idx = int(final_key)
                if idx < len(target):
                    target[idx] = value

        elif operation == "remove":
            if isinstance(target, dict):
                target.pop(final_key, None)
            elif isinstance(target, list):
                idx = int(final_key)
                if idx < len(target):
                    target.pop(idx)

        return result


# Singleton instance
workshop_repository = WorkshopRepository()
