"""Add Google OAuth fields to users table

Revision ID: 20260405_0002
Revises: 20260405_0001
Create Date: 2026-04-05

Add OAuth-related columns to support Google Sign-In:
- auth_provider: tracks primary authentication method (email/google)
- google_id: Google's unique subject identifier
- google_linked_at: timestamp when Google was linked
- hashed_password: made nullable for Google-only users
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260405_0002"
down_revision: str | None = "20260405_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add auth_provider column with default for existing users
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(20), nullable=False, server_default="email"),
    )

    # Add google_id column with unique constraint
    op.add_column(
        "users",
        sa.Column("google_id", sa.String(255), nullable=True),
    )
    op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)

    # Add google_linked_at column
    op.add_column(
        "users",
        sa.Column("google_linked_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Make hashed_password nullable (for Google-only users)
    op.alter_column(
        "users",
        "hashed_password",
        existing_type=sa.String(255),
        nullable=True,
    )


def downgrade() -> None:
    # Note: Downgrade will fail if any Google-only users exist (NULL password)
    op.alter_column(
        "users",
        "hashed_password",
        existing_type=sa.String(255),
        nullable=False,
    )

    op.drop_column("users", "google_linked_at")
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "google_id")
    op.drop_column("users", "auth_provider")
