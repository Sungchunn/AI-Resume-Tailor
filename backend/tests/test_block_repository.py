"""
Unit tests for BlockRepository.

These tests focus on the basic CRUD operations.
Vector/embedding-specific features require PostgreSQL with pgvector
and are tested separately in integration tests.
"""

import pytest
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.crud.block import BlockRepository
from app.core.protocols import BlockType


@pytest.fixture
def block_repo():
    """Create a fresh BlockRepository instance."""
    return BlockRepository()


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
async def test_create_block(db_session: AsyncSession, block_repo: BlockRepository):
    """Test creating a new experience block."""
    user = await create_test_user(db_session)

    block = await block_repo.create(
        db_session,
        user_id=user.id,
        content="Reduced API latency by 40% through Redis caching implementation",
        block_type=BlockType.ACHIEVEMENT,
        tags=["python", "redis", "backend"],
        source_company="Tech Corp",
        source_role="Senior Engineer",
    )

    assert block["id"] is not None
    assert block["user_id"] == user.id
    assert block["content"] == "Reduced API latency by 40% through Redis caching implementation"
    assert block["block_type"] == "achievement"
    assert block["tags"] == ["python", "redis", "backend"]
    assert block["source_company"] == "Tech Corp"
    assert block["source_role"] == "Senior Engineer"
    assert block["verified"] is False


@pytest.mark.asyncio
async def test_create_block_with_dates(db_session: AsyncSession, block_repo: BlockRepository):
    """Test creating a block with source dates."""
    user = await create_test_user(db_session)

    block = await block_repo.create(
        db_session,
        user_id=user.id,
        content="Led team of 5 engineers",
        block_type=BlockType.RESPONSIBILITY,
        source_date_start=date(2022, 1, 1),
        source_date_end=date(2023, 6, 30),
    )

    assert block["source_date_start"] == "2022-01-01"
    assert block["source_date_end"] == "2023-06-30"


@pytest.mark.asyncio
async def test_get_block(db_session: AsyncSession, block_repo: BlockRepository):
    """Test retrieving a block by ID."""
    user = await create_test_user(db_session)

    created = await block_repo.create(
        db_session,
        user_id=user.id,
        content="Test content",
        block_type=BlockType.SKILL,
    )

    retrieved = await block_repo.get(db_session, block_id=created["id"], user_id=user.id)

    assert retrieved is not None
    assert retrieved["id"] == created["id"]
    assert retrieved["content"] == "Test content"


