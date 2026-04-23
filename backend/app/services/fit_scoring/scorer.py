"""
Daily fit-score batch scorer.

For each user with a verified master resume, upserts ``fit_score_raw``
onto a ``user_job_interactions`` row for every active keyword-bearing
``JobListing``. Rows are created on demand via ``ON CONFLICT`` so the
list page shows a badge on every job, not just ones the user has
already interacted with.

v4 math (gated by ``settings.fit_score_v4_enabled``):
    sem  = calibrate( cosine(resume_vec, job_vec) )       # 0..1
    kw   = sqrt( min(overlap, N) / min(N, |job_kws|) )    # 0..1
    base = 0.5 * sem + 0.5 * kw
    if required_skills \\ resume_keywords: base = min(base, 0.60)
    score = round(base * 100)

v3 fallback (flag off, or embeddings missing on either side): pure
capped + sqrt-curve keyword overlap.

Every score is paired with a ``breakdown`` dict so the UI can render
the formula, matched/missing keywords, and the cap state. Each run of
``score_all_users`` writes one ``fit_score_batch_runs`` row so the UI
can show "Scores refreshed Xh ago".
"""

import logging
import math
import time
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.mongodb import get_mongodb
from app.db.session import AsyncSessionLocal
from app.models.fit_score_batch_run import FitScoreBatchRun
from app.models.job_listing import JobListing
from app.models.mongo.resume import ParsedContent
from app.models.user_job_interaction import UserJobInteraction
from app.services.ai.embedding import EmbeddingTaskType, get_embedding_service
from app.services.fit_scoring.resume_keywords import (
    build_resume_embedding_text,
    compute_resume_embedding_hash,
    compute_resume_keywords_hash,
    extract_resume_keywords,
)

logger = logging.getLogger(__name__)

_UPSERT_CHUNK = 200

# Capped-denominator keyword scoring with a square-root curve. Matching the
# top N JD keywords hits the ceiling; the sqrt curve lifts mid-range overlaps
# so a partial match reads as encouraging rather than mediocre while
# preserving monotonicity (more matches always means a higher score).
TOP_N = 10

# Cosine-similarity calibration window. Raw JD-to-resume cosines typically
# sit in [0.55, 0.85]; linear-map that window to [0, 1] and clip. Revisit
# after two weeks of production data — a skewed distribution should swap
# this for a percentile-rank transform.
_COS_MIN = 0.55
_COS_MAX = 0.85

_SEM_WEIGHT = 0.5  # hybrid weight on semantic term
_KW_WEIGHT = 0.5  # hybrid weight on keyword term
_REQUIRED_GATE_CAP = 0.60  # max base score when a required keyword is missing


def _keyword_term(resume_keywords: set[str], job_keywords: set[str]) -> float:
    """0..1 capped + sqrt-curve keyword-overlap term (v3 math)."""
    denom = min(TOP_N, len(job_keywords))
    if denom == 0:
        return 0.0
    overlap = len(resume_keywords & job_keywords)
    ratio = min(overlap, denom) / denom
    return math.sqrt(ratio)


def _cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity. Returns 0.0 if either vector is empty or zero-norm."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na <= 0.0 or nb <= 0.0:
        return 0.0
    return dot / math.sqrt(na * nb)


def _calibrate_cosine(cos: float) -> float:
    """Clip-and-scale raw cosine into [0, 1]."""
    if cos <= _COS_MIN:
        return 0.0
    if cos >= _COS_MAX:
        return 1.0
    return (cos - _COS_MIN) / (_COS_MAX - _COS_MIN)


