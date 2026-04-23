# Fit-Score Deep Analysis (Wave 2)

## Context

Wave 1 (commits `426a47c..4f2924f`, master plan at
`docs/features/ats/260424_fit-score-v4-transparency/master-plan.md`) rebuilt the
fit-score UI around transparency: the `/jobs` list shows a SEM×KW mini-bar
breakdown and a "Hide capped" filter, and `/jobs/{id}` exposes the v4 formula,
required-skills pass/fail, and matched/missing keywords.

That made the score *legible*. Wave 2 makes it *actionable*. A new
"Run deep analysis" CTA on `/jobs/{id}` runs an on-demand orchestrator that
composes three existing ATS analyzers — knockout, detailed keyword, and
per-bullet rewrite suggestions — into a single response rendered inline below
the fit-score block. This closes the loop: a capped-at-60 score can now answer
"which missing required skill is blocking me, which of my bullets should I
rewrite to match this JD, and is there a hard knockout I missed?"

The v4 fit score itself (computed by the daily batch) is unchanged. Deep
analysis is a strictly additive layer that does *not* recompute the numerical
score — it enriches the breakdown with AI-generated guidance.

**Why now:** Wave 1 explicitly deferred this to Wave 2 with pre-agreed
decisions (endpoint path, cache key, quota, inline UX). The insertion point is
already marked in the JSX at `frontend/src/app/(protected)/jobs/[id]/page.tsx:304-306`.

---

## Approach

1. **Backend orchestrator** at `backend/app/services/job_listings/deep_analysis.py`
   runs `analyze_keywords_detailed()`, `BulletAnalyzer.analyze_batch()`, and
   the knockout analyzer in parallel via `asyncio.gather`, with graceful
   partial-failure handling. Result is a single `JobDeepAnalysisResponse`.

2. **Redis cache** keyed on `(resume_content_hash, job_listing_id)`, namespaced
   `deep_analysis:v1:` to avoid colliding with the existing
   `ats:v2:` progressive cache. 24h TTL.

3. **Quota gate** enforced server-side by counting successful `ai_usage_log`
   rows for the current user where `endpoint='/job-listings/analyze'` in the
   trailing 24h. Limit 5/user/day; return 429 when exceeded. Failed runs
   (success=false) do not consume quota.

4. **Endpoint:** `POST /job-listings/{id}/analyze` — synchronous, returns full
   JSON when orchestration completes. Typical latency 30-60s. Client aborts
   via `AbortController` to cancel. No run_id state machine.

5. **Frontend:** two new components under `frontend/src/components/jobs/fit-score/`:
   `DeepAnalysisCTA.tsx` (button + cost copy, disabled on quota exhausted) and
   `DeepAnalysisResult.tsx` (inline expandable result renderer reusing
   `KnockoutAlerts`, `KeywordSection`, `KeywordChip` from the workshop panel).
   A new `useJobDeepAnalysis` hook mirrors the `useFitScoreMeta` pattern.

6. **No database changes.** All state is either Redis (result cache) or the
   existing `ai_usage_log` Postgres table (quota + observability).

---

## Decisions carried from Wave 1 (fixed)

| Decision | Value |
| --- | --- |
| Endpoint | `POST /job-listings/{id}/analyze` |
| Cache | Redis, keyed on `(resume_content_hash, job_id)`, 24h TTL |
| Quota | 5 runs/user/day via `ai_usage_log` |
| CTA copy | "Run deep analysis · 1 AI run" |
| Result UX | Inline expand below CTA on `/jobs/{id}` |
| Component paths | `frontend/src/components/jobs/fit-score/DeepAnalysisCTA.tsx`, `DeepAnalysisResult.tsx` |
| Continue link | "Continue in Tailor →" pointing to `/tailor?job_listing_id={id}` stays |

## Decisions made in this plan

