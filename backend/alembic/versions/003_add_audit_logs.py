"""Add audit_logs table for security and compliance tracking

Revision ID: 003
Revises: 002
Create Date: 2024-01-20 00:00:00.000000

This migration adds the audit_logs table for:
- Security compliance
- User activity tracking
- Debugging and analytics
- Data access logging
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        # Who
        sa.Column("user_id", sa.Integer(), nullable=True),  # Null for anonymous
        sa.Column("ip_address", sa.String(45), nullable=True),  # IPv4 or IPv6
        sa.Column("user_agent", sa.String(500), nullable=True),
        # What
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        # Where
        sa.Column("endpoint", sa.String(255), nullable=True),
        sa.Column("http_method", sa.String(10), nullable=True),
        # Details
        sa.Column("details", JSONB(), nullable=True),
        sa.Column("old_value", JSONB(), nullable=True),
        sa.Column("new_value", JSONB(), nullable=True),
        # Status
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("error_message", sa.Text(), nullable=True),
        # When
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for common query patterns
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # Composite indexes for efficient queries
    op.create_index(
        "ix_audit_logs_user_resource",
        "audit_logs",
        ["user_id", "resource_type"]
    )
    op.create_index(
        "ix_audit_logs_resource_id",
        "audit_logs",
        ["resource_type", "resource_id"]
    )
    op.create_index(
        "ix_audit_logs_action_time",
        "audit_logs",
        ["action", "created_at"]
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_audit_logs_action_time", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_resource", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_id", table_name="audit_logs")

    # Drop table
    op.drop_table("audit_logs")
