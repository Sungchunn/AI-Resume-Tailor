"""drop_legacy_resume_tables

Revision ID: 20260312_0002
Revises: 20260312_0001
Create Date: 2026-03-12

Drop PostgreSQL resumes and tailored_resumes tables that have been
migrated to MongoDB. The export.py endpoint has been updated to use
MongoDB CRUD operations.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260312_0002'
down_revision: str | None = '20260312_0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop tailored_resumes first (has FK to resumes)
    op.drop_table('tailored_resumes')
    # Then drop resumes
    op.drop_table('resumes')


def downgrade() -> None:
    # Recreate resumes table
    op.create_table(
        'resumes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('raw_content', sa.Text(), nullable=True),
        sa.Column('html_content', sa.Text(), nullable=True),
        sa.Column('parsed_content', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('style', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('original_filename', sa.String(length=255), nullable=True),
        sa.Column('original_file_type', sa.String(length=50), nullable=True),
        sa.Column('original_file_size', sa.Integer(), nullable=True),
        sa.Column('is_master', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_resumes_owner_id', 'resumes', ['owner_id'], unique=False)

    # Recreate tailored_resumes table
    op.create_table(
        'tailored_resumes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('resume_id', sa.Integer(), nullable=False),
        sa.Column('job_description_id', sa.Integer(), nullable=True),
        sa.Column('job_listing_id', sa.Integer(), nullable=True),
        sa.Column('tailored_content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('match_score', sa.Float(), nullable=True),
        sa.Column('skill_matches', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('skill_gaps', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('keyword_coverage', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['job_description_id'], ['job_descriptions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['job_listing_id'], ['job_listings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resume_id'], ['resumes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tailored_resumes_job_description_id', 'tailored_resumes', ['job_description_id'], unique=False)
    op.create_index('ix_tailored_resumes_job_listing_id', 'tailored_resumes', ['job_listing_id'], unique=False)
    op.create_index('ix_tailored_resumes_resume_id', 'tailored_resumes', ['resume_id'], unique=False)
