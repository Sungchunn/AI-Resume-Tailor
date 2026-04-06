"""Grant admin access to sungchun.hua@gmail.com

Revision ID: 20260406_0001
Revises: 20260405_0002
Create Date: 2026-04-06

Data migration to grant admin privileges to a specific user.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260406_0001"
down_revision: str | None = "20260405_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ADMIN_EMAIL = "sungchun.hua@gmail.com"


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("UPDATE users SET is_admin = true WHERE email = :email"),
        {"email": ADMIN_EMAIL},
    )
    if result.rowcount > 0:
        print(f"Granted admin access to {ADMIN_EMAIL}")
    else:
        print(f"User {ADMIN_EMAIL} not found - will need to grant admin after signup")


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("UPDATE users SET is_admin = false WHERE email = :email"),
        {"email": ADMIN_EMAIL},
    )
    if result.rowcount > 0:
        print(f"Revoked admin access from {ADMIN_EMAIL}")
