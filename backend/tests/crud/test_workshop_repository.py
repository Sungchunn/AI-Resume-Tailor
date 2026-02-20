"""
Unit tests for WorkshopRepository.

These tests focus on the basic CRUD operations and workshop-specific
functionality like pulling blocks and managing diffs.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.crud.workshop import WorkshopRepository
from app.core.protocols import WorkshopStatus


@pytest.fixture
def workshop_repo():
    """Create a fresh WorkshopRepository instance."""
    return WorkshopRepository()


async def create_test_user(db: AsyncSession, email: str = "test@example.com") -> User:
    """Helper to create a test user."""
    user = User(
        email=email,
        hashed_password="hashed_password_123",
        full_name="Test User",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.mark.asyncio
async def test_create_workshop(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test creating a new workshop."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Senior Software Engineer",
        job_description="Looking for a senior engineer with Python experience...",
        job_company="Tech Corp",
    )

    assert workshop["id"] is not None
    assert workshop["user_id"] == user.id
    assert workshop["job_title"] == "Senior Software Engineer"
    assert workshop["job_description"] == "Looking for a senior engineer with Python experience..."
    assert workshop["job_company"] == "Tech Corp"
    assert workshop["status"] == "draft"
    assert workshop["sections"] == {}
    assert workshop["pulled_block_ids"] == []
    assert workshop["pending_diffs"] == []


@pytest.mark.asyncio
async def test_get_workshop(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test retrieving a workshop by ID."""
    user = await create_test_user(db_session)

    created = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Test description",
    )

    retrieved = await workshop_repo.get(db_session, workshop_id=created["id"], user_id=user.id)

    assert retrieved is not None
    assert retrieved["id"] == created["id"]
    assert retrieved["job_title"] == "Test Job"


