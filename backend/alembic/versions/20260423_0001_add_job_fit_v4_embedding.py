"""Add job_listings.description_embedding for fit-score v4 hybrid math.

Revision ID: 20260423_0001
Revises: 20260420_0001
Create Date: 2026-04-23

Adds a JSONB column storing the sentence-embedding vector of each job
description. The scorer combines cosine(resume_vec, job_vec) with the
existing keyword-overlap term to produce a hybrid fit score.

Stored as JSONB (not pgvector) because the scorer loads vectors into
Python to compute cosine directly — we do not run kNN search at the
database level.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "20260423_0001"
down_revision: str | None = "20260420_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "job_listings",
        sa.Column("description_embedding", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("job_listings", "description_embedding")
