# Admin API

## Overview

The Admin API provides administrative endpoints for managing the job scraper, cleanup operations, scraper presets, and scheduling. All endpoints require admin authentication.

**Base Path:** `/api/admin`

**Authentication:** All endpoints require admin role (`is_admin: true`)

---

## Scraper Status & Control

### Get Scraper Status

Get current scheduler status and next run time.

```http
GET /api/admin/scraper/status
```

**Response (200 OK):**

```json
{
  "scheduler_running": true,
  "scraper_enabled": true,
  "next_run_time": "2026-02-19T06:00:00.000000",
  "last_run_time": "2026-02-18T06:00:00.000000",
  "last_run_result": {
    "status": "success",
    "total_jobs_found": 150,
    "total_jobs_created": 75,
    "total_jobs_updated": 50,
    "total_errors": 0,
    "duration_seconds": 45.2
  }
}
```

---

### Trigger Scraper

Manually trigger the scraper job for all configured regions.

```http
POST /api/admin/scraper/trigger
```

> **Note:** This is a long-running operation that may take several minutes. Uses distributed locking to prevent duplicate runs.

**Response (200 OK):**

```json
{
  "status": "success",
  "total_jobs_found": 150,
  "total_jobs_created": 75,
  "total_jobs_updated": 50,
  "total_errors": 0,
  "region_results": [
    {
      "region": "thailand",
      "status": "success",
      "jobs_found": 50,
      "jobs_created": 25,
      "jobs_updated": 15,
      "errors": 0,
      "duration_seconds": 15.3
    }
  ],
  "started_at": "2026-02-18T10:30:00.000000",
  "completed_at": "2026-02-18T10:31:30.000000",
  "duration_seconds": 90.5
}
```

**Error Responses:**

| Status | Condition |
| ------ | --------- |
| 409 | Scraper is already running on another instance |
| 503 | Scraper is disabled via configuration |

---

### Ad-Hoc Scrape

Trigger an ad-hoc scrape with a custom LinkedIn URL.

```http
POST /api/admin/scraper/adhoc
```

**Request Body:**

| Field | Type | Required | Description |
| ----- | ------ | ---------- | ------------- |
| `url` | string | Yes | LinkedIn job search URL |
| `count` | integer | No | Max jobs to scrape (1-500, default 100) |

**URL Validation:**

- Must use `http` or `https` scheme
- Domain must be `linkedin.com` or `www.linkedin.com`
- Path must start with `/jobs`

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/admin/scraper/adhoc \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.linkedin.com/jobs/search/?keywords=software%20engineer&location=Singapore",
    "count": 50
  }'