| Decision | Value | Rationale |
| --- | --- | --- |
| Request pattern | Synchronous POST | Simplest; latency budget 30-60s fits typical proxy timeouts; matches Wave 1 `POST` spec. |
| Orchestration | Parallel via `asyncio.gather` | All three analyzers take the same inputs (resume + job); no inter-dependency. |
| Resume selection | Master resume only | Matches pre-scoring daily-batch behavior; user expects analysis against the resume that produced the shown score. 400 if no master set. |
| Bullet scope | All work-experience bullets | Matches existing tailor flow; consistent UX. |
| Staleness handling | Automatic via hash-keyed cache | If resume content hash changed, cache miss triggers fresh run; no "your resume changed" prompt needed. |
| CTA placement | After `KeywordOverlapSection`, before company info | Per Wave 1 comment in `page.tsx:304-306`. Existing "Optimize Resume for This Job" action-bar link stays alongside. |
| Partial failure | Return partial result with `warnings[]` | Keyword analysis is the critical path; if bullet or knockout fails individually, surface the warning but still render what succeeded. If keyword itself fails, return 500. |
| Quota display | Static "1 AI run" label only; 429 surfaces remaining=0 | Wave 1 prescribed the static copy. No live counter in CTA. |

---

## API

### `POST /job-listings/{id}/analyze`

**Request:** no body. Auth required. Path param is the `JobListing.id`.

**Responses:**

| Status | Body |
| --- | --- |
| 200 | `JobDeepAnalysisResponse` (fresh run or cache hit) |
| 400 | `{ "detail": "No master resume set" }` |
| 404 | `{ "detail": "Job listing not found" }` |
| 429 | `{ "detail": "Daily limit reached", "limit": 5, "used": 5, "resets_at": "..." }` |
| 500 | `{ "detail": "Deep analysis failed: <reason>" }` (only if keyword analysis fails) |

**Response schema** (new type in `backend/app/schemas/job_listings.py`):

```python
class JobDeepAnalysisResponse(BaseModel):
    job_listing_id: int
    resume_id: str                      # master resume mongo _id
    resume_content_hash: str            # first 16 chars of SHA256
    cached: bool                        # True if served from Redis
    cached_at: datetime | None          # only set when cached=True
    generated_at: datetime              # when the fresh run completed (or was cached)

    # Analyzer outputs — None if that analyzer failed; see `warnings`
    knockout: KnockoutBlock | None
    keywords: KeywordBlock | None       # required for 200; 500 if missing
    bullets: BulletsBlock | None

    warnings: list[AnalysisWarning]     # one entry per partial failure
    ai_usage: AIUsageSummary            # tokens/cost for this run (0 if cached)


class KnockoutBlock(BaseModel):
    passes_all_checks: bool
    risks: list[KnockoutRiskResponse]   # reuse existing schema from ats/knockout.py
    summary: str
    recommendation: str


class KeywordBlock(BaseModel):
    # Mirror DetailedKeywordAnalysis but flattened for frontend consumption.
    coverage_score: float               # 0-1
    required_coverage: float
    preferred_coverage: float
    required_matched: list[KeywordDetail]
    required_missing: list[KeywordDetail]
    preferred_matched: list[KeywordDetail]
    preferred_missing: list[KeywordDetail]
    nice_to_have_matched: list[KeywordDetail]
    nice_to_have_missing: list[KeywordDetail]
    missing_available_in_vault: list[KeywordDetail]   # vault-backfill hints
    suggestions: list[str]
    warnings: list[str]


class BulletsBlock(BaseModel):
    suggestions: list[BulletSuggestionResponse]  # reuse existing schema
    total_analyzed: int
    suggestions_count: int
    skipped_count: int


class AnalysisWarning(BaseModel):
    stage: Literal["knockout", "keywords", "bullets"]
    error: str
    retriable: bool


class AIUsageSummary(BaseModel):
    total_tokens: int
    cost_usd: float
    latency_ms: int
```

Fields are intentionally nested per analyzer (not flattened into one mega-list)
so the frontend can render section-by-section with independent loading/error
states and so that partial-failure payloads remain machine-readable.

### `GET /ai-usage/quota` (optional, deferred)

Wave 1 did not require a live quota endpoint, and the CTA will show static
copy. **Not included in this plan** — server-side 429 is the enforcement path,
and the 429 body carries `used`/`limit`/`resets_at` for error-state UI.

---

## Backend

### New files

