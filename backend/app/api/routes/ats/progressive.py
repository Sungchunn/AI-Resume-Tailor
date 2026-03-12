"""
ATS Progressive Analysis with Server-Sent Events (SSE)

Orchestrates all ATS stages with real-time progress streaming.
"""

import json
import time

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user_id_sse, get_db, get_mongo_db
from app.crud.job import JobCRUD
from app.crud.job_listing import JobListingRepository
from app.crud.mongo.resume import ResumeCRUD as MongoResumeCRUD
from app.services.core.cache import get_cache_service

from app.schemas.ats import ATSProgressiveRequest

from app.api.routes.ats.helpers import (
    execute_knockout_check,
    execute_structure_analysis,
    execute_keyword_analysis,
    execute_content_quality,
    execute_role_proximity,
    calculate_composite_score,
)

router = APIRouter()


@router.get("/analyze-progressive")
async def analyze_progressive_ats(
    resume_id: str | None = Query(None, description="Resume MongoDB ObjectId"),
    job_id: int | None = Query(None, description="User-created job PostgreSQL ID"),
    job_listing_id: int | None = Query(None, description="Scraped job listing PostgreSQL ID"),
    force_refresh: bool = Query(False, description="Skip cache and run fresh analysis"),
    user_id: int = Depends(get_current_user_id_sse),
    db: AsyncSession = Depends(get_db),
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
):
    """
    Run complete ATS analysis with real-time progress updates via SSE.

    This endpoint orchestrates all 5 ATS stages and streams progress events:

    **Event Types:**
    - `cache_hit`: Cached results found, returning fast playback
    - `cache_miss`: No cached results, running full analysis
    - `stage_start`: Stage N is beginning
    - `stage_complete`: Stage N completed successfully (includes result data)
    - `stage_error`: Stage N failed (includes error message, continues to next stage)
    - `score_calculation`: Calculating final composite score
    - `complete`: All stages finished, composite score ready
    - `error`: Fatal error that aborts entire analysis

    **Caching Behavior:**
    - Cache key: `ats:{resume_content_hash[:16]}:{job_id}`
    - TTL: 24 hours
    - On cache hit, streams cached results as fast playback
    - On cache miss, runs full pipeline and caches results

    **Client Usage:**
    ```javascript
    const eventSource = new EventSource('/api/v1/ats/analyze-progressive?resume_id=123&job_id=456');
    eventSource.addEventListener('stage_complete', (e) => {
      const data = JSON.parse(e.data);
      console.log(`Stage ${data.stage} done:`, data.result);
    });
    ```
    """
    # Get cache service for ATS result caching
    cache = get_cache_service()

    async def event_generator():
        nonlocal resume_id, job_id, job_listing_id
        start_time = time.time()
        stage_results = {}
        failed_stages = []
        resume_content_hash: str | None = None
        effective_job_id: int | None = None
        parsed_resume_content: dict = {}
        job_description: str = ""

        # Stage metadata
        stages = [
            (0, "knockout-check", "Knockout Risk Check"),
            (1, "structure", "Structure Analysis"),
            (2, "keywords-enhanced", "Keyword Matching"),
            (3, "content-quality", "Content Quality"),
            (4, "role-proximity", "Role Proximity"),
        ]

        try:
            # Validate input - need resume_id AND (job_id OR job_listing_id)
            if not resume_id or not (job_id or job_listing_id):
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "error": "Must provide resume_id and either job_id or job_listing_id"
                    })
                }
                return

            # Fetch resume from MongoDB using ObjectId string
            mongo_resume_repo = MongoResumeCRUD()
            mongo_resume = await mongo_resume_repo.get(mongo_db, id=resume_id)
            if not mongo_resume or mongo_resume.user_id != user_id:
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Resume not found or not authorized"})
                }
                return

            raw_resume_content = mongo_resume.raw_content or ""
            parsed_resume_content = mongo_resume.parsed.model_dump() if mongo_resume.parsed else {}
            resume_content_hash = cache.hash_content(raw_resume_content)

            # Fetch job description from job_listings or job_descriptions table
            job_content: dict = {}
            if job_listing_id:
                job_listing_repo = JobListingRepository()
                job_listing = await job_listing_repo.get(db, id=job_listing_id)
                if not job_listing:
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": "Job listing not found"})
                    }
                    return
                job_description = str(job_listing.job_description or "")
                effective_job_id = job_listing_id
                job_content = {
                    "title": str(job_listing.job_title or ""),
                    "company": str(job_listing.company_name or ""),
                    "location": str(job_listing.location or ""),
                    "seniority": str(job_listing.seniority or ""),
                    "job_function": str(job_listing.job_function or ""),
                    "industry": str(job_listing.industry or ""),
                    "description": job_description,
                }
            elif job_id:
                job_repo = JobCRUD()
                job = await job_repo.get(db, id=job_id)
                if not job or job.owner_id != user_id:
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": "Job not found or not authorized"})
                    }
                    return
                job_description = str(job.raw_content or "")
                effective_job_id = job_id
                parsed = job.parsed_content
                if parsed and isinstance(parsed, dict):
                    job_content = parsed
                else:
                    job_content = {
                        "title": str(getattr(job, 'title', "") or ""),
                        "company": str(getattr(job, 'company', "") or ""),
                        "description": job_description,
                    }

            # Build request object with fetched content for helper functions
            request = ATSProgressiveRequest(
                resume_content=parsed_resume_content,
                job_description=job_description,
                job_content=job_content,
            )

            # Check cache before running analysis (skip if force_refresh is True)
            cached_result = None if force_refresh else await cache.get_ats_result(resume_content_hash, effective_job_id)
            if cached_result:
                cached_at = cached_result.get("cached_at", "")
                yield {
                    "event": "cache_hit",
                    "data": json.dumps({
                        "cached_at": cached_at,
                        "resume_content_hash": resume_content_hash,
                    })
                }

                cached_stages = cached_result.get("stage_results", {})
                for idx, (stage_num, stage_key, stage_name) in enumerate(stages):
                    progress_percent = int(((idx + 1) / len(stages)) * 100)

                    if stage_key in cached_stages:
                        yield {
                            "event": "stage_complete",
                            "data": json.dumps({
                                "stage": stage_num,
                                "stage_name": stage_name,
                                "status": "completed",
                                "progress_percent": progress_percent,
                                "elapsed_ms": 0,
                                "result": cached_stages[stage_key],
                                "from_cache": True,
                            })
                        }
                    else:
                        failed_stages.append(stage_name)

                cached_knockout_risks = []
                cached_knockout = cached_stages.get("knockout-check", {})
                if cached_knockout:
                    cached_knockout_risks = cached_knockout.get("risks", [])

                composite_score = cached_result.get("composite_score", {})
                yield {
                    "event": "complete",
                    "data": json.dumps({
                        "stage": 5,
                        "stage_name": "Complete",
                        "status": "completed",
                        "progress_percent": 100,
                        "elapsed_ms": int((time.time() - start_time) * 1000),
                        "composite_score": composite_score,
                        "knockout_risks": cached_knockout_risks,
                        "from_cache": True,
                        "cached_at": cached_at,
                    })
                }
                return

            yield {
                "event": "cache_miss",
                "data": json.dumps({
                    "resume_content_hash": resume_content_hash,
                    "job_id": effective_job_id,
                })
            }

            for idx, (stage_num, stage_key, stage_name) in enumerate(stages):
                stage_start = time.time()
                progress_percent = int((idx / len(stages)) * 100)

                yield {
                    "event": "stage_start",
                    "data": json.dumps({
                        "stage": stage_num,
                        "stage_name": stage_name,
                        "status": "running",
                        "progress_percent": progress_percent,
                    })
                }

                try:
                    if stage_num == 0:
                        result = await execute_knockout_check(request, user_id, db)
                    elif stage_num == 1:
                        result = await execute_structure_analysis(request, user_id, db)
                    elif stage_num == 2:
                        result = await execute_keyword_analysis(request, user_id, db)
                    elif stage_num == 3:
                        result = await execute_content_quality(request, user_id, db)
                    elif stage_num == 4:
                        result = await execute_role_proximity(request, user_id, db)

                    stage_elapsed = int((time.time() - stage_start) * 1000)
                    progress_percent = int(((idx + 1) / len(stages)) * 100)

                    stage_results[stage_key] = result

                    yield {
                        "event": "stage_complete",
                        "data": json.dumps({
                            "stage": stage_num,
                            "stage_name": stage_name,
                            "status": "completed",
                            "progress_percent": progress_percent,
                            "elapsed_ms": stage_elapsed,
                            "result": result.model_dump() if hasattr(result, 'model_dump') else result,
                        })
                    }

                except Exception as e:
                    stage_elapsed = int((time.time() - stage_start) * 1000)
                    failed_stages.append(stage_name)

                    yield {
                        "event": "stage_error",
                        "data": json.dumps({
                            "stage": stage_num,
                            "stage_name": stage_name,
                            "status": "failed",
                            "progress_percent": progress_percent,
                            "elapsed_ms": stage_elapsed,
                            "error": str(e),
                        })
                    }

            yield {
                "event": "score_calculation",
                "data": json.dumps({
                    "stage": 5,
                    "stage_name": "Calculating Final Score",
                    "status": "running",
                    "progress_percent": 95,
                })
            }

            composite_score = calculate_composite_score(stage_results, failed_stages)
            total_elapsed = int((time.time() - start_time) * 1000)

            if resume_content_hash and effective_job_id and stage_results and not failed_stages:
                cacheable_stage_results = {}
                for key, result in stage_results.items():
                    if hasattr(result, 'model_dump'):
                        cacheable_stage_results[key] = result.model_dump()
                    else:
                        cacheable_stage_results[key] = result

                await cache.set_ats_result(
                    resume_content_hash=resume_content_hash,
                    job_id=effective_job_id,
                    composite_score=composite_score.model_dump(),
                    stage_results=cacheable_stage_results,
                )

            knockout_risks = []
            knockout_result = stage_results.get("knockout-check")
            if knockout_result:
                if hasattr(knockout_result, 'model_dump'):
                    knockout_data = knockout_result.model_dump()
                else:
                    knockout_data = knockout_result
                knockout_risks = knockout_data.get("risks", [])

            yield {
                "event": "complete",
                "data": json.dumps({
                    "stage": 5,
                    "stage_name": "Complete",
                    "status": "completed",
                    "progress_percent": 100,
                    "elapsed_ms": total_elapsed,
                    "composite_score": composite_score.model_dump(),
                    "knockout_risks": knockout_risks,
                    "from_cache": False,
                })
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({
                    "error": f"Fatal error during ATS analysis: {str(e)}"
                })
            }

    return EventSourceResponse(event_generator())
