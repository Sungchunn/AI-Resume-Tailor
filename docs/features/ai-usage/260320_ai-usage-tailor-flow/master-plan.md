# AI Usage Tracking for Tailor Flow

## Overview

Extends the [AI Usage Dashboard](../ai-usage-dashboard/260312_master-plan.md) feature by adding AI usage tracking to all tailor flow endpoints that make AI calls.

**Dependency:** `ai-usage-dashboard` (implemented March 12, 2026)

---

## Problem Statement

Several tailor flow endpoints make AI calls but don't log usage to `ai_usage_logs`. This means the admin AI Usage dashboard under-reports actual AI costs and usage.

---

## Current State

### Already Tracked

| Endpoint | Tracking Mechanism | File |
| -------- | ------------------ | ---- |
| `POST /tailor` | `result["ai_metrics"]` | tailor.py:156-165 |
| `GET /ats/analyze-progressive` | `AccumulatedMetrics` | progressive.py:351-361 |
| `POST /ai/improve-section` | Direct logging | ai.py |
| `POST /ai/chat` | Direct logging | ai.py |
| `POST /profile/generate-about-me` | Direct logging | profile.py |

### Not Tracked (needs implementation)

| Endpoint | AI Calls | File |
| -------- | -------- | ---- |
| `POST /tailor/quick-match` | ResumeParser + JobAnalyzer | tailor.py:213-272 |
| `POST /ats/keywords/extract` | KeywordExtractor | keywords.py:337-395 |
| `POST /ats/knockout-check` | ResumeParser + JobAnalyzer | knockout.py:27-121 |
| `POST /ats/role-proximity` | JobAnalyzer | role_proximity.py:28-158 |

### No AI Calls (skip)

| Endpoint | Reason |
| -------- | ------ |
| `POST /ats/structure` | Deterministic regex analysis |
| `POST /ats/content-quality` | Deterministic content analysis |
| `POST /ats/keywords` variants | Covered by progressive endpoint |

## Implementation Plan

### Stage 1: Update TailoringService for quick-match metrics

**File:** `backend/app/services/resume/tailor.py`

Modify `get_quick_match_score()` to track and return AI metrics:

```python
async def get_quick_match_score(
    self,
    raw_resume: str,
    raw_job: str,
) -> dict[str, Any]:
    """Get a quick match score without full tailoring."""
    accumulated_metrics = AccumulatedMetrics()

    # Parse with metrics
    parsed_resume, resume_metrics = await self.resume_parser.parse(
        raw_resume, return_metrics=True
    )
    if resume_metrics:
        accumulated_metrics.add(resume_metrics)

    parsed_job, job_metrics = await self.job_analyzer.analyze(
        raw_job, return_metrics=True
    )
    if job_metrics:
        accumulated_metrics.add(job_metrics)

    # ... existing calculation logic ...

    result = {
        "match_score": min(match_score, 100),
        "keyword_coverage": round(keyword_coverage, 2),
        "skill_matches": list(skill_matches),
        "skill_gaps": list(skill_gaps),
    }

    if accumulated_metrics.call_count > 0:
        result["ai_metrics"] = accumulated_metrics.to_ai_response()

    return result
```

### Stage 2: Update /tailor/quick-match endpoint

**File:** `backend/app/api/routes/tailor.py`

Add AI usage tracking after `get_quick_match_score()`:

```python
@router.post("/quick-match", response_model=QuickMatchResponse)
async def quick_match(...):
    # ... existing validation ...

    service = get_tailoring_service()
    result = await service.get_quick_match_score(
        raw_resume=resume.raw_content,
        raw_job=raw_job,
    )

    # Log AI usage metrics
    if "ai_metrics" in result:
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=pg,
            user_id=current_user_id,
            endpoint="/tailor/quick-match",
            response=result["ai_metrics"],
        )
        await pg.commit()

    return QuickMatchResponse(**result)
```

### Stage 3: Update /ats/keywords/extract endpoint

**File:** `backend/app/api/routes/ats/keywords.py`

Add AI usage tracking:

