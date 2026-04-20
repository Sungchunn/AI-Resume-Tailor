# Daily Job-Fit Pre-Scoring

## Context

Users browse scraped job listings at `/jobs` with no signal for "how well does this match me?" until they open the full ATS editor. We want a lightweight pre-score badge on each job list card so users can triage quickly. The score is computed daily via keyword overlap between each user's **starred (master) resume** and their active job listings. It is cheap (one AI call per job at import; deterministic set intersection for every scoring pair) and deliberately separate from the 5-stage in-editor ATS pipeline.

## Architecture Decisions

1. **Timing:** Daily batch after the Apify scrape completes (not lazy, not on-demand).
2. **Scope:** Each user's starred resume × their active (non-expired, non-hidden) job listings. Starred resume = `ResumeDocument.is_master=True` (already enforced one-at-a-time by `resume_crud.set_master()` — no schema change needed).
3. **Algorithm:** Stage 1 keyword overlap — `|resume ∩ job| / |job|` as an integer 0–100.
4. **Keyword extraction:** One AI call per JobListing at import, cached on the row. Resume keywords extracted from parsed content with no AI call.
5. **Re-scoring on resume change:** Do NOT recompute immediately; stale flag surfaces via `scored_resume_hash` mismatch; next daily batch refreshes.
6. **Display skewing (frontend only):** `displayScore = Math.round(40 + (rawScore * 55) / 100)`.
7. **No red.** Green ≥75, amber 60–74, gray <60.

## Verified Codebase Facts

- **Jobs:** Ingested via APIFY API directly through `SchedulerService` at `backend/app/services/scraping/scheduler.py` — APScheduler cron, not n8n, not webhook.
- **JobListing model** (`backend/app/models/job_listing.py`): Postgres table `job_listings`. Relevant columns: `id`, `job_description` (Text, NOT NULL), `is_active` (Boolean), `last_synced_at`, `scraped_at`. No existing keyword column.
- **UserJobInteraction** (`backend/app/models/user_job_interaction.py`): Postgres `user_job_interactions`, unique on `(user_id, job_listing_id)`. Tracks `is_saved`, `is_hidden`, `applied_at`. No score column.
- **Resume:** MongoDB `ResumeDocument` at `backend/app/models/mongo/resume.py:256`. `is_master: bool` marks the starred resume; `parsed: ParsedContent | None` holds structured content. This is a Mongo document, not a Postgres row — adaptations noted below.
- **Content hashing:** Reuse `CacheService.hash_content(content)` (`backend/app/services/core/cache.py:97`). Static method, SHA256 first 16 chars — already the project convention.
- **AI client / usage tracking:** `get_ai_client()` with `.generate_json_with_metrics()`; log via `get_usage_tracker().log_generation(...)` per CLAUDE.md rule #14.
- **Migrations:** Alembic at `backend/alembic/versions/`. Latest revision: `20260414_0001_add_dedup_hash_and_cleanup`.
- **Frontend job card:** `frontend/src/components/jobs/JobListingCard.tsx`.
- **List page:** `frontend/src/app/(protected)/jobs/page.tsx`; hook `useJobListings` (find in `frontend/src/lib/api/hooks.ts`).

## Phase 1 — Keyword Extraction on Job Listings

### Schema (Alembic migration)

`backend/alembic/versions/20260420_0001_add_job_fit_scoring.py` (combined with Phase 3 migration):

```sql
ALTER TABLE job_listings ADD COLUMN extracted_keywords JSONB DEFAULT NULL;
```

