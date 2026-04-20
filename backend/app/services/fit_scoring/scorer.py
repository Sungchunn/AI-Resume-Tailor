"""
Daily fit-score batch scorer.

For each user with a verified master resume, upserts ``fit_score_raw``
onto a ``user_job_interactions`` row for every active keyword-bearing
``JobListing``. Rows are created on demand via ``ON CONFLICT`` so the
list page shows a badge on every job, not just ones the user has
already interacted with.

Pure set intersection on the cached keyword lists — no AI calls.
"""

import logging
import time

from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.mongodb import get_mongodb
from app.db.session import AsyncSessionLocal
from app.models.job_listing import JobListing
from app.models.mongo.resume import ParsedContent
from app.models.user_job_interaction import UserJobInteraction
from app.services.fit_scoring.resume_keywords import (
    compute_resume_keywords_hash,
    extract_resume_keywords,
)

_UPSERT_CHUNK = 200

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
    """Score every active keyword-bearing job for one user via upsert."""
    started = time.perf_counter()

    jobs_q = select(JobListing.id, JobListing.extracted_keywords).where(
        JobListing.is_active.is_(True),
        JobListing.extracted_keywords.isnot(None),
    )
    jobs = (await pg_session.execute(jobs_q)).all()
    if not jobs:
        return {"written": 0, "skipped_no_change": 0, "skipped_no_job_kws": 0}

    job_ids = [job.id for job in jobs]
    existing_q = select(
        UserJobInteraction.job_listing_id,
        UserJobInteraction.scored_resume_hash,
    ).where(
        UserJobInteraction.user_id == user_id,
        UserJobInteraction.job_listing_id.in_(job_ids),
    )
    already_scored: dict[int, str | None] = {
        row.job_listing_id: row.scored_resume_hash
        for row in (await pg_session.execute(existing_q)).all()
    }

    rows: list[dict] = []
    skipped_no_change = 0
    skipped_no_job_kws = 0

    for job in jobs:
        payload = job.extracted_keywords
        job_keywords_raw = (
            payload.get("keywords") if isinstance(payload, dict) else None
        )
        if not isinstance(job_keywords_raw, list) or not job_keywords_raw:
            skipped_no_job_kws += 1
            continue

        job_keywords = {kw.lower() for kw in job_keywords_raw if isinstance(kw, str)}
        if not job_keywords:
            skipped_no_job_kws += 1
            continue

        if already_scored.get(job.id) == resume_hash:
            skipped_no_change += 1
            continue

        overlap = len(resume_keywords & job_keywords)
        raw_score = round((overlap / len(job_keywords)) * 100)
        rows.append(
            {
                "user_id": user_id,
                "job_listing_id": job.id,
                "fit_score_raw": raw_score,
                "scored_resume_hash": resume_hash,
            }
        )

    written = 0
    for i in range(0, len(rows), _UPSERT_CHUNK):
        batch = rows[i : i + _UPSERT_CHUNK]
        stmt = pg_insert(UserJobInteraction).values(batch)
        stmt = stmt.on_conflict_do_update(
            index_elements=["user_id", "job_listing_id"],
            set_={
                "fit_score_raw": stmt.excluded.fit_score_raw,
                "scored_resume_hash": stmt.excluded.scored_resume_hash,
                "updated_at": func.now(),
            },
        )
        await pg_session.execute(stmt)
        written += len(batch)

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