```

**Response (200 OK):**

```json
{
  "status": "success",
  "jobs_found": 50,
  "jobs_created": 30,
  "jobs_updated": 15,
  "errors": 0,
  "error_details": [],
  "duration_seconds": 25.3
}
```

---

## Job Statistics & Health

### Get Scraper Stats

Get job listing statistics by region and status.

```http
GET /api/admin/scraper/stats
```

**Response (200 OK):**

```json
{
  "total_listings": 5000,
  "listings_by_region": {
    "thailand": 1500,
    "singapore": 2000,
    "malaysia": 750,
    "unknown": 750
  },
  "listings_by_status": {
    "active": 4500,
    "inactive": 500
  },
  "last_24h_created": 150,
  "last_7d_created": 750
}
```

---

### Get Scraper Health

Get aggregated scraper performance statistics.

```http
GET /api/admin/scraper/health
```

**Query Parameters:**

| Parameter | Type | Default | Description |
| --------- | ------- | --------- | ----------- |
| `days` | integer | 7 | Number of days to analyze (1-30) |

**Response (200 OK):**

```json
{
  "period_days": 7,
  "total_runs": 14,
  "successful_runs": 13,
  "success_rate": 0.928,
  "avg_duration_seconds": 85.5,
  "total_jobs_created": 1050
}
```

---

### Get Scraper History

Get paginated scraper run history.

```http
GET /api/admin/scraper/history
```

**Query Parameters:**

| Parameter | Type | Default | Description |
| --------- | ------- | --------- | ----------- |
| `limit` | integer | 10 | Number of runs to return (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Response (200 OK):**

```json
{
  "runs": [
    {
      "id": 125,
      "run_type": "scheduled",
      "status": "success",
      "started_at": "2026-02-18T06:00:00.000000",
      "completed_at": "2026-02-18T06:01:30.000000",
      "duration_seconds": 90.5,
      "total_jobs_found": 150,
      "total_jobs_created": 75,
      "total_jobs_updated": 50,
      "total_errors": 0,
      "triggered_by": "scheduler"
    },
    {
      "id": 124,
      "run_type": "adhoc",
      "status": "partial",
      "started_at": "2026-02-17T14:30:00.000000",
      "completed_at": "2026-02-17T14:31:00.000000",
      "duration_seconds": 60.2,
      "total_jobs_found": 50,
      "total_jobs_created": 40,
      "total_jobs_updated": 5,
      "total_errors": 2,
      "triggered_by": "admin:123"
    }
  ],
  "total": 125
}
```

---

## Job Cleanup

### Trigger Cleanup

Manually trigger job cleanup (deletes old listings).

```http
POST /api/admin/jobs/cleanup
```

> **Note:** Deletes job listings older than the configured retention period (default: 21 days). Uses `created_at` timestamp to determine job age.

**Response (200 OK):**

```json
{
  "status": "success",
  "deleted_count": 250,
  "duration_seconds": 5.2,
  "error": null
}
```

**Error Responses:**

| Status | Condition |
| ------ | --------- |
| 409 | Cleanup is already running on another instance |

---

## Scraper Presets

Presets allow saving LinkedIn job search URLs for scheduled scraping.

### Create Preset

Create a new scraper preset.

```http
POST /api/admin/scraper/presets
```

**Request Body:**

| Field | Type | Required | Description |
| ----- | ------ | -------- | ----------- |
| `name` | string | Yes | Preset name (1-100 characters) |
| `url` | string | Yes | LinkedIn job search URL |
| `count` | integer | No | Max jobs to scrape (1-500, default 100) |
| `is_active` | boolean | No | Whether preset is active (default true) |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/admin/scraper/presets \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Singapore Software Engineers",
    "url": "https://www.linkedin.com/jobs/search/?keywords=software%20engineer&location=Singapore",
    "count": 100,
    "is_active": true
  }'
```

**Response (201 Created):**

```json
{
  "id": 1,
  "name": "Singapore Software Engineers",
  "url": "https://www.linkedin.com/jobs/search/?keywords=software%20engineer&location=Singapore",
  "count": 100,
  "is_active": true,
  "created_at": "2026-02-18T10:30:00.000000",
  "updated_at": null
}
```

---

### List Presets

Get all scraper presets.

```http
GET /api/admin/scraper/presets
```

**Response (200 OK):**

```json
{
  "presets": [
    {
      "id": 1,
      "name": "Singapore Software Engineers",
      "url": "https://www.linkedin.com/jobs/search/?...",
      "count": 100,
      "is_active": true,
      "created_at": "2026-02-18T10:30:00.000000",
      "updated_at": null
    },
    {
      "id": 2,
      "name": "Thailand Data Analysts",
      "url": "https://www.linkedin.com/jobs/search/?...",
      "count": 50,
      "is_active": false,
      "created_at": "2026-02-15T08:00:00.000000",
      "updated_at": "2026-02-17T12:00:00.000000"
    }
  ],
  "total": 2
}
```

---

### Get Preset

Get a single preset by ID.

```http
GET /api/admin/scraper/presets/{preset_id}
```

**Path Parameters:**

| Parameter    | Type    | Description        |
| ------------ | ------- | ------------------ |
| `preset_id`  | integer | Preset identifier  |

**Response (200 OK):**

Returns a single `ScraperPresetResponse`.

**Error Responses:**

| Status | Condition |
| ------ | --------- |
| 404 | Preset not found |

---

### Update Preset

Update an existing preset.

```http
PATCH /api/admin/scraper/presets/{preset_id}
```

**Path Parameters:**

| Parameter    | Type    | Description        |
| ------------ | ------- | ------------------ |
| `preset_id`  | integer | Preset identifier  |

**Request Body:**

All fields optional:

| Field      | Type    | Description                |
| ---------- | ------- | -------------------------- |
| `name`     | string  | Preset name                |
| `url`      | string  | LinkedIn job search URL    |
| `count`    | integer | Max jobs to scrape         |
| `is_active` | boolean | Whether preset is active   |

