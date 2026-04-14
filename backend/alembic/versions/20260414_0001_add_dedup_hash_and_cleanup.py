"""Add dedup_hash column and clean up duplicate job listings.

Revision ID: 20260414_0001
Revises: 20260411_0001
Create Date: 2026-04-14

Adds content-based deduplication to job_listings using an MD5 hash of
(job_title, company_name, city). Backfills existing rows, merges
user_job_interactions from duplicate losers to winners, deactivates
losers, and adds a unique index. MongoDB collections (tailored_resumes,
keyword_overrides) are handled by the post-deploy cleanup script.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260414_0001"
down_revision: str | None = "20260411_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # Phase A — Add column and backfill
    op.add_column("job_listings", sa.Column("dedup_hash", sa.String(32), nullable=True))

    conn.execute(sa.text("""
        UPDATE job_listings
        SET dedup_hash = MD5(
            LOWER(TRIM(job_title)) || '|' ||
            LOWER(TRIM(company_name)) || '|' ||
            LOWER(TRIM(COALESCE(city, '')))
        )
    """))

    # Phase B — Clean up existing duplicates
    # For each duplicate group, the winner is the row with the highest id (newest).
    dupes = conn.execute(sa.text("""
        SELECT dedup_hash, ARRAY_AGG(id ORDER BY id DESC) AS ids
        FROM job_listings
        WHERE dedup_hash IS NOT NULL
        GROUP BY dedup_hash
        HAVING COUNT(*) > 1
    """)).fetchall()

    loser_to_winner: list[tuple[int, int]] = []

    for row in dupes:
        ids = row.ids
        winner_id = ids[0]
        loser_ids = ids[1:]

        for loser_id in loser_ids:
            loser_to_winner.append((loser_id, winner_id))

            # Merge user_job_interactions:
            # Case 1 — user has interactions on BOTH winner and loser
            # Merge fields: OR is_saved, earliest applied_at, most recent
            # application_status by status_changed_at, then delete loser row.
            conn.execute(sa.text("""
                UPDATE user_job_interactions AS winner
                SET
                    is_saved = winner.is_saved OR loser.is_saved,
                    is_hidden = winner.is_hidden OR loser.is_hidden,
                    applied_at = LEAST(winner.applied_at, loser.applied_at),
                    application_status = CASE
                        WHEN loser.status_changed_at IS NOT NULL
                             AND (winner.status_changed_at IS NULL
                                  OR loser.status_changed_at > winner.status_changed_at)
                        THEN loser.application_status
                        ELSE winner.application_status
                    END,
                    status_changed_at = CASE
                        WHEN loser.status_changed_at IS NOT NULL
                             AND (winner.status_changed_at IS NULL
                                  OR loser.status_changed_at > winner.status_changed_at)
                        THEN loser.status_changed_at
                        ELSE winner.status_changed_at
                    END,
                    last_viewed_at = GREATEST(winner.last_viewed_at, loser.last_viewed_at)
                FROM user_job_interactions AS loser
                WHERE winner.job_listing_id = :winner_id
                  AND loser.job_listing_id = :loser_id
                  AND winner.user_id = loser.user_id
            """), {"winner_id": winner_id, "loser_id": loser_id})

            # Delete the loser interaction rows that were merged above
            conn.execute(sa.text("""
                DELETE FROM user_job_interactions
                WHERE job_listing_id = :loser_id
                  AND user_id IN (
                      SELECT user_id FROM user_job_interactions
                      WHERE job_listing_id = :winner_id
                  )
            """), {"winner_id": winner_id, "loser_id": loser_id})

            # Case 2 — user has interaction on loser ONLY: re-point to winner
            conn.execute(sa.text("""
                UPDATE user_job_interactions
                SET job_listing_id = :winner_id
                WHERE job_listing_id = :loser_id
            """), {"winner_id": winner_id, "loser_id": loser_id})

            # Note: tailored_resumes was migrated from PostgreSQL to MongoDB
            # in 20260312_0002. Re-pointing is handled by the post-deploy
            # cleanup script (scripts/cleanup_keyword_overrides_dedup.py).

            # Deactivate loser (soft-delete)
            conn.execute(sa.text("""
                UPDATE job_listings
                SET is_active = FALSE
                WHERE id = :loser_id
            """), {"loser_id": loser_id})

    # Log loser-to-winner mapping for MongoDB cleanup (Step 8)
    if loser_to_winner:
        # Create a temp table to persist the mapping for the post-deploy script
        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS _dedup_loser_winner_map (
                loser_id INTEGER NOT NULL,
                winner_id INTEGER NOT NULL
            )
        """))
        for loser_id, winner_id in loser_to_winner:
            conn.execute(sa.text(
                "INSERT INTO _dedup_loser_winner_map (loser_id, winner_id) VALUES (:loser_id, :winner_id)"
            ), {"loser_id": loser_id, "winner_id": winner_id})

    # Phase C — Add NOT NULL constraint and unique index
    op.alter_column("job_listings", "dedup_hash", nullable=False)
    op.create_index(
        "ix_job_listings_dedup_hash",
        "job_listings",
        ["dedup_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_job_listings_dedup_hash", table_name="job_listings")
    op.drop_column("job_listings", "dedup_hash")
    # Clean up temp mapping table if it exists
    op.execute("DROP TABLE IF EXISTS _dedup_loser_winner_map")