No index needed (keyword JSON isn't queried directly).

### Model

Add to `JobListing` in `backend/app/models/job_listing.py`:

```python
extracted_keywords = Column(JSONB, nullable=True)
```

Shape stored in this JSONB:

```json
{
  "keywords": ["python", "fastapi", "docker", "rest apis"],
  "extracted_at": "2026-04-20T12:00:00Z"
}
```

### Extractor module

Create `backend/app/services/fit_scoring/job_keywords.py`:

```python
async def extract_job_keywords(
    description: str,
) -> tuple[list[str], AIResponse | None]:
    """AI-extract lowercase keywords from a JD for fit scoring."""
```

- Uses `get_ai_client().generate_json_with_metrics(system_prompt=..., user_prompt=description)`
- Prompt keeps extraction lightweight: skills, tools, frameworks, methodologies, qualifications; return flat `{"keywords": [...]}`.
- Normalizes to lowercase, de-duplicates, strips.
- Returns `(keywords, ai_response)` so callers can log usage.

### Integration into scrape pipeline

In `backend/app/services/scraping/scheduler.py`, after the upsert in `_run_scraper_job_with_lock` (or the batch upsert in `job_listing_repository`), add a post-step: fetch job IDs where `extracted_keywords IS NULL AND is_active=True`, extract in a bounded `asyncio.Semaphore(3)` loop, persist. Log AI usage with `endpoint="/internal/fit-scoring/extract-job-keywords"` under a synthetic `user_id=None` (or add a system-user sentinel — check existing `AIUsageTracker` nullable semantics first; if `user_id` is NOT NULL, log under an admin user or skip).

Idempotent: `WHERE extracted_keywords IS NULL` guarantees no re-extraction.

## Phase 2 — Resume Keyword Extraction (Mongo, no AI)

### Model adaptation (Mongo, no migration)

Extend `ResumeDocument` in `backend/app/models/mongo/resume.py`:

```python
extracted_keywords: list[str] | None = None
keywords_content_hash: str | None = None
```

Pydantic/Mongo accepts new optional fields without migration; old documents serialize `None` by default.

### Extractor module

Create `backend/app/services/fit_scoring/resume_keywords.py`:

```python
def extract_resume_keywords(parsed: ParsedContent) -> set[str]:
    """Deterministic keyword set from structured parsed resume content."""
```

Sources (all normalized lowercase):

- `parsed.skills` — flat list; also split each entry on `,` and `/` to handle comma-delimited skill strings.
- Bullets from `parsed.experience[*].bullets`, `parsed.projects[*].bullets`, `parsed.volunteer[*].bullets`, `parsed.leadership[*].bullets`: tokenize on non-alphanumeric (excluding `+`, `#`, `.`); keep tokens matching a simple technical-noun heuristic (length ≥ 2, not in a small stopword set). Keep it dumb — baseline is skills section.
- `parsed.summary` — same tokenization.

Hash helper:

```python
def compute_resume_keywords_hash(parsed: ParsedContent) -> str:
    canonical = json.dumps(parsed.model_dump(), sort_keys=True, default=str)
    return CacheService.hash_content(canonical)  # 16-char SHA256
```

### Cache on save/parse

In the resume parse completion flow (`backend/app/services/resume/parser.py` or the route that saves parsed content — `backend/app/api/routes/resumes.py`), after `parsed` is persisted:

- Compute `hash = compute_resume_keywords_hash(parsed)`.
- If `resume.keywords_content_hash != hash`: recompute keywords, update both fields.
- If equal, skip.

## Phase 3 — Score Storage

Same Alembic migration as Phase 1:

```sql
ALTER TABLE user_job_interactions ADD COLUMN fit_score_raw INTEGER DEFAULT NULL;
ALTER TABLE user_job_interactions ADD COLUMN scored_resume_hash VARCHAR(64) DEFAULT NULL;
CREATE INDEX idx_uji_fit_score ON user_job_interactions (user_id, fit_score_raw DESC)
  WHERE fit_score_raw IS NOT NULL;
```

Update model `backend/app/models/user_job_interaction.py`:

```python
fit_score_raw = Column(Integer, nullable=True)
scored_resume_hash = Column(String(64), nullable=True)
```

Add matching `Index("idx_uji_fit_score", ...)` to `__table_args__` (mirror the partial index — Alembic owns creation, model declares for ORM awareness).

## Phase 4 — Daily Batch Scoring Job

### Scorer module

Create `backend/app/services/fit_scoring/scorer.py`:

```python
async def score_all_users(
    pg_session: AsyncSession,
    mongo_db: AsyncIOMotorDatabase,
) -> dict[str, int]:
    """Daily job-fit scoring across all users with starred resumes."""
```

Logic:

1. Query Mongo for all `ResumeDocument` where `is_master=True AND parsed_verified=True`, project `{user_id, parsed, extracted_keywords, keywords_content_hash}` (explicit projection per CLAUDE.md rule #8).
2. For each master resume:
   - If `extracted_keywords` missing or hash stale, re-extract (Phase 2 logic) and persist.
   - Use `resume_keywords: set[str]` and `resume_hash: str`.
   - Query Postgres: `UserJobInteraction` rows where `user_id=X AND is_hidden=False` joined with `JobListing` where `is_active=True AND extracted_keywords IS NOT NULL`, eager-load via `selectinload(UserJobInteraction.job_listing)` (rule #9). Select explicit columns (rule #5).
   - For each interaction: skip if `scored_resume_hash == resume_hash`. Otherwise compute:

     ```python
     job_kws = set(job.extracted_keywords["keywords"])
     overlap = len(resume_keywords & job_kws)
     raw = round((overlap / len(job_kws)) * 100) if job_kws else 0
     ```

   - Update in-place; bulk commit per user to keep transactions small.
3. Log: `"Scored {count} jobs for user {user_id} in {elapsed}ms"`.

Sequential over users (Supabase free-tier connection pool); within a user, batch updates.

### Scheduler hook

In `backend/app/services/scraping/scheduler.py`, register a second APScheduler job: `_run_fit_scoring_with_lock`, triggered ~30 min after the scraper cron (`CronTrigger(hour=scraper_hour+1, minute=...)` — or chain at the end of `_run_scraper_job_with_lock` after a successful scrape). Use a distributed lock key `fit_scoring:distributed_lock` with a 30-min TTL (mirror `SCRAPER_LOCK_KEY` pattern).

Guard: if scraper disabled, still run fit scoring daily (independent lifecycle).

### Admin trigger

Add an admin route `POST /api/v1/admin/fit-scoring/run` in `backend/app/api/routes/admin.py` so maintainers can kick the batch manually. Guard with existing admin dependency.

## Phase 5 — API Surface

Update `JobListingListItem` / `JobListingResponse` in `backend/app/schemas/job_listing.py`:

```python
fit_score_raw: int | None = None
is_score_stale: bool = False
```

In the list endpoint (`backend/app/api/routes/job_listings.py` `GET /`):

- When projecting the user's interaction row, select `fit_score_raw` and `scored_resume_hash`.
- Compute `is_score_stale` server-side by comparing against the current starred resume's hash, which should be pre-fetched **once per request** (one Mongo lookup with projection `{keywords_content_hash: 1}`) and compared across all rows — not once per job.

Type-sync: run `./scripts/generate-client.sh` after backend schema change.

Docs update: `/docs/api/job-listings.md` per CLAUDE.md rule #11.

## Phase 6 — Frontend Badge

### Component

`frontend/src/components/jobs/FitScoreBadge.tsx`:

```tsx
interface Props { rawScore: number | null; isStale: boolean }

export function FitScoreBadge({ rawScore, isStale }: Props) {
  if (rawScore === null) return null
  const display = Math.round(40 + (rawScore * 55) / 100)
  const tone =
    display >= 75 ? "bg-green-100 text-green-800 border-green-200"
    : display >= 60 ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-gray-100 text-gray-600 border-gray-200"
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
      tone,
      isStale && "opacity-60",
    )}>
      {display}% Match
    </span>
  )
}
```

### Integration

- Render in `JobListingCard.tsx` near the title/metadata row (match existing badge placement for `is_saved`).
- Pass `rawScore={job.fit_score_raw ?? null}` and `isStale={job.is_score_stale}`.
- Also render on `/jobs/[id]` detail page header.

Kanban and sort/filter-by-fit are out of scope for this plan.

## Files Summary

### Create

| Path | Phase |
| --- | --- |
| `backend/alembic/versions/20260420_0001_add_job_fit_scoring.py` | 1, 3 |
| `backend/app/services/fit_scoring/__init__.py` | 1 |
| `backend/app/services/fit_scoring/job_keywords.py` | 1 |
| `backend/app/services/fit_scoring/resume_keywords.py` | 2 |
| `backend/app/services/fit_scoring/scorer.py` | 4 |
| `frontend/src/components/jobs/FitScoreBadge.tsx` | 6 |

### Modify

| Path | Phase | Change |
| --- | --- | --- |
| `backend/app/models/job_listing.py` | 1 | Add `extracted_keywords` column |
| `backend/app/models/mongo/resume.py` | 2 | Add `extracted_keywords`, `keywords_content_hash` |
| `backend/app/models/user_job_interaction.py` | 3 | Add `fit_score_raw`, `scored_resume_hash`, index |
| `backend/app/services/scraping/scheduler.py` | 1, 4 | Post-scrape extraction; register fit-scoring cron |
| `backend/app/services/resume/parser.py` or resume save route | 2 | Cache resume keywords on parse |
| `backend/app/schemas/job_listing.py` | 5 | Add `fit_score_raw`, `is_score_stale` |
| `backend/app/api/routes/job_listings.py` | 5 | Populate score fields in list/detail responses |
| `backend/app/api/routes/admin.py` | 4 | Admin trigger endpoint |
| `frontend/src/components/jobs/JobListingCard.tsx` | 6 | Render `FitScoreBadge` |
| `frontend/src/app/(protected)/jobs/[id]/page.tsx` | 6 | Render `FitScoreBadge` in header |
| Frontend generated types (via `scripts/generate-client.sh`) | 5 | Regenerate |
| `docs/api/job-listings.md` | 5 | Document new response fields (CLAUDE.md #11) |

### Do Not Touch

`atsProgressStore.ts`, `useATSProgressStream.ts`, `rewriteDiffStore.ts`, `bulletSuggestionsStore.ts`, editor ATS tab. This pre-score is list-page only.

## Existing Utilities to Reuse

- `CacheService.hash_content(content: str) -> str` — `backend/app/services/core/cache.py:97`. Use for both `scored_resume_hash` and `keywords_content_hash`.
- `get_ai_client()` + `generate_json_with_metrics` — AI calls.
- `get_usage_tracker().log_generation(...)` — AI usage logging (CLAUDE.md #14).
- `SchedulerService._acquire_distributed_lock` pattern — mirror for fit-scoring lock.
- `resume_crud.set_master()` — already guarantees single master; no change.
- `selectinload(UserJobInteraction.job_listing)` — eager load per CLAUDE.md #9.

## Verification

- **Phase 1:** `SELECT id, extracted_keywords FROM job_listings WHERE id=<pick-one> LIMIT 1` → JSONB populated, lowercase list, `extracted_at` present. Confirm `ai_usage_logs` row created for the extraction call.
- **Phase 2:** Upload + parse a resume → `db.resumes.findOne({_id: ...}, {extracted_keywords:1, keywords_content_hash:1})` → both populated. Edit resume → hash changes on next parse → keywords re-extracted.
- **Phase 3:** Migration up/down cleanly. `\d user_job_interactions` shows new columns + partial index.
- **Phase 4:** Manually invoke `score_all_users()` via admin endpoint. Check: `SELECT user_id, job_listing_id, fit_score_raw, scored_resume_hash FROM user_job_interactions WHERE fit_score_raw IS NOT NULL` populated. Log line printed per user.
- **Phase 5:** `GET /api/v1/job-listings?limit=5` returns `fit_score_raw` + `is_score_stale` in each item. Regenerate TS types; frontend typecheck passes (`bun run build`).
- **Phase 6:** `/jobs` page shows badges: green/amber/gray, all in 40–95 display range, no red. Star a different resume → reload `/jobs` → badges fade to stale indicator. Run admin trigger → badges refresh with new scores.
- **Staleness end-to-end:** Edit starred resume → `is_score_stale=True` on next API call → run batch → `is_score_stale=False` and scores updated.

## Open Follow-ups

- `AIUsageTracker.user_id` nullability for system-initiated AI calls (job-keyword extraction isn't user-attributable). **Resolved** — `log_generation(user_id: int | None = None, ...)` already supports system ops.
- Sort-by-fit and min-fit filter on `/jobs` (requires this plan's index — deliberately deferred).
- Embedding-based secondary score for synonym coverage (explicit non-goal here).

## Phase 7 — Upsert for all active jobs (2026-04-20)

**Problem surfaced post-deploy:** Scores never appeared on the `/jobs` list because the scorer iterated over *existing* `UserJobInteraction` rows, and those rows are only created lazily when a user saves / hides / applies / views a job. A fresh user scrolling the list had zero interactions → zero scored pairs → zero badges.

**Fix:** Rewrote `_score_user` in `backend/app/services/fit_scoring/scorer.py` to drive off the full set of active, keyword-bearing `JobListing` rows and bulk-upsert via `postgresql.insert(...).on_conflict_do_update(...)` on `(user_id, job_listing_id)`. Pre-fetches the user's existing `scored_resume_hash` per job so rows whose hash already matches are skipped (idempotent). Upserts in chunks of 200 to keep statements bounded.

No schema change — `UserJobInteraction` already had the columns and unique constraint. Routes, schemas, frontend unchanged. Commit `55163c6`.
