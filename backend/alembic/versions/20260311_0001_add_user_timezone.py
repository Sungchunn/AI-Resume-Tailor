"""add_user_timezone

Revision ID: 20260311_0001
Revises: 68967ecf74ba
Create Date: 2026-03-11

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260311_0001'
down_revision: str | None = '68967ecf74ba'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('timezone', sa.String(length=100), nullable=True, server_default='UTC'))


def downgrade() -> None:
    op.drop_column('users', 'timezone')
