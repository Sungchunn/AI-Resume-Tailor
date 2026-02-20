"""
Alembic environment configuration for async SQLAlchemy.

This module configures Alembic to work with async database connections
and automatically detect model changes for autogeneration.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

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
    Workshop,
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
    """Get database URL, converting async driver to sync for migrations."""
    url = settings.database_url
    # Alembic needs synchronous driver for some operations
    # asyncpg -> psycopg2 for sync operations
    return url.replace("+asyncpg", "+psycopg2")


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


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with the provided connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    Run migrations in 'online' mode with async engine.

    Creates an async Engine and associates a connection with the context.
    """
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = settings.database_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
