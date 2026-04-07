"""Add public_id UUID columns for security hardening

Revision ID: 20260407_0001
Revises: 20260406_0001
Create Date: 2026-04-07

Security hardening Phase 1: Add public_id UUID columns to user-owned tables
to replace sequential integer IDs in public API URLs.

Tables modified:
- job_descriptions
- resume_builds
- user_job_interactions
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260407_0001"
down_revision: str | None = "20260406_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # =========================================
    # job_descriptions table
    # =========================================

    # 1. Add nullable column first
    op.add_column(
        "job_descriptions",
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 2. Backfill existing rows with UUIDs
    op.execute("""
        UPDATE job_descriptions
        SET public_id = gen_random_uuid()
        WHERE public_id IS NULL
    """)

    # 3. Make column non-nullable
    op.alter_column("job_descriptions", "public_id", nullable=False)

    # 4. Add unique index for fast lookups
    op.create_index(
        "ix_job_descriptions_public_id",
        "job_descriptions",
        ["public_id"],
        unique=True,
    )

    # =========================================
    # resume_builds table
    # =========================================

    op.add_column(
        "resume_builds",
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.execute("""
        UPDATE resume_builds
        SET public_id = gen_random_uuid()
        WHERE public_id IS NULL
    """)

    op.alter_column("resume_builds", "public_id", nullable=False)

    op.create_index(
        "ix_resume_builds_public_id",
        "resume_builds",
        ["public_id"],
        unique=True,
    )

    # =========================================
    # user_job_interactions table
    # =========================================

    op.add_column(
        "user_job_interactions",
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.execute("""
        UPDATE user_job_interactions
        SET public_id = gen_random_uuid()
        WHERE public_id IS NULL
    """)

    op.alter_column("user_job_interactions", "public_id", nullable=False)

    op.create_index(
        "ix_user_job_interactions_public_id",
        "user_job_interactions",
        ["public_id"],
        unique=True,
    )


def downgrade() -> None:
    # Reverse order: drop indexes first, then columns

    op.drop_index("ix_user_job_interactions_public_id", table_name="user_job_interactions")
    op.drop_column("user_job_interactions", "public_id")

    op.drop_index("ix_resume_builds_public_id", table_name="resume_builds")
    op.drop_column("resume_builds", "public_id")

    op.drop_index("ix_job_descriptions_public_id", table_name="job_descriptions")
    op.drop_column("job_descriptions", "public_id")