**Response (200 OK):**

Returns the updated preset.

---

### Delete Preset

Delete a preset.

```http
DELETE /api/admin/scraper/presets/{preset_id}
```

**Response (204 No Content):**

No response body.

**Error Responses:**

| Status | Condition |
| ------ | --------- |
| 404 | Preset not found |

---

### Toggle Preset

Toggle the active status of a preset.

```http
POST /api/admin/scraper/presets/{preset_id}/toggle
```

**Response (200 OK):**

Returns the updated preset with toggled `is_active` status.

---

## Schedule Settings

Configure automated scraper scheduling.

### Get Schedule Settings

Get the current schedule configuration.

```http
GET /api/admin/scraper/schedule
```

**Response (200 OK):**

```json
{
  "is_enabled": true,
  "schedule_type": "daily",
  "schedule_hour": 6,
  "schedule_minute": 0,
  "schedule_day_of_week": null,
  "last_run_at": "2026-02-18T06:00:00.000000",
  "next_run_at": "2026-02-19T06:00:00.000000",
  "updated_at": "2026-02-15T10:00:00.000000"
}
```

---

---

### Update Schedule Settings

Update the schedule configuration.

```http
PATCH /api/admin/scraper/schedule
```

**Request Body:**

All fields optional:

| Field | Type | Description |
| ----- | ------- | ----------- |
| `is_enabled` | boolean | Enable/disable scheduling |
| `schedule_type` | string | `daily` or `weekly` |
| `schedule_hour` | integer | Hour to run (0-23) |
| `schedule_minute` | integer | Minute to run (0-59) |
| `schedule_day_of_week` | integer | Day of week for weekly schedule (0=Mon, 6=Sun) |

**Example Request:**

```bash
curl -X PATCH http://localhost:8000/api/admin/scraper/schedule \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule_type": "daily",
    "schedule_hour": 6,
    "schedule_minute": 30
  }'
```

**Response (200 OK):**

Returns the updated schedule settings with recalculated `next_run_at`.

---

### Toggle Schedule

Toggle the schedule enabled status.

```http
POST /api/admin/scraper/schedule/toggle
```

**Response (200 OK):**

Returns the updated schedule settings with toggled `is_enabled`.

---

## Data Models

### ScraperStatusResponse

```typescript
{
  scheduler_running: boolean;
  scraper_enabled: boolean;
  next_run_time: string | null;
  last_run_time: string | null;
  last_run_result: ScraperBatchResult | null;
}
```

### ScraperBatchResult

```typescript
{
  status: string;                  // "success", "partial", "error"
  total_jobs_found: number;
  total_jobs_created: number;
  total_jobs_updated: number;
  total_errors: number;
  region_results: ScraperRunResult[];
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
}
```

### ScraperRunResult

```typescript
{
  region: string;                  // "thailand", "singapore", etc.
  status: string;                  // "success", "error", "timeout"
  jobs_found: number;
  jobs_created: number;
  jobs_updated: number;
  errors: number;
  error_details: object[];
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
}
```

### ScraperPresetResponse

```typescript
{
  id: number;
  name: string;
  url: string;
  count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}
```

### ScheduleSettingsResponse

```typescript
{
  is_enabled: boolean;
  schedule_type: string;           // "daily" or "weekly"
  schedule_hour: number;           // 0-23
  schedule_minute: number;         // 0-59
  schedule_day_of_week: number | null;  // 0-6 for weekly
  last_run_at: string | null;
  next_run_at: string | null;
  updated_at: string | null;
}
```

### AdHocScrapeResponse

```typescript
{
  status: string;                  // "success", "partial", "error", "timeout"
  jobs_found: number;
  jobs_created: number;
  jobs_updated: number;
  errors: number;
  error_details: object[];
  duration_seconds: number | null;
}
```

### CleanupResponse

```typescript
{
  status: string;
  deleted_count: number;
  duration_seconds: number | null;
  error: string | null;
}
```

## Usage Notes

- All admin endpoints require the user to have `is_admin: true` set in the database
- Scraper operations use distributed locking (Redis) to prevent concurrent runs
- Ad-hoc scrapes create audit records for tracking
- Schedule changes take effect immediately after the API call
- Presets marked as inactive are excluded from scheduled runs

## Related Endpoints

- [Job Listings](job-listings.md) - Browse scraped job listings
