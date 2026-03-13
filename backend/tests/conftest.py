import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from mongomock_motor import AsyncMongoMockClient

# Disable rate limiting for tests
os.environ["RATE_LIMIT_ENABLED"] = "false"

from app.main import app
from app.db.session import Base
from app.api.deps import get_current_user_id, get_db_session, get_mongo_db
from app.models.user import User

# Use SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# Compile PostgreSQL JSONB as JSON for SQLite compatibility
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign keys for SQLite."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# Override PostgreSQL types for SQLite compatibility
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import ARRAY


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    # SQLite doesn't support arrays, use JSON instead
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
    """Create a fresh database for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        # Create a test user with id=1 to satisfy foreign key constraints
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


@pytest_asyncio.fixture
async def mongo_db():
    """Create a fresh MongoDB mock database for each test."""
    client = AsyncMongoMockClient()
    db = client["test_database"]
    yield db
    # Clean up collections after test
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
    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    app.dependency_overrides[get_mongo_db] = override_get_mongo_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
