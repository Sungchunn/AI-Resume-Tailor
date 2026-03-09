"""Add scraper_requests table for user job scraping requests.

Revision ID: 015
Revises: 014
Create Date: 2026-03-09

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the requeststatus enum type (if it doesn't already exist)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'requeststatus') THEN
                CREATE TYPE requeststatus AS ENUM ('pending', 'approved', 'rejected');
            END IF;
        END $$;
    """)

    # Create the scraper_requests table
    op.create_table(
        "scraper_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("pending", "approved", "rejected", name="requeststatus", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("preset_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["preset_id"], ["scraper_presets.id"], ondelete="SET NULL"),
    )

    # Create indexes
    op.create_index("ix_scraper_requests_id", "scraper_requests", ["id"])
    op.create_index("ix_scraper_requests_user_id", "scraper_requests", ["user_id"])
    op.create_index("ix_scraper_requests_status", "scraper_requests", ["status"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_scraper_requests_status", table_name="scraper_requests")
    op.drop_index("ix_scraper_requests_user_id", table_name="scraper_requests")
    op.drop_index("ix_scraper_requests_id", table_name="scraper_requests")

    # Drop table
    op.drop_table("scraper_requests")

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS requeststatus")
