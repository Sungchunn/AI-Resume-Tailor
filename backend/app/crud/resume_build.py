"""
ResumeBuild Repository - Data access layer for Resume Builds.

Implements the IResumeBuildRepository protocol for all database operations
related to resume build management.
"""

import copy
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume_build import ResumeBuild
from app.core.protocols import (
    ResumeBuildStatus,
    ResumeBuildData,
    DiffSuggestionData,
)


def _resume_build_to_data(resume_build: ResumeBuild) -> ResumeBuildData:
    """Convert ResumeBuild model to ResumeBuildData TypedDict."""
    return {
        "id": resume_build.id,
        "user_id": resume_build.user_id,
        "job_title": resume_build.job_title,
        "job_company": resume_build.job_company,
        "job_description": resume_build.job_description,
        "status": resume_build.status,
        "pulled_block_ids": resume_build.pulled_block_ids or [],
        "pending_diffs": resume_build.pending_diffs or [],
        "sections": resume_build.sections or {},
        "created_at": resume_build.created_at.isoformat() if resume_build.created_at else None,
        "updated_at": resume_build.updated_at.isoformat() if resume_build.updated_at else None,
    }


class ResumeBuildRepository:
    """
    Repository for ResumeBuild CRUD operations.

    Implements IResumeBuildRepository protocol.
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
    ) -> ResumeBuildData:
        """Create a new resume build for a job."""
        db_obj = ResumeBuild(
            user_id=user_id,
            job_title=job_title,
            job_description=job_description,
            job_company=job_company,
            status=ResumeBuildStatus.DRAFT.value,
            sections={},
            pulled_block_ids=[],
            pending_diffs=[],
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return _resume_build_to_data(db_obj)

    async def get(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
    ) -> Optional[ResumeBuildData]:
        """Get resume build by ID with user ownership check."""
        result = await db.execute(
            select(ResumeBuild).where(
                and_(
                    ResumeBuild.id == resume_build_id,
                    ResumeBuild.user_id == user_id,
                )
            )
        )
        resume_build = result.scalar_one_or_none()
        return _resume_build_to_data(resume_build) if resume_build else None

    async def get_model(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
    ) -> Optional[ResumeBuild]:
        """Get the raw SQLAlchemy model (for internal use)."""
        result = await db.execute(
            select(ResumeBuild).where(
                and_(
                    ResumeBuild.id == resume_build_id,
                    ResumeBuild.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        status: Optional[ResumeBuildStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ResumeBuildData]:
        """List user's resume builds with optional status filter."""
        conditions = [ResumeBuild.user_id == user_id]

        if status is not None:
            status_value = status.value if isinstance(status, ResumeBuildStatus) else status
            conditions.append(ResumeBuild.status == status_value)

        result = await db.execute(
            select(ResumeBuild)
            .where(and_(*conditions))
            .order_by(ResumeBuild.updated_at.desc().nullsfirst(), ResumeBuild.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        resume_builds = result.scalars().all()
        return [_resume_build_to_data(rb) for rb in resume_builds]

    async def count(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        status: Optional[ResumeBuildStatus] = None,
    ) -> int:
        """Count resume builds matching filters."""
        conditions = [ResumeBuild.user_id == user_id]

        if status is not None:
            status_value = status.value if isinstance(status, ResumeBuildStatus) else status
            conditions.append(ResumeBuild.status == status_value)

        result = await db.execute(
            select(func.count(ResumeBuild.id)).where(and_(*conditions))
        )
        return result.scalar() or 0

    async def update_sections(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
        sections: Dict[str, Any],
    ) -> Optional[ResumeBuildData]:
        """Update resume build content sections (merge with existing)."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        # Merge new sections with existing
        current_sections = dict(resume_build.sections or {})
        current_sections.update(sections)
        resume_build.sections = current_sections

        # Auto-transition to in_progress when editing
        if resume_build.status == ResumeBuildStatus.DRAFT.value:
            resume_build.status = ResumeBuildStatus.IN_PROGRESS.value

        db.add(resume_build)
        await db.flush()
        await db.refresh(resume_build)
        return _resume_build_to_data(resume_build)

    async def pull_blocks(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
        block_ids: List[int],
    ) -> Optional[ResumeBuildData]:
        """Pull blocks from Vault into resume build."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        # Add new block IDs, avoiding duplicates
        current_ids = set(resume_build.pulled_block_ids or [])
        new_ids = current_ids | set(block_ids)
        resume_build.pulled_block_ids = list(new_ids)

        # Auto-transition to in_progress when pulling blocks
        if resume_build.status == ResumeBuildStatus.DRAFT.value:
            resume_build.status = ResumeBuildStatus.IN_PROGRESS.value

        db.add(resume_build)
        await db.flush()
        await db.refresh(resume_build)
        return _resume_build_to_data(resume_build)

    async def remove_block(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
        block_id: int,
    ) -> Optional[ResumeBuildData]:
        """Remove a block from resume build's pulled blocks."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        if resume_build.pulled_block_ids and block_id in resume_build.pulled_block_ids:
            resume_build.pulled_block_ids = [
                bid for bid in resume_build.pulled_block_ids if bid != block_id
            ]
            db.add(resume_build)
            await db.flush()
            await db.refresh(resume_build)

        return _resume_build_to_data(resume_build)

    async def add_pending_diffs(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
        diffs: List[DiffSuggestionData],
    ) -> Optional[ResumeBuildData]:
        """Add AI-generated diff suggestions."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        # Append new diffs to existing
        current_diffs = list(resume_build.pending_diffs or [])
        current_diffs.extend(diffs)
        resume_build.pending_diffs = current_diffs

        db.add(resume_build)
        await db.flush()
        await db.refresh(resume_build)
        return _resume_build_to_data(resume_build)

    async def accept_diff(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
        diff_index: int,
    ) -> Optional[ResumeBuildData]:
        """
        Accept a pending diff and apply it to sections.

        Applies the diff to sections and removes from pending.
        """
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        if not resume_build.pending_diffs or diff_index >= len(resume_build.pending_diffs):
            return _resume_build_to_data(resume_build)

        # Get the diff to apply
        diff = resume_build.pending_diffs[diff_index]

        # Apply the diff to sections (basic JSON Patch support)
        sections = dict(resume_build.sections or {})
        sections = self._apply_diff(sections, diff)
        resume_build.sections = sections

        # Remove the diff from pending
        resume_build.pending_diffs = (
            resume_build.pending_diffs[:diff_index] + resume_build.pending_diffs[diff_index + 1:]
        )

        db.add(resume_build)
        await db.flush()
        await db.refresh(resume_build)
        return _resume_build_to_data(resume_build)

    async def reject_diff(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
        diff_index: int,
    ) -> Optional[ResumeBuildData]:
        """Reject a pending diff (remove without applying)."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        if not resume_build.pending_diffs or diff_index >= len(resume_build.pending_diffs):
            return _resume_build_to_data(resume_build)

        # Remove the diff without applying
        resume_build.pending_diffs = (
            resume_build.pending_diffs[:diff_index] + resume_build.pending_diffs[diff_index + 1:]
        )

        db.add(resume_build)
        await db.flush()
        await db.refresh(resume_build)
        return _resume_build_to_data(resume_build)

    async def update_status(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
        status: ResumeBuildStatus,
    ) -> Optional[ResumeBuildData]:
        """Update resume build status."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        status_value = status.value if isinstance(status, ResumeBuildStatus) else status
        resume_build.status = status_value

        if status == ResumeBuildStatus.EXPORTED:
            resume_build.exported_at = datetime.utcnow()

        db.add(resume_build)
        await db.flush()
        await db.refresh(resume_build)
        return _resume_build_to_data(resume_build)

    async def delete(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
    ) -> bool:
        """Delete resume build (hard delete)."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return False

        await db.delete(resume_build)
        await db.flush()
        return True

    async def update_job_embedding(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
        embedding: List[float],
    ) -> Optional[ResumeBuildData]:
        """Update resume build's job description embedding."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        resume_build.job_embedding = embedding
        db.add(resume_build)
        await db.flush()
        await db.refresh(resume_build)
        return _resume_build_to_data(resume_build)

    async def clear_pending_diffs(
        self,
        db: AsyncSession,
        *,
        resume_build_id: int,
        user_id: int,
    ) -> Optional[ResumeBuildData]:
        """Clear all pending diffs from resume build."""
        resume_build = await self.get_model(db, resume_build_id=resume_build_id, user_id=user_id)
        if not resume_build:
            return None

        resume_build.pending_diffs = []
        db.add(resume_build)
        await db.flush()
        await db.refresh(resume_build)
        return _resume_build_to_data(resume_build)

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
        result = copy.deepcopy(document)
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
resume_build_repository = ResumeBuildRepository()

# Backward compatibility alias
workshop_repository = resume_build_repository
