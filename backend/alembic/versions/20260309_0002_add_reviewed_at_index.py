"""Add index on reviewed_at for scraper_requests.

Revision ID: 016
Revises: 015
Create Date: 2026-03-09

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_scraper_requests_reviewed_at",
        "scraper_requests",
        ["reviewed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_scraper_requests_reviewed_at", table_name="scraper_requests")
