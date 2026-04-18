"""Phase 3 dual-db rollback tests for routes/tailor.py.

Covers bucket C of the error-handling audit (items 13 and 14):

- Site 1 (POST /api/tailor): a Mongo `tailored_resume_crud.create` failure must
  roll back the pending `ai_usage_logs` INSERT so billing is not orphaned.
- Site 2 (POST /api/tailor/{id}/finalize): a Mongo `tailored_resume_crud.finalize`
  failure must trigger an explicit `pg.rollback()` and surface a typed 500 envelope.
"""

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from bson import ObjectId
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user_id,
    get_db_session,
    get_db_with_user_context,
    get_mongo_db,
)
from app.api.routes import tailor as tailor_route
from app.main import app
from app.models.ai_usage_log import AIUsageLog
from app.models.job_listing import JobListing
from app.models.mongo.tailored_resume import TailoredResumeStatus


@pytest_asyncio.fixture
async def dual_db_client(db_session: AsyncSession, mongo_db):
    """Client variant with ``raise_app_exceptions=False`` so the catch-all
    Exception handler can send its 500 envelope instead of the test seeing
    the raw RuntimeError bubble up through Starlette's ServerErrorMiddleware.
    """

    async def override_get_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    async def override_get_current_user_id():
        return 1

    def override_get_mongo_db():
        return mongo_db

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_db_with_user_context] = override_get_db
    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    app.dependency_overrides[get_mongo_db] = override_get_mongo_db

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


async def _seed_parsed_resume(mongo_db) -> str:
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": 1,
        "title": "Test Resume",
        "is_master": False,
        "raw_content": "John Doe\nSoftware Engineer\nPython, FastAPI",
        "parsed": {
            "contact": {"name": "John Doe", "email": "john@example.com"},
            "summary": "Engineer",
            "experience": [],
            "education": [],
            "skills": ["Python"],
        },
        "parsed_verified": True,
        "parsed_verified_at": now,
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }
    result = await mongo_db["resumes"].insert_one(doc)
    return str(result.inserted_id)


async def _seed_job_listing(db_session: AsyncSession) -> int:
    listing = JobListing(
        external_job_id="ext_dual_db_rollback",
        dedup_hash="hash_dual_db_rollback",
        job_title="Backend Engineer",
        company_name="Acme Corp",
        job_description="Python and FastAPI experience required.",
        job_url="https://example.com/jobs/dual-db",
        is_active=True,
    )
    db_session.add(listing)
    await db_session.flush()
    return listing.id


class _FakeTailoringService:
    """Stand-in for TailoringService that skips the real AI call."""

    async def tailor(self, **kwargs):
        return {
            "tailored_content": {
                "contact": {"name": "John Doe", "email": "john@example.com"},
                "summary": "Tailored summary",
                "experience": [],
                "skills": ["Python", "FastAPI"],
            },
            "match_score": 85.0,
            "skill_matches": ["Python"],
            "skill_gaps": [],
            "keyword_coverage": 0.9,
            "ai_metrics": {
                "provider": "openai",
                "model": "gpt-4",
                "metrics": {
                    "input_tokens": 100,
                    "output_tokens": 200,
                    "total_tokens": 300,
                    "latency_ms": 500,
                },
            },
        }


@pytest.mark.asyncio
async def test_tailor_rollback_on_mongo_create_failure(
    dual_db_client: AsyncClient,
    db_session: AsyncSession,
    mongo_db,
    monkeypatch,
):
    """Site 1: Mongo create failure must leave ai_usage_logs unchanged."""
    resume_id = await _seed_parsed_resume(mongo_db)
    job_listing_id = await _seed_job_listing(db_session)

    count_stmt = (
        select(func.count())
        .select_from(AIUsageLog)
        .where(AIUsageLog.user_id == 1)
    )
    count_before = await db_session.scalar(count_stmt)

    monkeypatch.setattr(
        tailor_route,
        "get_tailoring_service",
        lambda ai_client=None: _FakeTailoringService(),
    )

    async def _raise_mongo(*args, **kwargs):
        raise RuntimeError("simulated mongo outage")

    monkeypatch.setattr(tailor_route.tailored_resume_crud, "create", _raise_mongo)

    response = await dual_db_client.post(
        "/api/tailor",
        json={"resume_id": resume_id, "job_listing_id": job_listing_id},
    )

    assert response.status_code == 500
    body = response.json()
    assert body["error_code"] == "internal_error"

    count_after = await db_session.scalar(count_stmt)
    assert count_after == count_before, (
        "ai_usage_logs row must be rolled back when the Mongo create fails"
    )


@pytest.mark.asyncio
async def test_finalize_rollback_on_mongo_failure(
    dual_db_client: AsyncClient,
    db_session: AsyncSession,
    mongo_db,
    monkeypatch,
):
    """Site 2: finalize failure triggers pg.rollback and surfaces the 500 envelope."""
    resume_id = await _seed_parsed_resume(mongo_db)

    now = datetime.now(timezone.utc)
    tailored_doc = {
        "resume_id": ObjectId(resume_id),
        "user_id": 1,
        "job_source": {"type": "job_listing", "id": 99},
        "tailored_data": {"summary": "Tailored"},
        "finalized_data": None,
        "status": TailoredResumeStatus.PENDING.value,
        "match_score": 80.0,
        "ats_keywords": None,
        "ai_model": None,
        "job_title": "Engineer",
        "company_name": "Acme",
        "section_order": ["summary"],
        "style_settings": {},
        "created_at": now,
        "updated_at": now,
        "finalized_at": None,
    }
    insert_result = await mongo_db["tailored_resumes"].insert_one(tailored_doc)
    tailored_id = str(insert_result.inserted_id)

    rollback_calls: list[None] = []
    original_rollback = db_session.rollback

    async def _spy_rollback(*args, **kwargs):
        rollback_calls.append(None)
        return await original_rollback(*args, **kwargs)

    monkeypatch.setattr(db_session, "rollback", _spy_rollback)

    async def _raise_mongo(*args, **kwargs):
        raise RuntimeError("simulated mongo outage")

    monkeypatch.setattr(tailor_route.tailored_resume_crud, "finalize", _raise_mongo)

    response = await dual_db_client.post(
        f"/api/tailor/{tailored_id}/finalize",
        json={"finalized_data": {"summary": "User approved"}},
    )

    assert response.status_code == 500
    body = response.json()
    assert body["error_code"] == "internal_error"
    assert rollback_calls, "pg.rollback() should have been invoked on Mongo failure"
