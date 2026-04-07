"""
Phase 2 CRUD Tests: Job CRUD Operations with public_id.

Tests that verify CRUD operations using UUID public_id lookups work correctly.
"""

import pytest
import pytest_asyncio
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.job import job_crud
from app.models.job import JobDescription
from app.schemas.job import JobCreate, JobUpdate


class TestJobCRUDPublicId:
    """Test CRUD operations with public_id."""

    @pytest_asyncio.fixture
    async def sample_job(self, db_session: AsyncSession):
        """Create a sample job for testing."""
        job = JobDescription(
            title="Sample Job",
            owner_id=1,
            company="Test Corp",
            raw_content="This is a test job description.",
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)
        return job

    async def test_get_by_public_id(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription,
    ):
        """Should retrieve job by public_id."""
        found = await job_crud.get_by_public_id(
            db_session,
            public_id=sample_job.public_id,
        )
        assert found is not None
        assert found.id == sample_job.id
        assert found.title == sample_job.title
        assert found.public_id == sample_job.public_id

    async def test_get_by_public_id_not_found(self, db_session: AsyncSession):
        """Should return None for non-existent public_id."""
        fake_uuid = uuid4()
        found = await job_crud.get_by_public_id(
            db_session,
            public_id=fake_uuid,
        )
        assert found is None

    async def test_get_by_public_id_and_owner_success(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription,
    ):
        """Should retrieve job when owner matches."""
        found = await job_crud.get_by_public_id_and_owner(
            db_session,
            public_id=sample_job.public_id,
            owner_id=1,
        )
        assert found is not None
        assert found.id == sample_job.id
        assert found.title == sample_job.title

    async def test_get_by_public_id_and_owner_wrong_owner(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription,
    ):
        """Should return None when owner doesn't match."""
        found = await job_crud.get_by_public_id_and_owner(
            db_session,
            public_id=sample_job.public_id,
            owner_id=999,  # Different owner
        )
        assert found is None

    async def test_get_by_public_id_returns_correct_type(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription,
    ):
        """Returned object should be a JobDescription instance."""
        found = await job_crud.get_by_public_id(
            db_session,
            public_id=sample_job.public_id,
        )
        assert isinstance(found, JobDescription)

    async def test_public_id_is_uuid_type(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription,
    ):
        """public_id should be a UUID type."""
        assert isinstance(sample_job.public_id, UUID)


class TestJobCRUDCreate:
    """Test job creation assigns UUID."""

    async def test_create_assigns_uuid(self, db_session: AsyncSession):
        """Creating a job should auto-assign a public_id."""
        job_in = JobCreate(
            title="New Job",
            company="New Corp",
            raw_content="New job description content.",
        )
        job = await job_crud.create(db_session, obj_in=job_in, owner_id=1)
        await db_session.commit()

        assert job.public_id is not None
        assert isinstance(job.public_id, UUID)

    async def test_create_uuid_is_unique(self, db_session: AsyncSession):
        """Each created job should have a unique public_id."""
        job_in = JobCreate(
            title="Job",
            company="Corp",
            raw_content="Content",
        )

        job1 = await job_crud.create(db_session, obj_in=job_in, owner_id=1)
        job2 = await job_crud.create(db_session, obj_in=job_in, owner_id=1)
        await db_session.commit()

        assert job1.public_id != job2.public_id


class TestJobCRUDUpdate:
    """Test that updates preserve public_id."""

    @pytest_asyncio.fixture
    async def sample_job(self, db_session: AsyncSession):
        """Create a sample job for testing."""
        job = JobDescription(
            title="Original Title",
            owner_id=1,
            company="Original Corp",
            raw_content="Original content.",
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)
        return job

    async def test_update_preserves_public_id(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription,
    ):
        """Updating a job should not change its public_id."""
        original_uuid = sample_job.public_id

        job_update = JobUpdate(title="Updated Title")
        updated = await job_crud.update(
            db_session,
            db_obj=sample_job,
            obj_in=job_update,
        )
        await db_session.commit()

        assert updated.public_id == original_uuid
        assert updated.title == "Updated Title"


class TestJobCRUDByIds:
    """Test batch fetch operations."""

    async def test_get_by_ids_returns_jobs(self, db_session: AsyncSession):
        """get_by_ids should return jobs matching the integer IDs."""
        # Create multiple jobs
        job1 = JobDescription(
            title="Job 1",
            owner_id=1,
            raw_content="Content 1",
        )
        job2 = JobDescription(
            title="Job 2",
            owner_id=1,
            raw_content="Content 2",
        )
        db_session.add_all([job1, job2])
        await db_session.commit()
        await db_session.refresh(job1)
        await db_session.refresh(job2)

        # Fetch by IDs
        jobs = await job_crud.get_by_ids(db_session, ids=[job1.id, job2.id])
        assert len(jobs) == 2

    async def test_get_by_ids_empty_list(self, db_session: AsyncSession):
        """get_by_ids with empty list should return empty list."""
        jobs = await job_crud.get_by_ids(db_session, ids=[])
        assert jobs == []

    async def test_get_by_ids_partial_match(self, db_session: AsyncSession):
        """get_by_ids should return only matching jobs."""
        job = JobDescription(
            title="Job",
            owner_id=1,
            raw_content="Content",
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)

        # Fetch with one valid and one invalid ID
        jobs = await job_crud.get_by_ids(db_session, ids=[job.id, 99999])
        assert len(jobs) == 1
        assert jobs[0].id == job.id
