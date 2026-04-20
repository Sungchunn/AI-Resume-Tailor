"""
Post-scrape ingestion helper for fit-scoring keyword extraction.

Runs after the daily APIFY scrape completes: finds active JobListings
whose ``extracted_keywords`` are still NULL and fills them in using a
bounded concurrency loop. Idempotent — the NULL filter guarantees we
never re-extract.
"""

import asyncio
import logging

from sqlalchemy import select, update

from app.db.session import AsyncSessionLocal
from app.models.job_listing import JobListing
from app.services.ai.usage_tracker import get_usage_tracker
from app.services.fit_scoring.job_keywords import (
    build_keywords_payload,
    extract_job_keywords,
)

logger = logging.getLogger(__name__)

_EXTRACTION_ENDPOINT = "/internal/fit-scoring/extract-job-keywords"
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
            select(JobListing.id, JobListing.job_description)
            .where(
                JobListing.extracted_keywords.is_(None),
                JobListing.is_active.is_(True),
            )
            .order_by(JobListing.id.desc())
            .limit(limit)
        )
        rows = (await db.execute(query)).all()

    if not rows:
        logger.info("fit-scoring: no jobs missing keywords")
        return {"candidates": 0, "extracted": 0, "failed": 0}

    logger.info("fit-scoring: extracting keywords for %d jobs", len(rows))

    semaphore = asyncio.Semaphore(concurrency)
    results: list[tuple[int, list[str], object | None]] = []

    async def _run(job_id: int, description: str) -> None:
        async with semaphore:
            keywords, ai_response = await extract_job_keywords(description)
            results.append((job_id, keywords, ai_response))

    await asyncio.gather(
        *(_run(job_id, description) for job_id, description in rows),
        return_exceptions=False,
    )

    extracted = 0
    failed = 0
    tracker = get_usage_tracker()

    async with AsyncSessionLocal() as db:
        for job_id, keywords, ai_response in results:
            if ai_response is None or not keywords:
                failed += 1
                continue

            await db.execute(
                update(JobListing)
                .where(JobListing.id == job_id)
                .values(extracted_keywords=build_keywords_payload(keywords))
            )
            await tracker.log_generation(
                db=db,
                user_id=None,
                endpoint=_EXTRACTION_ENDPOINT,
                response=ai_response,
            )
            extracted += 1

        await db.commit()

    logger.info(
        "fit-scoring: extracted %d, failed %d (candidates %d)",
        extracted,
        failed,
        len(rows),
    )
    return {"candidates": len(rows), "extracted": extracted, "failed": failed}