def compute_raw_score(
    resume_keywords: set[str],
    job_keywords: set[str],
    *,
    job_required: set[str] | None = None,
    resume_embedding: list[float] | None = None,
    job_embedding: list[float] | None = None,
) -> tuple[int, dict]:
    """Return ``(score, breakdown)`` for the given keyword/embedding state.

    Breakdown fields are the same shape across all three paths (v3 fallback,
    v4 uncapped, v4 capped); ``version`` and ``semantic_sub`` are the only
    path-dependent fields. The UI uses the breakdown verbatim to render
    the formula panel, required-skills row, and keyword-overlap section.
    """
    kw_raw = _keyword_term(resume_keywords, job_keywords)
    keyword_sub = round(kw_raw * 100)

    matched = sorted(resume_keywords & job_keywords)
    missing = sorted(job_keywords - resume_keywords)

    required_set = job_required or set()
    required_matched = sorted(required_set & resume_keywords)
    required_missing = sorted(required_set - resume_keywords)

    breakdown: dict = {
        "version": 4,
        "semantic_sub": None,
        "keyword_sub": keyword_sub,
        "keyword_matched": matched,
        "keyword_missing": missing,
        "keyword_total": len(job_keywords),
        "required_total": len(required_set),
        "required_matched": required_matched,
        "required_missing": required_missing,
        "is_capped": False,
        "cap_value": 100,
    }

    # v3 fallback — no embedding on one side.
    if resume_embedding is None or job_embedding is None:
        breakdown["version"] = 3
        return round(kw_raw * 100), breakdown

    sem_raw = _calibrate_cosine(_cosine(resume_embedding, job_embedding))
    breakdown["semantic_sub"] = round(sem_raw * 100)

    base = _SEM_WEIGHT * sem_raw + _KW_WEIGHT * kw_raw

    # Cap only fires when it actually reduces the score — a low-base job with
    # a missing required skill is already "low fit" and the UI should not
    # show CAP 60 there.
    if required_missing and base > _REQUIRED_GATE_CAP:
        base = _REQUIRED_GATE_CAP
        breakdown["is_capped"] = True
        breakdown["cap_value"] = round(_REQUIRED_GATE_CAP * 100)

    return round(base * 100), breakdown


