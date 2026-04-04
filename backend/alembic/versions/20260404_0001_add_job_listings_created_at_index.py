"""Add index on job_listings.created_at for cleanup job performance.

Revision ID: 20260404_0001
Revises: 20260312_0003
Create Date: 2026-04-04

The daily cleanup job executes:
    DELETE FROM job_listings WHERE created_at < cutoff_date

Without an index on created_at, this causes a full sequential scan of the
entire job_listings table, consuming excessive CPU on each run.

This index enables efficient range scans for the deletion query.
"""
from collections.abc import Sequence
from alembic import op


revision: str = "20260404_0001"
down_revision: str | None = "20260312_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add index for cleanup job's WHERE created_at < cutoff filter
    # This enables efficient range scans instead of full table scans
    op.create_index(
        "ix_job_listings_created_at",
        "job_listings",
        ["created_at"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_job_listings_created_at",
        table_name="job_listings",
        if_exists=True,
    )
