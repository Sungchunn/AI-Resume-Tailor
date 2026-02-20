"""Add scraper_runs table for audit trail

Revision ID: 003
Revises: 002
Create Date: 2026-02-20

This migration creates the scraper_runs table to track scraper execution
history including timing, status, and job counts per region.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scraper_runs",
        # Primary key
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        # Run identification
        sa.Column("run_type", sa.String(50), nullable=False, server_default="scheduled"),
        sa.Column("batch_id", sa.String(100), nullable=True),
        # Overall status
        sa.Column("status", sa.String(20), nullable=False),
        # Timing
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        # Aggregate counts
        sa.Column("total_jobs_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_jobs_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_jobs_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_errors", sa.Integer(), nullable=False, server_default="0"),
        # Regional breakdown (JSONB)
        sa.Column(
            "region_results",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        # Error details (JSONB)
        sa.Column(
            "error_details",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        # Metadata
        sa.Column("triggered_by", sa.String(100), nullable=True),
        sa.Column(
            "config_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create indexes
    op.create_index("ix_scraper_runs_id", "scraper_runs", ["id"])
    op.create_index("ix_scraper_runs_status", "scraper_runs", ["status"])
    op.create_index(
        "ix_scraper_runs_started_at",
        "scraper_runs",
        ["started_at"],
        postgresql_ops={"started_at": "DESC"},
    )
    op.create_index("ix_scraper_runs_run_type", "scraper_runs", ["run_type"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_scraper_runs_run_type", table_name="scraper_runs")
    op.drop_index("ix_scraper_runs_started_at", table_name="scraper_runs")
    op.drop_index("ix_scraper_runs_status", table_name="scraper_runs")
    op.drop_index("ix_scraper_runs_id", table_name="scraper_runs")

    # Drop table
    op.drop_table("scraper_runs")
