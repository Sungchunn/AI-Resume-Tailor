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

Idempotent: an earlier deploy committed the column/table DDL before the
final CONCURRENT index step failed, so alembic_version was never bumped.
Every operation below uses IF NOT EXISTS so the migration can safely
resume from any partial state.
"""
from collections.abc import Sequence

from alembic import op


revision: str = "20260424_0001"
down_revision: str | None = "20260423_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE user_job_interactions "
        "ADD COLUMN IF NOT EXISTS fit_score_breakdown JSONB"
    )
    op.execute(
        "ALTER TABLE user_job_interactions "
        "ADD COLUMN IF NOT EXISTS fit_score_is_capped BOOLEAN"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS fit_score_batch_runs (
            id SERIAL PRIMARY KEY,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            users_count INTEGER NOT NULL DEFAULT 0,
            rows_written INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'running'
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_fit_score_batch_runs_started_at
        ON fit_score_batch_runs (started_at)
        """
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

    op.execute("DROP INDEX IF EXISTS ix_fit_score_batch_runs_started_at")
    op.execute("DROP TABLE IF EXISTS fit_score_batch_runs")

    op.execute(
        "ALTER TABLE user_job_interactions "
        "DROP COLUMN IF EXISTS fit_score_is_capped"
    )
    op.execute(
        "ALTER TABLE user_job_interactions "
        "DROP COLUMN IF EXISTS fit_score_breakdown"
    )
