"""Add fit-score breakdown + batch-run metadata.

Revision ID: 20260424_0001
Revises: 20260423_0001
Create Date: 2026-04-24

Exposes what the v4 scorer already computes so the UI can render the
formula, required-skill state, and per-batch freshness.

- ``user_job_interactions.fit_score_breakdown`` (JSONB): per-user semantic
  sub-score, keyword sub-score, matched/missing keywords, required-skill
  state, and cap flag. Same shape for both v3 fallback (``version: 3``,
  ``semantic_sub: null``) and v4.
- ``user_job_interactions.fit_score_is_capped`` (Boolean): denormalized
  from breakdown so the "Hide capped scores" filter can index-scan.
- Partial index ``idx_uji_fit_not_capped`` on the common filtered-list
  query.
- ``fit_score_batch_runs`` table: singleton-style log of each
  ``score_all_users`` invocation. Read as ``ORDER BY started_at DESC
  LIMIT 1`` to drive the "Scores refreshed Xh ago" header.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "20260424_0001"
down_revision: str | None = "20260423_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_job_interactions",
        sa.Column("fit_score_breakdown", JSONB, nullable=True),
    )
    op.add_column(
        "user_job_interactions",
        sa.Column("fit_score_is_capped", sa.Boolean, nullable=True),
    )

    op.create_table(
        "fit_score_batch_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("users_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rows_written", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
    )
    op.create_index(
        "ix_fit_score_batch_runs_started_at",
        "fit_score_batch_runs",
        ["started_at"],
    )

    # CREATE INDEX CONCURRENTLY must run outside of a transaction. The
    # existing idx_uji_fit_score covers the unfiltered case; this new one
    # covers the common "hide capped scores" filtered sort.
    op.execute("COMMIT")
    op.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uji_fit_not_capped
        ON user_job_interactions (user_id, fit_score_raw DESC)
        WHERE fit_score_raw IS NOT NULL AND fit_score_is_capped IS NOT TRUE
        """
    )


def downgrade() -> None:
    op.execute("COMMIT")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_uji_fit_not_capped")

    op.drop_index("ix_fit_score_batch_runs_started_at", "fit_score_batch_runs")
    op.drop_table("fit_score_batch_runs")

    op.drop_column("user_job_interactions", "fit_score_is_capped")
    op.drop_column("user_job_interactions", "fit_score_breakdown")
