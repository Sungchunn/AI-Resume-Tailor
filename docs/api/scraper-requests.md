# Scraper Requests API

## Overview

The Scraper Requests API allows users to submit LinkedIn job URLs for admin review. Users can request that specific job searches be added to the scraper system. Admins review these requests and can approve them (creating scraper presets) or reject them with feedback.

**Base Path:** `/api/scraper-requests`

**Authentication:** All endpoints require authentication.

---

## Endpoints

### Create Request

Submit a new scraper request for admin review.

```http
POST /api/scraper-requests
```

**Request Body:**

| Field | Type | Required | Constraints |
| ----- | ------ | -------- | ----------- |
| `url` | string | Yes | Must be a LinkedIn jobs URL |
| `name` | string | No | Suggested preset name (max 100 chars) |
| `reason` | string | No | Why you want these jobs (max 500 chars) |

**URL Validation:**

- Must use `http` or `https` scheme
- Domain must be `linkedin.com` or `www.linkedin.com`
- Path must start with `/jobs`

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/scraper-requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.linkedin.com/jobs/search/?keywords=software%20engineer&location=Remote",
    "name": "Remote Software Engineer Jobs",
    "reason": "Looking for remote opportunities in Europe"
  }'
```

**Response (201 Created):**

```json
{
  "id": 1,
  "url": "https://www.linkedin.com/jobs/search/?keywords=software%20engineer&location=Remote",
  "name": "Remote Software Engineer Jobs",
  "reason": "Looking for remote opportunities in Europe",
  "status": "pending",
  "admin_notes": null,
  "created_at": "2026-03-09T10:30:00.000000",
  "updated_at": "2026-03-09T10:30:00.000000",
  "reviewed_at": null,
  "preset_id": null
}
```

**Error Responses:**

| Status | Condition |
| ------ | --------- |
| 400 | Invalid URL format or not a LinkedIn jobs URL |
| 422 | Validation error (missing required fields) |

---

### List My Requests

Get all scraper requests submitted by the current user.

```http
GET /api/scraper-requests
```

**Query Parameters:**

| Parameter | Type | Default | Constraints |
| --------- | ------- | ------- | ----------- |
| `limit` | integer | 50 | 1-100 |
| `offset` | integer | 0 | >= 0 |

**Example Request:**

```bash
curl "http://localhost:8000/api/scraper-requests?limit=20&offset=0" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

```json
{
  "requests": [
    {
      "id": 1,
      "url": "https://www.linkedin.com/jobs/search/?keywords=...",
      "name": "Remote Software Engineer Jobs",
      "reason": "Looking for remote opportunities",
      "status": "pending",
      "admin_notes": null,
      "created_at": "2026-03-09T10:30:00.000000",
      "updated_at": "2026-03-09T10:30:00.000000",
      "reviewed_at": null,
      "preset_id": null
    },
    {
      "id": 2,
      "url": "https://www.linkedin.com/jobs/search/?keywords=...",
      "name": "Data Analyst Jobs",
      "reason": null,
      "status": "approved",
      "admin_notes": "Added to weekly scrape",
      "created_at": "2026-03-08T14:00:00.000000",
      "updated_at": "2026-03-08T16:00:00.000000",
      "reviewed_at": "2026-03-08T16:00:00.000000",
      "preset_id": 5
    }
  ],
  "total": 2
}
```

---

### Cancel Request

Cancel a pending scraper request. Only pending requests can be cancelled.

```http
DELETE /api/scraper-requests/{request_id}
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ------- | ----------- |
| `request_id` | integer | Request identifier |

**Example Request:**

```bash
curl -X DELETE http://localhost:8000/api/scraper-requests/1 \
  -H "Authorization: Bearer <token>"
```

**Response (204 No Content):**

No response body.

**Error Responses:**

| Status | Condition |
| ------ | --------- |
| 404 | Request not found, not owned by user, or not pending |

---

## Data Models

### ScraperRequestCreate

```typescript
{
  url: string;           // LinkedIn jobs URL, required
  name?: string | null;  // Suggested preset name, optional (max 100 chars)
  reason?: string | null; // Why you want these jobs, optional (max 500 chars)
}
```

### ScraperRequestResponse

```typescript
{
  id: number;
  url: string;
  name: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;    // Feedback from admin (approval notes or rejection reason)
  created_at: string;            // ISO 8601 datetime
  updated_at: string | null;     // ISO 8601 datetime
  reviewed_at: string | null;    // ISO 8601 datetime when reviewed
  preset_id: number | null;      // ID of created preset (if approved)
}
```

### ScraperRequestListResponse

```typescript
{
  requests: ScraperRequestResponse[];
  total: number;
}
```

## Request Status Flow

```text
pending ──┬── approved (preset created)
          └── rejected (with admin notes)
```

- **pending:** Request submitted, awaiting admin review
- **approved:** Admin approved the request; a scraper preset was created
- **rejected:** Admin rejected the request; `admin_notes` contains the reason

## Usage Notes

- Users can only view and cancel their own requests
- Only pending requests can be cancelled
- When a request is approved, a scraper preset is automatically created
- The `preset_id` field links to the created preset (visible in approved requests)
- Check `admin_notes` for feedback on approved or rejected requests

## Related Endpoints

- [Admin Scraper Requests](admin.md#scraper-requests) - Admin endpoints for reviewing requests
- [Job Listings](job-listings.md) - Browse scraped job listings