```text
backend/app/services/job_listings/
├── __init__.py                        # (existing or new; add export)
└── deep_analysis.py                   # NEW: orchestrator service

backend/app/schemas/
└── job_listings.py                    # ADD: JobDeepAnalysisResponse + nested types
```

### Modified files

```text
backend/app/api/routes/job_listings.py
  ADD: POST /{id}/analyze route handler
  - dep: get_db, get_mongo_db, get_current_user_id, get_cache_service, get_ai_client, get_usage_tracker
  - load master resume via mongo_resume_repo; 400 if none
  - load JobListing via job_listing_repo; 404 if not found
  - check quota: count ai_usage_log rows (user_id, endpoint, created_at, success)
  - check Redis cache: deep_analysis:v1:{hash[:16]}:{job_id}
  - on miss: call DeepAnalysisService.run(); cache result
  - on hit: return cached
  - always: log 1 ai_usage_log row with aggregated metrics

backend/app/services/core/cache.py
  ADD: _make_deep_analysis_key(resume_hash, job_id) -> str
       = f"deep_analysis:v1:{resume_hash[:16]}:{job_id}"
  ADD: get_deep_analysis_result / set_deep_analysis_result wrappers
       (24h TTL, matching PARSE_TTL constant)
```

### `DeepAnalysisService` contract

```python
# backend/app/services/job_listings/deep_analysis.py

class DeepAnalysisService:
    def __init__(
        self,
        ai_client: AIClient,
        keyword_analyzer: KeywordAnalyzer,         # existing
        bullet_analyzer: BulletAnalyzer,           # existing
        knockout_analyzer: KnockoutAnalyzer,       # existing
    ): ...

    async def run(
        self,
        *,
        resume_raw: str,
        resume_parsed: dict,                       # ResumeDocument.parsed.model_dump()
        job: JobListing,                           # ORM object
    ) -> tuple[JobDeepAnalysisResponse, list[AIResponse]]:
        """Fan out 3 analyzers in parallel, aggregate, return response +
        per-call AI metrics for usage logging."""
```

Returning the `list[AIResponse]` lets the route aggregate tokens/cost into a
single `ai_usage_log` row (rather than 3 rows), matching the rule that one
deep-analysis run = one quota slot.

### Orchestration diagram

```text
POST /job-listings/{id}/analyze
  │
  ├─ auth + load master resume (mongo) + load JobListing (postgres)
  ├─ 400 if no master resume
  ├─ 404 if JobListing missing
  ├─ quota_used = count(ai_usage_log WHERE user_id=? AND endpoint='/job-listings/analyze'
  │                                   AND success=true AND created_at >= NOW() - 1d)
  ├─ 429 if quota_used >= 5
  │
  ├─ hash = sha256(resume.raw_content)[:16]
  ├─ cache_key = f"deep_analysis:v1:{hash}:{job_id}"
  │
  ├─ IF cache.get(cache_key):
  │     └─ return cached response (cached=true, ai_usage.total_tokens=0)
  │
  └─ ELSE:
        ├─ asyncio.gather(
        │     knockout_analyzer.analyze(resume_parsed, job_description, return_metrics=True),
        │     keyword_analyzer.analyze_keywords_detailed(resume, job, return_metrics=True),
        │     bullet_analyzer.analyze_batch(bullets=all_work_bullets, job, return_metrics=True),
        │     return_exceptions=True,
        │  )
        ├─ per-task: success → block populated; exception → warning entry, block=None
        ├─ IF keyword task failed: return 500 (critical path)
        ├─ build JobDeepAnalysisResponse(..., warnings=[...], cached=false)
        ├─ cache.set(cache_key, response, ttl=24h)
        ├─ usage_tracker.log_generation(db, user_id, '/job-listings/analyze',
        │     aggregated AIResponse, success=all_critical_succeeded)
        ├─ await db.commit()
        └─ return response
```

### Reuse map

