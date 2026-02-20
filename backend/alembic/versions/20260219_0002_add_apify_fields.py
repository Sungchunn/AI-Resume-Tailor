"""Add APIFY LinkedIn scraper fields

Revision ID: 002
Revises: 001
Create Date: 2026-02-19

This migration adds additional fields to support the APIFY LinkedIn scraper output:
- Company details: company_url, company_logo
- Location breakdown: city, state, country, is_remote
- Job details: job_url_direct, job_type, emails, easy_apply
- Metadata: scraped_at, region, last_synced_at
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Company details
    op.add_column(
        "job_listings",
        sa.Column("company_url", sa.String(2000), nullable=True),
    )
    op.add_column(
        "job_listings",
        sa.Column("company_logo", sa.String(2000), nullable=True),
    )

    # Location breakdown
    op.add_column(
        "job_listings",
        sa.Column("city", sa.String(255), nullable=True),
    )
    op.add_column(
        "job_listings",
        sa.Column("state", sa.String(255), nullable=True),
    )
    op.add_column(
        "job_listings",
        sa.Column("country", sa.String(255), nullable=True),
    )
    op.add_column(
        "job_listings",
        sa.Column("is_remote", sa.Boolean(), server_default="false", nullable=False),
    )

    # Job details
    op.add_column(
        "job_listings",
        sa.Column("job_url_direct", sa.String(2000), nullable=True),
    )
    op.add_column(
        "job_listings",
        sa.Column(
            "job_type",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "job_listings",
        sa.Column(
            "emails",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "job_listings",
        sa.Column("easy_apply", sa.Boolean(), server_default="false", nullable=False),
    )

    # Metadata
    op.add_column(
        "job_listings",
        sa.Column("scraped_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "job_listings",
        sa.Column("region", sa.String(100), nullable=True),
    )
    op.add_column(
        "job_listings",
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Add indexes for new filterable columns
    op.create_index("ix_job_listings_country", "job_listings", ["country"])
    op.create_index("ix_job_listings_is_remote", "job_listings", ["is_remote"])
    op.create_index("ix_job_listings_region", "job_listings", ["region"])
    op.create_index("ix_job_listings_easy_apply", "job_listings", ["easy_apply"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_job_listings_easy_apply", table_name="job_listings")
    op.drop_index("ix_job_listings_region", table_name="job_listings")
    op.drop_index("ix_job_listings_is_remote", table_name="job_listings")
    op.drop_index("ix_job_listings_country", table_name="job_listings")

    # Drop columns
    op.drop_column("job_listings", "last_synced_at")
    op.drop_column("job_listings", "region")
    op.drop_column("job_listings", "scraped_at")
    op.drop_column("job_listings", "easy_apply")
    op.drop_column("job_listings", "emails")
    op.drop_column("job_listings", "job_type")
    op.drop_column("job_listings", "job_url_direct")
    op.drop_column("job_listings", "is_remote")
    op.drop_column("job_listings", "country")
    op.drop_column("job_listings", "state")
    op.drop_column("job_listings", "city")
    op.drop_column("job_listings", "company_logo")
    op.drop_column("job_listings", "company_url")
