"""
Post-scrape ingestion helper for fit-scoring keyword extraction.

Runs after the daily APIFY scrape completes: finds active JobListings
whose ``extracted_keywords`` are still NULL and fills them in using a
bounded concurrency loop. Idempotent — the NULL filter guarantees we
never re-extract.
"""

import asyncio
import logging

from sqlalchemy import or_, select, update

from app.db.session import AsyncSessionLocal
from app.models.job_listing import JobListing
from app.services.ai.embedding import EmbeddingTaskType, get_embedding_service
from app.services.ai.response import AIResponse, AIUsageMetrics, EmbeddingResponse
from app.services.ai.usage_tracker import get_usage_tracker
from app.services.fit_scoring.job_keywords import (
    build_keywords_payload,
    extract_job_keywords,
)

logger = logging.getLogger(__name__)

_EXTRACTION_ENDPOINT = "/internal/fit-scoring/extract-job-keywords"
_EMBEDDING_ENDPOINT = "/internal/fit-scoring/embed-job"
_DEFAULT_CONCURRENCY = 3
_DEFAULT_LIMIT = 500


async def extract_missing_job_keywords(
    limit: int = _DEFAULT_LIMIT,
    concurrency: int = _DEFAULT_CONCURRENCY,
) -> dict[str, int]:
    """Backfill ``extracted_keywords`` for active JobListings missing them.

    Args:
        limit: Maximum number of jobs to extract per run. Soft cap; leftover
            rows are picked up on the next scheduler tick.
        concurrency: Max concurrent AI calls.

    Returns:
        Counts dict: ``{"candidates": N, "extracted": N, "failed": N}``.
    """
    async with AsyncSessionLocal() as db:
        query = (
            select(
                JobListing.id,
                JobListing.job_description,
                JobListing.extracted_keywords,
                JobListing.description_embedding,
            )
            .where(
                JobListing.is_active.is_(True),
                or_(
                    JobListing.extracted_keywords.is_(None),
                    JobListing.description_embedding.is_(None),
                ),
            )
            .order_by(JobListing.id.desc())
            .limit(limit)
        )
        rows = (await db.execute(query)).all()

    if not rows:
        logger.info("fit-scoring: no jobs missing keywords or embeddings")
        return {
            "candidates": 0,
            "extracted": 0,
            "embedded": 0,
            "failed_extract": 0,
            "failed_embed": 0,
        }

    logger.info(
        "fit-scoring: processing %d jobs for keywords/embeddings", len(rows)
    )

    semaphore = asyncio.Semaphore(concurrency)
    embedding_service = get_embedding_service()

    # Per-job result tuple:
    # (job_id, need_kw, kws, required, ai_response,
    #  need_emb, embedding, embed_response)
    results: list[tuple[
        int,
        bool, list[str], list[str], AIResponse | None,
        bool, list[float] | None, EmbeddingResponse | None,
    ]] = []

    async def _run(
        job_id: int,
        description: str,
        existing_keywords: object,
        existing_embedding: object,
    ) -> None:
        need_kw = existing_keywords is None
        need_emb = existing_embedding is None

        kws: list[str] = []
        required: list[str] = []
        ai_response: AIResponse | None = None
        embedding: list[float] | None = None
        embed_response: EmbeddingResponse | None = None

        async with semaphore:
            if need_kw:
                kws, required, ai_response = await extract_job_keywords(description)

            if need_emb:
                try:
                    embed_response = await embedding_service._embed_with_metrics(
                        text=description,
                        task_type=EmbeddingTaskType.SEMANTIC_SIMILARITY,
                    )
                    embedding = embed_response.embedding
                except Exception:
                    logger.exception("fit-scoring: embedding call failed job=%d", job_id)
                    embedding = None
                    embed_response = None

        results.append(
            (
                job_id, need_kw, kws, required, ai_response,
                need_emb, embedding, embed_response,
            )
        )

    await asyncio.gather(
        *(
            _run(
                job_id,
                description,
                existing_keywords,
                existing_embedding,
            )
            for (
                job_id,
                description,
                existing_keywords,
                existing_embedding,
            ) in rows
        ),
        return_exceptions=False,
    )

    extracted = 0
    embedded = 0
    failed_extract = 0
    failed_embed = 0
    tracker = get_usage_tracker()

    async with AsyncSessionLocal() as db:
        for (
            job_id, need_kw, kws, required, ai_response,
            need_emb, embedding, embed_response,
        ) in results:
            values: dict[str, object] = {}

            if need_kw:
                if ai_response is None or not kws:
                    failed_extract += 1
                else:
                    values["extracted_keywords"] = build_keywords_payload(kws, required)
                    await tracker.log_generation(
                        db=db,
                        user_id=None,
                        endpoint=_EXTRACTION_ENDPOINT,
                        response=ai_response,
                    )
                    extracted += 1

            if need_emb:
                if embedding is None:
                    failed_embed += 1
                else:
                    values["description_embedding"] = embedding
                    if embed_response is not None:
                        # Wrap EmbeddingResponse metrics into an AIResponse-shaped
                        # log entry so usage tracker sees a uniform payload.
                        await tracker.log_generation(
                            db=db,
                            user_id=None,
                            endpoint=_EMBEDDING_ENDPOINT,
                            response=_embedding_response_as_ai_response(embed_response),
                        )
                    embedded += 1

            if values:
                await db.execute(
                    update(JobListing).where(JobListing.id == job_id).values(**values)
                )

        await db.commit()

    logger.info(
        "fit-scoring: kws extracted=%d failed=%d; embeddings done=%d failed=%d (candidates=%d)",
        extracted,
        failed_extract,
        embedded,
        failed_embed,
        len(rows),
    )
    return {
        "candidates": len(rows),
        "extracted": extracted,
        "embedded": embedded,
        "failed_extract": failed_extract,
        "failed_embed": failed_embed,
    }


def _embedding_response_as_ai_response(embed: EmbeddingResponse) -> AIResponse:
    """Adapt an EmbeddingResponse into the AIResponse shape the tracker expects."""
    return AIResponse(
        content="",
        metrics=AIUsageMetrics(
            input_tokens=embed.metrics.input_tokens,
            output_tokens=0,
            total_tokens=embed.metrics.total_tokens,
            latency_ms=embed.metrics.latency_ms,
        ),
        provider=embed.provider,
        model=embed.model,
    )