```python
@router.post("/keywords/extract", response_model=ExtractKeywordsResponse)
async def extract_keywords_with_context(
    request: ExtractKeywordsRequest,
    user_id: int = Depends(get_current_user_id),
    mongo_db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    db: AsyncSession = Depends(get_db),  # Add PG session
):
    extractor = KeywordExtractor()

    # Extract with metrics
    keywords_data, ai_metrics = await extractor.extract_keywords_with_context(
        job_description=request.job_description,
        return_metrics=True,
    )

    # Log AI usage
    if ai_metrics:
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=db,
            user_id=user_id,
            endpoint="/ats/keywords/extract",
            response=ai_metrics,
        )
        await db.commit()

    # ... rest of conversion logic ...
```

### Stage 4: Update /ats/knockout-check endpoint

**File:** `backend/app/api/routes/ats/knockout.py`

Add AI usage tracking for parser/analyzer calls:

```python
@router.post("/knockout-check", response_model=KnockoutCheckResponse)
async def perform_knockout_check(
    request: KnockoutCheckRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    accumulated_metrics = AccumulatedMetrics()

    # Parse resume with metrics
    if request.resume_content:
        parsed_resume, resume_metrics = await resume_parser.parse(
            request.resume_content, return_metrics=True
        )
        if resume_metrics:
            accumulated_metrics.add(resume_metrics)

    # Parse job with metrics
    if request.job_description:
        parsed_job, job_metrics = await job_analyzer.analyze(
            request.job_description, return_metrics=True
        )
        if job_metrics:
            accumulated_metrics.add(job_metrics)

    # ... existing knockout check logic ...

    # Log AI usage
    if accumulated_metrics.call_count > 0:
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=db,
            user_id=user_id,
            endpoint="/ats/knockout-check",
            response=accumulated_metrics.to_ai_response(),
        )
        await db.commit()

    return KnockoutCheckResponse(...)
```

### Stage 5: Update /ats/role-proximity endpoint

**File:** `backend/app/api/routes/ats/role_proximity.py`

Add AI usage tracking for job analyzer:

```python
@router.post("/role-proximity", response_model=RoleProximityResponse)
async def analyze_role_proximity(
    request: RoleProximityRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    accumulated_metrics = AccumulatedMetrics()

    # Parse job with metrics (if raw job_content provided)
    if request.job_content is None and request.job_id:
        # ... existing job fetch logic ...
        if job.raw_content:
            parsed_job, job_metrics = await job_analyzer.analyze(
                job.raw_content, return_metrics=True
            )
            if job_metrics:
                accumulated_metrics.add(job_metrics)

    # ... existing role proximity logic ...

    # Log AI usage
    if accumulated_metrics.call_count > 0:
        usage_tracker = get_usage_tracker()
        await usage_tracker.log_generation(
            db=db,
            user_id=user_id,
            endpoint="/ats/role-proximity",
            response=accumulated_metrics.to_ai_response(),
        )
        await db.commit()

    return RoleProximityResponse(...)
```

## Files to Modify

1. `backend/app/services/resume/tailor.py` - Update `get_quick_match_score()`
2. `backend/app/api/routes/tailor.py` - Add tracking to `/quick-match`
3. `backend/app/api/routes/ats/keywords.py` - Add tracking to `/keywords/extract`
4. `backend/app/api/routes/ats/knockout.py` - Add tracking to `/knockout-check`
5. `backend/app/api/routes/ats/role_proximity.py` - Add tracking to `/role-proximity`

## Verification

1. **Run backend tests:**

   ```bash
   cd backend && poetry run pytest tests/ -v
   ```

2. **Manual testing:**
   - Login to the app
   - Go through the tailor flow (select resume + job listing)
   - Complete ATS analysis
   - Run keyword extraction
   - Check the AI Usage dashboard (`/admin/ai-usage`)
   - Verify new endpoints appear: `/tailor/quick-match`, `/ats/keywords/extract`, `/ats/knockout-check`, `/ats/role-proximity`

3. **Database verification:**

   ```sql
   SELECT endpoint, COUNT(*), SUM(cost_usd)
   FROM ai_usage_logs
   WHERE created_at > NOW() - INTERVAL '1 hour'
   GROUP BY endpoint
   ORDER BY SUM(cost_usd) DESC;
   ```
