"""Add AI usage tracking tables.

Revision ID: 20260312_0003
Revises: 20260312_0002
Create Date: 2026-03-12

Adds ai_usage_logs and ai_pricing_configs tables for tracking AI API usage,
costs, and latency across all AI operations.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260312_0003"
down_revision: str | None = "20260312_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create ai_usage_logs table
    op.create_table(
        "ai_usage_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("endpoint", sa.String(100), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("model", sa.String(50), nullable=False),
        sa.Column("operation_type", sa.String(30), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(10, 6), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for ai_usage_logs
    op.create_index("ix_ai_usage_logs_id", "ai_usage_logs", ["id"])
    op.create_index("ix_ai_usage_logs_user_id", "ai_usage_logs", ["user_id"])
    op.create_index("ix_ai_usage_logs_endpoint", "ai_usage_logs", ["endpoint"])
    op.create_index("ix_ai_usage_logs_provider", "ai_usage_logs", ["provider"])
    op.create_index("ix_ai_usage_logs_model", "ai_usage_logs", ["model"])
    op.create_index("ix_ai_usage_logs_created_at", "ai_usage_logs", ["created_at"])
    op.create_index(
        "ix_ai_usage_logs_time_endpoint", "ai_usage_logs", ["created_at", "endpoint"]
    )
    op.create_index(
        "ix_ai_usage_logs_time_provider", "ai_usage_logs", ["created_at", "provider"]
    )
    op.create_index(
        "ix_ai_usage_logs_user_time", "ai_usage_logs", ["user_id", "created_at"]
    )

    # Create ai_pricing_configs table
    op.create_table(
        "ai_pricing_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("model", sa.String(50), nullable=False),
        sa.Column("input_cost_per_1k", sa.Numeric(10, 8), nullable=False),
        sa.Column("output_cost_per_1k", sa.Numeric(10, 8), nullable=False),
        sa.Column(
            "effective_date",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for ai_pricing_configs
    op.create_index("ix_ai_pricing_configs_id", "ai_pricing_configs", ["id"])
    op.create_index(
        "ix_ai_pricing_configs_provider_model",
        "ai_pricing_configs",
        ["provider", "model"],
    )
    op.create_index(
        "ix_ai_pricing_configs_active",
        "ai_pricing_configs",
        ["is_active", "provider", "model"],
    )

    # Seed default pricing data
    op.execute("""
        INSERT INTO ai_pricing_configs (provider, model, input_cost_per_1k, output_cost_per_1k, is_active)
        VALUES
            ('openai', 'gpt-4o-mini', 0.00015000, 0.00060000, true),
            ('gemini', 'gemini-2.0-flash', 0.00007500, 0.00030000, true),
            ('openai', 'text-embedding-3-small', 0.00002000, 0.00002000, true),
            ('gemini', 'text-embedding-004', 0.00002500, 0.00002500, true)
    """)


def downgrade() -> None:
    # Drop indexes for ai_pricing_configs
    op.drop_index("ix_ai_pricing_configs_active", table_name="ai_pricing_configs")
    op.drop_index("ix_ai_pricing_configs_provider_model", table_name="ai_pricing_configs")
    op.drop_index("ix_ai_pricing_configs_id", table_name="ai_pricing_configs")

    # Drop ai_pricing_configs table
    op.drop_table("ai_pricing_configs")

    # Drop indexes for ai_usage_logs
    op.drop_index("ix_ai_usage_logs_user_time", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_time_provider", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_time_endpoint", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_created_at", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_model", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_provider", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_endpoint", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_user_id", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_id", table_name="ai_usage_logs")

    # Drop ai_usage_logs table
    op.drop_table("ai_usage_logs")
