# Job Listings API

## Overview

The Job Listings API provides access to scraped job listings from external sources (LinkedIn via Apify). Users can browse, search, filter, and interact with these listings by saving, hiding, or marking them as applied.

**Base Path:** `/api/job-listings`

**Authentication:** All endpoints require authentication.

> **Note:** This API is for browsing scraped job listings. For managing user-created job postings, see [Jobs API](jobs.md).

---

## Endpoints

### Get Filter Options

Get available filter values based on existing job data.

```http
GET /api/job-listings/filter-options
```

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
| `sort_by` | string | `date_posted` | Sort field: `date_posted`, `relevance`, `salary` |
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
      "applied_at": null
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
}
```

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
  job_listing_id: number;
  is_saved: boolean;
  is_hidden: boolean;
  applied_at: string | null;
  viewed_at: string | null;
}
```

## Sort Options

| Value | Description |
| ----- | ----------- |
| `date_posted` | Sort by posting date |
| `relevance` | Sort by relevance to search query |
| `salary` | Sort by salary (requires salary data) |

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
