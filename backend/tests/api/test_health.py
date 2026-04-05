from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_check_all_healthy():
    """Test health endpoint when all dependencies are healthy."""
    with patch("app.main.AsyncSessionLocal") as mock_pg, \
         patch("app.main.get_mongodb") as mock_mongo:

        # Mock PostgreSQL
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_session.execute.return_value = None
        mock_pg.return_value = mock_session

        # Mock MongoDB
        mock_db = AsyncMock()
        mock_db.command.return_value = {"ok": 1}
        mock_mongo.return_value = mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["checks"]["postgres"] == "ok"
        assert data["checks"]["mongodb"] == "ok"


@pytest.mark.asyncio
async def test_health_check_postgres_down():
    """Test health endpoint when PostgreSQL is unreachable."""
    with patch("app.main.AsyncSessionLocal") as mock_pg, \
         patch("app.main.get_mongodb") as mock_mongo:

        # Mock PostgreSQL failure
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_session.execute.side_effect = Exception("connection refused")
        mock_pg.return_value = mock_session

        # Mock MongoDB success
        mock_db = AsyncMock()
        mock_db.command.return_value = {"ok": 1}
        mock_mongo.return_value = mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/health")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert "error" in data["checks"]["postgres"]
        assert data["checks"]["mongodb"] == "ok"


@pytest.mark.asyncio
async def test_health_check_mongodb_down():
    """Test health endpoint when MongoDB is unreachable."""
    with patch("app.main.AsyncSessionLocal") as mock_pg, \
         patch("app.main.get_mongodb") as mock_mongo:

        # Mock PostgreSQL success
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_session.execute.return_value = None
        mock_pg.return_value = mock_session

        # Mock MongoDB failure
        mock_mongo.side_effect = Exception("ServerSelectionTimeoutError")

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/health")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["checks"]["postgres"] == "ok"
        assert "error" in data["checks"]["mongodb"]


@pytest.mark.asyncio
async def test_health_check_both_down():
    """Test health endpoint when both PostgreSQL and MongoDB are unreachable."""
    with patch("app.main.AsyncSessionLocal") as mock_pg, \
         patch("app.main.get_mongodb") as mock_mongo:

        # Mock PostgreSQL failure
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_session.execute.side_effect = Exception("connection refused")
        mock_pg.return_value = mock_session

        # Mock MongoDB failure
        mock_mongo.side_effect = Exception("ServerSelectionTimeoutError")

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/health")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert "error" in data["checks"]["postgres"]
        assert "error" in data["checks"]["mongodb"]


@pytest.mark.asyncio
async def test_root():
    """Test root endpoint returns API info."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "re-zoo-me API"
    assert data["docs"] == "/docs"
