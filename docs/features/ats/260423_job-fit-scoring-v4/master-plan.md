# Fit-Score Algorithm Rework (v4) — Hybrid Embedding + Required-Skill Gate

> Note: per project convention, once approved this file should move to
> `docs/features/ats/260423_job-fit-scoring-v4/master-plan.md` before implementation.

## Context

The v3 fit score on `/jobs` and `/jobs/[id]` is pure keyword set-intersection with a
sqrt curve (`backend/app/services/fit_scoring/scorer.py:41-48`). Keywords on the job
side come from an AI extractor; resume-side keywords come from regex
`TECH_KEYWORD_PATTERNS`. The two sides are asymmetric and purely lexical, so
synonyms (TypeScript↔JavaScript, "ML"↔"machine learning"), phrasing variants, and
domain-specific terms miss silently. All keywords are weighted equally, so a job
that *requires* AWS scores the same whether the candidate has AWS or not. Users
will read a 32 on a role they are genuinely qualified for and distrust the number.

v4 keeps the daily batch architecture and the existing UI (compact fit bar / badge)
but upgrades the math to a hybrid of semantic similarity + weighted keyword overlap,
with a hard cap when a required skill is missing.

## Approach

### Math

```
sem  = calibrate( cosine(resume_vec, job_vec) )           # 0..1
kw   = sqrt( min(overlap, 10) / min(10, |job_kws|) )      # 0..1 (unchanged)
base = 0.5 * sem + 0.5 * kw                               # 0..1
if required_skills \ resume_keywords != ∅:
    base = min(base, 0.60)                                # required-skill cap
score = round(base * 100)                                 # 0..100
```

- **Calibration.** Raw JD↔resume cosine typically lives in `[0.55, 0.85]`. Linear
  map `clip((cos - 0.55) / 0.30, 0, 1)`. Revisit with real data after two weeks;
  swap for percentile-rank if distribution is skewed.
- **Required gate.** If the AI flags `required=["python", "aws"]` and the resume
  keyword set is missing any of them, `base` is capped at 0.60 regardless of how
  strong the rest of the match is. Deliberately aggressive so a "great on paper,
  missing a must-have" job cannot reach the green tier (≥75).
- **Sqrt keyword term stays.** Keeps continuity with v3 display distribution and
  color-tier thresholds (55 / 75) used by `FitScoreBadge` and `FitScoreGauge`.

### Pipeline changes

1. **Embeddings service** (new) — `backend/app/services/fit_scoring/embeddings.py`
   - Wraps OpenAI `text-embedding-3-small` (1536 dims).
   - `embed_text(text: str) -> tuple[list[float], AIMetrics]`
   - Logged through `AIUsageTracker.log_generation` with endpoint
     `/internal/fit-scoring/embed-{job,resume}`.

2. **Job side** — extend `job_keywords.py` AI prompt to return:
   ```json
   { "keywords": [...15-25...], "required": [...0-5...], "extracted_at": "..." }
   ```
   In `ingest.py::extract_missing_job_keywords`, in the same per-job task:
   - Call keyword extractor (existing).
   - Call `embed_text(description)`.
   - Persist both to `job_listings.extracted_keywords` (JSONB) and
     `job_listings.description_embedding` (JSONB `list[float]`).
   - Idempotent: skip any job where both are already present.

3. **Resume side** — `resume_keywords.py` adds a sibling function
   `extract_resume_embedding(parsed) -> list[float]`:
   - Flattens `summary + skills + bullets` into a single string.
   - Calls `embed_text`.
   - Persisted to MongoDB `resumes.content_embedding` with
     `embedding_content_hash` alongside existing `keywords_content_hash`.
   - Computed lazily in `scorer.score_all_users()` if hash mismatches
     (same pattern as existing keyword lazy-compute at
     `scorer.py:81-94`).

4. **Scorer** — rewrite `compute_raw_score` in `scorer.py`:
   ```python
   def compute_raw_score(
       resume_kws: set[str],
       resume_vec: list[float] | None,
       job_kws: set[str],
       job_required: set[str],
       job_vec: list[float] | None,
   ) -> int: ...
   ```
   - If either embedding is missing, fall back to `kw` term only (protects
     rollout + handles extraction failures without unscoring jobs).
   - Required gate applied inside this function.
   - Pure, deterministic, easy to unit-test.

