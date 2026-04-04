"""drop_experience_blocks

Revision ID: 20260405_0001
Revises: 20260404_0003
Create Date: 2026-04-05

Drop the experience_blocks table (Vault feature) as it has been removed
from the application. The Vault functionality has been deprecated in favor
of direct resume content management.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260405_0001"
down_revision: str | None = "20260404_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop indexes first
    op.execute("DROP INDEX IF EXISTS ix_experience_blocks_tags")
    op.execute("DROP INDEX IF EXISTS ix_experience_blocks_embedding_hnsw")
    op.drop_index("ix_experience_blocks_user_type", table_name="experience_blocks")
    op.drop_index("ix_experience_blocks_user_id", table_name="experience_blocks")
    op.drop_index("ix_experience_blocks_id", table_name="experience_blocks")

    # Drop the table
    op.drop_table("experience_blocks")


def downgrade() -> None:
    # Recreate experience_blocks table
    op.create_table(
        "experience_blocks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("block_type", sa.String(length=50), nullable=False),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text()),
            server_default="{}",
            nullable=True,
        ),
        sa.Column("source_resume_id", sa.Integer(), nullable=True),
        sa.Column("source_section", sa.String(length=100), nullable=True),
        sa.Column("source_company", sa.String(length=255), nullable=True),
        sa.Column("source_role", sa.String(length=255), nullable=True),
        sa.Column(
            "source_dates", sa.String(length=100), nullable=True
        ),
        sa.Column(
            "verified", sa.Boolean(), server_default="false", nullable=True
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Add vector column
    op.execute("ALTER TABLE experience_blocks ADD COLUMN embedding vector(768)")

    # Recreate indexes
    op.create_index(
        "ix_experience_blocks_id", "experience_blocks", ["id"]
    )
    op.create_index(
        "ix_experience_blocks_user_id", "experience_blocks", ["user_id"]
    )
    op.execute(
        """
        CREATE INDEX ix_experience_blocks_embedding_hnsw
        ON experience_blocks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )
    op.execute(
        "CREATE INDEX ix_experience_blocks_tags ON experience_blocks USING gin(tags)"
    )
    op.create_index(
        "ix_experience_blocks_user_type",
        "experience_blocks",
        ["user_id", "block_type"],
    )
