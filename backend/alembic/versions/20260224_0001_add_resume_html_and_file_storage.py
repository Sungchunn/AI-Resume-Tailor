"""Add html_content and file storage columns to resumes

Revision ID: 010
Revises: 009
Create Date: 2026-02-24

This migration adds support for:
- html_content: TipTap-compatible HTML for rich text editing
- original_file_key: Path to the original uploaded file in MinIO/S3
- original_filename: Original name of the uploaded file
- file_type: Type of the original file (pdf, docx)
- file_size_bytes: Size of the original uploaded file
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in the table."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table_name "
            "AND column_name = :column_name)"
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return result.scalar()


def upgrade() -> None:
    # Add html_content column for TipTap-compatible HTML
    if not column_exists("resumes", "html_content"):
        op.add_column(
            "resumes",
            sa.Column("html_content", sa.Text(), nullable=True),
        )

    # Add file storage columns
    if not column_exists("resumes", "original_file_key"):
        op.add_column(
            "resumes",
            sa.Column("original_file_key", sa.String(512), nullable=True),
        )

    if not column_exists("resumes", "original_filename"):
        op.add_column(
            "resumes",
            sa.Column("original_filename", sa.String(255), nullable=True),
        )

    if not column_exists("resumes", "file_type"):
        op.add_column(
            "resumes",
            sa.Column("file_type", sa.String(10), nullable=True),
        )

    if not column_exists("resumes", "file_size_bytes"):
        op.add_column(
            "resumes",
            sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    # Remove columns in reverse order
    columns_to_remove = [
        "file_size_bytes",
        "file_type",
        "original_filename",
        "original_file_key",
        "html_content",
    ]

    for col_name in columns_to_remove:
        if column_exists("resumes", col_name):
            op.drop_column("resumes", col_name)
