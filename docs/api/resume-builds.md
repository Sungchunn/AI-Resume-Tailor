# Resume Builds API

## Overview

The Resume Builds API (formerly Workshops) provides a workspace for building tailored resumes. A resume build is a session where users pull blocks from their vault, receive AI-powered suggestions, and build a resume targeted at a specific job.

**Base Path:** `/v1/resume-builds`

**Authentication:** All endpoints require authentication.

---

## Resume Build Lifecycle

```
┌──────────┐     Create      ┌───────────┐     Pull Blocks    ┌─────────────┐
│  DRAFT   │ ──────────────► │IN_PROGRESS│ ─────────────────► │ IN_PROGRESS │
└──────────┘                 └───────────┘                    └─────────────┘
                                                                     │
                              ┌──────────────────────────────────────┘
                              │  Get AI Suggestions
                              ▼
                        ┌─────────────┐     Accept/Reject    ┌─────────────┐
                        │ IN_PROGRESS │ ───────────────────► │ IN_PROGRESS │
                        │ (with diffs)│                      │ (updated)   │
                        └─────────────┘                      └─────────────┘
                                                                     │
                              ┌──────────────────────────────────────┘
                              │  Export Resume
                              ▼
                        ┌──────────┐     Mark Complete     ┌───────────┐
                        │ EXPORTED │ ────────────────────► │ COMPLETED │
                        └──────────┘                       └───────────┘
```

## Status Values

| Status | Description |
|--------|-------------|
| `draft` | Initial state, job details entered |
| `in_progress` | Actively building the resume |
| `exported` | Resume has been exported |
| `completed` | Build finalized |

---

## Endpoints

### Create Resume Build

Create a new resume build session.

```http
POST /v1/resume-builds
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_title` | string | Yes | Target job title |
| `job_company` | string | No | Target company |
| `job_description` | string | Yes | Full job description |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/resume-builds \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Senior Software Engineer",
    "job_company": "TechCorp",
    "job_description": "We are looking for a Senior Software Engineer with 5+ years of Python experience..."
  }'
```

**Response (201 Created):**

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "job_title": "Senior Software Engineer",
  "job_company": "TechCorp",
  "job_description": "We are looking for a Senior Software Engineer...",
  "status": "draft",
  "sections": {},
  "pulled_block_ids": [],
  "pending_diffs": [],
  "created_at": "2026-02-18T10:30:00.000000",
  "updated_at": "2026-02-18T10:30:00.000000"
}
```

---

### List Resume Builds

Retrieve all resume builds for the authenticated user.

```http
GET /v1/resume-builds
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | None | Filter by status |
| `limit` | integer | 50 | Maximum results (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Example Request:**

```bash
curl "http://localhost:8000/v1/resume-builds?status=in_progress&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

```json
{
  "builds": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "job_title": "Senior Software Engineer",
      "job_company": "TechCorp",
      "status": "in_progress",
      "created_at": "2026-02-18T10:30:00.000000"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

---

### Get Resume Build

Retrieve a specific resume build.

```http
GET /v1/resume-builds/{build_id}
```

**Response (200 OK):**

Full resume build object with all fields.

---

### Update Resume Build

Update resume build details.

```http
PATCH /v1/resume-builds/{build_id}
```

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `job_title` | string | Updated job title |
| `job_company` | string | Updated company |
| `job_description` | string | Updated job description |

---

### Delete Resume Build

Delete a resume build.

```http
DELETE /v1/resume-builds/{build_id}
```

**Response (204 No Content):**

No response body.

---

### Pull Blocks

Add blocks from the vault to the resume build.

```http
POST /v1/resume-builds/{build_id}/pull
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `block_ids` | UUID[] | Yes | Block IDs to pull (min 1) |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/resume-builds/990e8400-e29b-41d4-a716-446655440000/pull \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "block_ids": [
      "880e8400-e29b-41d4-a716-446655440001",
      "880e8400-e29b-41d4-a716-446655440002"
    ]
  }'
```

**Response (200 OK):**

```json
{
  "build": {...},
  "newly_pulled": [
    "880e8400-e29b-41d4-a716-446655440001",
    "880e8400-e29b-41d4-a716-446655440002"
  ],
  "already_pulled": []
}
```

---

### Get Build Blocks

Retrieve all blocks pulled into a resume build.

```http
GET /v1/resume-builds/{build_id}/blocks
```

**Response (200 OK):**

```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440001",
    "content": "Led migration to microservices...",
    "block_type": "ACHIEVEMENT"
  }
]
```

---

### Remove Block from Build

Remove a block from the resume build.

```http
DELETE /v1/resume-builds/{build_id}/blocks/{block_id}
```

**Response (200 OK):**

Returns updated resume build.

---

### Get AI Suggestions

Request AI-powered improvement suggestions.

```http
POST /v1/resume-builds/{build_id}/suggest
```

**Request Body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_suggestions` | integer | 10 | Maximum suggestions (1-50) |
| `focus_sections` | string[] | All | Sections to focus on |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/resume-builds/990e8400-e29b-41d4-a716-446655440000/suggest \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "max_suggestions": 5,
    "focus_sections": ["experience", "skills"]
  }'