| Existing asset | Used for | File |
| --- | --- | --- |
| `KeywordAnalyzer.analyze_keywords_detailed` | keyword block | `backend/app/services/job/ats/analyzers/keyword/analyzer.py:207` |
| `BulletAnalyzer.analyze_batch` | bullets block | `backend/app/services/job/diff/bullet_analyzer.py:28` |
| Knockout analyzer | knockout block | `backend/app/services/job/ats/analyzers/knockout.py` (entry used by `routes/ats/knockout.py`) |
| `CacheService.hash_content` + existing Redis client | cache infra | `backend/app/services/core/cache.py:97` |
| `AIUsageTracker.log_generation` | quota source + metrics | `backend/app/services/ai/usage_tracker.py:71` |
| `AIUsageLog` model + `(user_id, created_at)` index | quota count | `backend/app/models/ai_usage_log.py` |
| `mongo_resume_repo.get` | load master resume | `backend/app/crud/mongo/resume.py:69` |
| `job_listing_repo.get` | load job | `backend/app/crud/job_listing.py` |
| `KnockoutRiskResponse`, `BulletSuggestionResponse`, `KeywordDetail` schemas | response shape | existing ATS route schemas |

**No new analyzers** — deep analysis is purely an orchestration layer.

---

## Frontend

### New files

```text
frontend/src/components/jobs/fit-score/
├── DeepAnalysisCTA.tsx                # NEW: button + cost copy + quota-aware states
└── DeepAnalysisResult.tsx             # NEW: inline result renderer

frontend/src/hooks/
└── useJobDeepAnalysis.ts              # NEW: React Query mutation hook
                                       # (mutation, not query — user-triggered)
```

### Modified files

```text
frontend/src/lib/api/types.ts
  ADD: JobDeepAnalysisResponse, KnockoutBlock, KeywordBlock, BulletsBlock,
       AnalysisWarning, AIUsageSummary
  REUSE: existing KeywordDetail, KnockoutRiskResponse, BulletSuggestionResponse

frontend/src/lib/api/client.ts
  ADD: jobListingApi.runDeepAnalysis(jobId: number, signal?: AbortSignal):
       Promise<JobDeepAnalysisResponse>
       - POST /api/v1/job-listings/{id}/analyze
       - accepts AbortSignal for cancel

frontend/src/lib/api/hooks.ts
  ADD: useJobDeepAnalysis(jobId) returning a useMutation
       with onSuccess cache invalidation

frontend/src/app/(protected)/jobs/[id]/page.tsx
  REPLACE the Wave 2 comment at lines 304-306 with
    <DeepAnalysisCTA jobId={job.id} onResult={setDeepAnalysisResult} />
    {deepAnalysisResult && <DeepAnalysisResult data={deepAnalysisResult} />}
  Add local state:
    const [deepAnalysisResult, setDeepAnalysisResult] =
      useState<JobDeepAnalysisResponse | null>(null)
```

### Component APIs

```tsx
// DeepAnalysisCTA.tsx
interface DeepAnalysisCTAProps {
  jobId: number;
  onResult: (data: JobDeepAnalysisResponse) => void;
}
// States: idle → running (disabled, spinner, "Cancel" link) → done (collapsed)
// Error states: 429 ("Daily limit reached — resets at 11pm"), 400, 500 retry
// Cost copy: "Run deep analysis · 1 AI run"
```

```tsx
// DeepAnalysisResult.tsx
interface DeepAnalysisResultProps {
  data: JobDeepAnalysisResponse;
  onRerun?: () => void;       // optional "Rerun" button after 24h or on demand
}
// Renders 3 sections in order:
//   1. Knockout block (reuse KnockoutAlerts from workshop/panels/ats/)
//   2. Keyword block (reuse KeywordSection + KeywordChip; render 3 tiers)
//   3. Bullets block (new inline BulletSuggestionCard using existing schema)
// Footer: "Continue in Tailor →" link to /tailor?job_listing_id={jobId}
// Per-section graceful degradation: if data.warnings contains stage=X, render
// a small warning chip for that section instead of hiding it.
```

### Reuse from `frontend/src/components/workshop/panels/ats/`

| Component | Used in | Coupling check |
| --- | --- | --- |
| `KnockoutAlerts.tsx` | knockout block | pure props, safe |
| `KeywordSection.tsx` | keyword block (required/preferred/nice-to-have) | pure props, safe |
| `KeywordChip.tsx` | inside KeywordSection | pure props, safe |
| `StageScoreBar.tsx` | keyword coverage score bar (optional, nice-to-have) | pure props, safe |

