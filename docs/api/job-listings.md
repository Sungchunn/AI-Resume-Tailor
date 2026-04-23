# Job Listings API

## Overview

The Job Listings API provides access to scraped job listings from external sources (LinkedIn via Apify). Users can browse, search, filter, and interact with these listings by saving, hiding, or marking them as applied.

**Base Path:** `/api/job-listings`

**Authentication:** All endpoints require authentication **except**
`GET /api/job-listings/filter-options`, which is public so Cloudflare
can edge-cache it.

> **Note:** This API is for browsing scraped job listings. For managing user-created job postings, see [Jobs API](jobs.md).

## Caching

All `GET` endpoints emit a `Cache-Control` header so Cloudflare and
browsers can absorb repeat reads. The rule is:

| Endpoint | Auth | `Cache-Control` |
| -------- | ---- | --------------- |
| `GET /filter-options` | None | `public, max-age=300, stale-while-revalidate=86400` |
| `GET /` (list) | Required | `private, max-age=60, stale-while-revalidate=30` |
| `GET /search` | Required | `private, max-age=60, stale-while-revalidate=30` |
| `GET /{listing_id}` | Required | `private, max-age=60, stale-while-revalidate=30` |
| `GET /saved` | Required | `private, no-store` |
| `GET /applied` | Required | `private, no-store` |
| `GET /kanban` | Required | `private, no-store` |

Rule of thumb: any response that merges user-interaction fields
(`is_saved`, `is_hidden`, `applied_at`, `application_status`) is
`private` — never `public` — so users on the same Cloudflare POP cannot
see each other's interaction state. Endpoints that only exist because
of a user filter (`/saved`, `/applied`, `/kanban`) use `no-store`.

Behind the scenes, `/filter-options` and the public portion of `/` are
kept in an in-process cache inside the FastAPI worker. Each entry
expires at or before the next scheduled scraper fire time (see Phase 4
of `/docs/features/infrastructure/260411_jobs-page-caching/`), and the
scheduler actively clears and **re-warms** the default view (pages 1–3
plus page 1 of the top 5 countries) after every successful scrape. The
public list cache also splits row payloads from count payloads so
pagination under the same filter set reuses the first page's total and
skips `SELECT COUNT(*)` on every next-page click.

---

## Endpoints

### Get Filter Options

Get available filter values based on existing job data.

```http
GET /api/job-listings/filter-options
```

**Authentication:** None. Rate-limited per IP under the default bucket
in `RateLimitMiddleware`. Served with
`Cache-Control: public, max-age=300, stale-while-revalidate=86400` so
Cloudflare can cache the response at the edge for up to 5 minutes and
serve stale for up to 24 hours while revalidating.

**Response (200 OK):**

```json
{
  "countries": [
    {"value": "Thailand", "label": "Thailand", "count": 150},
    {"value": "Singapore", "label": "Singapore", "count": 200},
    {"value": "Malaysia", "label": "Malaysia", "count": 75}
  ],
  "regions": [
    {"value": "Bangkok", "label": "Bangkok", "count": 120},
    {"value": "Central Singapore", "label": "Central Singapore", "count": 180}
  ],
  "seniorities": [
    {"value": "Entry level", "label": "Entry level", "count": 100},
    {"value": "Mid-Senior level", "label": "Mid-Senior level", "count": 250},
    {"value": "Associate", "label": "Associate", "count": 75}
  ],
  "cities": [
    {"value": "Singapore", "label": "Singapore", "count": 200},
    {"value": "Bangkok", "label": "Bangkok", "count": 150},
    {"value": "Kuala Lumpur", "label": "Kuala Lumpur", "count": 75}
  ]
}
```

---

### List Job Listings

List job listings with comprehensive filtering and pagination.

```http
GET /api/job-listings
```

