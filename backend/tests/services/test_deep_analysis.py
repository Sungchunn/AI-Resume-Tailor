"""Unit tests for DeepAnalysisService orchestration + partial-failure handling."""

from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.mongo.resume import (
    ExperienceEntry,
    ParsedContent,
    ResumeDocument,
)
from app.services.ai.response import AIResponse, AIUsageMetrics
from app.services.job.ats.models.keywords import DetailedKeywordAnalysis
from app.services.job_listings.deep_analysis import (
    DeepAnalysisCriticalError,
    DeepAnalysisService,
    _build_bullet_inputs,
)


# ----- fixtures ------------------------------------------------------------


def _ai_response(tokens: int = 100, latency: int = 500) -> AIResponse:
    return AIResponse(
        content="{}",
        metrics=AIUsageMetrics(
            input_tokens=tokens,
            output_tokens=tokens // 2,
            total_tokens=tokens + tokens // 2,
            latency_ms=latency,
        ),
        provider="openai",
        model="gpt-4o-mini",
    )


def _resume(with_experience: bool = True) -> ResumeDocument:
    experience = (
        [
            ExperienceEntry(
                title="Senior Engineer",
                company="TechCorp",
                start_date="Jan 2022",
                end_date="Present",
                bullets=["Led migration to AWS", "Built CI/CD pipeline"],
            ),
            ExperienceEntry(
                title="Engineer",
                company="StartupInc",
                start_date="Jun 2019",
                end_date="Dec 2021",
                bullets=["Developed Python services"],
            ),
        ]
        if with_experience
        else []
    )
    return ResumeDocument(
        user_id=1,
        title="Master",
        raw_content="John Doe — Senior Engineer. Python, AWS, Docker.",
        parsed=ParsedContent(experience=experience, skills=["Python", "AWS"]),
    )


def _job() -> MagicMock:
    job = MagicMock()
    job.id = 42
    job.job_description = (
        "Senior Backend Engineer. Requires Python, AWS, Docker, Kubernetes. "
        "5+ years of experience."
    )
    return job


@dataclass
class _Knockout:
    risks: list = None
    passes_all_checks: bool = True
    summary: str = "No knockout risks detected."
    recommendation: str = "Proceed."

    def __post_init__(self):
        if self.risks is None:
            self.risks = []


def _keyword_result() -> DetailedKeywordAnalysis:
    return DetailedKeywordAnalysis(
        coverage_score=0.75,
        required_coverage=0.80,
        preferred_coverage=0.50,
        required_matched=["Python", "AWS"],
        required_missing=["Kubernetes"],
        preferred_matched=["Docker"],
        preferred_missing=[],
        nice_to_have_matched=[],
        nice_to_have_missing=[],
        missing_available_in_vault=[],
        missing_not_in_vault=[],
        all_keywords=[],
        suggestions=["Add Kubernetes experience"],
        warnings=[],
    )


def _build_service(
    *,
    knockout_raises: Exception | None = None,
    keyword_raises: Exception | None = None,
    bullets_raises: Exception | None = None,
) -> DeepAnalysisService:
    """Construct a service with three injected mocks."""

    ats_analyzer = MagicMock()
    if keyword_raises:
        ats_analyzer.analyze_keywords_detailed = AsyncMock(side_effect=keyword_raises)
    else:
        ats_analyzer.analyze_keywords_detailed = AsyncMock(
            return_value=(_keyword_result(), _ai_response(tokens=200))
        )
    ats_analyzer.perform_knockout_check = MagicMock(return_value=_Knockout())

    job_analyzer = MagicMock()
    if knockout_raises:
        job_analyzer.analyze = AsyncMock(side_effect=knockout_raises)
    else:
        job_analyzer.analyze = AsyncMock(
            return_value=({"requirements": [], "skills": []}, _ai_response(tokens=120))
        )

    bullet_analyzer = MagicMock()
    if bullets_raises:
        bullet_analyzer.analyze_batch = AsyncMock(side_effect=bullets_raises)
    else:
        bullet_analyzer.analyze_batch = AsyncMock(
            return_value=([], _ai_response(tokens=300))
        )

    cache = MagicMock()
    cache.hash_content = MagicMock(
        side_effect=lambda content: "abcdef1234567890"  # stable 16-char hash
    )
    # The service constructor calls CacheService.hash_content as a classmethod
    # on the class, not the instance — the helper below is not invoked during
    # tests, but keeping the attribute aligns with real usage.
    ai_client = MagicMock()

    return DeepAnalysisService(
        ai_client=ai_client,
        cache=cache,
        ats_analyzer=ats_analyzer,
        bullet_analyzer=bullet_analyzer,
        job_analyzer=job_analyzer,
    )


