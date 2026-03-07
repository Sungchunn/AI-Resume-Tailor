"""Add Kanban status fields to user_job_interactions

Revision ID: 20260307_0001
Revises: 20260303_0001
Create Date: 2026-03-07

This migration adds columns for Kanban board functionality:
- application_status: Track job application stage (applied, interview, accepted, rejected, ghosted)
- status_changed_at: Track when status last changed (for notifications)
- column_position: Order within Kanban column for drag-and-drop

Also backfills existing applied jobs with 'applied' status.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add application_status column
    op.add_column(
        "user_job_interactions",
        sa.Column("application_status", sa.String(length=20), nullable=True),
    )

    # Add status_changed_at column
    op.add_column(
        "user_job_interactions",
        sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Add column_position column with default 0
    op.add_column(
        "user_job_interactions",
        sa.Column("column_position", sa.Integer(), nullable=True, server_default="0"),
    )

    # Create index for efficient Kanban queries
    op.create_index(
        "ix_user_job_interactions_status",
        "user_job_interactions",
        ["user_id", "application_status"],
    )

    # Backfill: Set application_status='applied' and status_changed_at=applied_at
    # for existing applied jobs (where applied_at IS NOT NULL)
    op.execute(
        """
        UPDATE user_job_interactions
        SET application_status = 'applied',
            status_changed_at = applied_at,
            column_position = 0
        WHERE applied_at IS NOT NULL
          AND application_status IS NULL
        """
    )


def downgrade() -> None:
    # Drop the index
    op.drop_index("ix_user_job_interactions_status", table_name="user_job_interactions")

    # Drop the columns
    op.drop_column("user_job_interactions", "column_position")
    op.drop_column("user_job_interactions", "status_changed_at")
    op.drop_column("user_job_interactions", "application_status")