async def score_all_users() -> dict[str, int]:
    """Score every user's active job interactions against their master resume.

    Returns summary counts: users scanned, scores written, rows skipped.
    Writes one ``fit_score_batch_runs`` row per invocation so the UI can
    show "Scores refreshed Xh ago".
    """
    mongo_db = get_mongodb()
    settings = get_settings()
    hybrid_enabled = settings.fit_score_v4_enabled

    summary = {
        "users": 0,
        "written": 0,
        "skipped_no_change": 0,
        "skipped_no_job_kws": 0,
    }

    batch_run_id = await _create_batch_run()

    try:
        projection = {
            "user_id": 1,
            "parsed": 1,
            "extracted_keywords": 1,
            "keywords_content_hash": 1,
            "content_embedding": 1,
            "embedding_content_hash": 1,
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

            # --- Keywords (lazy-compute if missing) ---
            resume_keywords_list = doc.get("extracted_keywords")
            resume_kw_hash = doc.get("keywords_content_hash")
            if not resume_keywords_list or not resume_kw_hash:
                resume_keywords_list = sorted(extract_resume_keywords(parsed))
                resume_kw_hash = compute_resume_keywords_hash(parsed)
                await mongo_db.resumes.update_one(
                    {"_id": doc["_id"]},
                    {
                        "$set": {
                            "extracted_keywords": resume_keywords_list,
                            "keywords_content_hash": resume_kw_hash,
                        }
                    },
                )

            resume_keywords: set[str] = {kw.lower() for kw in resume_keywords_list}

            # --- Embedding (lazy-compute only when hybrid is enabled) ---
            resume_embedding: list[float] | None = doc.get("content_embedding")
            resume_emb_hash: str | None = doc.get("embedding_content_hash")
            current_emb_hash = compute_resume_embedding_hash(parsed)

            if hybrid_enabled and (
                resume_embedding is None or resume_emb_hash != current_emb_hash
            ):
                try:
                    embed_response = await get_embedding_service()._embed_with_metrics(
                        text=build_resume_embedding_text(parsed),
                        task_type=EmbeddingTaskType.SEMANTIC_SIMILARITY,
                    )
                    resume_embedding = embed_response.embedding
                    resume_emb_hash = current_emb_hash
                    await mongo_db.resumes.update_one(
                        {"_id": doc["_id"]},
                        {
                            "$set": {
                                "content_embedding": resume_embedding,
                                "embedding_content_hash": resume_emb_hash,
                            }
                        },
                    )
                except Exception:
                    logger.exception(
                        "fit-scoring: resume embedding failed user=%s (falling back to v3)",
                        user_id,
                    )
                    resume_embedding = None
                    resume_emb_hash = None

            # Combined hash so v3↔v4 flips, keyword edits, and content edits all
            # trigger re-scoring on the next run.
            combined_hash = f"{resume_kw_hash}:{resume_emb_hash or '-'}:{int(hybrid_enabled)}"

            async with AsyncSessionLocal() as pg_session:
                counts = await _score_user(
                    pg_session,
                    user_id,
                    resume_keywords,
                    combined_hash,
                    resume_embedding=resume_embedding if hybrid_enabled else None,
                )
            for key, delta in counts.items():
                summary[key] = summary.get(key, 0) + delta

        await _complete_batch_run(
            batch_run_id,
            status="completed",
            users_count=summary["users"],
            rows_written=summary["written"],
        )
    except Exception:
        await _complete_batch_run(
            batch_run_id,
            status="failed",
            users_count=summary["users"],
            rows_written=summary["written"],
        )
        raise

    logger.info("fit-scoring: batch complete — %s", summary)
    return summary


async def _create_batch_run() -> int | None:
    """Insert a running batch-run row; return its id (None on failure)."""
    try:
        async with AsyncSessionLocal() as pg_session:
            row = FitScoreBatchRun(status="running")
            pg_session.add(row)
            await pg_session.commit()
            await pg_session.refresh(row)
            return row.id
    except Exception:
        logger.exception("fit-scoring: failed to create batch-run row")
        return None


async def _complete_batch_run(
    batch_run_id: int | None,
    *,
    status: str,
    users_count: int,
    rows_written: int,
) -> None:
    """Mark the batch-run row as completed/failed with final counts."""
    if batch_run_id is None:
        return
    try:
        async with AsyncSessionLocal() as pg_session:
            row = await pg_session.get(FitScoreBatchRun, batch_run_id)
            if row is None:
                return
            row.status = status
            row.users_count = users_count
            row.rows_written = rows_written
            row.completed_at = datetime.now(timezone.utc)
            await pg_session.commit()
    except Exception:
        logger.exception("fit-scoring: failed to update batch-run id=%s", batch_run_id)


async def _score_user(
    pg_session: AsyncSession,
    user_id: int,
    resume_keywords: set[str],
    resume_hash: str,
    *,
    resume_embedding: list[float] | None = None,
) -> dict[str, int]:
    """Score every active keyword-bearing job for one user via upsert."""
    started = time.perf_counter()

    jobs_q = select(
        JobListing.id,
        JobListing.extracted_keywords,
        JobListing.description_embedding,
    ).where(
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

        required_raw = (
            payload.get("required") if isinstance(payload, dict) else None
        )
        job_required = (
            {kw.lower() for kw in required_raw if isinstance(kw, str)}
            if isinstance(required_raw, list)
            else set()
        )

        if already_scored.get(job.id) == resume_hash:
            skipped_no_change += 1
            continue

        raw_score, breakdown = compute_raw_score(
            resume_keywords,
            job_keywords,
            job_required=job_required,
            resume_embedding=resume_embedding,
            job_embedding=job.description_embedding,
        )
        rows.append(
            {
                "user_id": user_id,
                "job_listing_id": job.id,
                "fit_score_raw": raw_score,
                "scored_resume_hash": resume_hash,
                "fit_score_breakdown": breakdown,
                "fit_score_is_capped": breakdown["is_capped"],
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
                "fit_score_breakdown": stmt.excluded.fit_score_breakdown,
                "fit_score_is_capped": stmt.excluded.fit_score_is_capped,
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


__all__ = ["score_all_users", "compute_raw_score", "TOP_N"]
