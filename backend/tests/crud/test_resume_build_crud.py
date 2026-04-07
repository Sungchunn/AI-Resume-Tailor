"""
Phase 2 CRUD Tests: ResumeBuild CRUD Operations with public_id.

Tests that verify CRUD operations using UUID public_id lookups work correctly.

IMPORTANT: ResumeBuild uses JSONB and ARRAY columns which are not fully
compatible with SQLite. These tests require PostgreSQL to run correctly.
"""

import os
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.resume_build import resume_build_repository
from app.models.resume_build import ResumeBuild

# Skip all tests if using SQLite (default test setup)
# ResumeBuild has JSONB and ARRAY columns that don't work with SQLite
pytestmark = pytest.mark.skipif(
    "postgresql" not in os.environ.get("TEST_DATABASE_URL", "sqlite"),
    reason="ResumeBuild tests require PostgreSQL (JSONB/ARRAY columns)",
)


class TestResumeBuildCRUDPublicId:
    """Test CRUD operations with public_id."""

    @pytest_asyncio.fixture
    async def sample_build(self, db_session: AsyncSession):
        """Create a sample resume build for testing."""
        build = ResumeBuild(
            job_title="Sample Job Title",
            user_id=1,
            job_company="Test Corp",
            job_description="Test job description for tailoring.",
            status="draft",
        )
        db_session.add(build)
        await db_session.commit()
        await db_session.refresh(build)
        return build

    async def test_get_by_public_id(
        self,
        db_session: AsyncSession,
        sample_build: ResumeBuild,
    ):
        """Should retrieve build by public_id with user check."""
        found = await resume_build_repository.get_by_public_id(
            db_session,
            public_id=sample_build.public_id,
            user_id=1,
        )
        assert found is not None
        assert found["id"] == sample_build.id
        assert found["job_title"] == sample_build.job_title
        assert found["public_id"] == sample_build.public_id

    async def test_get_by_public_id_not_found(self, db_session: AsyncSession):
        """Should return None for non-existent public_id."""
        fake_uuid = uuid4()
        found = await resume_build_repository.get_by_public_id(
            db_session,
            public_id=fake_uuid,
            user_id=1,
        )
        assert found is None

    async def test_get_by_public_id_wrong_user(
        self,
        db_session: AsyncSession,
        sample_build: ResumeBuild,
    ):
        """Should return None when user doesn't match."""
        found = await resume_build_repository.get_by_public_id(
            db_session,
            public_id=sample_build.public_id,
            user_id=999,  # Different user
        )
        assert found is None

    async def test_get_model_by_public_id(
        self,
        db_session: AsyncSession,
        sample_build: ResumeBuild,
    ):
        """Should retrieve raw model by public_id."""
        found = await resume_build_repository.get_model_by_public_id(
            db_session,
            public_id=sample_build.public_id,
            user_id=1,
        )
        assert found is not None
        assert isinstance(found, ResumeBuild)
        assert found.id == sample_build.id

    async def test_get_model_by_public_id_wrong_user(
        self,
        db_session: AsyncSession,
        sample_build: ResumeBuild,
    ):
        """Model lookup should fail for wrong user."""
        found = await resume_build_repository.get_model_by_public_id(
            db_session,
            public_id=sample_build.public_id,
            user_id=999,
        )
        assert found is None


class TestResumeBuildCRUDCreate:
    """Test resume build creation assigns UUID."""

    async def test_create_assigns_uuid(self, db_session: AsyncSession):
        """Creating a build should auto-assign a public_id."""
        build_data = await resume_build_repository.create(
            db_session,
            user_id=1,
            job_title="New Job",
            job_description="New description",
            job_company="New Corp",
        )
        await db_session.commit()

        assert build_data["public_id"] is not None
        assert isinstance(build_data["public_id"], UUID)

    async def test_create_uuid_is_unique(self, db_session: AsyncSession):
        """Each created build should have a unique public_id."""
        build1 = await resume_build_repository.create(
            db_session,
            user_id=1,
            job_title="Job 1",
            job_description="Description 1",
        )
        build2 = await resume_build_repository.create(
            db_session,
            user_id=1,
            job_title="Job 2",
            job_description="Description 2",
        )
        await db_session.commit()

        assert build1["public_id"] != build2["public_id"]


class TestResumeBuildCRUDOwnership:
    """Test ownership verification in all CRUD operations."""

    @pytest_asyncio.fixture
    async def user1_build(self, db_session: AsyncSession):
        """Create a build owned by user 1."""
        build = ResumeBuild(
            job_title="User 1 Build",
            user_id=1,
            status="draft",
        )
        db_session.add(build)
        await db_session.commit()
        await db_session.refresh(build)
        return build

    async def test_list_only_returns_own_builds(self, db_session: AsyncSession):
        """list_builds should only return builds owned by the user."""
        # Create builds for different users
        build1 = ResumeBuild(job_title="User 1 Build", user_id=1, status="draft")
        build2 = ResumeBuild(job_title="User 2 Build", user_id=2, status="draft")
        db_session.add_all([build1, build2])
        await db_session.commit()

        # List for user 1
        builds = await resume_build_repository.list_builds(db_session, user_id=1)
        assert len(builds) == 1
        assert builds[0]["job_title"] == "User 1 Build"

    async def test_get_respects_ownership(
        self,
        db_session: AsyncSession,
        user1_build: ResumeBuild,
    ):
        """get should return None for wrong user."""
        # User 1 can access
        found = await resume_build_repository.get(
            db_session,
            resume_build_id=user1_build.id,
            user_id=1,
        )
        assert found is not None

        # User 2 cannot access
        found = await resume_build_repository.get(
            db_session,
            resume_build_id=user1_build.id,
            user_id=2,
        )
        assert found is None

    async def test_delete_respects_ownership(
        self,
        db_session: AsyncSession,
        user1_build: ResumeBuild,
    ):
        """delete should fail for wrong user."""
        build_id = user1_build.id

        # User 2 cannot delete
        deleted = await resume_build_repository.delete(
            db_session,
            resume_build_id=build_id,
            user_id=2,
        )
        assert deleted is False

        # User 1 can delete
        deleted = await resume_build_repository.delete(
            db_session,
            resume_build_id=build_id,
            user_id=1,
        )
        assert deleted is True


class TestResumeBuildDataConversion:
    """Test that ResumeBuildData includes public_id."""

    async def test_data_includes_public_id(self, db_session: AsyncSession):
        """ResumeBuildData should include public_id field."""
        build_data = await resume_build_repository.create(
            db_session,
            user_id=1,
            job_title="Test Job",
            job_description="Test description",
        )
        await db_session.commit()

        assert "public_id" in build_data
        assert build_data["public_id"] is not None

    async def test_list_includes_public_ids(self, db_session: AsyncSession):
        """Listed builds should include public_id."""
        await resume_build_repository.create(
            db_session,
            user_id=1,
            job_title="Test Job",
            job_description="Test description",
        )
        await db_session.commit()

        builds = await resume_build_repository.list_builds(db_session, user_id=1)
        assert len(builds) == 1
        assert "public_id" in builds[0]
        assert builds[0]["public_id"] is not None