**Do NOT reuse** `ATSPanel`, `KeywordAnalysis` (workshop-context-coupled), or
`InsertKeywordModal` (writes back to workshop state). Deep analysis is
read-only.

### Placement (confirmed from code)

In `frontend/src/app/(protected)/jobs/[id]/page.tsx`:

```text
...                                             (line 249-302)
├─ Action bar: Apply Now | Mark Applied | View on source | Optimize Resume
├─ FitScoreHero                                 (line 307)
├─ FitScoreFormulaPanel                         (line 311)
├─ RequiredSkillsRow                            (line 315)
├─ KeywordOverlapSection                        (line 318-321)
├─ [NEW] DeepAnalysisCTA                       ← insert here
├─ [NEW] DeepAnalysisResult (conditional)      ← insert here
└─ Company info / About block                   (line 322+)
```

The existing "Optimize Resume for This Job" link in the action bar **stays** —
it remains the path for users who want to edit their resume. Deep analysis is
the path for users who want to understand the gap without editing yet.

---

## Quota enforcement detail

```python
# in the route handler
from datetime import datetime, timedelta
from sqlalchemy import select, func

QUOTA_LIMIT = 5
QUOTA_WINDOW = timedelta(days=1)

async def _quota_used(db: AsyncSession, user_id: int) -> int:
    since = datetime.utcnow() - QUOTA_WINDOW
    stmt = select(func.count(AIUsageLog.id)).where(
        AIUsageLog.user_id == user_id,
        AIUsageLog.endpoint == "/job-listings/analyze",
        AIUsageLog.success == True,   # noqa: E712
        AIUsageLog.created_at >= since,
    )
    return (await db.execute(stmt)).scalar_one()
```

Counted rows: only `success=true`. A run that raised mid-orchestration and
was logged with `success=false` does not consume quota. A cache hit writes
no `ai_usage_log` row (cost=0), so cache hits do not consume quota either.

**429 response body** includes `resets_at` computed as `oldest_counted_row.created_at + 1d`
so the client can display a countdown.

---

## Verification

### Unit tests (pytest, new file)

`backend/tests/services/test_deep_analysis.py`:

- `test_orchestrator_parallel_success`: mock all 3 analyzers returning valid results; assert response shape + fields.
- `test_orchestrator_bullet_failure_partial`: knockout + keyword succeed, bullet raises; assert warnings[0].stage=="bullets" and bullets=None, status=200 path.
- `test_orchestrator_keyword_failure_raises`: keyword raises; assert service raises (route translates to 500).
- `test_orchestrator_knockout_failure_partial`: same pattern as bullets.

### Integration tests (pytest + test DB + fakeredis)

`backend/tests/api/test_job_listings_analyze.py`:

- `test_analyze_cache_miss_then_hit`: first POST hits analyzers (mocked), writes cache + ai_usage_log row. Second POST within TTL returns cache, no new log row.
- `test_analyze_no_master_resume_returns_400`.
- `test_analyze_unknown_job_returns_404`.
- `test_analyze_quota_exhausted_returns_429`: seed 5 successful ai_usage_log rows for user within 24h; POST returns 429 with resets_at.
- `test_analyze_failed_run_does_not_consume_quota`: force analyzer to raise; seed run logs success=false; subsequent successful run counts as 1/5 (not 2/5).
- `test_analyze_resume_hash_change_busts_cache`: store cached payload at hash A, update resume (new hash B), POST re-runs analyzers.

### Frontend test (Jest + React Testing Library)

`frontend/src/components/jobs/fit-score/__tests__/DeepAnalysisCTA.test.tsx`:

- Button renders with "Run deep analysis · 1 AI run" copy.
- Clicking fires the mutation; during loading shows spinner + Cancel.
- On 429 shows "Daily limit reached — resets at {time}" banner.
- On 500 shows "Analysis failed — Retry" button.

### E2E (Playwright)

`docs/testing/260425_deep-analysis-tests.md` — new test-plan doc covering:

