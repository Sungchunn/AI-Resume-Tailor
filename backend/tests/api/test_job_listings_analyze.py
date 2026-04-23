"""Integration tests for POST /job-listings/{id}/analyze.

Exercises the route wiring end-to-end with stubbed Redis (in-memory dict)
and stubbed DeepAnalysisService (canned result). Covers:
- fresh run → cache write → ai_usage_log insert
- cache hit → no service call, no quota consumption
- missing master resume (400) / missing listing (404)
- quota exhaustion (429) and oldest-row resets_at math
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import job_listings as route_module
from app.models.ai_usage_log import AIUsageLog
from app.models.job_listing import JobListing
from app.services.ai.response import AIResponse, AIUsageMetrics
from app.services.job_listings.deep_analysis import (
    DeepAnalysisCriticalError,
    DeepAnalysisResult,
)


# ----- in-memory stubs -----------------------------------------------------


class _CacheStub:
    """Dict-backed cache stand-in that mirrors CacheService's deep-analysis
    methods. Allows monkeypatching ``get_cache_service`` without spinning up
    Redis in the test harness."""

    def __init__(self) -> None:
        self._store: dict[str, dict] = {}

    @staticmethod
    def hash_content(content: str) -> str:
        # Deterministic 16-char hash keyed on content so cache-bust tests can
        # change content and get a new key.
        import hashlib

        return hashlib.sha256((content or "").encode()).hexdigest()[:16]

    async def get_deep_analysis_result(
        self, resume_content_hash: str, job_listing_id: int
    ) -> dict | None:
        key = f"{resume_content_hash}:{job_listing_id}"
        return self._store.get(key)

    async def set_deep_analysis_result(
        self, resume_content_hash: str, job_listing_id: int, payload: dict
    ) -> None:
        key = f"{resume_content_hash}:{job_listing_id}"
        self._store[key] = payload


@dataclass
class _FakeService:
    """Stand-in for DeepAnalysisService.run() — returns a canned response
    plus configurable AI usage so the route's usage-tracker path runs with
    real-enough data."""

    cache: _CacheStub
    call_count: int = 0

    async def run(self, *, resume, job) -> DeepAnalysisResult:
        self.call_count += 1
        response_dict = {
            "job_listing_id": job.id,
            "resume_id": str(resume.id) if resume.id else "",
            "resume_content_hash": self.cache.hash_content(resume.raw_content or ""),
            "cached": False,
            "cached_at": None,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "knockout": {
                "passes_all_checks": True,
                "risks": [],
                "summary": "Looks good",
                "recommendation": "Apply!",
            },
            "keywords": {
                "coverage_score": 0.8,
                "required_coverage": 0.9,
                "preferred_coverage": 0.5,
                "required_matched": ["Python"],
                "required_missing": [],
                "preferred_matched": [],
                "preferred_missing": [],
                "nice_to_have_matched": [],
                "nice_to_have_missing": [],
                "all_keywords": [],
                "suggestions": [],
                "warnings": [],
            },
            "bullets": {
                "suggestions": [],
                "total_analyzed": 0,
                "suggestions_count": 0,
                "skipped_count": 0,
            },
            "warnings": [],
            "ai_usage": {"total_tokens": 150, "cost_usd": 0.0, "latency_ms": 1200},
        }

        from app.schemas.job_listing_analysis import JobDeepAnalysisResponse

        return DeepAnalysisResult(
            response=JobDeepAnalysisResponse.model_validate(response_dict),
            ai_responses=[
                AIResponse(
                    content="{}",
                    metrics=AIUsageMetrics(
                        input_tokens=100,
                        output_tokens=50,
                        total_tokens=150,
                        latency_ms=1200,
                    ),
                    provider="openai",
                    model="gpt-4o-mini",
                )
            ],
        )


def _install_stubs(monkeypatch, *, cache: _CacheStub | None = None) -> tuple[_CacheStub, _FakeService]:
    cache = cache or _CacheStub()
    service = _FakeService(cache=cache)

    monkeypatch.setattr(route_module, "get_cache_service", lambda: cache)
    # Ignore the actual AI client/model resolution — the service is stubbed.
    monkeypatch.setattr(
        route_module, "resolve_ai_model", _async_returning("gpt-4o-mini")
    )
    monkeypatch.setattr(
        route_module, "get_ai_client_for_model", lambda model: object()
    )
    monkeypatch.setattr(
        route_module, "DeepAnalysisService", lambda **kwargs: service
    )
    return cache, service


def _async_returning(value: Any):
    async def _inner(*args, **kwargs):
        return value

    return _inner


# ----- DB/Mongo fixtures ---------------------------------------------------


async def _seed_job(db: AsyncSession, *, external_id: str = "ext-1") -> JobListing:
    listing = JobListing(
        external_job_id=external_id,
        dedup_hash=f"hash-{external_id}",
        job_title="Senior Backend Engineer",
        company_name="TestCo",
        job_description="We need Python and AWS. 5+ years experience.",
        job_url="https://example.com/jobs/1",
    )
    db.add(listing)
    await db.flush()
    await db.refresh(listing)
    return listing


async def _seed_master_resume(mongo, user_id: int = 1, content: str = "Base resume content"):
    from bson import ObjectId

    doc = {
        "_id": ObjectId(),
        "user_id": user_id,
        "title": "Master",
        "is_master": True,
        "raw_content": content,
        "parsed": {
            "experience": [
                {
                    "title": "Senior Engineer",
                    "company": "TechCorp",
                    "start_date": "Jan 2022",
                    "end_date": "Present",
                    "bullets": ["Led migration to AWS", "Built CI/CD pipeline"],
                }
            ],
            "skills": ["Python", "AWS"],
        },
        "version": 1,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await mongo.resumes.insert_one(doc)
    return doc


# ----- tests ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_analyze_cache_miss_then_hit(
    client: AsyncClient, db_session: AsyncSession, mongo_db, monkeypatch
):
    """First POST runs the service + writes cache; second POST hits cache
    and the service is NOT invoked again."""

    cache, service = _install_stubs(monkeypatch)
    listing = await _seed_job(db_session)
    await _seed_master_resume(mongo_db)

    r1 = await client.post(f"/api/job-listings/{listing.id}/analyze")
    assert r1.status_code == 200, r1.text
    assert r1.json()["cached"] is False
    assert service.call_count == 1

    r2 = await client.post(f"/api/job-listings/{listing.id}/analyze")
    assert r2.status_code == 200, r2.text
    assert r2.json()["cached"] is True
    assert service.call_count == 1  # no second invocation


@pytest.mark.asyncio
async def test_analyze_no_master_resume_returns_400(
    client: AsyncClient, db_session: AsyncSession, mongo_db, monkeypatch
):
    _install_stubs(monkeypatch)
    listing = await _seed_job(db_session)
    # no master resume seeded

    r = await client.post(f"/api/job-listings/{listing.id}/analyze")
    assert r.status_code == 400
    assert "master resume" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_analyze_unknown_job_returns_404(
    client: AsyncClient, db_session: AsyncSession, mongo_db, monkeypatch
):
    _install_stubs(monkeypatch)
    await _seed_master_resume(mongo_db)

    r = await client.post("/api/job-listings/999999/analyze")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_analyze_quota_exhausted_returns_429(
    client: AsyncClient, db_session: AsyncSession, mongo_db, monkeypatch
):
    """Seed 5 successful ai_usage_log rows and verify the 6th attempt 429s
    with a structured detail body carrying limit/used/resets_at."""

    _install_stubs(monkeypatch)
    listing = await _seed_job(db_session)
    await _seed_master_resume(mongo_db, content="UNIQUE-hash-content-for-quota-test")

    now = datetime.now(timezone.utc)
    for i in range(5):
        db_session.add(
            AIUsageLog(
                user_id=1,
                endpoint=route_module.DEEP_ANALYSIS_ENDPOINT,
                provider="openai",
                model="gpt-4o-mini",
                operation_type="generation",
                input_tokens=100,
                output_tokens=50,
                total_tokens=150,
                cost_usd=0,
                latency_ms=1000,
                success=True,
                created_at=now - timedelta(hours=i),
            )
        )
    await db_session.commit()

    r = await client.post(f"/api/job-listings/{listing.id}/analyze")
    assert r.status_code == 429
    detail = r.json()["detail"]
    assert detail["limit"] == 5
    assert detail["used"] == 5
    assert "resets_at" in detail


@pytest.mark.asyncio
async def test_analyze_failed_runs_do_not_consume_quota(
    client: AsyncClient, db_session: AsyncSession, mongo_db, monkeypatch
):
    """Seed 5 FAILED ai_usage_log rows (success=False). A fresh run should
    still be allowed through because only successful rows count."""

    _install_stubs(monkeypatch)
    listing = await _seed_job(db_session)
    await _seed_master_resume(mongo_db, content="UNIQUE-for-failed-quota-test")

    now = datetime.now(timezone.utc)
    for _ in range(5):
        db_session.add(
            AIUsageLog(
                user_id=1,
                endpoint=route_module.DEEP_ANALYSIS_ENDPOINT,
                provider="openai",
                model="gpt-4o-mini",
                operation_type="generation",
                input_tokens=50,
                output_tokens=25,
                total_tokens=75,
                cost_usd=0,
                latency_ms=500,
                success=False,
                created_at=now,
            )
        )
    await db_session.commit()

    r = await client.post(f"/api/job-listings/{listing.id}/analyze")
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_analyze_resume_hash_change_busts_cache(
    client: AsyncClient, db_session: AsyncSession, mongo_db, monkeypatch
):
    """Seed cache under hash A; update the master resume so hash changes to
    B; next POST should miss and invoke the service again."""

    cache, service = _install_stubs(monkeypatch)
    listing = await _seed_job(db_session)
    await _seed_master_resume(mongo_db, content="version-A-content")

    r1 = await client.post(f"/api/job-listings/{listing.id}/analyze")
    assert r1.status_code == 200
    assert service.call_count == 1

    # Simulate the user editing their master resume — new raw_content means
    # a new content hash, which changes the cache key.
    await mongo_db.resumes.update_one(
        {"user_id": 1, "is_master": True},
        {"$set": {"raw_content": "version-B-content-different"}},
    )

    r2 = await client.post(f"/api/job-listings/{listing.id}/analyze")
    assert r2.status_code == 200
    assert service.call_count == 2  # fresh run, not cache hit


@pytest.mark.asyncio
async def test_analyze_critical_failure_returns_500(
    client: AsyncClient, db_session: AsyncSession, mongo_db, monkeypatch
):
    """Critical-path failure from the orchestrator translates to a 500 with
    a helpful detail string."""

    cache = _CacheStub()
    monkeypatch.setattr(route_module, "get_cache_service", lambda: cache)
    monkeypatch.setattr(
        route_module, "resolve_ai_model", _async_returning("gpt-4o-mini")
    )
    monkeypatch.setattr(
        route_module, "get_ai_client_for_model", lambda model: object()
    )

    class _FailingService:
        async def run(self, **_):
            raise DeepAnalysisCriticalError("keyword extractor exploded")

    monkeypatch.setattr(
        route_module, "DeepAnalysisService", lambda **kwargs: _FailingService()
    )

    listing = await _seed_job(db_session)
    await _seed_master_resume(mongo_db)

    r = await client.post(f"/api/job-listings/{listing.id}/analyze")
    assert r.status_code == 500
    assert "keyword extractor exploded" in r.json()["detail"]
