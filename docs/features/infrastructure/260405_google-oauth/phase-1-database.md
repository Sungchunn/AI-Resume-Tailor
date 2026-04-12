# Phase 1: Database Schema Changes

## Overview

Add OAuth-related columns to the `users` table to track authentication method and Google account linking.

## Schema Changes

| Column | Type | Nullable | Default | Index | Notes |
| ------ | ---- | -------- | ------- | ----- | ----- |
| `auth_provider` | `VARCHAR(20)` | No | `"email"` | No | Primary auth method |
| `google_id` | `VARCHAR(255)` | Yes | `NULL` | Yes (unique) | Google's `sub` claim |
| `google_linked_at` | `TIMESTAMP WITH TZ` | Yes | `NULL` | No | When Google was linked |
| `hashed_password` | - | Yes (change) | - | - | Allow NULL for Google-only users |

## Model Changes

**File:** `/backend/app/models/user.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Changed: nullable for Google-only
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # OAuth fields
    auth_provider = Column(String(20), default="email", nullable=False)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    google_linked_at = Column(DateTime(timezone=True), nullable=True)

    # User profile fields
    headline = Column(String(255), nullable=True)
    about_me = Column(Text, nullable=True)
    about_me_generated_at = Column(DateTime(timezone=True), nullable=True)
    timezone = Column(String(100), nullable=True, default="UTC")

    # Relationships
    resumes = relationship("Resume", back_populates="owner", cascade="all, delete-orphan")
    job_descriptions = relationship("JobDescription", back_populates="owner", cascade="all, delete-orphan")
    resume_builds = relationship("ResumeBuild", back_populates="owner", cascade="all, delete-orphan")
    job_interactions = relationship(
        "UserJobInteraction", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def workshops(self):
        return self.resume_builds

    @property
    def has_password(self) -> bool:
        """Check if user can use password login."""
        return self.hashed_password is not None

    @property
    def google_linked(self) -> bool:
        """Check if Google is linked to this account."""
        return self.google_id is not None
```

## Migration

**File:** `/backend/alembic/versions/050426_0001_add_google_oauth_fields.py`

```python
"""Add Google OAuth fields to users table

Revision ID: 050426_0001
Revises: <previous_revision>
Create Date: 2026-04-05
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '050426_0001'
down_revision = '<previous_revision>'  # Update this
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add auth_provider column with default for existing users
    op.add_column(
        'users',
        sa.Column('auth_provider', sa.String(20), nullable=False, server_default='email')
    )

    # Add google_id column with unique constraint
    op.add_column(
        'users',
        sa.Column('google_id', sa.String(255), nullable=True)
    )
    op.create_index('ix_users_google_id', 'users', ['google_id'], unique=True)

    # Add google_linked_at column
    op.add_column(
        'users',
        sa.Column('google_linked_at', sa.DateTime(timezone=True), nullable=True)
    )

    # Make hashed_password nullable (for Google-only users)
    op.alter_column(
        'users',
        'hashed_password',
        existing_type=sa.String(255),
        nullable=True
    )


def downgrade() -> None:
    # Note: Downgrade will fail if any Google-only users exist (NULL password)
    op.alter_column(
        'users',
        'hashed_password',
        existing_type=sa.String(255),
        nullable=False
    )

    op.drop_column('users', 'google_linked_at')
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_column('users', 'google_id')
    op.drop_column('users', 'auth_provider')
```

## Running the Migration

```bash
cd backend

# Generate migration (if not using the template above)
poetry run alembic revision --autogenerate -m "Add Google OAuth fields"

# Apply migration
poetry run alembic upgrade head

# Verify
poetry run alembic current
```

## Verification

After running the migration, verify the schema:

```sql
-- Check columns exist
\d users

-- Verify all existing users have auth_provider = 'email'
SELECT auth_provider, COUNT(*) FROM users GROUP BY auth_provider;

-- Should return:
-- auth_provider | count
-- email         | <your_user_count>
```
