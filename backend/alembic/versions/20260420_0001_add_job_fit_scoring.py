"""Add job-fit pre-scoring columns.

Revision ID: 20260420_0001
Revises: 20260414_0001
Create Date: 2026-04-20

Adds columns required for the daily job-fit pre-scoring feature:

- ``job_listings.extracted_keywords`` (JSONB): lowercase keywords extracted
  from the job description once per listing at import, shared across users.
- ``user_job_interactions.fit_score_raw`` (Integer): raw 0-100 keyword
  overlap between the user's starred resume and the job.
- ``user_job_interactions.scored_resume_hash`` (VarChar): hash of the
  starred resume at score time, used to detect staleness.

A partial index on ``(user_id, fit_score_raw DESC) WHERE fit_score_raw
IS NOT NULL`` supports future sort-by-fit queries.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "20260420_0001"
down_revision: str | None = "20260414_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "job_listings",
        sa.Column("extracted_keywords", JSONB, nullable=True),
    )

    op.add_column(
        "user_job_interactions",
        sa.Column("fit_score_raw", sa.Integer, nullable=True),
    )
    op.add_column(
        "user_job_interactions",
        sa.Column("scored_resume_hash", sa.String(64), nullable=True),
    )

    # CREATE INDEX CONCURRENTLY must run outside of a transaction.
    op.execute("COMMIT")
    op.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uji_fit_score
        ON user_job_interactions (user_id, fit_score_raw DESC)
        WHERE fit_score_raw IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("COMMIT")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_uji_fit_score")

    op.drop_column("user_job_interactions", "scored_resume_hash")
    op.drop_column("user_job_interactions", "fit_score_raw")
    op.drop_column("job_listings", "extracted_keywords")
