"""
Audit Logging Service

Provides audit logging functionality for tracking user actions.
Records all CRUD operations, authentication events, and data access.

Usage:
    from app.services.audit import audit_service

    # Log a read operation
    await audit_service.log_read(
        db=db,
        user_id=current_user.id,
        resource_type="resume",
        resource_id=resume_id,
        request=request,
    )

    # Log a create operation
    await audit_service.log_create(
        db=db,
        user_id=current_user.id,
        resource_type="block",
        resource_id=new_block.id,
        new_value=block_data,
        request=request,
    )
"""

from datetime import datetime, timezone
from typing import Any
from functools import lru_cache

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.core.config import get_settings


class AuditAction:
    """Constants for audit action types."""

    # CRUD actions
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"

    # Auth actions
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    TOKEN_REFRESH = "token_refresh"
    PASSWORD_CHANGE = "password_change"

    # Special actions
    EXPORT = "export"
    IMPORT = "import"
    SEARCH = "search"
    AI_GENERATE = "ai_generate"


class AuditService:
    """
    Service for recording and querying audit logs.

    All logging methods are fire-and-forget to avoid blocking the main request.
    Failures in audit logging should not affect the primary operation.
    """

    def __init__(self):
        self.settings = get_settings()

    @property
    def enabled(self) -> bool:
        """Check if audit logging is enabled."""
        return self.settings.audit_log_enabled

    async def log(
        self,
        db: AsyncSession,
        action: str,
        user_id: int | None = None,
        resource_type: str | None = None,
        resource_id: int | None = None,
        details: dict[str, Any] | None = None,
        old_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        status: str = "success",
        error_message: str | None = None,
        request: Request | None = None,
    ) -> AuditLog | None:
        """
        Create an audit log entry.

        Args:
            db: Database session
            action: Action type (create, read, update, delete, etc.)
            user_id: ID of user performing action
            resource_type: Type of resource (resume, job, block, etc.)
            resource_id: ID of affected resource
            details: Additional context data
            old_value: State before change (for updates)
            new_value: State after change (for creates/updates)
            status: success, failure, or denied
            error_message: Error details if failed
            request: FastAPI request for extracting metadata

        Returns:
            Created AuditLog entry or None if logging disabled/failed
        """
        if not self.enabled:
            return None

        try:
            # Extract request metadata
            ip_address = None
            user_agent = None
            endpoint = None
            http_method = None

            if request:
                # Get IP address
                forwarded_for = request.headers.get("X-Forwarded-For")
                if forwarded_for:
                    ip_address = forwarded_for.split(",")[0].strip()
                elif request.client:
                    ip_address = request.client.host

                user_agent = request.headers.get("User-Agent", "")[:500]
                endpoint = str(request.url.path)
                http_method = request.method

            # Create audit log entry
            audit_log = AuditLog(
                user_id=user_id,
                ip_address=ip_address,
                user_agent=user_agent,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                endpoint=endpoint,
                http_method=http_method,
                details=details,
                old_value=old_value,
                new_value=new_value,
                status=status,
                error_message=error_message,
            )

            db.add(audit_log)
            await db.commit()
            await db.refresh(audit_log)

            return audit_log

        except Exception:
            # Silently fail - audit logging should never break the main operation
            await db.rollback()
            return None

    # Convenience methods for common actions

    async def log_create(
        self,
        db: AsyncSession,
        user_id: int,
        resource_type: str,
        resource_id: int,
        new_value: dict[str, Any] | None = None,
        request: Request | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog | None:
        """Log a resource creation."""
        return await self.log(
            db=db,
            action=AuditAction.CREATE,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            new_value=new_value,
            request=request,
            details=details,
        )

    async def log_read(
        self,
        db: AsyncSession,
        user_id: int,
        resource_type: str,
        resource_id: int | None = None,
        request: Request | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog | None:
        """Log a resource read/access."""
        return await self.log(
            db=db,
            action=AuditAction.READ,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            request=request,
            details=details,
        )

    async def log_update(
        self,
        db: AsyncSession,
        user_id: int,
        resource_type: str,
        resource_id: int,
        old_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        request: Request | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog | None:
        """Log a resource update."""
        return await self.log(
            db=db,
            action=AuditAction.UPDATE,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            request=request,
            details=details,
        )

    async def log_delete(
        self,
        db: AsyncSession,
        user_id: int,
        resource_type: str,
        resource_id: int,
        old_value: dict[str, Any] | None = None,
        request: Request | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog | None:
        """Log a resource deletion."""
        return await self.log(
            db=db,
            action=AuditAction.DELETE,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            request=request,
            details=details,
        )

    async def log_login(
        self,
        db: AsyncSession,
        user_id: int | None = None,
        success: bool = True,
        request: Request | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog | None:
        """Log a login attempt."""
        return await self.log(
            db=db,
            action=AuditAction.LOGIN if success else AuditAction.LOGIN_FAILED,
            user_id=user_id,
            status="success" if success else "failure",
            request=request,
            details=details,
        )

    async def log_export(
        self,
        db: AsyncSession,
        user_id: int,
        resource_type: str,
        resource_id: int,
        export_format: str,
        request: Request | None = None,
    ) -> AuditLog | None:
        """Log an export operation."""
        return await self.log(
            db=db,
            action=AuditAction.EXPORT,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            details={"format": export_format},
            request=request,
        )

    async def log_ai_operation(
        self,
        db: AsyncSession,
        user_id: int,
        operation: str,
        resource_type: str | None = None,
        resource_id: int | None = None,
        request: Request | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog | None:
        """Log an AI operation (parsing, tailoring, etc.)."""
        return await self.log(
            db=db,
            action=AuditAction.AI_GENERATE,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            details={"operation": operation, **(details or {})},
            request=request,
        )

    # Query methods

    async def get_user_activity(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 100,
        offset: int = 0,
        action: str | None = None,
        resource_type: str | None = None,
        since: datetime | None = None,
    ) -> list[AuditLog]:
        """
        Get audit log entries for a user.

        Args:
            db: Database session
            user_id: User ID to query
            limit: Maximum results
            offset: Pagination offset
            action: Filter by action type
            resource_type: Filter by resource type
            since: Only entries after this time

        Returns:
            List of audit log entries
        """
        query = select(AuditLog).where(AuditLog.user_id == user_id)

        if action:
            query = query.where(AuditLog.action == action)

        if resource_type:
            query = query.where(AuditLog.resource_type == resource_type)

        if since:
            query = query.where(AuditLog.created_at >= since)

        query = query.order_by(AuditLog.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_resource_history(
        self,
        db: AsyncSession,
        resource_type: str,
        resource_id: int,
        limit: int = 50,
    ) -> list[AuditLog]:
        """
        Get audit history for a specific resource.

        Args:
            db: Database session
            resource_type: Type of resource
            resource_id: ID of resource
            limit: Maximum results

        Returns:
            List of audit log entries for the resource
        """
        query = (
            select(AuditLog)
            .where(AuditLog.resource_type == resource_type)
            .where(AuditLog.resource_id == resource_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )

        result = await db.execute(query)
        return list(result.scalars().all())


@lru_cache
def get_audit_service() -> AuditService:
    """Get a singleton audit service instance."""
    return AuditService()


# Convenience export
audit_service = get_audit_service()
