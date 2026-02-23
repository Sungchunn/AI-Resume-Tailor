"""Add missing job_listings columns

Revision ID: 20260223_0009
Revises: 20260223_0008
Create Date: 2026-02-23

This migration adds columns that were in the baseline migration but
missing from the actual database schema (likely due to an older Flyway
migration being used initially).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename company_url to company_website if it exists
    # First check if company_url exists and company_website doesn't
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'job_listings' AND column_name IN ('company_url', 'company_website')
            """
        )
    )
    existing_cols = {row[0] for row in result}

    if "company_url" in existing_cols and "company_website" not in existing_cols:
        op.alter_column(
            "job_listings",
            "company_url",
            new_column_name="company_website",
        )
    elif "company_website" not in existing_cols:
        # Add company_website if neither exists
        op.add_column(
            "job_listings",
            sa.Column("company_website", sa.String(length=2000), nullable=True),
        )

    # Add missing columns (check each one to be idempotent)
    columns_to_add = [
        ("company_description", sa.Text(), None),
        ("company_linkedin_url", sa.String(length=2000), None),
        ("company_address_locality", sa.String(length=255), None),
        ("company_address_country", sa.String(length=100), None),
        ("apply_url", sa.String(length=2000), None),
        ("benefits", postgresql.JSONB(), None),
    ]

    for col_name, col_type, default in columns_to_add:
        # Check if column exists
        result = conn.execute(
            sa.text(
                f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'job_listings' AND column_name = '{col_name}'
                """
            )
        )
        if not result.fetchone():
            op.add_column(
                "job_listings",
                sa.Column(col_name, col_type, nullable=True, server_default=default),
            )


def downgrade() -> None:
    # Remove added columns
    columns_to_remove = [
        "company_description",
        "company_linkedin_url",
        "company_address_locality",
        "company_address_country",
        "apply_url",
        "benefits",
    ]

    for col_name in columns_to_remove:
        op.drop_column("job_listings", col_name)

    # Rename company_website back to company_url
    op.alter_column(
        "job_listings",
        "company_website",
        new_column_name="company_url",
    )
