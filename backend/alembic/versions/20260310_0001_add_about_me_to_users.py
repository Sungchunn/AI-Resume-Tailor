"""Add about_me columns to users table.

Revision ID: 017
Revises: 016
Create Date: 2026-03-10

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("about_me", sa.Text(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "about_me_generated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "about_me_generated_at")
    op.drop_column("users", "about_me")
