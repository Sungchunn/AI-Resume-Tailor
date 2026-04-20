"""
Daily fit-score batch scorer.

For each user with a verified master resume, recomputes ``fit_score_raw``
on their active ``UserJobInteraction`` rows whose ``scored_resume_hash``
does not match the current starred resume's content hash.

Pure set intersection on the cached keyword lists — no AI calls.
"""

import logging
import time

from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.mongodb import get_mongodb
from app.db.session import AsyncSessionLocal
from app.models.job_listing import JobListing
from app.models.mongo.resume import ParsedContent
from app.models.user_job_interaction import UserJobInteraction
from app.services.fit_scoring.resume_keywords import (
    compute_resume_keywords_hash,
    extract_resume_keywords,
)

logger = logging.getLogger(__name__)


async def score_all_users() -> dict[str, int]:
    """Score every user's active job interactions against their master resume.

    Returns summary counts: users scanned, scores written, rows skipped.
    """
    mongo_db = get_mongodb()
    summary = {"users": 0, "written": 0, "skipped_no_change": 0, "skipped_no_job_kws": 0}

    projection = {
        "user_id": 1,
        "parsed": 1,
        "extracted_keywords": 1,
        "keywords_content_hash": 1,
    }
    cursor = mongo_db.resumes.find(
        {"is_master": True, "parsed_verified": True, "parsed": {"$ne": None}},
        projection,
    )

    async for doc in cursor:
        user_id = doc.get("user_id")
        parsed_raw = doc.get("parsed")
        if user_id is None or not parsed_raw:
            continue

        summary["users"] += 1
        parsed = ParsedContent(**parsed_raw)

        resume_keywords_list = doc.get("extracted_keywords")
        resume_hash = doc.get("keywords_content_hash")
        if not resume_keywords_list or not resume_hash:
            resume_keywords_list = sorted(extract_resume_keywords(parsed))
            resume_hash = compute_resume_keywords_hash(parsed)
            await mongo_db.resumes.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "extracted_keywords": resume_keywords_list,
                        "keywords_content_hash": resume_hash,
                    }
                },
            )

        resume_keywords: set[str] = {kw.lower() for kw in resume_keywords_list}

        async with AsyncSessionLocal() as pg_session:
            counts = await _score_user(
                pg_session, user_id, resume_keywords, resume_hash
            )
        for key, delta in counts.items():
            summary[key] = summary.get(key, 0) + delta

    logger.info("fit-scoring: batch complete — %s", summary)
    return summary


async def _score_user(
    pg_session: AsyncSession,
    user_id: int,
    resume_keywords: set[str],
    resume_hash: str,
) -> dict[str, int]:
    """Score one user's interactions; returns per-user counts."""
    started = time.perf_counter()

    query = (
        select(UserJobInteraction)
        .where(
            UserJobInteraction.user_id == user_id,
            UserJobInteraction.is_hidden.is_(False),
        )
        .options(selectinload(UserJobInteraction.job_listing))
    )
    result = await pg_session.execute(query)
    interactions = result.scalars().all()

    written = 0
    skipped_no_change = 0
    skipped_no_job_kws = 0

    for interaction in interactions:
        job = interaction.job_listing
        if job is None or not job.is_active:
            continue

        if interaction.scored_resume_hash == resume_hash:
            skipped_no_change += 1
            continue

        payload = job.extracted_keywords
        if not payload or not isinstance(payload, dict):
            skipped_no_job_kws += 1
            continue

        job_keywords_raw = payload.get("keywords")
        if not isinstance(job_keywords_raw, list) or not job_keywords_raw:
            skipped_no_job_kws += 1
            continue

        job_keywords = {kw.lower() for kw in job_keywords_raw if isinstance(kw, str)}
        if not job_keywords:
            skipped_no_job_kws += 1
            continue

        overlap = len(resume_keywords & job_keywords)
        raw_score = round((overlap / len(job_keywords)) * 100)

        await pg_session.execute(
            update(UserJobInteraction)
            .where(UserJobInteraction.id == interaction.id)
            .values(
                fit_score_raw=raw_score,
                scored_resume_hash=resume_hash,
            )
        )
        written += 1

    if written:
        await pg_session.commit()

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "fit-scoring: user=%s scored=%d skipped_same_hash=%d skipped_no_job_kws=%d in %dms",
        user_id,
        written,
        skipped_no_change,
        skipped_no_job_kws,
        elapsed_ms,
    )

    return {
        "written": written,
        "skipped_no_change": skipped_no_change,
        "skipped_no_job_kws": skipped_no_job_kws,
    }


__all__ = ["score_all_users"]