- Happy path: navigate to `/jobs/{id}`, click CTA, wait for result, assert all 3 sections render, assert "Continue in Tailor" link href.
- Cached path: click CTA twice; second click returns instantly; assert `cached` badge.
- Quota path: stub backend to return 429; assert banner renders and CTA disables.
- Partial failure: stub bullets-failed response; assert warning chip renders in bullets section but knockout + keywords still render.

Page objects:

- `frontend/e2e/fixtures/page-objects/JobDetailPage.ts` — add `clickDeepAnalysis()`, `deepAnalysisResult` locator.

### Manual smoke (dev server)

1. `docker-compose up -d`
2. `cd frontend && bun dev`, `cd backend && poetry run uvicorn app.main:app --reload`
3. Log in, navigate to `/jobs/{any-scored-job-id}`, click "Run deep analysis".
4. Verify: spinner for 30-60s → result renders inline → sections are scrollable → "Continue in Tailor" navigates correctly.
5. Click again within a minute — should be near-instant (cache hit) with `cached=true` badge.
6. Run 5 times on different jobs, then try a 6th — should see quota banner.

---

## Docs updates

- `docs/api/job-listings.md` — add `POST /job-listings/{id}/analyze` with full request/response schema.
- `docs/api/errors-rate-limits.md` — note the 5/day endpoint quota under "Per-endpoint limits".
- `docs/architecture/ai-integration.md` — add a "Deep analysis orchestration" subsection describing the parallel-analyzer pattern (useful precedent for future multi-analyzer endpoints).
- `docs/testing/260425_deep-analysis-tests.md` — new Playwright test plan (see above).

No architecture-level rewrite needed; deep analysis is a composition over existing services.

---

## Out of scope (explicit)

- **Live quota counter in CTA** — Wave 1 spec said static "1 AI run" copy; a live counter is a separate UX task for future.
- **Background pre-warming** — no queue to pre-compute deep analysis for top-N jobs overnight. User-initiated only.
- **Configurable bullet scope** — all work-experience bullets, no query param.
- **Streaming progress** — synchronous POST; if latency proves problematic post-launch, revisit with SSE or polling.
- **Accepting a `resume_id` param** — master resume only; tailored-resume analysis continues to happen in `/tailor`.
- **Persisting deep-analysis results to Postgres** — Redis-only cache for v1. If we need cross-session history later, migrate to a table.

---

## Critical files to modify

**Backend (2 new, 2 modified):**

- `backend/app/services/job_listings/deep_analysis.py` (new)
- `backend/app/schemas/job_listings.py` (add types)
- `backend/app/api/routes/job_listings.py` (add route)
- `backend/app/services/core/cache.py` (add key + wrappers)

**Frontend (2 new, 3 modified):**

- `frontend/src/components/jobs/fit-score/DeepAnalysisCTA.tsx` (new)
- `frontend/src/components/jobs/fit-score/DeepAnalysisResult.tsx` (new)
- `frontend/src/hooks/useJobDeepAnalysis.ts` (new — or add to `hooks.ts`, match existing pattern)
- `frontend/src/lib/api/types.ts` (add types)
- `frontend/src/lib/api/client.ts` (add fetch)
- `frontend/src/app/(protected)/jobs/[id]/page.tsx` (mount CTA + result)

**Docs (2 updated, 1 new):**

- `docs/api/job-listings.md`, `docs/api/errors-rate-limits.md` (updated)
- `docs/testing/260425_deep-analysis-tests.md` (new)

---

## Implementation order (suggested commits)

1. `backend: add DeepAnalysisService orchestrator + schemas`
2. `backend: add POST /job-listings/{id}/analyze route + cache helpers`
3. `backend: tests for deep analysis orchestration + quota`
4. `frontend: types + client + hook for deep analysis`
5. `frontend: DeepAnalysisCTA component`
6. `frontend: DeepAnalysisResult component + mount on /jobs/[id]`
7. `test: Playwright E2E for deep analysis flow`
8. `docs: API + test-plan docs for deep analysis`

Each commit self-contained and independently testable. Backend lands first so
frontend can develop against the real endpoint.
