"""
Row Level Security (RLS) Policy Tests.

These tests verify that PostgreSQL RLS policies correctly enforce
user data isolation at the database level.

IMPORTANT: These tests require a PostgreSQL database with RLS enabled.
They will be skipped when running against SQLite (default test setup).

To run these tests:
1. Set TEST_DATABASE_URL to a PostgreSQL connection string
2. Run: pytest tests/test_rls_policies.py -v

These tests validate the defense-in-depth layer that RLS provides,
ensuring data isolation even if application-level authorization is bypassed.
"""

import os

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db.session import Base
from app.models.job import JobDescription
from app.models.user import User

# Skip all tests if not using PostgreSQL
pytestmark = pytest.mark.skipif(
    "postgresql" not in os.environ.get("TEST_DATABASE_URL", ""),
    reason="RLS tests require PostgreSQL database",
)


@pytest_asyncio.fixture
async def pg_engine():
    """Create a PostgreSQL engine for RLS testing."""
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url or "postgresql" not in database_url:
        pytest.skip("PostgreSQL database required for RLS tests")

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
async def session_maker(pg_engine):
    """Create session maker for RLS tests."""
    return async_sessionmaker(
        pg_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest_asyncio.fixture
async def test_users(session_maker):
    """Create two test users for cross-user access testing."""
    async with session_maker() as session:
        user1 = User(
            id=1,
            email="user1@example.com",
            hashed_password="hashed123",
            full_name="Test User 1",
            is_active=True,
        )
        user2 = User(
            id=2,
            email="user2@example.com",
            hashed_password="hashed456",
            full_name="Test User 2",
            is_active=True,
        )
        session.add_all([user1, user2])
        await session.commit()
        return {"user1": user1, "user2": user2}


@pytest_asyncio.fixture
async def user1_session(session_maker, test_users):
    """Session with user 1 RLS context.

    Uses session-scoped SET (not SET LOCAL) so the context persists
    across commits within the test.
    """
    async with session_maker() as session:
        # Use session-scoped SET so context survives commits
        await session.execute(text("SET app.current_user_id = '1'"))
        await session.commit()  # Commit to apply the setting
        try:
            yield session
        finally:
            # Clean up session variable
            await session.execute(text("RESET app.current_user_id"))
            await session.commit()


@pytest_asyncio.fixture
async def user2_session(session_maker, test_users):
    """Session with user 2 RLS context.

    Uses session-scoped SET (not SET LOCAL) so the context persists
    across commits within the test.
    """
    async with session_maker() as session:
        # Use session-scoped SET so context survives commits
        await session.execute(text("SET app.current_user_id = '2'"))
        await session.commit()  # Commit to apply the setting
        try:
            yield session
        finally:
            # Clean up session variable
            await session.execute(text("RESET app.current_user_id"))
            await session.commit()


@pytest_asyncio.fixture
async def no_user_session(session_maker, test_users):
    """Session with no user context (should see nothing)."""
    async with session_maker() as session:
        await session.execute(text("RESET app.current_user_id"))
        await session.commit()
        try:
            yield session
        finally:
            pass  # No cleanup needed


class TestJobDescriptionsRLS:
    """Test RLS policies on job_descriptions table."""

    async def test_user_can_only_see_own_jobs(
        self,
        user1_session: AsyncSession,
        user2_session: AsyncSession,
    ):
        """User 1 cannot see User 2's jobs."""
        # Create job as user 1
        job = JobDescription(
            title="User 1 Job",
            owner_id=1,
            company="Test Corp",
            description="Test job description",
        )
        user1_session.add(job)
        await user1_session.commit()

        # User 1 can see it
        result = await user1_session.execute(
            text("SELECT id FROM job_descriptions WHERE title = 'User 1 Job'")
        )
        assert result.scalar() is not None

        # User 2 cannot see it
        result = await user2_session.execute(
            text("SELECT id FROM job_descriptions WHERE title = 'User 1 Job'")
        )
        assert result.scalar() is None

    async def test_no_context_sees_nothing(
        self,
        no_user_session: AsyncSession,
        user1_session: AsyncSession,
    ):
        """Session without user context sees no rows."""
        # Create job as user 1
        job = JobDescription(
            title="Test Job",
            owner_id=1,
            company="Test Corp",
            description="Test job description",
        )
        user1_session.add(job)
        await user1_session.commit()

        # No context session sees nothing
        result = await no_user_session.execute(
            text("SELECT COUNT(*) FROM job_descriptions")
        )
        assert result.scalar() == 0

    async def test_user_cannot_insert_as_another_user(
        self,
        user1_session: AsyncSession,
    ):
        """User 1 cannot create a job owned by User 2."""
        with pytest.raises(Exception):  # RLS violation
            await user1_session.execute(
                text("""
                    INSERT INTO job_descriptions (title, owner_id, company, description)
                    VALUES ('Malicious Job', 2, 'Evil Corp', 'Trying to create for another user')
                """)
            )
            await user1_session.commit()

    async def test_user_cannot_update_another_users_job(
        self,
        user1_session: AsyncSession,
        user2_session: AsyncSession,
    ):
        """User 2 cannot update User 1's job."""
        # Create job as user 1 using raw SQL to get a predictable ID
        await user1_session.execute(
            text("""
                INSERT INTO job_descriptions (id, title, owner_id, company, description)
                VALUES (999, 'Original Title', 1, 'Test Corp', 'Original description')
            """)
        )
        await user1_session.commit()

        # User 2 tries to update - should affect 0 rows
        result = await user2_session.execute(
            text("""
                UPDATE job_descriptions
                SET title = 'Hacked Title'
                WHERE id = 999
            """)
        )
        assert result.rowcount == 0

        # Verify job still has original title (check as user 1)
        result = await user1_session.execute(
            text("SELECT title FROM job_descriptions WHERE id = 999")
        )
        assert result.scalar() == "Original Title"

    async def test_user_cannot_delete_another_users_job(
        self,
        user1_session: AsyncSession,
        user2_session: AsyncSession,
    ):
        """User 2 cannot delete User 1's job."""
        # Create job as user 1
        await user1_session.execute(
            text("""
                INSERT INTO job_descriptions (id, title, owner_id, company, description)
                VALUES (998, 'To Delete', 1, 'Test Corp', 'Test description')
            """)
        )
        await user1_session.commit()

        # User 2 tries to delete - should affect 0 rows
        result = await user2_session.execute(
            text("DELETE FROM job_descriptions WHERE id = 998")
        )
        assert result.rowcount == 0

        # Job still exists (verify as user 1)
        result = await user1_session.execute(
            text("SELECT id FROM job_descriptions WHERE id = 998")
        )
        assert result.scalar() == 998


class TestResumeBuildsRLS:
    """Test RLS policies on resume_builds table."""

    async def test_user_can_only_see_own_builds(
        self,
        user1_session: AsyncSession,
        user2_session: AsyncSession,
    ):
        """User 1 cannot see User 2's resume builds."""
        # Create resume build as user 1
        await user1_session.execute(
            text("""
                INSERT INTO resume_builds (id, user_id, job_title, status)
                VALUES (100, 1, 'User 1 Build', 'draft')
            """)
        )
        await user1_session.commit()

        # User 1 can see it
        result = await user1_session.execute(
            text("SELECT id FROM resume_builds WHERE job_title = 'User 1 Build'")
        )
        assert result.scalar() is not None

        # User 2 cannot see it
        result = await user2_session.execute(
            text("SELECT id FROM resume_builds WHERE job_title = 'User 1 Build'")
        )
        assert result.scalar() is None

    async def test_user_cannot_insert_build_for_another_user(
        self,
        user1_session: AsyncSession,
    ):
        """User 1 cannot create a resume build for User 2."""
        with pytest.raises(Exception):  # RLS violation
            await user1_session.execute(
                text("""
                    INSERT INTO resume_builds (id, user_id, job_title, status)
                    VALUES (101, 2, 'Malicious Build', 'draft')
                """)
            )
            await user1_session.commit()

    async def test_user_cannot_update_another_users_build(
        self,
        user1_session: AsyncSession,
        user2_session: AsyncSession,
    ):
        """User 2 cannot update User 1's resume build."""
        # Create build as user 1
        await user1_session.execute(
            text("""
                INSERT INTO resume_builds (id, user_id, job_title, status)
                VALUES (102, 1, 'Original Build', 'draft')
            """)
        )
        await user1_session.commit()

        # User 2 tries to update - should affect 0 rows
        result = await user2_session.execute(
            text("""
                UPDATE resume_builds
                SET job_title = 'Hacked Build'
                WHERE id = 102
            """)
        )
        assert result.rowcount == 0

    async def test_user_cannot_delete_another_users_build(
        self,
        user1_session: AsyncSession,
        user2_session: AsyncSession,
    ):
        """User 2 cannot delete User 1's resume build."""
        # Create build as user 1
        await user1_session.execute(
            text("""
                INSERT INTO resume_builds (id, user_id, job_title, status)
                VALUES (103, 1, 'To Delete Build', 'draft')
            """)
        )
        await user1_session.commit()

        # User 2 tries to delete - should affect 0 rows
        result = await user2_session.execute(
            text("DELETE FROM resume_builds WHERE id = 103")
        )
        assert result.rowcount == 0

        # Build still exists (verify as user 1)
        result = await user1_session.execute(
            text("SELECT id FROM resume_builds WHERE id = 103")
        )
        assert result.scalar() == 103


class TestUserJobInteractionsRLS:
    """Test RLS policies on user_job_interactions table."""

    async def test_user_can_only_see_own_interactions(
        self,
        user1_session: AsyncSession,
        user2_session: AsyncSession,
    ):
        """User 1 cannot see User 2's job interactions."""
        # First create a job listing (not user-owned)
        await user1_session.execute(
            text("""
                INSERT INTO job_listings (id, title, company, external_id, url, source)
                VALUES (1, 'Software Engineer', 'Tech Corp', 'ext123', 'http://example.com', 'linkedin')
            """)
        )
        await user1_session.commit()

        # Create interaction as user 1
        await user1_session.execute(
            text("""
                INSERT INTO user_job_interactions (id, user_id, job_listing_id, is_saved)
                VALUES (200, 1, 1, true)
            """)
        )
        await user1_session.commit()

        # User 1 can see it
        result = await user1_session.execute(
            text("SELECT id FROM user_job_interactions WHERE user_id = 1")
        )
        assert result.scalar() is not None

        # User 2 cannot see it
        result = await user2_session.execute(
            text("SELECT id FROM user_job_interactions WHERE user_id = 1")
        )
        assert result.scalar() is None

    async def test_user_cannot_create_interaction_for_another_user(
        self,
        user1_session: AsyncSession,
    ):
        """User 1 cannot create an interaction for User 2."""
        # Ensure job listing exists
        await user1_session.execute(
            text("""
                INSERT INTO job_listings (id, title, company, external_id, url, source)
                VALUES (2, 'Another Job', 'Corp', 'ext456', 'http://example.com/2', 'linkedin')
                ON CONFLICT (id) DO NOTHING
            """)
        )
        await user1_session.commit()

        with pytest.raises(Exception):  # RLS violation
            await user1_session.execute(
                text("""
                    INSERT INTO user_job_interactions (id, user_id, job_listing_id, is_saved)
                    VALUES (201, 2, 2, true)
                """)
            )
            await user1_session.commit()


class TestRLSContextSetting:
    """Test that RLS context is properly set and cleared."""

    async def test_session_variable_is_set(
        self,
        user1_session: AsyncSession,
    ):
        """Verify session variable is correctly set."""
        result = await user1_session.execute(
            text("SELECT current_setting('app.current_user_id', true)")
        )
        assert result.scalar() == "1"

    async def test_different_sessions_have_different_context(
        self,
        user1_session: AsyncSession,
        user2_session: AsyncSession,
    ):
        """Verify different sessions have isolated contexts."""
        result1 = await user1_session.execute(
            text("SELECT current_setting('app.current_user_id', true)")
        )
        result2 = await user2_session.execute(
            text("SELECT current_setting('app.current_user_id', true)")
        )
        assert result1.scalar() == "1"
        assert result2.scalar() == "2"

    async def test_no_context_returns_empty(
        self,
        no_user_session: AsyncSession,
    ):
        """Verify session without context has empty/null user_id."""
        result = await no_user_session.execute(
            text("SELECT current_setting('app.current_user_id', true)")
        )
        setting = result.scalar()
        assert setting is None or setting == ""