@pytest.mark.asyncio
async def test_get_workshop_wrong_user(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test that workshops are scoped to users."""
    user1 = await create_test_user(db_session, "user1@example.com")
    user2 = await create_test_user(db_session, "user2@example.com")

    workshop = await workshop_repo.create(
        db_session,
        user_id=user1.id,
        job_title="User 1's workshop",
        job_description="Description",
    )

    # User 2 should not be able to access User 1's workshop
    retrieved = await workshop_repo.get(db_session, workshop_id=workshop["id"], user_id=user2.id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_list_workshops(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test listing workshops for a user."""
    user = await create_test_user(db_session)

    await workshop_repo.create(db_session, user_id=user.id, job_title="Job 1", job_description="Desc 1")
    await workshop_repo.create(db_session, user_id=user.id, job_title="Job 2", job_description="Desc 2")
    await workshop_repo.create(db_session, user_id=user.id, job_title="Job 3", job_description="Desc 3")

    workshops = await workshop_repo.list(db_session, user_id=user.id)

    assert len(workshops) == 3


@pytest.mark.asyncio
async def test_list_workshops_filter_by_status(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test filtering workshops by status."""
    user = await create_test_user(db_session)

    w1 = await workshop_repo.create(db_session, user_id=user.id, job_title="Job 1", job_description="Desc")
    w2 = await workshop_repo.create(db_session, user_id=user.id, job_title="Job 2", job_description="Desc")

    # Update one to in_progress
    await workshop_repo.update_status(
        db_session,
        workshop_id=w1["id"],
        user_id=user.id,
        status=WorkshopStatus.IN_PROGRESS,
    )

    draft_workshops = await workshop_repo.list(
        db_session,
        user_id=user.id,
        status=WorkshopStatus.DRAFT,
    )

    assert len(draft_workshops) == 1
    assert draft_workshops[0]["id"] == w2["id"]


@pytest.mark.asyncio
async def test_update_sections(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test updating workshop sections."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    updated = await workshop_repo.update_sections(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        sections={
            "summary": "Experienced software engineer...",
            "skills": ["Python", "FastAPI", "PostgreSQL"],
        },
    )

    assert updated is not None
    assert updated["sections"]["summary"] == "Experienced software engineer..."
    assert updated["sections"]["skills"] == ["Python", "FastAPI", "PostgreSQL"]
    # Status should auto-transition to in_progress
    assert updated["status"] == "in_progress"


@pytest.mark.asyncio
async def test_update_sections_merges(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test that update_sections merges with existing sections."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    # First update
    await workshop_repo.update_sections(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        sections={"summary": "Initial summary"},
    )

    # Second update should merge
    updated = await workshop_repo.update_sections(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        sections={"skills": ["Python"]},
    )

    assert updated["sections"]["summary"] == "Initial summary"
    assert updated["sections"]["skills"] == ["Python"]


@pytest.mark.asyncio
async def test_pull_blocks(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test pulling blocks into a workshop."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    updated = await workshop_repo.pull_blocks(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        block_ids=[1, 2, 3],
    )

    assert updated is not None
    assert set(updated["pulled_block_ids"]) == {1, 2, 3}
    assert updated["status"] == "in_progress"


@pytest.mark.asyncio
async def test_pull_blocks_no_duplicates(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test that pulling blocks doesn't create duplicates."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    await workshop_repo.pull_blocks(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        block_ids=[1, 2],
    )

    updated = await workshop_repo.pull_blocks(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        block_ids=[2, 3],  # 2 is duplicate
    )

    assert len(updated["pulled_block_ids"]) == 3
    assert set(updated["pulled_block_ids"]) == {1, 2, 3}


@pytest.mark.asyncio
async def test_remove_block(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test removing a block from a workshop."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    await workshop_repo.pull_blocks(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        block_ids=[1, 2, 3],
    )

    updated = await workshop_repo.remove_block(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        block_id=2,
    )

    assert updated is not None
    assert set(updated["pulled_block_ids"]) == {1, 3}


@pytest.mark.asyncio
async def test_add_pending_diffs(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test adding pending diff suggestions."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    diffs = [
        {
            "operation": "replace",
            "path": "/summary",
            "value": "Improved summary text",
            "original_value": None,
            "reason": "Better alignment with job requirements",
            "impact": "high",
            "source_block_id": 1,
        },
        {
            "operation": "add",
            "path": "/skills/-",
            "value": "AWS",
            "original_value": None,
            "reason": "Job requires AWS experience",
            "impact": "medium",
            "source_block_id": 2,
        },
    ]

    updated = await workshop_repo.add_pending_diffs(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        diffs=diffs,
    )

    assert updated is not None
    assert len(updated["pending_diffs"]) == 2
    assert updated["pending_diffs"][0]["operation"] == "replace"
    assert updated["pending_diffs"][1]["operation"] == "add"


@pytest.mark.asyncio
async def test_accept_diff(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test accepting a diff applies it to sections."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    # Set initial sections
    await workshop_repo.update_sections(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        sections={"summary": "Old summary"},
    )

    # Add a diff
    await workshop_repo.add_pending_diffs(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        diffs=[{
            "operation": "replace",
            "path": "/summary",
            "value": "New improved summary",
            "original_value": "Old summary",
            "reason": "Better wording",
            "impact": "medium",
            "source_block_id": None,
        }],
    )

    # Accept the diff
    updated = await workshop_repo.accept_diff(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        diff_index=0,
    )

    assert updated is not None
    assert updated["sections"]["summary"] == "New improved summary"
    assert len(updated["pending_diffs"]) == 0


@pytest.mark.asyncio
async def test_reject_diff(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test rejecting a diff removes it without applying."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    # Set initial sections
    await workshop_repo.update_sections(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        sections={"summary": "Original summary"},
    )

    # Add a diff
    await workshop_repo.add_pending_diffs(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        diffs=[{
            "operation": "replace",
            "path": "/summary",
            "value": "Unwanted change",
            "original_value": "Original summary",
            "reason": "Test",
            "impact": "low",
            "source_block_id": None,
        }],
    )

    # Reject the diff
    updated = await workshop_repo.reject_diff(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        diff_index=0,
    )

    assert updated is not None
    # Section should NOT be changed
    assert updated["sections"]["summary"] == "Original summary"
    # Diff should be removed
    assert len(updated["pending_diffs"]) == 0


@pytest.mark.asyncio
async def test_update_status(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test updating workshop status."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    assert workshop["status"] == "draft"

    updated = await workshop_repo.update_status(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        status=WorkshopStatus.EXPORTED,
    )

    assert updated is not None
    assert updated["status"] == "exported"


@pytest.mark.asyncio
async def test_delete_workshop(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test deleting a workshop."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="To Delete",
        job_description="Description",
    )

    result = await workshop_repo.delete(db_session, workshop_id=workshop["id"], user_id=user.id)
    assert result is True

    # Workshop should no longer exist
    retrieved = await workshop_repo.get(db_session, workshop_id=workshop["id"], user_id=user.id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_delete_workshop_wrong_user(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test that users cannot delete other users' workshops."""
    user1 = await create_test_user(db_session, "user1@example.com")
    user2 = await create_test_user(db_session, "user2@example.com")

    workshop = await workshop_repo.create(
        db_session,
        user_id=user1.id,
        job_title="Protected",
        job_description="Description",
    )

    result = await workshop_repo.delete(db_session, workshop_id=workshop["id"], user_id=user2.id)
    assert result is False

    # Workshop should still exist
    retrieved = await workshop_repo.get(db_session, workshop_id=workshop["id"], user_id=user1.id)
    assert retrieved is not None


@pytest.mark.asyncio
async def test_count_workshops(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test counting workshops."""
    user = await create_test_user(db_session)

    await workshop_repo.create(db_session, user_id=user.id, job_title="Job 1", job_description="Desc")
    await workshop_repo.create(db_session, user_id=user.id, job_title="Job 2", job_description="Desc")
    w3 = await workshop_repo.create(db_session, user_id=user.id, job_title="Job 3", job_description="Desc")

    # Update one to exported
    await workshop_repo.update_status(
        db_session,
        workshop_id=w3["id"],
        user_id=user.id,
        status=WorkshopStatus.EXPORTED,
    )

    total_count = await workshop_repo.count(db_session, user_id=user.id)
    assert total_count == 3

    draft_count = await workshop_repo.count(
        db_session,
        user_id=user.id,
        status=WorkshopStatus.DRAFT,
    )
    assert draft_count == 2


@pytest.mark.asyncio
async def test_clear_pending_diffs(db_session: AsyncSession, workshop_repo: WorkshopRepository):
    """Test clearing all pending diffs."""
    user = await create_test_user(db_session)

    workshop = await workshop_repo.create(
        db_session,
        user_id=user.id,
        job_title="Test Job",
        job_description="Description",
    )

    # Add some diffs
    await workshop_repo.add_pending_diffs(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
        diffs=[
            {"operation": "add", "path": "/test1", "value": "v1", "reason": "r", "impact": "low", "source_block_id": None, "original_value": None},
            {"operation": "add", "path": "/test2", "value": "v2", "reason": "r", "impact": "low", "source_block_id": None, "original_value": None},
        ],
    )

    # Clear all diffs
    updated = await workshop_repo.clear_pending_diffs(
        db_session,
        workshop_id=workshop["id"],
        user_id=user.id,
    )

    assert updated is not None
    assert len(updated["pending_diffs"]) == 0
