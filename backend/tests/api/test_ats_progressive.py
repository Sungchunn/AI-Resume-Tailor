"""Failure-injection tests for /ats/analyze-progressive SSE endpoint.

Covers phase-2 sites S1 and S2: a cache-layer failure mid-stream must be
downgraded to a cache miss + logged, not re-raised (which would abort the
stream and leave the client with a dropped connection instead of a typed
error). Regression guard for the class of bugs behind commit fc2071b.
"""

from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from app.api import deps
from app.api.routes.ats import progressive as progressive_route
from app.main import app


class _CacheStub:
    """Mutable cache double.

    Tests swap ``get_behavior`` / ``set_behavior`` to either return a
    value or raise — simulating a poisoned cache entry or a Redis write
    failure without wiring up real Redis.
    """

    def __init__(self) -> None:
        self.get_behavior = self._return_none
        self.set_behavior = self._noop_set
        self.set_calls: list[dict] = []

    @staticmethod
    def hash_content(content: str) -> str:
        return "stub-hash"

    async def get_ats_result(self, resume_content_hash, job_id):
        return await self.get_behavior(resume_content_hash, job_id)

    async def set_ats_result(self, **kwargs):
        self.set_calls.append(kwargs)
        return await self.set_behavior(**kwargs)

    # Default behaviors ----------------------------------------------------
    @staticmethod
    async def _return_none(*args, **kwargs):
        return None

    @staticmethod
    async def _noop_set(**kwargs):
        return None


def _install_progressive_stubs(monkeypatch) -> _CacheStub:
    """Stub every dependency the progressive route exercises except the cache.

    Returns the mutable _CacheStub so individual tests can swap the
    get/set behavior (raise vs return None) without re-stubbing the rest.
    """
    async def _override_sse_auth():
        return 1

    app.dependency_overrides[deps.get_current_user_id_sse] = _override_sse_auth

    # Replace the module-level factory with one that returns a stub —
    # the real factory requires Redis to be connected, which we skip
    # in this test harness.
    cache_stub = _CacheStub()
    monkeypatch.setattr(
        progressive_route, "get_cache_service", lambda: cache_stub
    )

    # Mongo resume fetch — return a minimal document with matching user_id.
    mock_resume = MagicMock()
    mock_resume.user_id = 1
    mock_resume.raw_content = "Resume text"
    mock_resume.parsed = MagicMock()
    mock_resume.parsed.model_dump.return_value = {
        "contact": {"name": "Test User"},
        "skills": ["Python"],
    }

    async def _get_mongo_resume(self, db, id):
        return mock_resume

    monkeypatch.setattr(
        progressive_route.MongoResumeCRUD, "get", _get_mongo_resume
    )

    # Postgres job-listing fetch — return a mock with every attribute
    # the route reads into job_content.
    mock_job = MagicMock()
    mock_job.job_description = "Job description"
    mock_job.job_title = "Engineer"
    mock_job.company_name = "Acme"
    mock_job.location = "Remote"
    mock_job.seniority = ""
    mock_job.job_function = ""
    mock_job.industry = ""

    async def _get_job_listing(self, db, *, id):
        return mock_job

    monkeypatch.setattr(
        progressive_route.JobListingRepository, "get", _get_job_listing
    )

    # Stage executors — return the minimum shape each caller expects.
    async def _stub_single(request, user_id, db):
        return {"risks": []}

    async def _stub_tuple(request, user_id, db):
        return {"risks": []}, None

    monkeypatch.setattr(
        progressive_route, "execute_knockout_check", _stub_single
    )
    monkeypatch.setattr(
        progressive_route, "execute_structure_analysis", _stub_single
    )
    monkeypatch.setattr(
        progressive_route, "execute_keyword_analysis", _stub_tuple
    )
    monkeypatch.setattr(
        progressive_route, "execute_content_quality", _stub_single
    )
    monkeypatch.setattr(
        progressive_route, "execute_role_proximity", _stub_single
    )

    # Composite score — just needs .model_dump() to serialize.
    composite_mock = MagicMock()
    composite_mock.model_dump.return_value = {"final_score": 0}

    def _calculate_composite(stage_results, failed_stages):
        return composite_mock

    monkeypatch.setattr(
        progressive_route, "calculate_composite_score", _calculate_composite
    )

    return cache_stub


@pytest.fixture(autouse=True)
def _clear_sse_override():
    """Ensure the SSE auth override doesn't leak between tests."""
    yield
    app.dependency_overrides.pop(deps.get_current_user_id_sse, None)


@pytest.fixture(autouse=True)
def _reset_sse_app_status():
    """sse_starlette stores a module-level asyncio Event that binds to the
    first event loop it sees; pytest-asyncio uses a fresh loop per test
    which triggers 'bound to a different event loop' errors on the second
    run. Reset the singleton before each test so sse_starlette lazily
    recreates it on the current loop.
    """
    from sse_starlette.sse import AppStatus

    AppStatus.should_exit_event = None
    AppStatus.should_exit = False
    yield
    AppStatus.should_exit_event = None
    AppStatus.should_exit = False


@pytest.mark.asyncio
async def test_progressive_cache_get_failure_continues_to_cache_miss(
    client: AsyncClient, monkeypatch
):
    """S1: cache.get_ats_result raising must fall through to the cache_miss path."""
    cache_stub = _install_progressive_stubs(monkeypatch)

    async def _raise(*args, **kwargs):
        raise RuntimeError("cache decode failed (simulated)")

    cache_stub.get_behavior = _raise

    response = await client.get(
        "/api/v1/ats/analyze-progressive",
        params={
            "resume_id": "507f1f77bcf86cd799439011",
            "job_listing_id": 1,
            "ticket": "fake-ticket-ignored",
        },
    )

    assert response.status_code == 200
    body = response.text
    # Cache miss path was taken despite the poisoned cache.
    assert "cache_miss" in body
    # Stages began running (wrap did not re-raise and abort the stream).
    assert "stage_start" in body
    # No fatal-error event was emitted by the outer catch-all.
    assert "Fatal error during ATS analysis" not in body


@pytest.mark.asyncio
async def test_progressive_cache_set_failure_does_not_abort_stream(
    client: AsyncClient, monkeypatch
):
    """S2: cache.set_ats_result raising must be swallowed after stages complete."""
    cache_stub = _install_progressive_stubs(monkeypatch)

    async def _raise(**kwargs):
        raise RuntimeError("redis write failed (simulated)")

    cache_stub.set_behavior = _raise

    response = await client.get(
        "/api/v1/ats/analyze-progressive",
        params={
            "resume_id": "507f1f77bcf86cd799439011",
            "job_listing_id": 1,
            "ticket": "fake-ticket-ignored",
        },
    )

    assert response.status_code == 200
    body = response.text
    # The cache write was attempted (the wrap didn't skip the call).
    assert len(cache_stub.set_calls) == 1
    # Terminal "complete" event must still be emitted — a write-failure
    # cannot prevent the client from receiving final results.
    assert "complete" in body
    assert "Fatal error during ATS analysis" not in body
