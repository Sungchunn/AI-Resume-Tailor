"""Add schedule_timezone column to scraper_schedule_settings

Revision ID: 012
Revises: 011
Create Date: 2026-02-27

Adds schedule_timezone column to allow admins to specify their timezone.
The scheduler will use this timezone instead of hardcoded UTC.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "012"
down_revision = "011"
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
    if not column_exists("scraper_schedule_settings", "schedule_timezone"):
        op.add_column(
            "scraper_schedule_settings",
            sa.Column(
                "schedule_timezone",
                sa.String(50),
                nullable=False,
                server_default="Asia/Bangkok",
            ),
        )


def downgrade() -> None:
    if column_exists("scraper_schedule_settings", "schedule_timezone"):
        op.drop_column("scraper_schedule_settings", "schedule_timezone")
