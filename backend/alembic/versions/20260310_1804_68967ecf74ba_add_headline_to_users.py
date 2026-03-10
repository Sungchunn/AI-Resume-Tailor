"""add_headline_to_users

Revision ID: 68967ecf74ba
Revises: 017
Create Date: 2026-03-10 18:04:55.724457

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '68967ecf74ba'
down_revision: str | None = '017'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('headline', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'headline')
