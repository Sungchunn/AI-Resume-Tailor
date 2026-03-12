# ATS Router Modularization Plan

**Created:** 2026-03-12
**Status:** Planning
**Priority:** High (largest route file at 1,224 lines)

## Overview

Refactor `/backend/app/api/routes/ats.py` (1,224 lines) into a modular subdirectory structure, following existing patterns in `/services/job/ats/` and `/schemas/ats/`.

## Current Structure Analysis

The file contains:

| Stage | Endpoints | Lines |
| ----- | --------- | ----- |
| Stage 0 | Knockout Check (1 endpoint) | ~95 |
| Stage 1 | Structure Analysis (1 endpoint) | ~45 |
| Stage 2 | Keywords Analysis (4 endpoints) | ~265 |
| Stage 3 | Content Quality (1 endpoint) | ~95 |
| Stage 4 | Role Proximity (1 endpoint) | ~130 |
| Progressive SSE | Complete analysis with streaming | ~315 |
| Helper Functions | 5 execute helpers + composite score | ~155 |

## Target Structure

```text
backend/app/api/routes/ats/
├── __init__.py           # Router aggregation (~40 lines)
├── knockout.py           # Stage 0: Knockout check endpoint
├── structure.py          # Stage 1: Structure analysis endpoint
├── keywords.py           # Stage 2: All 4 keyword endpoints
├── content_quality.py    # Stage 3: Content quality endpoint
├── role_proximity.py     # Stage 4: Role proximity endpoint
├── progressive.py        # SSE progressive analysis endpoint
└── helpers.py            # Shared execution helpers + composite score
```

## Implementation Steps

### Step 1: Create Directory Structure

- Create `/backend/app/api/routes/ats/` directory
- Create empty `__init__.py`

### Step 2: Extract Helper Functions → `helpers.py`

**Move these functions:**

- `_execute_knockout_check()` (lines 1076-1127)
- `_execute_structure_analysis()` (lines 1130-1134)
- `_execute_keyword_analysis()` (lines 1137-1144)
- `_execute_content_quality()` (lines 1147-1153)
- `_execute_role_proximity()` (lines 1156-1164)
- `_calculate_composite_score()` (lines 1167-1224)

**Imports needed:**

```python
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.ats import (
    ATSProgressiveRequest,
    KnockoutCheckRequest,
    ATSStructureRequest,
    ATSKeywordEnhancedRequest,
    ContentQualityRequest,
    RoleProximityRequest,
    ATSCompositeScore,
)
```

### Step 3: Extract Stage 0 → `knockout.py`

**Move:**

- `perform_knockout_check()` endpoint (lines 73-167)

**Dependencies:**

- FastAPI router, Depends, HTTPException
- get_current_user_id, get_db
- JobCRUD, get_ats_analyzer, ResumeParser, JobAnalyzer, get_ai_client, get_cache_service
- KnockoutCheckRequest, KnockoutCheckResponse, KnockoutRiskResponse

### Step 4: Extract Stage 1 → `structure.py`

**Move:**

- `analyze_structure()` endpoint (lines 175-213)

**Dependencies:**

- FastAPI router, Depends
- get_current_user_id, get_ats_analyzer
- ATSStructureRequest, ATSStructureResponse, SectionOrderDetails

### Step 5: Extract Stage 2 → `keywords.py`

**Move:**

- `analyze_keywords()` (lines 221-273)
- `analyze_keywords_detailed()` (lines 276-353)
- `analyze_keywords_enhanced()` (lines 356-485)
- `get_ats_tips()` (lines 488-503)

**Dependencies:**

- FastAPI router, Depends, HTTPException
- get_current_user_id, get_db
- BlockRepository, get_ats_analyzer
- All keyword-related schemas (ATSKeywordRequest, ATSKeywordResponse, etc.)

### Step 6: Extract Stage 3 → `content_quality.py`

**Move:**

- `analyze_content_quality()` endpoint (lines 511-605)

**Dependencies:**

- FastAPI router, Depends, HTTPException
- get_current_user_id, get_db
- get_ats_analyzer
- ContentQualityRequest, ContentQualityResponse, BlockTypeAnalysisResponse, etc.

### Step 7: Extract Stage 4 → `role_proximity.py`

**Move:**

- `analyze_role_proximity()` endpoint (lines 613-743)

**Dependencies:**

- FastAPI router, Depends, HTTPException
- get_current_user_id, get_db
- JobCRUD, get_ats_analyzer, JobAnalyzer, get_ai_client, get_cache_service
- RoleProximityRequest, RoleProximityResponse, TitleMatchResponse, etc.

### Step 8: Extract Progressive → `progressive.py`

