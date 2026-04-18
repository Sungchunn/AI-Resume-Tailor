"""Failure-injection tests for resume-build AI endpoints.

Covers phase-2 sites S5 and S6: AIServiceError raised inside the suggest
endpoints must map to 503 with the shared `"AI service error: ..."` detail
prefix, mirroring the existing pattern in routes/tailor.py:212-217.

Skipped on SQLite: ResumeBuild uses JSONB + ARRAY columns which aiosqlite
cannot bind parameters for. See tests/crud/test_resume_build_crud.py for
the same skip.
"""

import os

import pytest
from httpx import AsyncClient

from app.services.ai.client import AIServiceError
from app.services.job.diff.engine import DiffEngine

pytestmark = pytest.mark.skipif(
    "postgresql" not in os.environ.get("TEST_DATABASE_URL", "sqlite"),
    reason="ResumeBuild tests require PostgreSQL (JSONB/ARRAY columns)",
)


async def _create_build(client: AsyncClient) -> dict:
    response = await client.post(
        "/api/v1/resume-builds",
        json={
            "job_title": "Senior Software Engineer",
            "job_company": "Acme Corp",
            "job_description": "We are hiring a senior engineer to build APIs.",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_generate_suggestions_ai_service_error_returns_503(
    client: AsyncClient, monkeypatch
):
    """S5: AIServiceError from diff_engine.generate_suggestions -> 503."""
    build = await _create_build(client)

    async def _raise_ai_error(*args, **kwargs):
        raise AIServiceError("AI rate limit exceeded. Please try again later.")

    monkeypatch.setattr(DiffEngine, "generate_suggestions", _raise_ai_error)

    response = await client.post(
        f"/api/v1/resume-builds/{build['id']}/suggest",
        json={"max_suggestions": 5},
    )

    assert response.status_code == 503
    body = response.json()
    assert body["detail"].startswith("AI service error: ")
    assert "rate limit" in body["detail"].lower()


@pytest.mark.asyncio
async def test_suggest_bullet_ai_service_error_returns_503(
    client: AsyncClient, monkeypatch
):
    """S6: AIServiceError from diff_engine.suggest_single_bullet -> 503."""
    build = await _create_build(client)

    async def _raise_ai_error(*args, **kwargs):
        raise AIServiceError("AI service unavailable")

    monkeypatch.setattr(DiffEngine, "suggest_single_bullet", _raise_ai_error)

    response = await client.post(
        f"/api/v1/resume-builds/{build['id']}/suggest-bullet",
        json={
            "bullet_text": "Led a team of engineers.",
            "entry_context": {
                "title": "Engineering Manager",
                "company": "Acme Corp",
                "date_range": "Jan 2022 - Present",
            },
            "job_description": "Hiring an engineering manager to lead teams.",
        },
    )

    assert response.status_code == 503
    body = response.json()
    assert body["detail"].startswith("AI service error: ")
    assert "unavailable" in body["detail"].lower()
