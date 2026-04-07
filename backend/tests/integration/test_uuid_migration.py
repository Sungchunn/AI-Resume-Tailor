"""
Phase 1 Integration Tests: UUID Migration Verification.

Tests that verify the UUID migration was successful and database
constraints are properly configured.

IMPORTANT: These tests require a PostgreSQL database.
They will be skipped when running against SQLite.

To run these tests:
1. Set TEST_DATABASE_URL to a PostgreSQL connection string
2. Run: pytest tests/integration/test_uuid_migration.py -v
"""

import os

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db.session import Base
from app.models.job import JobDescription
from app.models.resume_build import ResumeBuild
from app.models.user import User


# Skip all tests if not using PostgreSQL
pytestmark = pytest.mark.skipif(
    "postgresql" not in os.environ.get("TEST_DATABASE_URL", ""),
    reason="UUID migration tests require PostgreSQL database",
)


@pytest_asyncio.fixture
async def pg_engine():
    """Create a PostgreSQL engine for migration testing."""
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url or "postgresql" not in database_url:
        pytest.skip("PostgreSQL database required for migration tests")

    engine = create_async_engine(
        database_url,
        poolclass=NullPool,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(pg_engine):
    """Create a database session for testing."""
    session_maker = async_sessionmaker(
        pg_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_maker() as session:
        # Create test user for FK constraints
        user = User(
            id=1,
            email="test@example.com",
            hashed_password="hashed123",
            full_name="Test User",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        yield session


class TestUUIDMigration:
    """Test UUID migration was successful."""

    async def test_all_jobs_have_uuid(self, db_session: AsyncSession):
        """Every job_description record should have a public_id."""
        # Create a job without explicitly setting public_id
        job = JobDescription(
            title="Test Job",
            owner_id=1,
            raw_content="Test content",
        )
        db_session.add(job)
        await db_session.commit()

        # Verify public_id is set
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM job_descriptions WHERE public_id IS NULL")
        )
        null_count = result.scalar()
        assert null_count == 0, f"Found {null_count} jobs without public_id"

    async def test_all_builds_have_uuid(self, db_session: AsyncSession):
        """Every resume_build record should have a public_id."""
        # Create a build without explicitly setting public_id
        build = ResumeBuild(
            job_title="Test Build",
            user_id=1,
            status="draft",
        )
        db_session.add(build)
        await db_session.commit()

        # Verify public_id is set
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM resume_builds WHERE public_id IS NULL")
        )
        null_count = result.scalar()
        assert null_count == 0, f"Found {null_count} builds without public_id"

    async def test_uuid_column_exists_on_jobs(self, db_session: AsyncSession):
        """Verify public_id column exists on job_descriptions table."""
        result = await db_session.execute(
            text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'job_descriptions'
                AND column_name = 'public_id'
            """)
        )
        row = result.fetchone()
        assert row is not None, "public_id column should exist on job_descriptions"
        assert row[1] == "uuid", f"public_id should be UUID type, got {row[1]}"

    async def test_uuid_column_exists_on_builds(self, db_session: AsyncSession):
        """Verify public_id column exists on resume_builds table."""
        result = await db_session.execute(
            text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'resume_builds'
                AND column_name = 'public_id'
            """)
        )
        row = result.fetchone()
        assert row is not None, "public_id column should exist on resume_builds"
        assert row[1] == "uuid", f"public_id should be UUID type, got {row[1]}"


class TestUUIDIndexes:
    """Test UUID indexes exist for fast lookups."""

    async def test_job_descriptions_uuid_index_exists(self, db_session: AsyncSession):
        """Unique index on job_descriptions.public_id should exist."""
        result = await db_session.execute(
            text("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'job_descriptions'
                AND indexname LIKE '%public_id%'
            """)
        )
        indexes = result.scalars().all()
        assert len(indexes) > 0, "No index found on job_descriptions.public_id"

    async def test_resume_builds_uuid_index_exists(self, db_session: AsyncSession):
        """Unique index on resume_builds.public_id should exist."""
        result = await db_session.execute(
            text("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'resume_builds'
                AND indexname LIKE '%public_id%'
            """)
        )
        indexes = result.scalars().all()
        assert len(indexes) > 0, "No index found on resume_builds.public_id"


class TestUUIDConstraints:
    """Test UUID uniqueness constraints."""

    async def test_job_uuid_uniqueness_constraint(self, db_session: AsyncSession):
        """Duplicate UUIDs should be rejected on job_descriptions."""
        # Create first job
        job1 = JobDescription(
            title="Job 1",
            owner_id=1,
            raw_content="Content 1",
        )
        db_session.add(job1)
        await db_session.flush()

        # Get the UUID
        existing_uuid = job1.public_id

        # Try to insert another job with the same UUID
        with pytest.raises(IntegrityError) as exc_info:
            await db_session.execute(
                text("""
                    INSERT INTO job_descriptions (title, owner_id, raw_content, public_id)
                    VALUES ('Duplicate', 1, 'Content', :uuid)
                """),
                {"uuid": existing_uuid},
            )
            await db_session.commit()

        assert "unique" in str(exc_info.value).lower() or "duplicate" in str(exc_info.value).lower()

    async def test_build_uuid_uniqueness_constraint(self, db_session: AsyncSession):
        """Duplicate UUIDs should be rejected on resume_builds."""
        # Create first build
        build1 = ResumeBuild(
            job_title="Build 1",
            user_id=1,
            status="draft",
        )
        db_session.add(build1)
        await db_session.flush()

        # Get the UUID
        existing_uuid = build1.public_id

        # Try to insert another build with the same UUID
        with pytest.raises(IntegrityError) as exc_info:
            await db_session.execute(
                text("""
                    INSERT INTO resume_builds (job_title, user_id, status, public_id)
                    VALUES ('Duplicate', 1, 'draft', :uuid)
                """),
                {"uuid": existing_uuid},
            )
            await db_session.commit()

        assert "unique" in str(exc_info.value).lower() or "duplicate" in str(exc_info.value).lower()


class TestServerDefaults:
    """Test database-level UUID defaults (gen_random_uuid())."""

    async def test_job_uuid_generated_by_database(self, db_session: AsyncSession):
        """UUID should be generated by database if not provided."""
        # Insert without providing public_id (relies on server_default)
        await db_session.execute(
            text("""
                INSERT INTO job_descriptions (title, owner_id, raw_content)
                VALUES ('Server Default Job', 1, 'Content')
            """)
        )
        await db_session.commit()

        # Verify UUID was generated
        result = await db_session.execute(
            text("""
                SELECT public_id FROM job_descriptions
                WHERE title = 'Server Default Job'
            """)
        )
        uuid_value = result.scalar()
        assert uuid_value is not None, "Database should generate UUID via server_default"

    async def test_build_uuid_generated_by_database(self, db_session: AsyncSession):
        """UUID should be generated by database if not provided."""
        # Insert without providing public_id (relies on server_default)
        await db_session.execute(
            text("""
                INSERT INTO resume_builds (job_title, user_id, status)
                VALUES ('Server Default Build', 1, 'draft')
            """)
        )
        await db_session.commit()

        # Verify UUID was generated
        result = await db_session.execute(
            text("""
                SELECT public_id FROM resume_builds
                WHERE job_title = 'Server Default Build'
            """)
        )
        uuid_value = result.scalar()
        assert uuid_value is not None, "Database should generate UUID via server_default"
