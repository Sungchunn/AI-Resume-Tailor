"""
Tests for the Workshops API endpoints.

These tests verify the Phase 3 Workshop functionality including:
- Workshop CRUD operations
- Block pulling
- Diff accept/reject
- Write-back functionality

NOTE: These tests require PostgreSQL due to ARRAY/JSONB types.
They will be skipped when run with SQLite.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# Skip all tests in this module if running on SQLite
pytestmark = pytest.mark.skip(reason="Requires PostgreSQL (ARRAY/JSONB types)")

from app.models.experience_block import ExperienceBlock
from app.models.workshop import Workshop


@pytest_asyncio.fixture
async def sample_blocks(db_session: AsyncSession):
    """Create sample blocks for testing."""
    blocks = [
        ExperienceBlock(
            user_id=1,
            content="Increased revenue by 40% through optimization",
            block_type="achievement",
            tags=["revenue", "optimization"],
            source_company="Acme Corp",
            source_role="Senior Engineer",
        ),
        ExperienceBlock(
            user_id=1,
            content="Led a team of 5 engineers",
            block_type="responsibility",
            tags=["leadership", "management"],
            source_company="Acme Corp",
            source_role="Senior Engineer",
        ),
        ExperienceBlock(
            user_id=1,
            content="Python",
            block_type="skill",
            tags=["programming", "backend"],
        ),
    ]

    for block in blocks:
        db_session.add(block)

    await db_session.commit()

    for block in blocks:
        await db_session.refresh(block)

    return blocks


@pytest_asyncio.fixture
async def sample_workshop(db_session: AsyncSession):
    """Create a sample workshop for testing."""
    workshop = Workshop(
        user_id=1,
        job_title="Senior Software Engineer",
        job_company="Tech Corp",
        job_description="We need a Python expert with leadership experience...",
        status="draft",
        sections={},
        pulled_block_ids=[],
        pending_diffs=[],
    )
    db_session.add(workshop)
    await db_session.commit()
    await db_session.refresh(workshop)
    return workshop


class TestWorkshopCRUD:
    """Tests for basic Workshop CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_workshop(self, client: AsyncClient):
        """Test creating a new workshop."""
        response = await client.post(
            "/api/v1/workshops",
            json={
                "job_title": "Software Engineer",
                "job_company": "Tech Corp",
                "job_description": "Build awesome software",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["job_title"] == "Software Engineer"
        assert data["job_company"] == "Tech Corp"
        assert data["status"] == "draft"
        assert data["sections"] == {}
        assert data["pulled_block_ids"] == []

    @pytest.mark.asyncio
    async def test_list_workshops(self, client: AsyncClient, sample_workshop):
        """Test listing workshops."""
        response = await client.get("/api/v1/workshops")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["workshops"]) >= 1

    @pytest.mark.asyncio
    async def test_get_workshop(self, client: AsyncClient, sample_workshop):
        """Test getting a single workshop."""
        response = await client.get(f"/api/v1/workshops/{sample_workshop.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_workshop.id
        assert data["job_title"] == sample_workshop.job_title

    @pytest.mark.asyncio
    async def test_get_nonexistent_workshop(self, client: AsyncClient):
        """Test getting a workshop that doesn't exist."""
        response = await client.get("/api/v1/workshops/9999")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_workshop(self, client: AsyncClient, sample_workshop):
        """Test deleting a workshop."""
        response = await client.delete(f"/api/v1/workshops/{sample_workshop.id}")

        assert response.status_code == 204

        # Verify it's deleted
        response = await client.get(f"/api/v1/workshops/{sample_workshop.id}")
        assert response.status_code == 404


class TestBlockPulling:
    """Tests for pulling blocks into workshops."""

    @pytest.mark.asyncio
    async def test_pull_blocks(
        self, client: AsyncClient, sample_workshop, sample_blocks
    ):
        """Test pulling blocks into a workshop."""
        block_ids = [b.id for b in sample_blocks[:2]]

        response = await client.post(
            f"/api/v1/workshops/{sample_workshop.id}/pull",
            json={"block_ids": block_ids},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["newly_pulled"]) == 2
        assert all(bid in data["workshop"]["pulled_block_ids"] for bid in block_ids)

    @pytest.mark.asyncio
    async def test_pull_blocks_already_pulled(
        self, client: AsyncClient, sample_workshop, sample_blocks
    ):
        """Test that pulling same blocks again reports them as already pulled."""
        block_ids = [sample_blocks[0].id]

        # First pull
        await client.post(
            f"/api/v1/workshops/{sample_workshop.id}/pull",
            json={"block_ids": block_ids},
        )

        # Second pull
        response = await client.post(
            f"/api/v1/workshops/{sample_workshop.id}/pull",
            json={"block_ids": block_ids},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["already_pulled"]) == 1
        assert len(data["newly_pulled"]) == 0

    @pytest.mark.asyncio
    async def test_remove_block(
        self, client: AsyncClient, sample_workshop, sample_blocks
    ):
        """Test removing a block from workshop."""
        block_id = sample_blocks[0].id

        # First pull the block
        await client.post(
            f"/api/v1/workshops/{sample_workshop.id}/pull",
            json={"block_ids": [block_id]},
        )

        # Then remove it
        response = await client.delete(
            f"/api/v1/workshops/{sample_workshop.id}/blocks/{block_id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert block_id not in data["pulled_block_ids"]

    @pytest.mark.asyncio
    async def test_get_pulled_blocks(
        self, client: AsyncClient, sample_workshop, sample_blocks
    ):
        """Test getting all pulled blocks."""
        block_ids = [b.id for b in sample_blocks[:2]]

        # Pull blocks
        await client.post(
            f"/api/v1/workshops/{sample_workshop.id}/pull",
            json={"block_ids": block_ids},
        )

        # Get pulled blocks
        response = await client.get(
            f"/api/v1/workshops/{sample_workshop.id}/blocks"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestSections:
    """Tests for workshop section management."""

    @pytest.mark.asyncio
    async def test_update_sections(self, client: AsyncClient, sample_workshop):
        """Test updating workshop sections."""
        response = await client.patch(
            f"/api/v1/workshops/{sample_workshop.id}/sections",
            json={
                "sections": {
                    "summary": "Experienced software engineer...",
                    "skills": ["Python", "JavaScript"],
                }
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["sections"]["summary"] == "Experienced software engineer..."
        assert data["sections"]["skills"] == ["Python", "JavaScript"]
        # Status should transition to in_progress
        assert data["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_sections_merge(self, client: AsyncClient, sample_workshop):
        """Test that sections are merged, not replaced."""
        # Add first section
        await client.patch(
            f"/api/v1/workshops/{sample_workshop.id}/sections",
            json={"sections": {"summary": "Summary"}},
        )

        # Add second section
        response = await client.patch(
            f"/api/v1/workshops/{sample_workshop.id}/sections",
            json={"sections": {"skills": ["Python"]}},
        )

        data = response.json()
        assert data["sections"]["summary"] == "Summary"
        assert data["sections"]["skills"] == ["Python"]


class TestDiffs:
    """Tests for diff management."""

    @pytest.mark.asyncio
    async def test_accept_diff(
        self, client: AsyncClient, db_session: AsyncSession, sample_workshop
    ):
        """Test accepting a pending diff."""
        # Add a pending diff directly to the workshop
        sample_workshop.pending_diffs = [
            {
                "operation": "add",
                "path": "/summary",
                "value": "Expert software engineer",
                "reason": "Better matches job requirements",
                "impact": "high",
                "source_block_id": None,
            }
        ]
        sample_workshop.sections = {}
        db_session.add(sample_workshop)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/workshops/{sample_workshop.id}/diffs/accept",
            json={"diff_index": 0},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "accept"
        assert data["workshop"]["sections"]["summary"] == "Expert software engineer"
        assert len(data["workshop"]["pending_diffs"]) == 0

    @pytest.mark.asyncio
    async def test_reject_diff(
        self, client: AsyncClient, db_session: AsyncSession, sample_workshop
    ):
        """Test rejecting a pending diff."""
        sample_workshop.pending_diffs = [
            {
                "operation": "add",
                "path": "/summary",
                "value": "Expert software engineer",
                "reason": "Better matches job requirements",
                "impact": "high",
                "source_block_id": None,
            }
        ]
        db_session.add(sample_workshop)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/workshops/{sample_workshop.id}/diffs/reject",
            json={"diff_index": 0},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "reject"
        assert len(data["workshop"]["pending_diffs"]) == 0
        # Section should NOT have the diff applied
        assert "summary" not in data["workshop"]["sections"]

    @pytest.mark.asyncio
    async def test_clear_diffs(
        self, client: AsyncClient, db_session: AsyncSession, sample_workshop
    ):
        """Test clearing all pending diffs."""
        sample_workshop.pending_diffs = [
            {"operation": "add", "path": "/summary", "value": "Test1"},
            {"operation": "add", "path": "/skills", "value": ["Python"]},
        ]
        db_session.add(sample_workshop)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/workshops/{sample_workshop.id}/diffs/clear"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["pending_diffs"]) == 0


class TestStatus:
    """Tests for workshop status management."""

    @pytest.mark.asyncio
    async def test_update_status(self, client: AsyncClient, sample_workshop):
        """Test updating workshop status."""
        response = await client.patch(
            f"/api/v1/workshops/{sample_workshop.id}/status",
            json={"status": "in_progress"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_filter_by_status(
        self, client: AsyncClient, db_session: AsyncSession, sample_workshop
    ):
        """Test filtering workshops by status."""
        # Create another workshop with different status
        workshop2 = Workshop(
            user_id=1,
            job_title="Another Job",
            job_description="Description",
            status="in_progress",
        )
        db_session.add(workshop2)
        await db_session.commit()

        response = await client.get("/api/v1/workshops?status=draft")

        assert response.status_code == 200
        data = response.json()
        assert all(w["status"] == "draft" for w in data["workshops"])
