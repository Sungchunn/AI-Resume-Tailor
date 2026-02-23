"""Add is_admin column to users table

Revision ID: 006
Revises: 005
Create Date: 2026-02-23

"""
import os
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006'
down_revision: str | None = '005'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in the table."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table_name "
            "AND column_name = :column_name)"
        ),
        {"table_name": table_name, "column_name": column_name}
    )
    return result.scalar()


def upgrade() -> None:
    # Skip if column already exists (idempotency check)
    if column_exists('users', 'is_admin'):
        return

    # Add is_admin column with default False
    op.add_column(
        'users',
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false')
    )

    # Seed initial admins from ADMIN_EMAILS environment variable
    admin_emails_str = os.environ.get('ADMIN_EMAILS', '')
    if admin_emails_str:
        # Parse comma-separated email list (same format as pydantic list)
        admin_emails = [email.strip() for email in admin_emails_str.split(',') if email.strip()]

        if admin_emails:
            conn = op.get_bind()
            # Update existing users matching admin emails to have is_admin=True
            result = conn.execute(
                sa.text("UPDATE users SET is_admin = true WHERE email = ANY(:emails)"),
                {"emails": admin_emails}
            )
            print(f"Seeded {result.rowcount} admin user(s) from ADMIN_EMAILS")


def downgrade() -> None:
    # Skip if column doesn't exist
    if not column_exists('users', 'is_admin'):
        return

    op.drop_column('users', 'is_admin')
