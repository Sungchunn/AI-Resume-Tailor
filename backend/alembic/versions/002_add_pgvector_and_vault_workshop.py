"""Add pgvector extension, experience_blocks table, and workshops table

Revision ID: 002
Revises: 001
Create Date: 2024-01-15 00:00:00.000000

This migration enables the Vault & Workshop architecture:
- pgvector extension for semantic search
- experience_blocks table for atomic career facts (the Vault)
- workshops table for job-specific tailoring workspaces
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension for vector similarity search
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create experience_blocks table (the Vault)
    op.create_table(
        "experience_blocks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("block_type", sa.String(50), nullable=False),
        sa.Column("tags", ARRAY(sa.String()), server_default="{}"),
        sa.Column("source_company", sa.String(255), nullable=True),
        sa.Column("source_role", sa.String(255), nullable=True),
        sa.Column("source_date_start", sa.Date(), nullable=True),
        sa.Column("source_date_end", sa.Date(), nullable=True),
        # Vector embedding column - 768 dimensions for Gemini text-embedding-004
        sa.Column("embedding", sa.LargeBinary(), nullable=True),  # Will use pgvector
        sa.Column("embedding_model", sa.String(100), server_default="text-embedding-004"),
        sa.Column("content_hash", sa.String(64), nullable=True),
        sa.Column("verified", sa.Boolean(), server_default="false"),
        sa.Column("verification_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Alter embedding column to use vector type after table creation
    op.execute("ALTER TABLE experience_blocks ALTER COLUMN embedding TYPE vector(768) USING embedding::vector(768)")

    # Create indexes for experience_blocks
    op.create_index("ix_experience_blocks_id", "experience_blocks", ["id"])
    op.create_index("ix_experience_blocks_user_id", "experience_blocks", ["user_id"])

    # HNSW index for fast approximate nearest neighbor search
    # m=16: Each node connects to 16 others (balance of speed/recall)
    # ef_construction=64: Build quality (higher = better recall, slower build)
    op.execute("""
        CREATE INDEX ix_experience_blocks_embedding_hnsw
        ON experience_blocks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # GIN index for efficient tag filtering
    op.execute("""
        CREATE INDEX ix_experience_blocks_tags
        ON experience_blocks
        USING gin(tags)
    """)

    # Composite index for common filter patterns
    op.create_index(
        "ix_experience_blocks_user_type",
        "experience_blocks",
        ["user_id", "block_type"]
    )

    # Create workshops table
    op.create_table(
        "workshops",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_title", sa.String(255), nullable=False),
        sa.Column("job_company", sa.String(255), nullable=True),
        sa.Column("job_description", sa.Text(), nullable=True),
        # Vector embedding for job description - enables semantic matching
        sa.Column("job_embedding", sa.LargeBinary(), nullable=True),
        sa.Column("status", sa.String(50), server_default="draft"),
        # JSONB for structured resume sections being built
        sa.Column("sections", JSONB(), server_default="{}"),
        # Array of block IDs pulled from the Vault
        sa.Column("pulled_block_ids", ARRAY(sa.Integer()), server_default="{}"),
        # JSONB for pending AI suggestions (diff operations)
        sa.Column("pending_diffs", JSONB(), server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Alter job_embedding column to use vector type
    op.execute("ALTER TABLE workshops ALTER COLUMN job_embedding TYPE vector(768) USING job_embedding::vector(768)")

    # Create indexes for workshops
    op.create_index("ix_workshops_id", "workshops", ["id"])
    op.create_index("ix_workshops_user_id", "workshops", ["user_id"])
    op.create_index("ix_workshops_status", "workshops", ["user_id", "status"])


def downgrade() -> None:
    # Drop workshops table and indexes
    op.drop_index("ix_workshops_status", table_name="workshops")
    op.drop_index("ix_workshops_user_id", table_name="workshops")
    op.drop_index("ix_workshops_id", table_name="workshops")
    op.drop_table("workshops")

    # Drop experience_blocks table and indexes
    op.drop_index("ix_experience_blocks_user_type", table_name="experience_blocks")
    op.execute("DROP INDEX IF EXISTS ix_experience_blocks_tags")
    op.execute("DROP INDEX IF EXISTS ix_experience_blocks_embedding_hnsw")
    op.drop_index("ix_experience_blocks_user_id", table_name="experience_blocks")
    op.drop_index("ix_experience_blocks_id", table_name="experience_blocks")
    op.drop_table("experience_blocks")

    # Note: We don't drop the pgvector extension as other tables might use it
    # and it's generally safe to leave installed
