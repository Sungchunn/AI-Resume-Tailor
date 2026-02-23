"""Add job_description_html column to job_listings

Revision ID: 005
Revises: 004
Create Date: 2026-02-23

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: str | None = '004'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in the table."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table_name "
            "AND column_name = :column_name)"
        ),
        {"table_name": table_name, "column_name": column_name}
    )
    return result.scalar()


def upgrade() -> None:
    # Skip if column already exists (idempotency check)
    if column_exists('job_listings', 'job_description_html'):
        return

    op.add_column(
        'job_listings',
        sa.Column('job_description_html', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    # Skip if column doesn't exist
    if not column_exists('job_listings', 'job_description_html'):
        return

    op.drop_column('job_listings', 'job_description_html')