**Move:**

- `analyze_progressive_ats()` endpoint (lines 751-1068)

**Dependencies:**

- FastAPI router, Depends, Query
- get_current_user_id_sse, get_db, get_mongo_db
- EventSourceResponse, time, json
- MongoResumeCRUD, JobCRUD, JobListingRepository, get_cache_service
- ATSProgressiveRequest, ATSCompositeScore
- Helper imports from `helpers.py`

### Step 9: Create Router Aggregation → `__init__.py`

```python
"""ATS Analysis API Routes - Modular Package."""
from fastapi import APIRouter

from app.api.routes.ats.knockout import router as knockout_router
from app.api.routes.ats.structure import router as structure_router
from app.api.routes.ats.keywords import router as keywords_router
from app.api.routes.ats.content_quality import router as content_quality_router
from app.api.routes.ats.role_proximity import router as role_proximity_router
from app.api.routes.ats.progressive import router as progressive_router

router = APIRouter()

router.include_router(knockout_router)
router.include_router(structure_router)
router.include_router(keywords_router)
router.include_router(content_quality_router)
router.include_router(role_proximity_router)
router.include_router(progressive_router)
```

### Step 10: Update Parent Router Registration

**File:** `/backend/app/api/__init__.py`

**No changes needed!** Python treats directories with `__init__.py` as packages. The existing import:

```python
from app.api.routes import ats
```

Will automatically import from `app/api/routes/ats/__init__.py`, and since we export `router` there, `ats.router` will work as before.

### Step 11: Delete Original File

- Delete `/backend/app/api/routes/ats.py`

## Dependency Graph

```text
helpers.py (no route imports)
    ↑
knockout.py ←────┐
structure.py ←───┤
keywords.py ←────┤── progressive.py imports execute helpers
content_quality.py ←┤
role_proximity.py ←─┘
    ↑
__init__.py (aggregates all routers)
```

## Circular Import Prevention

The `helpers.py` module will contain the `_execute_*` functions. These call the stage endpoint functions (like `perform_knockout_check`). To avoid circular imports:

**Option A (Recommended):** Move execution logic INTO helpers.py itself, not calling endpoint functions

- Helpers directly use the analyzer service
- Progressive endpoint uses helpers
- Stage endpoints remain standalone for direct API access

**Option B:** Keep helpers calling endpoints (requires careful import ordering)

I recommend **Option A** - the `_execute_*` functions should directly interact with the ATS analyzer service, not call the endpoint functions. This is cleaner and avoids circular imports.

## Files Modified/Created

| Action | File |
| ------ | ---- |
| CREATE | `backend/app/api/routes/ats/__init__.py` |
| CREATE | `backend/app/api/routes/ats/knockout.py` |
| CREATE | `backend/app/api/routes/ats/structure.py` |
| CREATE | `backend/app/api/routes/ats/keywords.py` |
| CREATE | `backend/app/api/routes/ats/content_quality.py` |
| CREATE | `backend/app/api/routes/ats/role_proximity.py` |
| CREATE | `backend/app/api/routes/ats/progressive.py` |
| CREATE | `backend/app/api/routes/ats/helpers.py` |
| DELETE | `backend/app/api/routes/ats.py` |

**Note:** `backend/app/api/__init__.py` requires NO changes - Python automatically imports from the package `__init__.py`.

## Verification

1. **Import check:**

   ```bash
   cd backend && python -c "from app.api.routes.ats import router; print('OK')"
   ```

2. **Run existing tests:**

   ```bash
   pytest backend/tests/api/test_ats_api.py -v
   ```

3. **API docs:** Start server and visit `/docs` - verify all ATS endpoints appear under the "ats" tag

4. **Smoke test structure endpoint:**

   ```bash
   curl -X POST http://localhost:8000/api/v1/ats/structure \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"resume_content": {"experience": [{"company": "Test"}]}}'
   ```

## Estimated Line Counts (Post-Refactor)

| File | Lines | Contents |
| ---- | ----- | -------- |
| `__init__.py` | ~25 | Router aggregation |
| `knockout.py` | ~110 | Stage 0 endpoint + imports |
| `structure.py` | ~55 | Stage 1 endpoint + imports |
| `keywords.py` | ~290 | Stage 2 (4 endpoints) + imports |
| `content_quality.py` | ~110 | Stage 3 endpoint + imports |
| `role_proximity.py` | ~145 | Stage 4 endpoint + imports |
| `progressive.py` | ~330 | SSE endpoint + event generator |
| `helpers.py` | ~170 | Execute helpers + composite score |
| **Total** | ~1,235 | Same logic, better organization |