@pytest.mark.asyncio
async def test_get_block_wrong_user(db_session: AsyncSession, block_repo: BlockRepository):
    """Test that blocks are scoped to users."""
    user1 = await create_test_user(db_session, "user1@example.com")
    user2 = await create_test_user(db_session, "user2@example.com")

    block = await block_repo.create(
        db_session,
        user_id=user1.id,
        content="User 1's block",
        block_type=BlockType.ACHIEVEMENT,
    )

    # User 2 should not be able to access User 1's block
    retrieved = await block_repo.get(db_session, block_id=block["id"], user_id=user2.id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_list_blocks(db_session: AsyncSession, block_repo: BlockRepository):
    """Test listing blocks for a user."""
    user = await create_test_user(db_session)

    await block_repo.create(db_session, user_id=user.id, content="Block 1", block_type=BlockType.ACHIEVEMENT)
    await block_repo.create(db_session, user_id=user.id, content="Block 2", block_type=BlockType.SKILL)
    await block_repo.create(db_session, user_id=user.id, content="Block 3", block_type=BlockType.PROJECT)

    blocks = await block_repo.list(db_session, user_id=user.id)

    assert len(blocks) == 3


@pytest.mark.asyncio
async def test_list_blocks_filter_by_type(db_session: AsyncSession, block_repo: BlockRepository):
    """Test filtering blocks by type."""
    user = await create_test_user(db_session)

    await block_repo.create(db_session, user_id=user.id, content="Achievement 1", block_type=BlockType.ACHIEVEMENT)
    await block_repo.create(db_session, user_id=user.id, content="Achievement 2", block_type=BlockType.ACHIEVEMENT)
    await block_repo.create(db_session, user_id=user.id, content="Skill 1", block_type=BlockType.SKILL)

    blocks = await block_repo.list(
        db_session,
        user_id=user.id,
        block_types=[BlockType.ACHIEVEMENT],
    )

    assert len(blocks) == 2
    assert all(b["block_type"] == "achievement" for b in blocks)


@pytest.mark.asyncio
async def test_list_blocks_pagination(db_session: AsyncSession, block_repo: BlockRepository):
    """Test pagination of block listing."""
    user = await create_test_user(db_session)

    for i in range(5):
        await block_repo.create(
            db_session,
            user_id=user.id,
            content=f"Block {i}",
            block_type=BlockType.ACHIEVEMENT,
        )

    # Get first page
    page1 = await block_repo.list(db_session, user_id=user.id, limit=2, offset=0)
    assert len(page1) == 2

    # Get second page
    page2 = await block_repo.list(db_session, user_id=user.id, limit=2, offset=2)
    assert len(page2) == 2

    # Get third page (partial)
    page3 = await block_repo.list(db_session, user_id=user.id, limit=2, offset=4)
    assert len(page3) == 1


@pytest.mark.asyncio
async def test_update_block(db_session: AsyncSession, block_repo: BlockRepository):
    """Test updating a block."""
    user = await create_test_user(db_session)

    created = await block_repo.create(
        db_session,
        user_id=user.id,
        content="Original content",
        block_type=BlockType.ACHIEVEMENT,
        tags=["tag1"],
    )

    updated = await block_repo.update(
        db_session,
        block_id=created["id"],
        user_id=user.id,
        content="Updated content",
        tags=["tag1", "tag2"],
    )

    assert updated is not None
    assert updated["content"] == "Updated content"
    assert updated["tags"] == ["tag1", "tag2"]


@pytest.mark.asyncio
async def test_update_block_verify(db_session: AsyncSession, block_repo: BlockRepository):
    """Test verifying a block."""
    user = await create_test_user(db_session)

    created = await block_repo.create(
        db_session,
        user_id=user.id,
        content="Test content",
        block_type=BlockType.ACHIEVEMENT,
    )

    assert created["verified"] is False

    updated = await block_repo.update(
        db_session,
        block_id=created["id"],
        user_id=user.id,
        verified=True,
    )

    assert updated["verified"] is True


@pytest.mark.asyncio
async def test_update_block_wrong_user(db_session: AsyncSession, block_repo: BlockRepository):
    """Test that users cannot update other users' blocks."""
    user1 = await create_test_user(db_session, "user1@example.com")
    user2 = await create_test_user(db_session, "user2@example.com")

    block = await block_repo.create(
        db_session,
        user_id=user1.id,
        content="Original",
        block_type=BlockType.ACHIEVEMENT,
    )

    result = await block_repo.update(
        db_session,
        block_id=block["id"],
        user_id=user2.id,
        content="Hacked!",
    )

    assert result is None


@pytest.mark.asyncio
async def test_soft_delete_block(db_session: AsyncSession, block_repo: BlockRepository):
    """Test soft deleting a block."""
    user = await create_test_user(db_session)

    block = await block_repo.create(
        db_session,
        user_id=user.id,
        content="To be deleted",
        block_type=BlockType.ACHIEVEMENT,
    )

    result = await block_repo.soft_delete(db_session, block_id=block["id"], user_id=user.id)
    assert result is True

    # Block should no longer appear in get
    retrieved = await block_repo.get(db_session, block_id=block["id"], user_id=user.id)
    assert retrieved is None

    # Block should no longer appear in list
    blocks = await block_repo.list(db_session, user_id=user.id)
    assert len(blocks) == 0


@pytest.mark.asyncio
async def test_soft_delete_block_wrong_user(db_session: AsyncSession, block_repo: BlockRepository):
    """Test that users cannot delete other users' blocks."""
    user1 = await create_test_user(db_session, "user1@example.com")
    user2 = await create_test_user(db_session, "user2@example.com")

    block = await block_repo.create(
        db_session,
        user_id=user1.id,
        content="Protected block",
        block_type=BlockType.ACHIEVEMENT,
    )

    result = await block_repo.soft_delete(db_session, block_id=block["id"], user_id=user2.id)
    assert result is False

    # Block should still exist
    retrieved = await block_repo.get(db_session, block_id=block["id"], user_id=user1.id)
    assert retrieved is not None


@pytest.mark.asyncio
async def test_count_blocks(db_session: AsyncSession, block_repo: BlockRepository):
    """Test counting blocks."""
    user = await create_test_user(db_session)

    await block_repo.create(db_session, user_id=user.id, content="Block 1", block_type=BlockType.ACHIEVEMENT)
    await block_repo.create(db_session, user_id=user.id, content="Block 2", block_type=BlockType.ACHIEVEMENT)
    await block_repo.create(db_session, user_id=user.id, content="Block 3", block_type=BlockType.SKILL)

    total_count = await block_repo.count(db_session, user_id=user.id)
    assert total_count == 3

    achievement_count = await block_repo.count(
        db_session,
        user_id=user.id,
        block_types=[BlockType.ACHIEVEMENT],
    )
    assert achievement_count == 2


@pytest.mark.asyncio
async def test_get_by_ids(db_session: AsyncSession, block_repo: BlockRepository):
    """Test getting multiple blocks by IDs."""
    user = await create_test_user(db_session)

    b1 = await block_repo.create(db_session, user_id=user.id, content="Block 1", block_type=BlockType.ACHIEVEMENT)
    b2 = await block_repo.create(db_session, user_id=user.id, content="Block 2", block_type=BlockType.SKILL)
    b3 = await block_repo.create(db_session, user_id=user.id, content="Block 3", block_type=BlockType.PROJECT)

    blocks = await block_repo.get_by_ids(
        db_session,
        block_ids=[b1["id"], b3["id"]],
        user_id=user.id,
    )

    assert len(blocks) == 2
    block_ids = [b["id"] for b in blocks]
    assert b1["id"] in block_ids
    assert b3["id"] in block_ids
    assert b2["id"] not in block_ids


@pytest.mark.asyncio
async def test_get_by_ids_filters_other_users(db_session: AsyncSession, block_repo: BlockRepository):
    """Test that get_by_ids only returns blocks owned by the user."""
    user1 = await create_test_user(db_session, "user1@example.com")
    user2 = await create_test_user(db_session, "user2@example.com")

    b1 = await block_repo.create(db_session, user_id=user1.id, content="User 1 block", block_type=BlockType.ACHIEVEMENT)
    b2 = await block_repo.create(db_session, user_id=user2.id, content="User 2 block", block_type=BlockType.ACHIEVEMENT)

    # User 1 requests both blocks but should only get their own
    blocks = await block_repo.get_by_ids(
        db_session,
        block_ids=[b1["id"], b2["id"]],
        user_id=user1.id,
    )

    assert len(blocks) == 1
    assert blocks[0]["id"] == b1["id"]
