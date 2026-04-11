import os

# Disable rate limiting for tests
os.environ["RATE_LIMIT_ENABLED"] = "false"

import asyncio

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.api.deps import (
    get_current_user_id,
    get_db_session,
    get_db_with_user_context,
    get_mongo_db,
)
from app.db.session import Base
from app.main import app
from app.models.user import User

# -----------------------------------------------------------------------------
# Database URL resolution
# -----------------------------------------------------------------------------
# CI sets TEST_DATABASE_URL + TEST_MONGODB_URI to point at service containers.
# Local laptop runs leave them unset and fall back to in-memory drivers so
# `pytest -x` on a dev machine stays fast and doesn't require Docker.
# -----------------------------------------------------------------------------
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "sqlite+aiosqlite:///:memory:",
)
TEST_MONGODB_URI = os.environ.get("TEST_MONGODB_URI")  # None ⇒ use mongomock

USING_SQLITE = TEST_DATABASE_URL.startswith("sqlite")
USING_POSTGRES = TEST_DATABASE_URL.startswith(("postgresql", "postgres"))


def _create_engine():
    if USING_SQLITE:
        return create_async_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    # Real Postgres — NullPool ensures every checkout opens a fresh
    # asyncpg connection bound to the current event loop. pytest-asyncio
    # uses function-scoped loops by default, and reusing pooled connections
    # across loops raises "attached to a different loop" at teardown.
    return create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
    )


engine = _create_engine()


# -----------------------------------------------------------------------------
# Postgres schema setup (one-shot, at module import)
# -----------------------------------------------------------------------------
# The spec asks for a session-scoped async fixture, but pytest-asyncio 0.23
# runs session-scoped fixtures on a different event loop than function-scoped
# tests, and asyncpg connections cannot cross loops. Running DDL synchronously
# at import time (via asyncio.run, which creates and tears down its own loop)
# sidesteps the issue entirely: by the time any test fixture runs, the schema
# already exists and the setup connection is long closed.
# -----------------------------------------------------------------------------
if USING_POSTGRES:

    async def _setup_postgres_schema():
        setup_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        try:
            async with setup_engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
        finally:
            await setup_engine.dispose()

    asyncio.run(_setup_postgres_schema())


if USING_SQLITE:
    from sqlalchemy.dialects.postgresql import ARRAY, JSONB
    from sqlalchemy.ext.compiler import compiles

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        """Enable foreign keys for SQLite."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    @compiles(JSONB, "sqlite")
    def _compile_jsonb_sqlite(type_, compiler, **kw):
        return "JSON"

    @compiles(ARRAY, "sqlite")
    def _compile_array_sqlite(type_, compiler, **kw):
        return "JSON"


TestingSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture
async def db_session():
    """Fresh, isolated session per test.

    On Postgres we wrap the test in an outer transaction and roll back
    unconditionally, leaving the database identical to its session-scoped
    initial state. On SQLite we keep the simple create_all / drop_all
    dance because StaticPool makes transaction isolation unreliable.
    """
    if USING_SQLITE:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with TestingSessionLocal() as session:
            test_user = User(
                id=1,
                email="test@example.com",
                hashed_password="hashedpassword123",
                full_name="Test User",
                is_active=True,
                is_admin=False,
            )
            session.add(test_user)
            await session.commit()
            yield session

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        return

    # Postgres path: outer transaction, rolled back at teardown.
    # join_transaction_mode="create_savepoint" makes session.commit() release
    # a savepoint instead of ending the outer transaction, so tests (and the
    # route handlers they exercise via the `client` fixture) can call commit
    # freely without leaking data between tests.
    async with engine.connect() as connection:
        trans = await connection.begin()
        async with AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        ) as session:
            test_user = User(
                id=1,
                email="test@example.com",
                hashed_password="hashedpassword123",
                full_name="Test User",
                is_active=True,
                is_admin=False,
            )
            session.add(test_user)
            await session.flush()
            # Advance the sequence past the hardcoded id=1 so subsequent
            # auto-generated ids don't collide with the fixture user.
            await session.execute(text("SELECT setval('users_id_seq', 100)"))
            yield session
        await trans.rollback()


@pytest_asyncio.fixture
async def mongo_db():
    """Real Motor client when TEST_MONGODB_URI is set; mock otherwise."""
    if TEST_MONGODB_URI:
        from motor.motor_asyncio import AsyncIOMotorClient

        client = AsyncIOMotorClient(TEST_MONGODB_URI)
        db = client.get_default_database()

        for collection_name in await db.list_collection_names():
            await db[collection_name].drop()

        yield db

        for collection_name in await db.list_collection_names():
            await db[collection_name].drop()
        client.close()
        return

    # Local fallback: mongomock.
    from mongomock_motor import AsyncMongoMockClient

    client = AsyncMongoMockClient()
    db = client["test_database"]
    yield db
    for collection_name in await db.list_collection_names():
        await db[collection_name].drop()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, mongo_db):
    """Create test client with overridden dependencies."""

    async def override_get_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    async def override_get_current_user_id():
        return 1

    def override_get_mongo_db():
        return mongo_db

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_db_with_user_context] = override_get_db  # RLS-aware dependency uses same mock
    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    app.dependency_overrides[get_mongo_db] = override_get_mongo_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