**Query Parameters:**

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `location` | string | - | Location filter (comma-separated) - **deprecated**, use `city` instead |
| `region` | string | - | Region filter (comma-separated) |
| `country` | string | - | Country filter (comma-separated) |
| `city` | string | - | City filter (comma-separated, exact match) |
| `company_name` | string | - | Company name text search |
| `seniority` | string | - | Seniority levels (comma-separated) |
| `job_function` | string | - | Job function filter |
| `industry` | string | - | Industry filter |
| `is_remote` | boolean | - | Filter by remote status |
| `easy_apply` | boolean | - | Filter by Easy Apply availability |
| `applicants_max` | integer | - | Maximum applicant count |
| `applicants_include_na` | boolean | true | Include jobs with unknown applicant count |
| `salary_min` | integer | - | Minimum salary |
| `salary_max` | integer | - | Maximum salary |
| `date_posted_after` | datetime | - | Only jobs posted after this date |
| `search` | string | - | Full-text search query |
| `is_saved` | boolean | - | Filter by saved status |
| `is_hidden` | boolean | - | Filter by hidden status |
| `applied` | boolean | - | Filter by applied status |
| `sort_by` | string | `date_posted` | Sort field: `fit_score`, `date_posted`, `salary_max`, `salary_min`, `company_name`, `job_title`, `created_at` |
| `sort_order` | string | `desc` | Sort order: `asc`, `desc` |
| `limit` | integer | 20 | Results per page (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Example Request:**

```bash
# Filter by city and company
curl "http://localhost:8000/api/job-listings?city=Singapore,Bangkok&company_name=Google&limit=20" \
  -H "Authorization: Bearer <token>"

# Filter by country and seniority
curl "http://localhost:8000/api/job-listings?country=Singapore&seniority=Entry%20level,Associate&is_remote=true&limit=20" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

```json
{
  "listings": [
    {
      "id": 12345,
      "external_job_id": "4340303441",
      "job_title": "Junior Software Engineer",
      "company_name": "TechCorp",
      "location": "Singapore",
      "seniority": "Entry level",
      "job_function": "Engineering",
      "industry": "Technology",
      "job_description": "We are looking for a Junior Software Engineer...",
      "job_url": "https://www.linkedin.com/jobs/view/4340303441",
      "salary_min": 4000,
      "salary_max": 6000,
      "salary_currency": "SGD",
      "salary_period": "monthly",
      "date_posted": "2026-02-15T00:00:00.000000",
      "source_platform": "linkedin",
      "is_active": true,
      "created_at": "2026-02-15T10:30:00.000000",
      "updated_at": "2026-02-18T10:30:00.000000",
      "is_saved": false,
      "is_hidden": false,
      "applied_at": null,
      "fit_score_raw": 74,
      "is_score_stale": false
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

---

### Search Job Listings

Full-text search across job listings.

```http
GET /api/job-listings/search
```

**Query Parameters:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `q` | string | Yes | Search query (min 1 character) |
| `limit` | integer | No | Results per page (1-100, default 20) |
| `offset` | integer | No | Pagination offset (default 0) |

**Example Request:**

```bash
curl "http://localhost:8000/api/job-listings/search?q=python%20developer&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

Same format as list endpoint.

---

### List Saved Jobs

Get all saved jobs for the current user.

```http
GET /api/job-listings/saved
```

**Query Parameters:**

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `limit` | integer | 50 | Results per page (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Example Request:**

```bash
curl "http://localhost:8000/api/job-listings/saved" \
  -H "Authorization: Bearer <token>"
```

---

### List Applied Jobs

Get all jobs the current user has marked as applied.

```http
GET /api/job-listings/applied
```

**Query Parameters:**

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `limit` | integer | 50 | Results per page (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Example Request:**

```bash
curl "http://localhost:8000/api/job-listings/applied" \
  -H "Authorization: Bearer <token>"
```

---

### Get Job Listing

Get a single job listing by ID. Also records that the user viewed this listing.

```http
GET /api/job-listings/{listing_id}
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `listing_id` | integer | Job listing identifier |

**Example Request:**

```bash
curl "http://localhost:8000/api/job-listings/12345" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

```json
{
  "id": 12345,
  "external_job_id": "4340303441",
  "job_title": "Junior Software Engineer",
  "company_name": "TechCorp",
  "location": "Singapore",
  "seniority": "Entry level",
  "job_function": "Engineering",
  "industry": "Technology",
  "job_description": "Full job description...",
  "job_url": "https://www.linkedin.com/jobs/view/4340303441",
  "salary_min": 4000,
  "salary_max": 6000,
  "salary_currency": "SGD",
  "salary_period": "monthly",
  "date_posted": "2026-02-15T00:00:00.000000",
  "source_platform": "linkedin",
  "is_active": true,
  "created_at": "2026-02-15T10:30:00.000000",
  "updated_at": "2026-02-18T10:30:00.000000",
  "is_saved": false,
  "is_hidden": false,
  "applied_at": null
}
```

**Error Responses:**

| Status | Condition |
| ------ | --------- |
| 404 | Job listing not found |

---

### Save/Unsave Job Listing

Save or unsave a job listing for later reference.

```http
POST /api/job-listings/{listing_id}/save
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `listing_id` | integer | Job listing identifier |

**Request Body:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `save` | boolean | Yes | `true` to save, `false` to unsave |

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/job-listings/12345/save" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"save": true}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Job listing saved successfully",
  "interaction": {
    "job_listing_id": 12345,
    "is_saved": true,
    "is_hidden": false,
    "applied_at": null,
    "viewed_at": "2026-02-18T10:30:00.000000"
  }
}
```

---

### Hide/Unhide Job Listing

Hide or unhide a job listing from search results.

```http
POST /api/job-listings/{listing_id}/hide
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `listing_id` | integer | Job listing identifier |

**Request Body:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `hide` | boolean | Yes | `true` to hide, `false` to unhide |

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/job-listings/12345/hide" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"hide": true}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Job listing hidden successfully",
  "interaction": {
    "job_listing_id": 12345,
    "is_saved": false,
    "is_hidden": true,
    "applied_at": null,
    "viewed_at": "2026-02-18T10:30:00.000000"
  }
}
```

---

### Mark as Applied

Mark a job listing as applied or remove the applied status.

```http
POST /api/job-listings/{listing_id}/applied
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `listing_id` | integer | Job listing identifier |

**Request Body:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `applied` | boolean | Yes | `true` to mark applied, `false` to unmark |

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/job-listings/12345/applied" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"applied": true}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Job listing marked as applied successfully",
  "interaction": {
    "job_listing_id": 12345,
    "is_saved": true,
    "is_hidden": false,
    "applied_at": "2026-02-18T10:30:00.000000",
    "viewed_at": "2026-02-18T10:30:00.000000"
  }
}
```

---

## Kanban Board Endpoints

The following endpoints support a Kanban-style board for tracking job applications through stages.

### Get Kanban Board

Get all applied jobs grouped by application status.

```http
GET /api/job-listings/kanban
```

**Response (200 OK):**

```json
{
  "columns": {
    "applied": {
      "status": "applied",
      "jobs": [
        {
          "id": 12345,
          "job_title": "Junior Software Engineer",
          "company_name": "TechCorp",
          "application_status": "applied",
          "status_changed_at": "2026-03-01T10:30:00.000000",
          "column_position": 0
        }
      ],
      "total": 1
    },
    "interview": {
      "status": "interview",
      "jobs": [],
      "total": 0
    },
    "accepted": {
      "status": "accepted",
      "jobs": [],
      "total": 0
    },
    "rejected": {
      "status": "rejected",
      "jobs": [],
      "total": 0
    },
    "ghosted": {
      "status": "ghosted",
      "jobs": [],
      "total": 0
    }
  }
}
```

---

### Update Application Status

Update the application status for a job listing (move between Kanban columns).

```http
PATCH /api/job-listings/{listing_id}/status
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `listing_id` | integer | Job listing identifier |

**Request Body:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `status` | string | Yes | New status: `applied`, `interview`, `accepted`, `rejected`, `ghosted` |

**Example Request:**

```bash
curl -X PATCH "http://localhost:8000/api/job-listings/12345/status" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "interview"}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Application status updated to 'interview'",
  "interaction": {
    "id": 1,
    "user_id": 1,
    "job_listing_id": 12345,
    "is_saved": true,
    "is_hidden": false,
    "applied_at": "2026-03-01T10:30:00.000000",
    "application_status": "interview",
    "status_changed_at": "2026-03-07T14:00:00.000000",
    "column_position": 0
  }
}
```

---

### Reorder Kanban Column

Reorder jobs within a Kanban column.

```http
PUT /api/job-listings/kanban/reorder
```

**Request Body:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `status` | string | Yes | Column status: `applied`, `interview`, `accepted`, `rejected`, `ghosted` |
| `job_listing_ids` | array | Yes | Ordered list of job listing IDs |

**Example Request:**

```bash
curl -X PUT "http://localhost:8000/api/job-listings/kanban/reorder" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "applied", "job_listing_ids": [12345, 12346, 12347]}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Jobs reordered successfully"
}
```

---

## Deep Analysis Endpoints

### Run Deep Analysis

Run deep analysis for the current user's master resume against a job listing. Composes knockout + detailed keyword + per-bullet rewrite analyzers in a single parallel orchestration. Results are Redis-cached per `(resume_content_hash, listing_id)` with a 24h TTL.

```http
POST /api/job-listings/{listing_id}/analyze
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `listing_id` | integer | The job listing ID |

**Request Body:** None

**Quota:**

- 5 successful runs per user per rolling 24-hour window
- Enforced by counting `ai_usage_log` rows where `endpoint = '/job-listings/analyze'` and `success = true`
- Cache hits do not consume quota (no `ai_usage_log` row is written)
- Failed runs do not consume quota

**Typical Latency:** 30–60 seconds on cache miss. Cache hits return instantly.

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/job-listings/12345/analyze" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK — fresh run):**

```json
{
  "job_listing_id": 12345,
  "resume_id": "507f1f77bcf86cd799439011",
  "resume_content_hash": "a1b2c3d4e5f67890",
  "cached": false,
  "cached_at": null,
  "generated_at": "2026-04-25T14:32:10.123Z",
  "knockout": {
    "passes_all_checks": false,
    "risks": [
      {
        "risk_type": "experience_years",
        "severity": "warning",
        "description": "Role requires 5+ years of experience, your resume shows ~3.5 years.",
        "job_requires": "5+ years",
        "user_has": "~3.5 years"
      }
    ],
    "summary": "1 potential knockout risk(s) detected (1 warning).",
    "recommendation": "These warnings may affect your application..."
  },
  "keywords": {
    "coverage_score": 0.75,
    "required_coverage": 0.8,
    "preferred_coverage": 0.5,
    "required_matched": ["Python", "AWS"],
    "required_missing": ["Kubernetes"],
    "preferred_matched": ["Docker"],
    "preferred_missing": [],
    "nice_to_have_matched": [],
    "nice_to_have_missing": [],
    "all_keywords": [],
    "suggestions": ["Add Kubernetes experience..."],
    "warnings": []
  },
  "bullets": {
    "suggestions": [
      {
        "bullet_id": "exp-0:bullet-0",
        "original": "Responsible for backend development",
        "suggested": "Built Python microservices on AWS serving 1M+ daily requests",
        "reason": "Added metrics, strong action verb, and AWS keyword",
        "impact": "high",
        "keywords_added": ["AWS"],
        "metrics_added": true
      }
    ],
    "total_analyzed": 12,
    "suggestions_count": 5,
    "skipped_count": 7
  },
  "warnings": [],
  "ai_usage": {
    "total_tokens": 2450,
    "cost_usd": 0.0,
    "latency_ms": 42000
  }
}
```

**Response (200 OK — cache hit):**

Same shape as the fresh-run response, but with:

- `cached: true`
- `cached_at`: ISO timestamp of when the cached payload was generated
- `ai_usage`: all zeros (no AI calls made)

**Response (200 OK — partial failure):**

If a non-critical analyzer (knockout or bullets) fails during orchestration, the response still returns 200 with the affected block set to `null` and a warning entry describing the failure:

```json
{
  "knockout": null,
  "keywords": { "...": "..." },
  "bullets": { "...": "..." },
  "warnings": [
    {
      "stage": "knockout",
      "error": "job parse timeout",
      "retriable": true
    }
  ]
}
```

The keyword stage is the critical path; if it fails the whole request returns 500.

**Error Responses:**

| Status | Body | Cause |
| ------ | ---- | ----- |
| 400 | `{"detail": "No master resume set..."}` | User has no resume starred as master |
| 400 | `{"detail": "Master resume has not been parsed yet..."}` | Parsed content missing on the master |
| 400 | `{"detail": "Job listing has no description text to analyze."}` | Empty job_description |
| 404 | `{"detail": "Job listing not found"}` | Invalid listing_id |
| 429 | See below | Daily quota exhausted |
| 500 | `{"detail": "Deep analysis failed: <reason>"}` | Critical-path (keyword) failure |

**429 response body** carries structured quota state:

```json
{
  "detail": {
    "detail": "Daily limit reached",
    "limit": 5,
    "used": 5,
    "resets_at": "2026-04-26T14:32:10.123Z"
  }
}
```

The frontend uses `resets_at` to display a countdown without requiring a separate quota-meta endpoint.

---

## Data Models

### JobListingResponse

```typescript
{
  id: number;                       // Internal ID
  external_job_id: string;          // LinkedIn job ID
  job_title: string;
  company_name: string;
  location: string | null;
  seniority: string | null;         // e.g., "Entry level", "Mid-Senior level"
  job_function: string | null;      // e.g., "Engineering", "Marketing"
  industry: string | null;
  job_description: string;
  job_url: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;     // "monthly", "yearly", "hourly"
  date_posted: string;              // ISO 8601 datetime
  source_platform: string;          // "linkedin"
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // User interaction fields
  is_saved: boolean;
  is_hidden: boolean;
  applied_at: string | null;
  // Kanban board fields
  application_status: string | null; // "applied", "interview", "accepted", "rejected", "ghosted"
  status_changed_at: string | null;  // ISO 8601 datetime
  column_position: number;           // Position within Kanban column
  // Job-fit pre-scoring
  fit_score_raw: number | null;      // 0-100, null until the daily batch has scored this pair
  is_score_stale: boolean;           // True when fit_score_raw was computed against an older resume version
}
```

**Note on `fit_score_raw` / `is_score_stale`:**

`fit_score_raw` is the raw 0-100 keyword-overlap score between the user's
master resume and this job's extracted keywords. It's refreshed by a
daily batch (see `POST /api/v1/admin/fit-scoring/run` for the manual
trigger). `is_score_stale=true` means the score exists but was computed
against a previous version of the master resume; the next daily run
refreshes it.

The raw score uses a **capped-denominator + square-root curve**:
`raw = round(sqrt(min(overlap, N) / min(N, len(job_kws))) * 100)` with
`N = 10`. The ceiling (100) means "matched the top N JD keywords" — the
square-root curve lifts mid-range overlaps so a partial match reads as
genuinely useful (e.g. a 50% overlap shows as 71, not 50) while preserving
monotonicity. Frontend consumers render the raw value directly — no display
skew is applied. See `docs/features/ats/260421_job-fit-prescoring-v3.md`
for the rationale and tier thresholds.

### JobListingListResponse

```typescript
{
  listings: JobListingResponse[];
  total: number;
  limit: number;
  offset: number;
}
```

### FilterOption

```typescript
{
  value: string;
  label: string;
  count: number;
}
```

### JobListingFilterOptionsResponse

```typescript
{
  countries: FilterOption[];
  regions: FilterOption[];
  seniorities: FilterOption[];
  cities: FilterOption[];
}
```

### JobInteractionActionResponse

```typescript
{
  success: boolean;
  message: string;
  interaction: UserJobInteractionResponse;
}
```

### UserJobInteractionResponse

```typescript
{
  id: number;
  user_id: number;
  job_listing_id: number;
  is_saved: boolean;
  is_hidden: boolean;
  applied_at: string | null;
  last_viewed_at: string | null;
  // Kanban board fields
  application_status: string | null; // "applied", "interview", "accepted", "rejected", "ghosted"
  status_changed_at: string | null;  // ISO 8601 datetime
  column_position: number;           // Position within Kanban column
  created_at: string;
  updated_at: string | null;
}
```

### KanbanBoardResponse

```typescript
{
  columns: {
    [status: string]: KanbanColumnResponse;  // One entry per status
  };
}
```

### KanbanColumnResponse

```typescript
{
  status: string;                // Column status identifier
  jobs: JobListingResponse[];    // Jobs in this column
  total: number;                 // Total count
}
```

### ApplicationStatus

Valid values for `application_status`:

| Value | Description |
| ----- | ----------- |
| `applied` | Initial status when job is marked as applied |
| `interview` | Application progressed to interview stage |
| `accepted` | Received job offer or accepted |
| `rejected` | Application was rejected |
| `ghosted` | No response received (typically 7+ days) |

## Sort Options

| Value | Description |
| ----- | ----------- |
| `fit_score` | Sort by pre-computed job-fit score. Unscored jobs fall to the end regardless of direction (NULLS LAST). Requires an authenticated user. |
| `date_posted` | Sort by posting date |
| `salary_max` | Sort by maximum salary |
| `salary_min` | Sort by minimum salary |
| `company_name` | Sort alphabetically by company |
| `job_title` | Sort alphabetically by title |
| `created_at` | Sort by ingestion timestamp |

## Usage Notes

- Listings are scraped from LinkedIn via Apify and stored locally
- Hidden listings are excluded from default search results
- Saved and applied listings can be retrieved with dedicated endpoints
- Viewing a listing automatically records the view for the user
- Filter options are dynamically generated from available data

## Related Endpoints

- [Admin](admin.md) - Manage scraper and job listings
- [Tailor](tailor-match.md) - Create tailored resumes for job listings
- [Jobs](jobs.md) - Manage user-created job postings