5. **Staleness hash** — extend `scored_resume_hash` to include the embedding hash,
   so a resume edit that changes wording but not regex tokens still re-scores.

### Storage

**Postgres** (new Alembic migration):
- `job_listings.description_embedding JSONB NULL` — `list[float]` length 1536
- `job_listings.required_keywords JSONB NULL` — `list[str]` (or inline into
  existing `extracted_keywords` payload; prefer inline to avoid a column)

Going with **inline** to avoid schema churn:
`extracted_keywords = {"keywords": [...], "required": [...], "extracted_at": ...}`.
Only `description_embedding` needs a new column.

**MongoDB** `resumes` document gains:
- `content_embedding: list[float] | None`
- `embedding_content_hash: str | None`

### What does NOT change

- Daily 4am UTC batch cadence and distributed lock.
- API response shape (`fit_score_raw`, `is_score_stale`) — frontend stays as-is.
- `FitScoreBadge` / `FitScoreGauge` color tiers and rendering.
- Sort-by-fit endpoint logic.
- On-demand "deep match" per user decision — **not introducing** LLM-judge on
  `/jobs/[id]`; detail page continues to read the batch score.

## Critical files

| File | Change |
| --- | --- |
| `backend/app/services/fit_scoring/scorer.py` | Rewrite `compute_raw_score`; plumb embeddings + required sets into `_score_user` (lines 109-203) |
| `backend/app/services/fit_scoring/job_keywords.py` | Extend AI prompt + response schema (lines 18-36, 85-90) |
| `backend/app/services/fit_scoring/resume_keywords.py` | Add `extract_resume_embedding`; extend hash to cover embedding input |
| `backend/app/services/fit_scoring/embeddings.py` | **NEW** — thin embedding client wrapper |
| `backend/app/services/fit_scoring/ingest.py` | Extend per-job task with embedding call; keep `Semaphore(3)` |
| `backend/app/models/job_listing.py` | `+ description_embedding: Mapped[list[float] \| None]` JSONB |
| `backend/app/models/mongo/resume.py` | `+ content_embedding`, `+ embedding_content_hash` |
| `backend/alembic/versions/26xxxx_fit_score_v4.py` | **NEW** migration adding `description_embedding` JSONB column |
| `backend/tests/services/test_fit_scoring.py` | Add cases for calibration, required-gate cap, missing-embedding fallback |

## Reuse

- `AIUsageTracker.log_generation` (`app.services.ai.get_usage_tracker`) — already
  used by other AI calls; wrap both embed + extract calls through it per
  CLAUDE.md rule #14.
- `CacheService.hash_content` (used in `resume_keywords.py:49-50`) — reuse for
  embedding input hash.
- Existing distributed lock + APScheduler wiring in
  `backend/app/services/scraping/scheduler.py:1187-1211` — no change needed.
- Existing `JobListing.extracted_keywords` JSONB column — add `required` key
  inline rather than new column.

## Rollout

1. Ship migration + embedding service + ingestion changes; embeddings backfill
   via existing `extract_missing_job_keywords` loop (idempotent). Scorer keeps
   using v3 math while backfill runs.
2. Once >95% of active jobs have embeddings, flip scorer to v4 math behind a
   single config flag (`settings.fit_score_v4_enabled`). No multi-version
   shim — flag exists purely to allow one-commit revert.
3. After one full daily cycle, verify distribution on `/jobs` (expect more
   mid-tier amber scores, fewer sub-30s on qualified matches); drop the flag.

## Verification

- **Unit tests** (`backend/tests/services/test_fit_scoring.py`):
  - Cosine calibration clamps at both ends.
  - Required-gate cap triggers when one required term missing; does not when
    all present.
  - Missing-embedding fallback returns a `kw`-only score equal to v3.
  - Score monotonic: adding a matching keyword never decreases the score.
- **Integration**: admin trigger `trigger_fit_scoring_now()` on a staging DB
  snapshot; compare top-20 jobs by score for 3 test users before/after.
  Expect: fewer 0-tier scores for qualified candidates whose resume uses
  synonymous phrasing; fewer ≥75 scores on jobs where a required skill is
  absent.
- **UI smoke**: hit `/jobs` sorted by fit_score; open `/jobs/[id]` for the top
  and bottom of the list; confirm badge/gauge render, staleness flag behaves.
