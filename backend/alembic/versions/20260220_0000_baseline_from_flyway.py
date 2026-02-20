"""Baseline migration from Flyway V1-V5

This migration consolidates all Flyway SQL migrations (V1-V5) into a single
Alembic baseline. For databases already migrated by Flyway, use `alembic stamp 000`
to mark this as applied without running it.

Revision ID: 000
Revises:
Create Date: 2026-02-20

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :table_name)"
        ),
        {"table_name": table_name}
    )
    return result.scalar()


def upgrade() -> None:
    # Skip if already migrated by Flyway (check for users table existence)
    if table_exists('users'):
        return

    # ========================================================================
    # V1: Initial tables (users, resumes, job_descriptions, tailored_resumes)
    # ========================================================================

    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'resumes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('raw_content', sa.Text(), nullable=False),
        sa.Column('parsed_content', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_resumes_id', 'resumes', ['id'])

    op.create_table(
        'job_descriptions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=True),
        sa.Column('raw_content', sa.Text(), nullable=False),
        sa.Column('parsed_content', postgresql.JSONB(), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_job_descriptions_id', 'job_descriptions', ['id'])

    op.create_table(
        'tailored_resumes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('resume_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=True),  # Made nullable in V4
        sa.Column('tailored_content', sa.Text(), nullable=False),
        sa.Column('suggestions', postgresql.JSONB(), nullable=True),
        sa.Column('match_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        # Added in V4:
        sa.Column('job_listing_id', sa.Integer(), nullable=True),
        sa.Column('style_settings', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('section_order', postgresql.ARRAY(sa.Text()), server_default='{}', nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['resume_id'], ['resumes.id']),
        sa.ForeignKeyConstraint(['job_id'], ['job_descriptions.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tailored_resumes_id', 'tailored_resumes', ['id'])

    # ========================================================================
    # V2: pgvector extension, experience_blocks (Vault), workshops tables
    # ========================================================================

    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    op.create_table(
        'experience_blocks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('block_type', sa.String(length=50), nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.Text()), server_default='{}', nullable=True),
        sa.Column('source_company', sa.String(length=255), nullable=True),
        sa.Column('source_role', sa.String(length=255), nullable=True),
        sa.Column('source_date_start', sa.Date(), nullable=True),
        sa.Column('source_date_end', sa.Date(), nullable=True),
        sa.Column('embedding', sa.Column('embedding', sa.LargeBinary()), nullable=True),  # vector(768) handled via raw SQL
        sa.Column('embedding_model', sa.String(length=100), server_default='text-embedding-004', nullable=True),
        sa.Column('content_hash', sa.String(length=64), nullable=True),
        sa.Column('verified', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('verification_date', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # Drop and recreate with proper vector type
    op.execute('ALTER TABLE experience_blocks DROP COLUMN IF EXISTS embedding')
    op.execute('ALTER TABLE experience_blocks ADD COLUMN embedding vector(768)')

    op.create_index('ix_experience_blocks_id', 'experience_blocks', ['id'])
    op.create_index('ix_experience_blocks_user_id', 'experience_blocks', ['user_id'])
    op.execute('''
        CREATE INDEX ix_experience_blocks_embedding_hnsw
        ON experience_blocks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    ''')
    op.execute('CREATE INDEX ix_experience_blocks_tags ON experience_blocks USING gin(tags)')
    op.create_index('ix_experience_blocks_user_type', 'experience_blocks', ['user_id', 'block_type'])

    op.create_table(
        'workshops',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('job_title', sa.String(length=255), nullable=False),
        sa.Column('job_company', sa.String(length=255), nullable=True),
        sa.Column('job_description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='draft', nullable=True),
        sa.Column('sections', postgresql.JSONB(), server_default='{}', nullable=True),
        sa.Column('pulled_block_ids', postgresql.ARRAY(sa.Integer()), server_default='{}', nullable=True),
        sa.Column('pending_diffs', postgresql.JSONB(), server_default='[]', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('exported_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # Add vector column for job_embedding
    op.execute('ALTER TABLE workshops ADD COLUMN job_embedding vector(768)')

    op.create_index('ix_workshops_id', 'workshops', ['id'])
    op.create_index('ix_workshops_user_id', 'workshops', ['user_id'])
    op.create_index('ix_workshops_status', 'workshops', ['user_id', 'status'])

    # ========================================================================
    # V3: Audit logs table
    # ========================================================================

    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=True),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('endpoint', sa.String(length=255), nullable=True),
        sa.Column('http_method', sa.String(length=10), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True),
        sa.Column('old_value', postgresql.JSONB(), nullable=True),
        sa.Column('new_value', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='success', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_logs_id', 'audit_logs', ['id'])
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('ix_audit_logs_user_resource', 'audit_logs', ['user_id', 'resource_type'])
    op.create_index('ix_audit_logs_resource_id', 'audit_logs', ['resource_type', 'resource_id'])
    op.create_index('ix_audit_logs_action_time', 'audit_logs', ['action', 'created_at'])

    # ========================================================================
    # V4: Job listings system (pg_trgm, job_listings, user_job_interactions)
    # ========================================================================

    # Enable pg_trgm extension for full-text search
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    op.create_table(
        'job_listings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('external_job_id', sa.String(length=255), nullable=False),
        sa.Column('job_title', sa.String(length=500), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('company_url', sa.String(length=2000), nullable=True),
        sa.Column('company_logo', sa.String(length=2000), nullable=True),
        sa.Column('location', sa.String(length=500), nullable=True),
        sa.Column('city', sa.String(length=255), nullable=True),
        sa.Column('state', sa.String(length=255), nullable=True),
        sa.Column('country', sa.String(length=255), nullable=True),
        sa.Column('is_remote', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('seniority', sa.String(length=100), nullable=True),
        sa.Column('job_function', sa.String(length=255), nullable=True),
        sa.Column('industry', sa.String(length=255), nullable=True),
        sa.Column('job_description', sa.Text(), nullable=False),
        sa.Column('job_url', sa.String(length=2000), nullable=False),
        sa.Column('job_url_direct', sa.String(length=2000), nullable=True),
        sa.Column('job_type', postgresql.JSONB(), nullable=True),
        sa.Column('emails', postgresql.JSONB(), nullable=True),
        sa.Column('easy_apply', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('applicants_count', sa.String(length=50), nullable=True),
        sa.Column('salary_min', sa.Integer(), nullable=True),
        sa.Column('salary_max', sa.Integer(), nullable=True),
        sa.Column('salary_currency', sa.String(length=10), server_default='USD', nullable=True),
        sa.Column('salary_period', sa.String(length=20), nullable=True),
        sa.Column('date_posted', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('scraped_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('source_platform', sa.String(length=100), nullable=True),
        sa.Column('region', sa.String(length=100), nullable=True),
        sa.Column('last_synced_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_job_listings_external_job_id', 'job_listings', ['external_job_id'], unique=True)
    op.create_index('ix_job_listings_id', 'job_listings', ['id'])
    op.create_index('ix_job_listings_company', 'job_listings', ['company_name'])
    op.create_index('ix_job_listings_location', 'job_listings', ['location'])
    op.create_index('ix_job_listings_seniority', 'job_listings', ['seniority'])
    op.create_index('ix_job_listings_job_function', 'job_listings', ['job_function'])
    op.create_index('ix_job_listings_industry', 'job_listings', ['industry'])
    op.create_index('ix_job_listings_date_posted', 'job_listings', ['date_posted'], postgresql_ops={'date_posted': 'DESC'})
    op.create_index('ix_job_listings_salary', 'job_listings', ['salary_min', 'salary_max'])
    op.create_index('ix_job_listings_active', 'job_listings', ['is_active'])
    op.create_index('ix_job_listings_country', 'job_listings', ['country'])
    op.create_index('ix_job_listings_is_remote', 'job_listings', ['is_remote'])
    op.create_index('ix_job_listings_region', 'job_listings', ['region'])
    op.create_index('ix_job_listings_easy_apply', 'job_listings', ['easy_apply'])

    # Full-text search indexes using pg_trgm
    op.execute('CREATE INDEX ix_job_listings_title_gin ON job_listings USING gin(job_title gin_trgm_ops)')
    op.execute('CREATE INDEX ix_job_listings_desc_gin ON job_listings USING gin(job_description gin_trgm_ops)')

    # Add FK and constraint to tailored_resumes (already has the columns from table creation)
    op.create_foreign_key(
        'fk_tailored_resumes_job_listing_id',
        'tailored_resumes', 'job_listings',
        ['job_listing_id'], ['id']
    )
    op.execute('''
        ALTER TABLE tailored_resumes ADD CONSTRAINT ck_tailored_resume_one_job_source
        CHECK (
            (job_id IS NOT NULL AND job_listing_id IS NULL) OR
            (job_id IS NULL AND job_listing_id IS NOT NULL)
        )
    ''')
    op.create_index('ix_tailored_resumes_job_listing_id', 'tailored_resumes', ['job_listing_id'])

    op.create_table(
        'user_job_interactions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('job_listing_id', sa.Integer(), nullable=False),
        sa.Column('is_saved', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('is_hidden', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('applied_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('last_viewed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_listing_id'], ['job_listings.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'job_listing_id', name='uq_user_job_interaction'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_job_interactions_id', 'user_job_interactions', ['id'])
    op.create_index('ix_user_job_interactions_user', 'user_job_interactions', ['user_id'])
    op.create_index('ix_user_job_interactions_job', 'user_job_interactions', ['job_listing_id'])
    op.create_index('ix_user_job_interactions_saved', 'user_job_interactions', ['user_id', 'is_saved'])
    op.create_index('ix_user_job_interactions_hidden', 'user_job_interactions', ['user_id', 'is_hidden'])

    # ========================================================================
    # V5: Scraper runs table
    # ========================================================================

    op.create_table(
        'scraper_runs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('run_type', sa.String(length=50), server_default='scheduled', nullable=False),
        sa.Column('batch_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('started_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('completed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('total_jobs_found', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_jobs_created', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_jobs_updated', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_errors', sa.Integer(), server_default='0', nullable=False),
        sa.Column('region_results', postgresql.JSONB(), nullable=True),
        sa.Column('error_details', postgresql.JSONB(), nullable=True),
        sa.Column('triggered_by', sa.String(length=100), nullable=True),
        sa.Column('config_snapshot', postgresql.JSONB(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_scraper_runs_id', 'scraper_runs', ['id'])
    op.create_index('ix_scraper_runs_status', 'scraper_runs', ['status'])
    op.create_index('ix_scraper_runs_started_at', 'scraper_runs', ['started_at'], postgresql_ops={'started_at': 'DESC'})
    op.create_index('ix_scraper_runs_run_type', 'scraper_runs', ['run_type'])


def downgrade() -> None:
    # Drop tables in reverse order of dependencies
    op.drop_table('scraper_runs')
    op.drop_table('user_job_interactions')
    op.drop_index('ix_tailored_resumes_job_listing_id', table_name='tailored_resumes')
    op.execute('ALTER TABLE tailored_resumes DROP CONSTRAINT IF EXISTS ck_tailored_resume_one_job_source')
    op.drop_constraint('fk_tailored_resumes_job_listing_id', 'tailored_resumes', type_='foreignkey')
    op.drop_index('ix_job_listings_desc_gin', table_name='job_listings')
    op.drop_index('ix_job_listings_title_gin', table_name='job_listings')
    op.drop_table('job_listings')
    op.drop_table('audit_logs')
    op.drop_table('workshops')
    op.drop_table('experience_blocks')
    op.drop_table('tailored_resumes')
    op.drop_table('job_descriptions')
    op.drop_table('resumes')
    op.drop_table('users')
    op.execute('DROP EXTENSION IF EXISTS pg_trgm')
    op.execute('DROP EXTENSION IF EXISTS vector')
