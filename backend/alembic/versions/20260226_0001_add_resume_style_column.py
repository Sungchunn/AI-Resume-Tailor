"""Add style column to resumes table

Revision ID: 011
Revises: 010
Create Date: 2026-02-26

This migration adds the style column to the resumes table for storing
font/margin/spacing settings used in PDF rendering.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in the table."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table_name "
            "AND column_name = :column_name)"
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return result.scalar()


def upgrade() -> None:
    if not column_exists("resumes", "style"):
        op.add_column(
            "resumes",
            sa.Column("style", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if column_exists("resumes", "style"):
        op.drop_column("resumes", "style")
