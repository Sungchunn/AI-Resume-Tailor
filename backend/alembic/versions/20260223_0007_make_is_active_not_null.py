"""Make is_active column NOT NULL for consistency

Revision ID: 007
Revises: 006
Create Date: 2026-02-23

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007'
down_revision: str | None = '006'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # First, set any NULL values to True (the default)
    conn = op.get_bind()
    result = conn.execute(
        sa.text("UPDATE users SET is_active = true WHERE is_active IS NULL")
    )
    if result.rowcount > 0:
        print(f"Set is_active=true for {result.rowcount} user(s) with NULL values")

    # Then alter the column to NOT NULL
    op.alter_column(
        'users',
        'is_active',
        existing_type=sa.Boolean(),
        nullable=False,
        server_default='true'
    )


def downgrade() -> None:
    op.alter_column(
        'users',
        'is_active',
        existing_type=sa.Boolean(),
        nullable=True,
        server_default=None
    )
