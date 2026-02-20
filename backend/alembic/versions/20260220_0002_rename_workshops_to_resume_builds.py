"""Rename workshops table to resume_builds

Revision ID: 004
Revises: 000 (baseline from Flyway)
Create Date: 2026-02-20

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: str | None = '000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :table_name)"
        ),
        {"table_name": table_name}
    )
    return result.scalar()


def upgrade() -> None:
    # Skip if already renamed (idempotency check)
    if table_exists('resume_builds'):
        return

    # Rename the table
    op.rename_table('workshops', 'resume_builds')

    # Rename indexes
    op.execute('ALTER INDEX IF EXISTS ix_workshops_user_id RENAME TO ix_resume_builds_user_id')
    op.execute('ALTER INDEX IF EXISTS ix_workshops_status RENAME TO ix_resume_builds_status')
    op.execute('ALTER INDEX IF EXISTS ix_workshops_id RENAME TO ix_resume_builds_id')


def downgrade() -> None:
    # Skip if already renamed back (idempotency check)
    if table_exists('workshops'):
        return

    # Rename indexes back
    op.execute('ALTER INDEX IF EXISTS ix_resume_builds_id RENAME TO ix_workshops_id')
    op.execute('ALTER INDEX IF EXISTS ix_resume_builds_user_id RENAME TO ix_workshops_user_id')
    op.execute('ALTER INDEX IF EXISTS ix_resume_builds_status RENAME TO ix_workshops_status')

    # Rename table back
    op.rename_table('resume_builds', 'workshops')
