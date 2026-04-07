"""Add server_default to public_id columns

Revision ID: 20260407_0002
Revises: 20260407_0001
Create Date: 2026-04-07

Adds database-level default (gen_random_uuid()) to public_id columns
as defense-in-depth for cases where Python code path is bypassed.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260407_0002"
down_revision: str | None = "20260407_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Use raw SQL for reliable default setting
    op.execute("ALTER TABLE job_descriptions ALTER COLUMN public_id SET DEFAULT gen_random_uuid()")
    op.execute("ALTER TABLE resume_builds ALTER COLUMN public_id SET DEFAULT gen_random_uuid()")
    op.execute("ALTER TABLE user_job_interactions ALTER COLUMN public_id SET DEFAULT gen_random_uuid()")


def downgrade() -> None:
    # Remove server defaults
    op.execute("ALTER TABLE user_job_interactions ALTER COLUMN public_id DROP DEFAULT")
    op.execute("ALTER TABLE resume_builds ALTER COLUMN public_id DROP DEFAULT")
    op.execute("ALTER TABLE job_descriptions ALTER COLUMN public_id DROP DEFAULT")
