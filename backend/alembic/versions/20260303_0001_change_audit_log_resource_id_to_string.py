"""Change audit_logs.resource_id from INTEGER to VARCHAR(50)

Revision ID: 013
Revises: 012
Create Date: 2026-03-03

This migration changes the resource_id column from INTEGER to VARCHAR(50)
to support both PostgreSQL integer IDs and MongoDB ObjectId strings.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change resource_id from INTEGER to VARCHAR(50)
    # The postgresql_using clause casts existing integer values to text
    op.alter_column(
        "audit_logs",
        "resource_id",
        existing_type=sa.Integer(),
        type_=sa.String(50),
        existing_nullable=True,
        postgresql_using="resource_id::TEXT",
    )


def downgrade() -> None:
    # Note: Downgrade will fail if any non-numeric resource_ids exist
    op.alter_column(
        "audit_logs",
        "resource_id",
        existing_type=sa.String(50),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="resource_id::INTEGER",
    )
