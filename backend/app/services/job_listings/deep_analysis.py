"""
Deep-analysis orchestrator for POST /job-listings/{id}/analyze.

Composes three existing ATS analyzers into a single response:
- knockout check (uses JobAnalyzer to parse the JD first)
- detailed keyword analysis by importance tier
- per-bullet ATS rewrite suggestions

All three run in parallel via ``asyncio.gather(return_exceptions=True)``.
The keyword stage is the critical path (raises on failure); the other two
degrade gracefully with warnings.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from app.models.job_listing import JobListing
from app.models.mongo.resume import ExperienceEntry, ResumeDocument
from app.schemas.ats.keywords import KeywordDetailResponse
from app.schemas.ats.knockout import KnockoutRiskResponse
from app.schemas.job_listing_analysis import (
    AIUsageSummary,
    AnalysisWarning,
    BulletsBlock,
    JobDeepAnalysisResponse,
    KeywordBlock,
    KnockoutBlock,
)
from app.schemas.tailor.suggestions import (
    ATSContextInput,
    BulletInput,
    EntryContext,
)
from app.services.ai.client import BaseAIClient
from app.services.ai.response import AccumulatedMetrics, AIResponse
from app.services.core.cache import CacheService
from app.services.job.analyzer import JobAnalyzer
from app.services.job.ats import ATSAnalyzer, create_ats_analyzer
from app.services.job.diff.bullet_analyzer import BulletAnalyzer

logger = logging.getLogger(__name__)


class DeepAnalysisCriticalError(Exception):
    """Raised when the critical path (keyword analysis) fails. The route
    translates this to a 500 response; partial failures on knockout or
    bullets surface as warnings in a 200 response instead."""


@dataclass
class DeepAnalysisResult:
    """Return container with the response plus the individual ``AIResponse``
    objects for per-call metrics logging."""

    response: JobDeepAnalysisResponse
    ai_responses: list[AIResponse]


def _build_bullet_inputs(experience: list[ExperienceEntry]) -> list[BulletInput]:
    """Flatten ``parsed.experience`` into ``BulletInput`` objects addressed
    by ``exp-{role_idx}:bullet-{bullet_idx}`` so the AI can reference them
    in suggestions."""

    bullets: list[BulletInput] = []
    for role_idx, entry in enumerate(experience):
        title = entry.title or ""
        company = entry.company or ""
        start = entry.start_date or ""
        end = entry.end_date or "Present"
        date_range = f"{start} - {end}" if start else end

        for bullet_idx, text in enumerate(entry.bullets):
            if not text or not text.strip():
                continue
            bullets.append(
                BulletInput(
                    id=f"exp-{role_idx}:bullet-{bullet_idx}",
                    text=text,
                    entry_context=EntryContext(
                        title=title,
                        company=company,
                        date_range=date_range,
                    ),
                )
            )
    return bullets


def _resume_text_for_keywords(resume: ResumeDocument) -> str:
    """Keyword analyzer accepts a list of ``ExperienceBlockData`` shaped
    dicts. For deep analysis we pass a single block containing the full
    resume text — matches the ``/ats/keywords/detailed`` route pattern."""

    return resume.raw_content or ""


class DeepAnalysisService:
    """Orchestrates knockout + keyword + bullet analyzers for a single
    ``(master resume, job listing)`` pair.

    The AI client, cache, and analyzer factory are injected at construction
    time so tests can substitute mocks without monkeypatching module state.
    """

    def __init__(
        self,
        ai_client: BaseAIClient,
        cache: CacheService,
        *,
        ats_analyzer: ATSAnalyzer | None = None,
        bullet_analyzer: BulletAnalyzer | None = None,
        job_analyzer: JobAnalyzer | None = None,
    ) -> None:
        self._ai_client = ai_client
        self._cache = cache
        self._ats_analyzer = ats_analyzer or create_ats_analyzer(ai_client=ai_client)
        self._bullet_analyzer = bullet_analyzer or BulletAnalyzer(ai_client)
        self._job_analyzer = job_analyzer or JobAnalyzer(ai_client, cache)

    async def run(
        self,
        *,
        resume: ResumeDocument,
        job: JobListing,
    ) -> DeepAnalysisResult:
        """Run the three analyzers in parallel and assemble the response.

        Raises:
            DeepAnalysisCriticalError: If the keyword analyzer fails. The
                route translates this into a 500 response. Non-critical
                failures on knockout or bullets are captured as warnings in
                a 200 response.
        """

        if resume.parsed is None:
            raise DeepAnalysisCriticalError(
                "Master resume has not been parsed — cannot run deep analysis."
            )

        job_description = (job.job_description or "").strip()
        if not job_description:
            raise DeepAnalysisCriticalError(
                "Job listing has no description text to analyze."
            )

        parsed_resume_dict = resume.parsed.model_dump()
        resume_blocks = [{"content": _resume_text_for_keywords(resume), "id": 0}]
        bullets = _build_bullet_inputs(resume.parsed.experience)

        knockout_task = self._knockout_task(parsed_resume_dict, job_description)
        keyword_task = self._keyword_task(resume_blocks, job_description)
        bullets_task = self._bullets_task(bullets, job_description)

        knockout_outcome, keyword_outcome, bullets_outcome = await asyncio.gather(
            knockout_task,
            keyword_task,
            bullets_task,
            return_exceptions=True,
        )

        warnings: list[AnalysisWarning] = []
        ai_responses: list[AIResponse] = []

        # Critical path: keyword. Any failure here means we can't produce
        # the signal the user is paying for, so we fail the whole request.
        if isinstance(keyword_outcome, BaseException):
            logger.exception(
                "deep_analysis keyword stage failed", exc_info=keyword_outcome
            )
            raise DeepAnalysisCriticalError(
                f"Keyword analysis failed: {keyword_outcome!s}"
            )

        keyword_block, keyword_metrics = keyword_outcome
        if keyword_metrics is not None:
            ai_responses.append(keyword_metrics)

        knockout_block: KnockoutBlock | None = None
        if isinstance(knockout_outcome, BaseException):
            logger.warning(
                "deep_analysis knockout stage failed: %s", knockout_outcome
            )
            warnings.append(
                AnalysisWarning(
                    stage="knockout",
                    error=str(knockout_outcome),
                    retriable=True,
                )
            )
        else:
            knockout_block, knockout_metrics = knockout_outcome
            if knockout_metrics is not None:
                ai_responses.append(knockout_metrics)

        bullets_block: BulletsBlock | None = None
        if isinstance(bullets_outcome, BaseException):
            logger.warning(
                "deep_analysis bullets stage failed: %s", bullets_outcome
            )
            warnings.append(
                AnalysisWarning(
                    stage="bullets",
                    error=str(bullets_outcome),
                    retriable=True,
                )
            )
        else:
            bullets_block, bullets_metrics = bullets_outcome
            if bullets_metrics is not None:
                ai_responses.append(bullets_metrics)

        now = datetime.now(timezone.utc)
        response = JobDeepAnalysisResponse(
            job_listing_id=job.id,
            resume_id=str(resume.id) if resume.id else "",
            resume_content_hash=CacheService.hash_content(resume.raw_content or ""),
            cached=False,
            cached_at=None,
            generated_at=now,
            knockout=knockout_block,
            keywords=keyword_block,
            bullets=bullets_block,
            warnings=warnings,
            ai_usage=_aggregate_usage(ai_responses),
        )

        return DeepAnalysisResult(response=response, ai_responses=ai_responses)

    # ----- internal per-stage helpers -----------------------------------

    async def _knockout_task(
        self, parsed_resume: dict, job_description: str
    ) -> tuple[KnockoutBlock, AIResponse | None]:
        """Parse the JD (cached) then run the pure-Python knockout checks."""

        parsed_job, parse_metrics = await self._job_analyzer.analyze(
            job_description, return_metrics=True
        )
        result = self._ats_analyzer.perform_knockout_check(parsed_resume, parsed_job)

        risks = [
            KnockoutRiskResponse(
                risk_type=r.risk_type,
                severity=r.severity,
                description=r.description,
                job_requires=r.job_requires,
                user_has=r.user_has,
            )
            for r in result.risks
        ]
        block = KnockoutBlock(
            passes_all_checks=result.passes_all_checks,
            risks=risks,
            summary=result.summary,
            recommendation=result.recommendation,
        )
        return block, parse_metrics

    async def _keyword_task(
        self, resume_blocks: list[dict], job_description: str
    ) -> tuple[KeywordBlock, AIResponse | None]:
        """Detailed keyword analysis by importance tier."""

        result, ai_metrics = await self._ats_analyzer.analyze_keywords_detailed(
            resume_blocks=resume_blocks,
            job_description=job_description,
            return_metrics=True,
        )

        all_keywords = [
            KeywordDetailResponse(
                keyword=kw.keyword,
                importance=kw.importance,
                found_in_resume=kw.found_in_resume,
                found_in_vault=kw.found_in_vault,
                frequency_in_job=kw.frequency_in_job,
                context=kw.context,
            )
            for kw in result.all_keywords
        ]

        block = KeywordBlock(
            coverage_score=result.coverage_score,
            required_coverage=result.required_coverage,
            preferred_coverage=result.preferred_coverage,
            required_matched=result.required_matched,
            required_missing=result.required_missing,
            preferred_matched=result.preferred_matched,
            preferred_missing=result.preferred_missing,
            nice_to_have_matched=result.nice_to_have_matched,
            nice_to_have_missing=result.nice_to_have_missing,
            all_keywords=all_keywords,
            suggestions=result.suggestions,
            warnings=result.warnings,
        )
        return block, ai_metrics

    async def _bullets_task(
        self, bullets: list[BulletInput], job_description: str
    ) -> tuple[BulletsBlock, AIResponse | None]:
        """Per-bullet ATS rewrite suggestions.

        Runs in parallel with the keyword analyzer so we can't pass its
        output as ``keyword_gaps`` here — the bullet prompt still has the
        full JD text and produces useful suggestions without it. If the
        quality gap proves too large in practice, switch to a two-phase
        (keyword first, then bullets) orchestration.
        """

        if not bullets:
            return (
                BulletsBlock(
                    suggestions=[],
                    total_analyzed=0,
                    suggestions_count=0,
                    skipped_count=0,
                ),
                None,
            )

        ats_context = ATSContextInput(
            keyword_gaps=[],
            importance_map={},
            bullets_needing_metrics=[],
            bullets_with_weak_verbs=[],
        )

        suggestions, ai_response = await self._bullet_analyzer.analyze_batch(
            bullets=bullets,
            job_description=job_description,
            ats_context=ats_context,
            return_metrics=True,
        )

        block = BulletsBlock(
            suggestions=suggestions,
            total_analyzed=len(bullets),
            suggestions_count=len(suggestions),
            skipped_count=len(bullets) - len(suggestions),
        )
        return block, ai_response


def _aggregate_usage(responses: list[AIResponse]) -> AIUsageSummary:
    """Sum tokens + latency across all AI calls in one run. Cost is left at
    zero here because the route layer resolves per-model pricing via
    ``AIUsageTracker.log_generation`` before persisting."""

    if not responses:
        return AIUsageSummary()

    acc = AccumulatedMetrics()
    for r in responses:
        acc.add(r)

    return AIUsageSummary(
        total_tokens=acc.total_tokens,
        cost_usd=0.0,
        latency_ms=acc.total_latency_ms,
    )