```

**Response (200 OK):**

```json
{
  "build": {
    "pending_diffs": [
      {
        "operation": "replace",
        "path": "/sections/experience/0/content",
        "value": "Led migration of monolithic application to microservices architecture, reducing deployment time by 75% and achieving 99.9% uptime SLA",
        "original_value": "Led migration to microservices",
        "reason": "Added quantified results to demonstrate impact",
        "impact": "HIGH",
        "source_block_id": "880e8400-e29b-41d4-a716-446655440001"
      },
      {
        "operation": "add",
        "path": "/sections/skills/-",
        "value": "Kubernetes",
        "original_value": null,
        "reason": "Job requires Kubernetes experience, which matches your microservices work",
        "impact": "MEDIUM",
        "source_block_id": null
      }
    ]
  },
  "new_suggestions_count": 2,
  "gaps_identified": [
    "AWS certification preferred but not in resume",
    "Machine learning experience mentioned as nice-to-have"
  ]
}
```

---

### Accept Diff

Accept a suggested change.

```http
POST /v1/resume-builds/{build_id}/diffs/accept
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `diff_index` | integer | Yes | Index of diff to accept |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/resume-builds/990e8400-e29b-41d4-a716-446655440000/diffs/accept \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"diff_index": 0}'
```

**Response (200 OK):**

```json
{
  "accepted": true,
  "diff_index": 0,
  "build": {...}
}
```

---

### Reject Diff

Reject a suggested change.

```http
POST /v1/resume-builds/{build_id}/diffs/reject
```

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `diff_index` | integer | Yes |

**Response (200 OK):**

```json
{
  "rejected": true,
  "diff_index": 0,
  "build": {...}
}
```

---

### Clear All Diffs

Clear all pending suggestions.

```http
POST /v1/resume-builds/{build_id}/diffs/clear
```

**Response (200 OK):**

Returns build with empty `pending_diffs`.

---

### Update Sections

Directly update resume sections.

```http
PATCH /v1/resume-builds/{build_id}/sections
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sections` | object | Yes | Section key-value pairs |

**Example Request:**

```bash
curl -X PATCH http://localhost:8000/v1/resume-builds/990e8400-e29b-41d4-a716-446655440000/sections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sections": {
      "summary": "Experienced software engineer with 8+ years...",
      "experience": [...],
      "skills": ["Python", "AWS", "Kubernetes"]
    }
  }'
```

---

### Update Status

Update resume build status.

```http
PATCH /v1/resume-builds/{build_id}/status
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | New status (enum) |

---

### Preview Writeback

Preview writing edited content back to the vault.

```http
POST /v1/resume-builds/{build_id}/writeback/preview
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `edited_content` | string | Yes | Content to write back |
| `source_block_id` | UUID | No | Original block ID (for updates) |
| `create_new` | boolean | No | Force create new block |

**Response (200 OK):**

```json
{
  "action": "update",
  "preview": {
    "content": "Updated achievement text...",
    "block_type": "ACHIEVEMENT"
  },
  "original": {
    "content": "Original text...",
    "block_type": "ACHIEVEMENT"
  },
  "changes": [
    "Content updated with quantified metrics"
  ]
}
```

---

### Execute Writeback

Write edited content back to the vault.

```http
POST /v1/resume-builds/{build_id}/writeback
```

**Request Body:**

Same as preview.

**Response (200 OK):**

Returns the created or updated block.

---

### Export Resume Build

Export the resume build to a file.

```http
POST /v1/resume-builds/{build_id}/export
```

**Request Body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | "pdf" | pdf, docx, txt, json |
| `template` | string | None | Template name |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/resume-builds/990e8400-e29b-41d4-a716-446655440000/export \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"format": "pdf"}' \
  --output resume.pdf
```

**Response:**

Binary file download with appropriate Content-Type header.

---

## Data Models

### DiffSuggestion

```typescript
{
  operation: "add" | "remove" | "replace";  // JSON Patch operation
  path: string;                              // RFC 6901 JSON Pointer
  value: any;                                // New value
  original_value: any | null;                // Previous value
  reason: string;                            // Explanation
  impact: "HIGH" | "MEDIUM" | "LOW";         // Importance
  source_block_id: string | null;            // Related block
}
```

### ResumeBuildResponse

```typescript
{
  id: string;
  user_id: string;
  job_title: string;
  job_company: string | null;
  job_description: string;
  status: ResumeBuildStatus;
  sections: object;
  pulled_block_ids: string[];
  pending_diffs: DiffSuggestion[];
  created_at: string;
  updated_at: string;
}
```

## Usage Notes

- Resume builds provide a structured way to build tailored resumes
- Pull relevant blocks from your vault to start building
- Use AI suggestions to improve content and fill gaps
- Review and accept/reject suggestions individually
- Writeback allows updating your vault with improved content
- Export when ready to apply for the job

## Related Endpoints

- [Blocks](blocks.md) - Manage content blocks
- [Semantic Match](tailor-match.md) - Find matching blocks for jobs
- [ATS Analysis](ats.md) - Check ATS compatibility
