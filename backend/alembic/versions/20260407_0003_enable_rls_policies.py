"""Enable Row Level Security policies

Revision ID: 20260407_0003
Revises: 20260407_0002
Create Date: 2026-04-07

Implements RLS as defense-in-depth for user data isolation.
Uses session variable app.current_user_id set by FastAPI dependency injection.
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260407_0003"
down_revision: str | None = "20260407_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # =========================================
    # Enable RLS on user-owned tables
    # =========================================

    op.execute("ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE resume_builds ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE user_job_interactions ENABLE ROW LEVEL SECURITY")

    # =========================================
    # Create policies for job_descriptions
    # =========================================

    # SELECT policy: Users can only read their own jobs
    op.execute("""
        CREATE POLICY job_descriptions_select_policy
        ON job_descriptions FOR SELECT
        USING (
            owner_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    # INSERT policy: Users can only insert jobs owned by themselves
    op.execute("""
        CREATE POLICY job_descriptions_insert_policy
        ON job_descriptions FOR INSERT
        WITH CHECK (
            owner_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    # UPDATE policy: Users can only update their own jobs
    op.execute("""
        CREATE POLICY job_descriptions_update_policy
        ON job_descriptions FOR UPDATE
        USING (
            owner_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
        WITH CHECK (
            owner_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    # DELETE policy: Users can only delete their own jobs
    op.execute("""
        CREATE POLICY job_descriptions_delete_policy
        ON job_descriptions FOR DELETE
        USING (
            owner_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    # =========================================
    # Create policies for resume_builds
    # =========================================

    op.execute("""
        CREATE POLICY resume_builds_select_policy
        ON resume_builds FOR SELECT
        USING (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    op.execute("""
        CREATE POLICY resume_builds_insert_policy
        ON resume_builds FOR INSERT
        WITH CHECK (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    op.execute("""
        CREATE POLICY resume_builds_update_policy
        ON resume_builds FOR UPDATE
        USING (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
        WITH CHECK (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    op.execute("""
        CREATE POLICY resume_builds_delete_policy
        ON resume_builds FOR DELETE
        USING (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    # =========================================
    # Create policies for user_job_interactions
    # =========================================

    op.execute("""
        CREATE POLICY user_job_interactions_select_policy
        ON user_job_interactions FOR SELECT
        USING (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    op.execute("""
        CREATE POLICY user_job_interactions_insert_policy
        ON user_job_interactions FOR INSERT
        WITH CHECK (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    op.execute("""
        CREATE POLICY user_job_interactions_update_policy
        ON user_job_interactions FOR UPDATE
        USING (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
        WITH CHECK (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    op.execute("""
        CREATE POLICY user_job_interactions_delete_policy
        ON user_job_interactions FOR DELETE
        USING (
            user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    """)

    # =========================================
    # Ensure indexes exist on owner columns for RLS performance
    # =========================================

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_job_descriptions_owner_id
        ON job_descriptions(owner_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_resume_builds_user_id
        ON resume_builds(user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_user_job_interactions_user_id
        ON user_job_interactions(user_id)
    """)


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_user_job_interactions_user_id")
    op.execute("DROP INDEX IF EXISTS ix_resume_builds_user_id")
    op.execute("DROP INDEX IF EXISTS ix_job_descriptions_owner_id")

    # Drop policies (in reverse order of creation)
    for table in ["user_job_interactions", "resume_builds", "job_descriptions"]:
        for operation in ["delete", "update", "insert", "select"]:
            op.execute(f"DROP POLICY IF EXISTS {table}_{operation}_policy ON {table}")

    # Disable RLS
    op.execute("ALTER TABLE user_job_interactions DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE resume_builds DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE job_descriptions DISABLE ROW LEVEL SECURITY")
