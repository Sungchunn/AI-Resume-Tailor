"""Add GIN trigram indexes for ILIKE pattern matching.

Revision ID: 20260404_0003
Revises: 20260404_0002
Create Date: 2026-04-04

ILIKE queries with wildcards on both sides (e.g., '%pattern%') require GIN
indexes with pg_trgm for efficient pattern matching. Without these indexes,
each ILIKE query causes a full sequential scan.

The pg_trgm extension is already enabled in the baseline migration.

Affected queries:
- GET /api/job-listings?location=california
- GET /api/job-listings?region=west coast
- GET /api/job-listings?country=united states
- GET /api/job-listings?job_function=engineering
- GET /api/job-listings?industry=technology
- GET /api/job-listings?company_name=google

Note: job_title and job_description already have GIN indexes from baseline.
"""
from collections.abc import Sequence
from alembic import op


revision: str = "20260404_0003"
down_revision: str | None = "20260404_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # GIN trigram indexes for ILIKE pattern matching
    # These enable efficient '%pattern%' searches

    # Location filter: job_listings?location=california
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_location_gin
        ON job_listings USING gin(location gin_trgm_ops)
        """
    )

    # Region filter: job_listings?region=west coast
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_region_gin
        ON job_listings USING gin(region gin_trgm_ops)
        """
    )

    # Country filter: job_listings?country=united states
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_country_gin
        ON job_listings USING gin(country gin_trgm_ops)
        """
    )

    # City filter (for ILIKE searches, separate from the LOWER expression index)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_city_gin
        ON job_listings USING gin(city gin_trgm_ops)
        """
    )

    # Job function filter: job_listings?job_function=engineering
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_job_function_gin
        ON job_listings USING gin(job_function gin_trgm_ops)
        """
    )

    # Industry filter: job_listings?industry=technology
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_industry_gin
        ON job_listings USING gin(industry gin_trgm_ops)
        """
    )

    # Company name filter: job_listings?company_name=google
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_company_name_gin
        ON job_listings USING gin(company_name gin_trgm_ops)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_job_listings_company_name_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_industry_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_job_function_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_city_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_country_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_region_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_location_gin")
