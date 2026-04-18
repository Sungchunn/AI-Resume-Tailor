"""Failure-injection tests for keyword override endpoints.

Covers phase-2 sites S3 and S4: Mongo driver errors from keyword_override_crud
must map to semantic HTTP statuses (InvalidId -> 422, OperationFailure -> 503)
instead of bubbling as opaque 500s.
"""

import pytest
from bson.errors import InvalidId
from httpx import AsyncClient
from pymongo.errors import OperationFailure

from app.api.routes.ats import keywords as keywords_route


@pytest.mark.asyncio
async def test_get_override_invalid_id_returns_422(
    client: AsyncClient, monkeypatch
):
    """S3: InvalidId from Motor should map to 422, not 500."""

    async def _raise_invalid_id(*args, **kwargs):
        raise InvalidId("'bogus' is not a valid ObjectId")

    monkeypatch.setattr(
        keywords_route.keyword_override_crud, "get", _raise_invalid_id
    )

    response = await client.get(
        "/api/v1/ats/keywords/override",
        params={"job_listing_id": 1},
    )

    assert response.status_code == 422
    body = response.json()
    assert "Invalid ID format" in body["detail"]


@pytest.mark.asyncio
async def test_get_override_operation_failure_returns_503(
    client: AsyncClient, monkeypatch
):
    """S3: OperationFailure from Motor should map to 503, not 500."""

    async def _raise_operation_failure(*args, **kwargs):
        raise OperationFailure("mongo cluster unreachable")

    monkeypatch.setattr(
        keywords_route.keyword_override_crud, "get", _raise_operation_failure
    )

    response = await client.get(
        "/api/v1/ats/keywords/override",
        params={"job_listing_id": 1},
    )

    assert response.status_code == 503
    body = response.json()
    assert body["detail"] == "Document store temporarily unavailable"


@pytest.mark.asyncio
async def test_put_override_invalid_id_returns_422(
    client: AsyncClient, monkeypatch
):
    """S4: InvalidId from upsert should map to 422."""

    async def _ok_get(*args, **kwargs):
        return None

    async def _raise_invalid_id(*args, **kwargs):
        raise InvalidId("bad object id")

    async def _stub_extract(*args, **kwargs):
        return []

    monkeypatch.setattr(keywords_route.keyword_override_crud, "get", _ok_get)
    monkeypatch.setattr(
        keywords_route.keyword_override_crud, "upsert", _raise_invalid_id
    )
    monkeypatch.setattr(
        keywords_route.KeywordExtractor,
        "extract_keywords_with_context",
        _stub_extract,
    )

    response = await client.put(
        "/api/v1/ats/keywords/override",
        json={
            "job_listing_id": 1,
            "job_description": "A job description that is longer than fifty characters for validation.",
            "keywords": [],
            "mark_reviewed": False,
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert "Invalid ID format" in body["detail"]


@pytest.mark.asyncio
async def test_put_override_operation_failure_returns_503(
    client: AsyncClient, monkeypatch
):
    """S4: OperationFailure from upsert should map to 503."""

    async def _ok_get(*args, **kwargs):
        return None

    async def _raise_operation_failure(*args, **kwargs):
        raise OperationFailure("write concern failed")

    async def _stub_extract(*args, **kwargs):
        return []

    monkeypatch.setattr(keywords_route.keyword_override_crud, "get", _ok_get)
    monkeypatch.setattr(
        keywords_route.keyword_override_crud, "upsert", _raise_operation_failure
    )
    monkeypatch.setattr(
        keywords_route.KeywordExtractor,
        "extract_keywords_with_context",
        _stub_extract,
    )

    response = await client.put(
        "/api/v1/ats/keywords/override",
        json={
            "job_listing_id": 1,
            "job_description": "A job description that is longer than fifty characters for validation.",
            "keywords": [],
            "mark_reviewed": False,
        },
    )

    assert response.status_code == 503
    body = response.json()
    assert body["detail"] == "Document store temporarily unavailable"
