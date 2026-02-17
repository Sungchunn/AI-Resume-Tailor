"""
Audit Log Model

Stores audit records for all data access and modification operations.
Used for security compliance, debugging, and analytics.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Index
from sqlalchemy.sql import func

from app.db.session import Base


class AuditLog(Base):
    """
    Audit log entry for tracking user actions.

    Captures:
    - Who performed the action (user_id)
    - What action was performed (action type)
    - Which resource was affected (resource_type, resource_id)
    - Request context (IP, user agent, endpoint)
    - Before/after state for mutations
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Who
    user_id = Column(Integer, nullable=True, index=True)  # Null for anonymous
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(String(500), nullable=True)

    # What
    action = Column(String(50), nullable=False, index=True)  # create, read, update, delete, login, export
    resource_type = Column(String(50), nullable=True, index=True)  # resume, job, block, workshop
    resource_id = Column(Integer, nullable=True)  # ID of affected resource

    # Where
    endpoint = Column(String(255), nullable=True)  # API endpoint path
    http_method = Column(String(10), nullable=True)  # GET, POST, PUT, DELETE

    # Details
    details = Column(JSON, nullable=True)  # Additional context
    old_value = Column(JSON, nullable=True)  # State before change (for updates)
    new_value = Column(JSON, nullable=True)  # State after change (for creates/updates)

    # Status
    status = Column(String(20), nullable=False, default="success")  # success, failure, denied
    error_message = Column(Text, nullable=True)  # Error details if failed

    # When
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Indexes for common query patterns
    __table_args__ = (
        Index("ix_audit_logs_user_resource", "user_id", "resource_type"),
        Index("ix_audit_logs_resource_id", "resource_type", "resource_id"),
        Index("ix_audit_logs_action_time", "action", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog(id={self.id}, user_id={self.user_id}, "
            f"action={self.action}, resource={self.resource_type}:{self.resource_id})>"
        )