# ----- tests ---------------------------------------------------------------


def test_build_bullet_inputs_flattens_experience():
    resume = _resume(with_experience=True)
    bullets = _build_bullet_inputs(resume.parsed.experience)

    assert len(bullets) == 3
    assert bullets[0].id == "exp-0:bullet-0"
    assert bullets[0].entry_context.title == "Senior Engineer"
    assert bullets[0].entry_context.company == "TechCorp"
    assert bullets[2].id == "exp-1:bullet-0"


def test_build_bullet_inputs_drops_empty_bullets():
    entry = ExperienceEntry(title="Eng", company="Co", bullets=["ok", "  ", ""])
    bullets = _build_bullet_inputs([entry])
    assert len(bullets) == 1
    assert bullets[0].text == "ok"


@pytest.mark.asyncio
async def test_orchestrator_parallel_success():
    service = _build_service()
    result = await service.run(resume=_resume(), job=_job())

    assert result.response.cached is False
    assert result.response.knockout is not None
    assert result.response.knockout.passes_all_checks is True
    assert result.response.keywords is not None
    assert result.response.keywords.required_matched == ["Python", "AWS"]
    assert result.response.bullets is not None
    assert result.response.bullets.total_analyzed == 3
    assert result.response.warnings == []
    # 3 AI calls (job-parse, keyword-extract, bullet-analyze) → 3 AIResponses
    assert len(result.ai_responses) == 3


@pytest.mark.asyncio
async def test_orchestrator_bullet_failure_partial():
    service = _build_service(bullets_raises=RuntimeError("bullet analyzer down"))
    result = await service.run(resume=_resume(), job=_job())

    assert result.response.keywords is not None
    assert result.response.knockout is not None
    assert result.response.bullets is None
    assert [w.stage for w in result.response.warnings] == ["bullets"]
    assert "bullet analyzer down" in result.response.warnings[0].error


@pytest.mark.asyncio
async def test_orchestrator_knockout_failure_partial():
    service = _build_service(knockout_raises=RuntimeError("job parse failed"))
    result = await service.run(resume=_resume(), job=_job())

    assert result.response.keywords is not None
    assert result.response.bullets is not None
    assert result.response.knockout is None
    assert [w.stage for w in result.response.warnings] == ["knockout"]


@pytest.mark.asyncio
async def test_orchestrator_keyword_failure_raises():
    service = _build_service(keyword_raises=RuntimeError("keyword extractor down"))
    with pytest.raises(DeepAnalysisCriticalError) as exc_info:
        await service.run(resume=_resume(), job=_job())
    assert "keyword extractor down" in str(exc_info.value)


@pytest.mark.asyncio
async def test_orchestrator_empty_experience_skips_bullet_call():
    service = _build_service()
    result = await service.run(resume=_resume(with_experience=False), job=_job())

    assert result.response.bullets is not None
    assert result.response.bullets.total_analyzed == 0
    # bullet_analyzer.analyze_batch should NOT have been called when we have
    # no bullets to process.
    service._bullet_analyzer.analyze_batch.assert_not_awaited()


@pytest.mark.asyncio
async def test_orchestrator_raises_when_resume_not_parsed():
    service = _build_service()
    resume = _resume()
    resume.parsed = None
    with pytest.raises(DeepAnalysisCriticalError, match="not been parsed"):
        await service.run(resume=resume, job=_job())


@pytest.mark.asyncio
async def test_orchestrator_raises_when_job_description_empty():
    service = _build_service()
    job = _job()
    job.job_description = "   "
    with pytest.raises(DeepAnalysisCriticalError, match="no description"):
        await service.run(resume=_resume(), job=job)
