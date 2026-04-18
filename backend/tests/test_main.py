"""Tests for global exception handlers registered in ``app.main``.

Each test raises a domain exception from a dedicated raise-route and
asserts the structured error envelope returned by the handler.
"""

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from redis.exceptions import RedisError

from app.api.utils.id_resolution import IDResolutionError
from app.crud.mongo.exceptions import VersionConflictError
from app.main import app as real_app
from app.services.document.converter import DocumentConversionError
from app.services.scraping.apify_client import ApifyClientError
from app.services.storage.file_storage import FileStorageError


def _build_test_app() -> FastAPI:
    """Build a FastAPI app that reuses the real handlers plus raise-routes.

    Copying ``real_app.exception_handlers`` lets us exercise the exact handler
    functions registered on the production app without routing through any of
    the real routes (which would need a full DB/Redis/Mongo fixture stack).
    """
    test_app = FastAPI()
    for exc_type, handler in real_app.exception_handlers.items():
        test_app.add_exception_handler(exc_type, handler)

    @test_app.get("/__raise/version_conflict")
    async def _raise_version_conflict():
        raise VersionConflictError(document_id="doc-abc", expected_version=3)

    @test_app.get("/__raise/id_resolution")
    async def _raise_id_resolution():
        raise IDResolutionError("Resume not found or not accessible")

    @test_app.get("/__raise/document_conversion")
    async def _raise_document_conversion():
        raise DocumentConversionError("Unsupported document format")

    @test_app.get("/__raise/apify")
    async def _raise_apify():
        raise ApifyClientError("Apify actor run failed with HTTP 500")

    @test_app.get("/__raise/file_storage")
    async def _raise_file_storage():
        raise FileStorageError("S3 backend unreachable")

    @test_app.get("/__raise/redis")
    async def _raise_redis():
        raise RedisError("Connection refused")

    @test_app.get("/__raise/unregistered")
    async def _raise_unregistered():
        raise RuntimeError("Unregistered bug")

    return test_app


@pytest_asyncio.fixture
async def exception_client():
    # raise_app_exceptions=False so Starlette's ServerErrorMiddleware doesn't
    # re-raise after our catch-all Exception handler produces its response —
    # the test needs to assert on the envelope, not catch the bubbled error.
    async with AsyncClient(
        transport=ASGITransport(app=_build_test_app(), raise_app_exceptions=False),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_version_conflict_returns_409_envelope(exception_client):
    resp = await exception_client.get("/__raise/version_conflict")
    assert resp.status_code == 409
    body = resp.json()
    assert body["error_code"] == "document_version_conflict"
    assert len(body["error_id"]) == 12
    assert body["detail"]["document_id"] == "doc-abc"
    assert body["detail"]["expected_version"] == 3
    assert body["detail"]["message"]


@pytest.mark.asyncio
async def test_id_resolution_returns_404_envelope(exception_client):
    resp = await exception_client.get("/__raise/id_resolution")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error_code"] == "resource_not_found"
    assert len(body["error_id"]) == 12
    assert "Resume not found" in body["detail"]


@pytest.mark.asyncio
async def test_document_conversion_returns_422_envelope(exception_client):
    resp = await exception_client.get("/__raise/document_conversion")
    assert resp.status_code == 422
    body = resp.json()
    assert body["error_code"] == "document_conversion_failed"
    assert len(body["error_id"]) == 12
    assert "Unsupported" in body["detail"]


@pytest.mark.asyncio
async def test_apify_client_returns_502_envelope(exception_client):
    resp = await exception_client.get("/__raise/apify")
    assert resp.status_code == 502
    body = resp.json()
    assert body["error_code"] == "external_api_error"
    assert len(body["error_id"]) == 12
    assert "Apify" in body["detail"]


@pytest.mark.asyncio
async def test_file_storage_returns_503_envelope(exception_client):
    resp = await exception_client.get("/__raise/file_storage")
    assert resp.status_code == 503
    body = resp.json()
    assert body["error_code"] == "storage_unavailable"
    assert len(body["error_id"]) == 12
    assert body["detail"] == "Storage temporarily unavailable"


@pytest.mark.asyncio
async def test_redis_error_returns_503_envelope(exception_client):
    resp = await exception_client.get("/__raise/redis")
    assert resp.status_code == 503
    body = resp.json()
    assert body["error_code"] == "cache_unavailable"
    assert len(body["error_id"]) == 12
    assert body["detail"] == "Cache temporarily unavailable"


@pytest.mark.asyncio
async def test_unregistered_exception_hits_catch_all(exception_client):
    """Regression: non-domain exceptions still fall through to the 500 catch-all envelope."""
    resp = await exception_client.get("/__raise/unregistered")
    assert resp.status_code == 500
    body = resp.json()
    assert body["error_code"] == "internal_error"
    assert body["detail"] == "Internal server error"
    assert len(body["error_id"]) == 12
