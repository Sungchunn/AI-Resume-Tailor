"""Add job listings system

Revision ID: 001
Revises: None
Create Date: 2026-02-19

This migration adds:
1. job_listings table - system-wide job listings from Apify/n8n
2. user_job_interactions table - track user save/hide/applied status
3. Updates to tailored_resumes table - job_listing_id, style_settings, section_order
4. Full-text search indexes using pg_trgm extension
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable pg_trgm extension for full-text search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Create job_listings table
    op.create_table(
        "job_listings",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("external_job_id", sa.String(255), unique=True, index=True, nullable=False),
        # Core job fields
        sa.Column("job_title", sa.String(500), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("location", sa.String(500), nullable=True),
        sa.Column("seniority", sa.String(100), nullable=True),
        sa.Column("job_function", sa.String(255), nullable=True),
        sa.Column("industry", sa.String(255), nullable=True),
        sa.Column("job_description", sa.Text(), nullable=False),
        sa.Column("job_url", sa.String(2000), nullable=False),
        # Salary
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("salary_currency", sa.String(10), server_default="USD"),
        sa.Column("salary_period", sa.String(20), nullable=True),
        # Metadata
        sa.Column("date_posted", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_platform", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create indexes for filtering
    op.create_index("ix_job_listings_company", "job_listings", ["company_name"])
    op.create_index("ix_job_listings_location", "job_listings", ["location"])
    op.create_index("ix_job_listings_seniority", "job_listings", ["seniority"])
    op.create_index("ix_job_listings_job_function", "job_listings", ["job_function"])
    op.create_index("ix_job_listings_industry", "job_listings", ["industry"])
    op.create_index(
        "ix_job_listings_date_posted",
        "job_listings",
        ["date_posted"],
        postgresql_ops={"date_posted": "DESC"},
    )
    op.create_index("ix_job_listings_salary", "job_listings", ["salary_min", "salary_max"])
    op.create_index("ix_job_listings_active", "job_listings", ["is_active"])

    # Create full-text search indexes using pg_trgm
    op.execute(
        """
        CREATE INDEX ix_job_listings_title_gin ON job_listings
        USING gin(job_title gin_trgm_ops)
        """
    )
    op.execute(
        """
        CREATE INDEX ix_job_listings_desc_gin ON job_listings
        USING gin(job_description gin_trgm_ops)
        """
    )

    # Create user_job_interactions table
    op.create_table(
        "user_job_interactions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_listing_id",
            sa.Integer(),
            sa.ForeignKey("job_listings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Interaction states
        sa.Column("is_saved", sa.Boolean(), server_default="false"),
        sa.Column("is_hidden", sa.Boolean(), server_default="false"),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_viewed_at", sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        # Unique constraint
        sa.UniqueConstraint("user_id", "job_listing_id", name="uq_user_job_interaction"),
    )

    # Create indexes for user_job_interactions
    op.create_index("ix_user_job_interactions_user", "user_job_interactions", ["user_id"])
    op.create_index("ix_user_job_interactions_job", "user_job_interactions", ["job_listing_id"])
    op.create_index(
        "ix_user_job_interactions_saved", "user_job_interactions", ["user_id", "is_saved"]
    )
    op.create_index(
        "ix_user_job_interactions_hidden", "user_job_interactions", ["user_id", "is_hidden"]
    )

    # Update tailored_resumes table
    # Add job_listing_id column
    op.add_column(
        "tailored_resumes",
        sa.Column(
            "job_listing_id",
            sa.Integer(),
            sa.ForeignKey("job_listings.id"),
            nullable=True,
        ),
    )

    # Add style_settings column (JSONB)
    op.add_column(
        "tailored_resumes",
        sa.Column(
            "style_settings",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )

    # Add section_order column (TEXT[])
    op.add_column(
        "tailored_resumes",
        sa.Column(
            "section_order",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
    )

    # Add updated_at column to tailored_resumes
    op.add_column(
        "tailored_resumes",
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Make job_id nullable (previously it was required)
    op.alter_column("tailored_resumes", "job_id", existing_type=sa.Integer(), nullable=True)

    # Add CHECK constraint: exactly one job source must be set
    # Note: This requires existing data to have job_id set (which it should)
    op.execute(
        """
        ALTER TABLE tailored_resumes ADD CONSTRAINT ck_tailored_resume_one_job_source
        CHECK (
            (job_id IS NOT NULL AND job_listing_id IS NULL) OR
            (job_id IS NULL AND job_listing_id IS NOT NULL)
        )
        """
    )

    # Create index on job_listing_id
    op.create_index("ix_tailored_resumes_job_listing_id", "tailored_resumes", ["job_listing_id"])


def downgrade() -> None:
    # Remove index on job_listing_id
    op.drop_index("ix_tailored_resumes_job_listing_id", table_name="tailored_resumes")

    # Remove CHECK constraint
    op.execute(
        "ALTER TABLE tailored_resumes DROP CONSTRAINT ck_tailored_resume_one_job_source"
    )

    # Make job_id required again
    op.alter_column("tailored_resumes", "job_id", existing_type=sa.Integer(), nullable=False)

    # Remove columns from tailored_resumes
    op.drop_column("tailored_resumes", "updated_at")
    op.drop_column("tailored_resumes", "section_order")
    op.drop_column("tailored_resumes", "style_settings")
    op.drop_column("tailored_resumes", "job_listing_id")

    # Drop user_job_interactions indexes
    op.drop_index("ix_user_job_interactions_hidden", table_name="user_job_interactions")
    op.drop_index("ix_user_job_interactions_saved", table_name="user_job_interactions")
    op.drop_index("ix_user_job_interactions_job", table_name="user_job_interactions")
    op.drop_index("ix_user_job_interactions_user", table_name="user_job_interactions")

    # Drop user_job_interactions table
    op.drop_table("user_job_interactions")

    # Drop full-text search indexes
    op.execute("DROP INDEX IF EXISTS ix_job_listings_desc_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_title_gin")

    # Drop job_listings indexes
    op.drop_index("ix_job_listings_active", table_name="job_listings")
    op.drop_index("ix_job_listings_salary", table_name="job_listings")
    op.drop_index("ix_job_listings_date_posted", table_name="job_listings")
    op.drop_index("ix_job_listings_industry", table_name="job_listings")
    op.drop_index("ix_job_listings_job_function", table_name="job_listings")
    op.drop_index("ix_job_listings_seniority", table_name="job_listings")
    op.drop_index("ix_job_listings_location", table_name="job_listings")
    op.drop_index("ix_job_listings_company", table_name="job_listings")

    # Drop job_listings table
    op.drop_table("job_listings")

    # Note: We don't drop pg_trgm extension as other code may depend on it
