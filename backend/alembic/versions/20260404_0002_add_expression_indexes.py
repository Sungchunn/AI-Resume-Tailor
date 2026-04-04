"""Add expression indexes for case-insensitive filters.

Revision ID: 20260404_0002
Revises: 20260404_0001
Create Date: 2026-04-04

The seniority and city filters use func.lower() which bypasses normal B-tree
indexes. Expression indexes on LOWER(column) enable index usage for these
case-insensitive equality checks.

Affected queries:
- GET /api/job-listings?seniority=senior,mid-level
- GET /api/job-listings?city=san francisco,new york
- GET /api/job-listings?exclude_city=los angeles
"""
from collections.abc import Sequence
from alembic import op


revision: str = "20260404_0002"
down_revision: str | None = "20260404_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Expression index for case-insensitive seniority filtering
    # Supports: WHERE LOWER(seniority) = 'senior'
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_seniority_lower
        ON job_listings (LOWER(seniority))
        """
    )

    # Expression index for case-insensitive city filtering
    # Supports: WHERE LOWER(city) = 'san francisco'
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_city_lower
        ON job_listings (LOWER(city))
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_job_listings_city_lower")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_seniority_lower")
