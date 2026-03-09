"""
CRUD operations for ScraperRequest model.

Provides repository-style operations for managing user-submitted
scraper requests.
"""

from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scraper_request import ScraperRequest, RequestStatus


class ScraperRequestRepository:
    """Repository for ScraperRequest operations."""

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        url: str,
        name: str | None = None,
        reason: str | None = None,
    ) -> ScraperRequest:
        """
        Create a new scraper request.

        Args:
            db: Database session
            user_id: ID of the requesting user
            url: LinkedIn job search URL
            name: User-suggested preset name
            reason: Why user wants these jobs

        Returns:
            Created ScraperRequest record
        """
        db_obj = ScraperRequest(
            user_id=user_id,
            url=url,
            name=name,
            reason=reason,
            status=RequestStatus.PENDING,
        )

        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get(self, db: AsyncSession, request_id: int) -> ScraperRequest | None:
        """Get a request by ID."""
        result = await db.execute(
            select(ScraperRequest).where(ScraperRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def get_with_user(
        self, db: AsyncSession, request_id: int
    ) -> ScraperRequest | None:
        """Get a request by ID with user relationships loaded."""
        result = await db.execute(
            select(ScraperRequest)
            .options(
                selectinload(ScraperRequest.user),
                selectinload(ScraperRequest.reviewer),
            )
            .where(ScraperRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ScraperRequest], int]:
        """
        List requests submitted by a specific user.

        Args:
            db: Database session
            user_id: ID of the user
            limit: Max records to return
            offset: Number of records to skip

        Returns:
            Tuple of (list of requests, total count)
        """
        # Count total
        count_result = await db.execute(
            select(func.count(ScraperRequest.id)).where(
                ScraperRequest.user_id == user_id
            )
        )
        total = count_result.scalar_one()

        # Get paginated list
        result = await db.execute(
            select(ScraperRequest)
            .where(ScraperRequest.user_id == user_id)
            .order_by(ScraperRequest.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all()), total

    async def list_all(
        self,
        db: AsyncSession,
        status: RequestStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ScraperRequest], int]:
        """
        List all requests with optional status filter.

        Args:
            db: Database session
            status: Filter by status (optional)
            limit: Max records to return
            offset: Number of records to skip

        Returns:
            Tuple of (list of requests, total count)
        """
        base_query = select(ScraperRequest)
        count_query = select(func.count(ScraperRequest.id))

        if status:
            base_query = base_query.where(ScraperRequest.status == status)
            count_query = count_query.where(ScraperRequest.status == status)

        # Count total
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()

        # Get paginated list with user relationships
        result = await db.execute(
            base_query.options(
                selectinload(ScraperRequest.user),
                selectinload(ScraperRequest.reviewer),
            )
            .order_by(ScraperRequest.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all()), total

    async def approve(
        self,
        db: AsyncSession,
        *,
        request_id: int,
        admin_id: int,
        preset_id: int | None = None,
        admin_notes: str | None = None,
    ) -> ScraperRequest | None:
        """
        Approve a pending request.

        Uses SELECT FOR UPDATE to prevent race conditions when multiple
        admins try to approve/reject the same request concurrently.

        Args:
            db: Database session
            request_id: ID of the request to approve
            admin_id: ID of the admin approving
            preset_id: ID of the created preset (if any)
            admin_notes: Optional approval notes

        Returns:
            Updated ScraperRequest or None if not found/not pending
        """
        # Use SELECT FOR UPDATE to prevent concurrent modifications
        stmt = (
            select(ScraperRequest)
            .where(ScraperRequest.id == request_id)
            .with_for_update()
        )
        result = await db.execute(stmt)
        request = result.scalar_one_or_none()

        if not request or request.status != RequestStatus.PENDING:
            return None

        request.status = RequestStatus.APPROVED
        request.reviewed_by = admin_id
        request.reviewed_at = datetime.now(timezone.utc)
        request.preset_id = preset_id
        request.admin_notes = admin_notes

        await db.flush()
        await db.refresh(request)
        return request

    async def reject(
        self,
        db: AsyncSession,
        *,
        request_id: int,
        admin_id: int,
        admin_notes: str,
    ) -> ScraperRequest | None:
        """
        Reject a pending request.

        Uses SELECT FOR UPDATE to prevent race conditions when multiple
        admins try to approve/reject the same request concurrently.

        Args:
            db: Database session
            request_id: ID of the request to reject
            admin_id: ID of the admin rejecting
            admin_notes: Rejection reason (required)

        Returns:
            Updated ScraperRequest or None if not found/not pending
        """
        # Use SELECT FOR UPDATE to prevent concurrent modifications
        stmt = (
            select(ScraperRequest)
            .where(ScraperRequest.id == request_id)
            .with_for_update()
        )
        result = await db.execute(stmt)
        request = result.scalar_one_or_none()

        if not request or request.status != RequestStatus.PENDING:
            return None

        request.status = RequestStatus.REJECTED
        request.reviewed_by = admin_id
        request.reviewed_at = datetime.now(timezone.utc)
        request.admin_notes = admin_notes

        await db.flush()
        await db.refresh(request)
        return request

    async def cancel(
        self,
        db: AsyncSession,
        request_id: int,
        user_id: int,
    ) -> bool:
        """
        Cancel a pending request (user can only cancel their own).

        Args:
            db: Database session
            request_id: ID of the request to cancel
            user_id: ID of the user attempting to cancel

        Returns:
            True if deleted, False if not found/not owner/not pending
        """
        request = await self.get(db, request_id)
        if not request:
            return False
        if request.user_id != user_id:
            return False
        if request.status != RequestStatus.PENDING:
            return False

        await db.delete(request)
        await db.flush()
        return True


# Module-level singleton
scraper_request_repository = ScraperRequestRepository()
