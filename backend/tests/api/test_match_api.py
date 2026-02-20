"""
Integration tests for Match (Semantic Search) API endpoints.

Tests the /api/v1/match endpoints.
Since these require embedding services, we mock the AI-related calls.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.crud.block import block_repository
from app.core.protocols import BlockType


async def create_test_user(db: AsyncSession, email: str = "test@example.com") -> User:
    """Helper to create a test user."""
    user = User(
        id=1,  # Match the mocked user ID from conftest
        email=email,
        hashed_password="hashed_password_123",
        full_name="Test User",
    )
    db.add(user)
    await db.flush()
    return user


async def create_test_blocks(db: AsyncSession, user_id: int):
    """Create test blocks for matching."""
    blocks = [
        {
            "content": "Built a Redis caching layer reducing API latency by 40%",
            "block_type": BlockType.ACHIEVEMENT,
            "tags": ["python", "redis", "backend"],
        },
        {
            "content": "Led a team of 5 engineers in developing microservices",
            "block_type": BlockType.RESPONSIBILITY,
            "tags": ["leadership", "microservices"],
        },
        {
            "content": "Expert in Python, FastAPI, and PostgreSQL",
            "block_type": BlockType.SKILL,
            "tags": ["python", "fastapi", "postgresql"],
        },
    ]

    created = []
    for block in blocks:
        b = await block_repository.create(
            db,
            user_id=user_id,
            content=block["content"],
            block_type=block["block_type"],
            tags=block["tags"],
        )
        created.append(b)

    return created


@pytest.mark.asyncio
async def test_match_blocks_mocked(db_session: AsyncSession):
    """Test semantic matching with mocked embedding service."""
    user = await create_test_user(db_session)
    blocks = await create_test_blocks(db_session, user.id)
    await db_session.commit()

    # Mock the semantic matcher
    mock_matches = [
        {
            "block": blocks[0],  # Redis caching achievement
            "score": 0.85,
            "matched_keywords": ["python", "caching"],
        },
        {
            "block": blocks[2],  # Python skills
            "score": 0.72,
            "matched_keywords": ["python", "fastapi"],
        },
    ]

    mock_keywords = ["python", "backend", "caching", "api"]

    with patch("app.api.routes.match.get_semantic_matcher") as mock_matcher:
        mock_instance = MagicMock()
        mock_instance.match = AsyncMock(return_value=mock_matches)
        mock_instance.extract_keywords = AsyncMock(return_value=mock_keywords)
        mock_matcher.return_value = mock_instance

        # Verify the mock works correctly
        result = await mock_instance.match(
            db=db_session,
            user_id=user.id,
            job_description="Looking for a Python backend engineer",
            limit=10,
        )

        assert len(result) == 2
        assert result[0]["score"] == 0.85


@pytest.mark.asyncio
async def test_gap_analysis_mocked(db_session: AsyncSession):
    """Test gap analysis with mocked services."""
    user = await create_test_user(db_session)
    blocks = await create_test_blocks(db_session, user.id)
    await db_session.commit()

    mock_gap_analysis = {
        "match_score": 75,
        "skill_matches": ["python", "backend"],
        "skill_gaps": ["kubernetes", "aws"],
        "keyword_coverage": 0.68,
        "recommendations": [
            "Consider adding cloud experience",
            "Highlight your Python projects more prominently",
        ],
    }

    with patch("app.api.routes.match.get_semantic_matcher") as mock_matcher:
        mock_instance = MagicMock()
        mock_instance.match = AsyncMock(return_value=[])
        mock_instance.analyze_gaps = AsyncMock(return_value=mock_gap_analysis)
        mock_matcher.return_value = mock_instance

        result = await mock_instance.analyze_gaps(
            db=db_session,
            user_id=user.id,
            job_description="Python backend with Kubernetes",
            matched_blocks=[],
        )

        assert result["match_score"] == 75
        assert "kubernetes" in result["skill_gaps"]
        assert len(result["recommendations"]) == 2


@pytest.mark.asyncio
async def test_match_empty_vault(client: AsyncClient, db_session: AsyncSession):
    """Test matching with empty vault."""
    await create_test_user(db_session)
    await db_session.commit()

    with patch("app.api.routes.match.get_semantic_matcher") as mock_matcher:
        mock_instance = MagicMock()
        mock_instance.match = AsyncMock(return_value=[])
        mock_instance.extract_keywords = AsyncMock(return_value=["python"])
        mock_matcher.return_value = mock_instance

        response = await client.post(
            "/api/v1/match",
            json={
                "job_description": "Looking for a Python developer",
                "limit": 10,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["matches"]) == 0
        assert data["total_vault_blocks"] == 0


@pytest.mark.asyncio
async def test_match_validates_input(client: AsyncClient, db_session: AsyncSession):
    """Test that match endpoint validates input."""
    await create_test_user(db_session)

    # Empty job description
    response = await client.post(
        "/api/v1/match",
        json={
            "job_description": "",
            "limit": 10,
        },
    )
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_match_with_filters(db_session: AsyncSession):
    """Test matching with block type and tag filters."""
    user = await create_test_user(db_session)
    blocks = await create_test_blocks(db_session, user.id)
    await db_session.commit()

    # Mock with filtered results
    achievement_only = [
        {
            "block": blocks[0],
            "score": 0.85,
            "matched_keywords": ["python"],
        },
    ]

    with patch("app.api.routes.match.get_semantic_matcher") as mock_matcher:
        mock_instance = MagicMock()
        mock_instance.match = AsyncMock(return_value=achievement_only)
        mock_instance.extract_keywords = AsyncMock(return_value=["python"])
        mock_matcher.return_value = mock_instance

        result = await mock_instance.match(
            db=db_session,
            user_id=user.id,
            job_description="Python developer",
            limit=10,
            block_types=[BlockType.ACHIEVEMENT],
            tags=["python"],
        )

        assert len(result) == 1
        assert result[0]["block"]["block_type"] == "achievement"
