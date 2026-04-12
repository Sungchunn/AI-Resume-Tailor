# Phase 2: Enhanced Health Endpoint

## Objective

Upgrade the `/health` endpoint to verify connectivity to critical dependencies (PostgreSQL, MongoDB). This enables the post-deployment health check to catch infrastructure issues.

## Current Implementation

**File:** `backend/app/main.py:160-162`

```python
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

This basic implementation always returns 200 OK, even if databases are unreachable.

## New Implementation

### Health Check Logic

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db.session import async_session_maker
from app.db.mongodb import get_database


@app.get("/health")
async def health_check():
    """
    Health check endpoint with dependency verification.

    Returns:
        200: All dependencies healthy
        503: One or more dependencies unhealthy

    Response format:
        {
            "status": "healthy" | "unhealthy",
            "checks": {
                "postgres": "ok" | "error: <message>",
                "mongodb": "ok" | "error: <message>"
            }
        }
    """
    checks = {
        "status": "healthy",
        "checks": {}
    }

    # Check PostgreSQL connectivity
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        checks["checks"]["postgres"] = "ok"
    except Exception as e:
        checks["checks"]["postgres"] = f"error: {str(e)}"
        checks["status"] = "unhealthy"

    # Check MongoDB connectivity
    try:
        mongo = await get_database()
        await mongo.command("ping")
        checks["checks"]["mongodb"] = "ok"
    except Exception as e:
        checks["checks"]["mongodb"] = f"error: {str(e)}"
        checks["status"] = "unhealthy"

    # Return appropriate status code
    status_code = 200 if checks["status"] == "healthy" else 503
    return JSONResponse(content=checks, status_code=status_code)
```

### Import Changes

Add to the imports at the top of `main.py`:

```python
from sqlalchemy import text
from app.db.session import async_session_maker
from app.db.mongodb import get_database
```

## Response Examples

### All Systems Healthy

```bash
curl -s http://localhost:8000/health | jq .
```

```json
{
  "status": "healthy",
  "checks": {
    "postgres": "ok",
    "mongodb": "ok"
  }
}
```

HTTP Status: `200 OK`

### PostgreSQL Unreachable

```json
{
  "status": "unhealthy",
  "checks": {
    "postgres": "error: connection refused",
    "mongodb": "ok"
  }
}
```

HTTP Status: `503 Service Unavailable`

### MongoDB Unreachable

```json
{
  "status": "unhealthy",
  "checks": {
    "postgres": "ok",
    "mongodb": "error: ServerSelectionTimeoutError"
  }
}
```

HTTP Status: `503 Service Unavailable`

### Both Unreachable

```json
{
  "status": "unhealthy",
  "checks": {
    "postgres": "error: connection refused",
    "mongodb": "error: ServerSelectionTimeoutError"
  }
}
```

HTTP Status: `503 Service Unavailable`

## Design Decisions

### Why 503 for Unhealthy

HTTP 503 (Service Unavailable) is the standard status for temporary unavailability. Load balancers and orchestrators (like Kubernetes) recognize this code and can:

- Remove the instance from rotation
- Trigger alerts
- Initiate restarts

### Why Include Error Messages

```python
checks["checks"]["postgres"] = f"error: {str(e)}"
```

Including the error message in the response helps with debugging:

- Developers can see exactly what failed
- No need to SSH into the server to check logs
- Post-deployment scripts can log the full response

### Why Catch Generic Exception

```python
except Exception as e:
```

Database connectivity can fail in many ways:

- `ConnectionRefusedError` - service not running
- `TimeoutError` - network issues
- `OperationalError` - authentication failed
- `ServerSelectionTimeoutError` - MongoDB cluster unavailable

Catching the base `Exception` ensures we handle all failure modes.

### Why Not Check Redis

Redis is used for caching and rate limiting. The app can function (with degraded performance) without it. PostgreSQL and MongoDB are critical - the app cannot serve any user requests without them.

If Redis checking is needed later, add:

```python
from app.db.redis import get_redis

# Check Redis connectivity
try:
    redis = await get_redis()
    await redis.ping()
    checks["checks"]["redis"] = "ok"
except Exception as e:
    checks["checks"]["redis"] = f"error: {str(e)}"
    # Note: Don't mark as unhealthy - Redis is optional
```

## Update Test

**File:** `backend/tests/api/test_health.py`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

from app.main import app


@pytest.mark.asyncio
async def test_health_check_all_healthy():
    """Test health endpoint when all dependencies are healthy."""
    with patch("app.main.async_session_maker") as mock_pg, \
         patch("app.main.get_database") as mock_mongo:

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
    with patch("app.main.async_session_maker") as mock_pg, \
         patch("app.main.get_database") as mock_mongo:

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
    with patch("app.main.async_session_maker") as mock_pg, \
         patch("app.main.get_database") as mock_mongo:

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
```

## Verification

### Local Testing

```bash
# Start local services
docker-compose up -d postgres mongodb

# Test healthy response
curl -s http://localhost:8000/health | jq .

# Stop PostgreSQL and test unhealthy response
docker-compose stop postgres
curl -s http://localhost:8000/health | jq .
# Should return 503 with postgres error

# Restart PostgreSQL
docker-compose start postgres
```

### Run Unit Tests

```bash
cd backend
poetry run pytest tests/api/test_health.py -v
```

## Backwards Compatibility

The old response was:

```json
{"status": "healthy"}
```

The new response is:

```json
{
  "status": "healthy",
  "checks": {
    "postgres": "ok",
    "mongodb": "ok"
  }
}
```

The `status` field is preserved, so any clients checking `response.json()["status"]` will continue to work. The additional `checks` field provides more detail without breaking existing consumers.
