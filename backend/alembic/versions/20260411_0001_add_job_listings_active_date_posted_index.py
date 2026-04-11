"""Add partial index for the default job-listings sort path.

Revision ID: 20260411_0001
Revises: 20260410_0001
Create Date: 2026-04-11

The default job-listings query is
``WHERE is_active = TRUE ORDER BY date_posted DESC LIMIT 20 OFFSET N``.
The existing ``ix_job_listings_date_posted`` index does not cover the
``is_active`` predicate, forcing Postgres to recheck the filter against
the heap. A partial index on ``(date_posted DESC, id DESC)`` restricted
to active rows lets the planner use an index-only scan for the hot path.

``CREATE INDEX CONCURRENTLY`` cannot run inside a transaction block, so
we commit the open alembic transaction before issuing the statement.
"""
from collections.abc import Sequence

from alembic import op


revision: str = "20260411_0001"
down_revision: str | None = "20260410_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # CREATE INDEX CONCURRENTLY must run outside of a transaction.
    op.execute("COMMIT")
    op.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS
            ix_job_listings_active_date_posted
        ON job_listings (date_posted DESC, id DESC)
        WHERE is_active = TRUE
        """
    )


def downgrade() -> None:
    op.execute("COMMIT")
    op.execute(
        "DROP INDEX CONCURRENTLY IF EXISTS ix_job_listings_active_date_posted"
    )
