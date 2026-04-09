"""Add user AI model preference and pricing configs for new models

Revision ID: 20260410_0001
Revises: 20260408_0001
Create Date: 2026-04-10

Adds preferred_ai_model column to users table and seeds pricing
configs for gpt-4o and o3-mini models.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from decimal import Decimal

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260410_0001"
down_revision: str | None = "20260408_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add preferred_ai_model column to users table
    op.add_column(
        "users",
        sa.Column("preferred_ai_model", sa.String(50), nullable=True),
    )

    # Seed pricing configs for new models
    ai_pricing_configs = sa.table(
        "ai_pricing_configs",
        sa.column("provider", sa.String),
        sa.column("model", sa.String),
        sa.column("input_cost_per_1k", sa.Numeric),
        sa.column("output_cost_per_1k", sa.Numeric),
        sa.column("effective_date", sa.DateTime),
        sa.column("is_active", sa.Boolean),
    )

    now = datetime.now(timezone.utc)

    op.bulk_insert(
        ai_pricing_configs,
        [
            {
                "provider": "openai",
                "model": "gpt-4o",
                "input_cost_per_1k": Decimal("0.0025"),
                "output_cost_per_1k": Decimal("0.01"),
                "effective_date": now,
                "is_active": True,
            },
            {
                "provider": "openai",
                "model": "o3-mini",
                "input_cost_per_1k": Decimal("0.0011"),
                "output_cost_per_1k": Decimal("0.0044"),
                "effective_date": now,
                "is_active": True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_column("users", "preferred_ai_model")

    # Remove seeded pricing configs
    op.execute(
        "DELETE FROM ai_pricing_configs WHERE model IN ('gpt-4o', 'o3-mini')"
    )
