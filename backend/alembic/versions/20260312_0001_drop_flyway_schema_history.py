"""drop_flyway_schema_history

Revision ID: 20260312_0001
Revises: 20260311_0001
Create Date: 2026-03-12

Legacy Flyway migration tracking table, no longer needed after
migrating to Alembic on 2026-02-20.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260312_0001'
down_revision: str | None = '20260311_0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table('flyway_schema_history')


def downgrade() -> None:
    # Recreate flyway_schema_history if needed for rollback
    # This matches Flyway's default schema
    op.create_table(
        'flyway_schema_history',
        sa.Column('installed_rank', sa.Integer(), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=True),
        sa.Column('description', sa.String(length=200), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('script', sa.String(length=1000), nullable=False),
        sa.Column('checksum', sa.Integer(), nullable=True),
        sa.Column('installed_by', sa.String(length=100), nullable=False),
        sa.Column('installed_on', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('execution_time', sa.Integer(), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('installed_rank'),
    )
