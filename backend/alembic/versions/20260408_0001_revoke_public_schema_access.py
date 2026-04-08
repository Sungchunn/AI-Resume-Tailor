"""Revoke public schema access for Supabase roles

Revision ID: 20260408_0001
Revises: 20260407_0003
Create Date: 2026-04-08

Since all database access goes through FastAPI (not Supabase client),
we revoke access for anon and authenticated roles to prevent direct access.
This resolves the Supabase security warning about tables without RLS.
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260408_0001"
down_revision: str | None = "20260407_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Revoke all privileges on public schema from Supabase roles
    op.execute("REVOKE ALL ON SCHEMA public FROM anon;")
    op.execute("REVOKE ALL ON SCHEMA public FROM authenticated;")

    # Revoke privileges on all existing tables
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;")
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;")

    # Revoke privileges on all sequences
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;")
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;")

    # Revoke default privileges for future tables
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE ALL ON TABLES FROM anon;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE ALL ON TABLES FROM authenticated;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE ALL ON SEQUENCES FROM anon;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE ALL ON SEQUENCES FROM authenticated;"
    )


def downgrade() -> None:
    # Re-grant schema usage (but not table access - that would need RLS)
    op.execute("GRANT USAGE ON SCHEMA public TO anon;")
    op.execute("GRANT USAGE ON SCHEMA public TO authenticated;")
