"""Add scraper preset and schedule settings tables

Revision ID: 008
Revises: 007
Create Date: 2026-02-23

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008'
down_revision: str | None = '007'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists."""
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
    # Create scraper_presets table
    if not table_exists('scraper_presets'):
        op.create_table(
            'scraper_presets',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('url', sa.Text(), nullable=False),
            sa.Column('count', sa.Integer(), nullable=False, server_default='100'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_scraper_presets_id'), 'scraper_presets', ['id'], unique=False)

    # Create scraper_schedule_settings table (singleton)
    if not table_exists('scraper_schedule_settings'):
        op.create_table(
            'scraper_schedule_settings',
            sa.Column('id', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('schedule_type', sa.String(length=20), nullable=False, server_default="'daily'"),
            sa.Column('schedule_hour', sa.Integer(), nullable=False, server_default='2'),
            sa.Column('schedule_minute', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('schedule_day_of_week', sa.Integer(), nullable=True),
            sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )

        # Seed with default settings (singleton row)
        conn = op.get_bind()
        conn.execute(
            sa.text(
                "INSERT INTO scraper_schedule_settings (id, is_enabled, schedule_type, schedule_hour, schedule_minute) "
                "VALUES (1, false, 'daily', 2, 0) "
                "ON CONFLICT (id) DO NOTHING"
            )
        )


def downgrade() -> None:
    if table_exists('scraper_schedule_settings'):
        op.drop_table('scraper_schedule_settings')

    if table_exists('scraper_presets'):
        op.drop_index(op.f('ix_scraper_presets_id'), table_name='scraper_presets')
        op.drop_table('scraper_presets')
