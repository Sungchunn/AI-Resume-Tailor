"""
Alembic environment configuration for SQLAlchemy.

This module configures Alembic to work with synchronous database connections
(psycopg2) for migrations while the main app uses async (asyncpg).
"""

from logging.config import fileConfig

from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Connection

from alembic import context

# Import the SQLAlchemy Base and all models to enable autogeneration
from app.db.session import Base
from app.models import (  # noqa: F401 - imported for model registration
    User,
    Resume,
    JobDescription,
    JobListing,
    UserJobInteraction,
    TailoredResume,
    ExperienceBlock,
    ResumeBuild,
    AuditLog,
    ScraperRun,
)
from app.core.config import get_settings

# Alembic Config object
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogeneration
target_metadata = Base.metadata

# Get database URL from settings
settings = get_settings()


def get_url() -> str:
    """Get sync database URL for migrations."""
    # Prefer explicit sync URL if available, otherwise convert async URL
    if settings.database_url_sync:
        return settings.database_url_sync
    # Fallback: convert asyncpg -> psycopg2
    return settings.database_url.replace("+asyncpg", "+psycopg2")


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine.
    Calls to context.execute() emit the given string to the script output.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode with sync engine.

    Creates a sync Engine and associates a connection with the context.
    """
    connectable = create_engine(
        get_url(),
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
