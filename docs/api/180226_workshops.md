# Workshops API

## Overview

The Workshops API provides a collaborative workspace for building tailored resumes. A workshop is a session where users pull blocks from their vault, receive AI-powered suggestions, and build a resume targeted at a specific job.

**Base Path:** `/v1/workshops`

**Authentication:** All endpoints require authentication.

---

## Workshop Lifecycle

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

## Workshop Status Values

| Status | Description |
|--------|-------------|
| `DRAFT` | Initial state, job details entered |
| `IN_PROGRESS` | Actively building the resume |
| `EXPORTED` | Resume has been exported |
| `COMPLETED` | Workshop finalized |

---

## Endpoints

### Create Workshop

Create a new resume workshop session.

```
POST /v1/workshops
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_title` | string | Yes | Target job title |
| `job_company` | string | No | Target company |
| `job_description` | string | Yes | Full job description |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/workshops \
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
  "status": "DRAFT",
  "sections": {},
  "pulled_block_ids": [],
  "pending_diffs": [],
  "created_at": "2026-02-18T10:30:00.000000",
  "updated_at": "2026-02-18T10:30:00.000000"
}
```

---

### List Workshops

Retrieve all workshops for the authenticated user.

```
GET /v1/workshops
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status_filter` | string | None | Filter by status |
| `limit` | integer | 50 | Maximum results (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Example Request:**

```bash
curl "http://localhost:8000/v1/workshops?status_filter=IN_PROGRESS&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

```json
{
  "workshops": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "job_title": "Senior Software Engineer",
      "job_company": "TechCorp",
      "status": "IN_PROGRESS",
      "created_at": "2026-02-18T10:30:00.000000"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

---

### Get Workshop

Retrieve a specific workshop.

```
GET /v1/workshops/{workshop_id}
```

**Response (200 OK):**

Full workshop object with all fields.

---

### Update Workshop

Update workshop details.

```
PATCH /v1/workshops/{workshop_id}
```

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `job_title` | string | Updated job title |
| `job_company` | string | Updated company |
| `job_description` | string | Updated job description |

---

### Delete Workshop

Delete a workshop.

```
DELETE /v1/workshops/{workshop_id}
```

**Response (204 No Content):**

No response body.

---

### Pull Blocks

Add blocks from the vault to the workshop.

```
POST /v1/workshops/{workshop_id}/pull
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `block_ids` | UUID[] | Yes | Block IDs to pull (min 1) |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/workshops/990e8400-e29b-41d4-a716-446655440000/pull \
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
  "workshop": {...},
  "newly_pulled": [
    "880e8400-e29b-41d4-a716-446655440001",
    "880e8400-e29b-41d4-a716-446655440002"
  ],
  "already_pulled": []
}
```

---

### Get Workshop Blocks

Retrieve all blocks pulled into a workshop.

```
GET /v1/workshops/{workshop_id}/blocks
```

**Response (200 OK):**

```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440001",
    "content": "Led migration to microservices...",
    "block_type": "ACHIEVEMENT",
    ...
  }
]
```

---

### Remove Block from Workshop

Remove a block from the workshop.

```
DELETE /v1/workshops/{workshop_id}/blocks/{block_id}
```

**Response (200 OK):**

Returns updated workshop.

---

### Get AI Suggestions

Request AI-powered improvement suggestions.

```
POST /v1/workshops/{workshop_id}/suggest
```

**Request Body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_suggestions` | integer | 10 | Maximum suggestions (1-50) |
| `focus_sections` | string[] | All | Sections to focus on |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/workshops/990e8400-e29b-41d4-a716-446655440000/suggest \
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
  "workshop": {
    ...
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

```
POST /v1/workshops/{workshop_id}/diffs/accept
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `diff_index` | integer | Yes | Index of diff to accept |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/workshops/990e8400-e29b-41d4-a716-446655440000/diffs/accept \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"diff_index": 0}'
```

**Response (200 OK):**

```json
{
  "accepted": true,
  "diff_index": 0,
  "workshop": {...}
}
```

---

### Reject Diff

Reject a suggested change.

```
POST /v1/workshops/{workshop_id}/diffs/reject
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
  "workshop": {...}
}
```

---

### Clear All Diffs

Clear all pending suggestions.

```
POST /v1/workshops/{workshop_id}/diffs/clear
```

**Response (200 OK):**

Returns workshop with empty `pending_diffs`.

---

### Update Sections

Directly update resume sections.

```
PATCH /v1/workshops/{workshop_id}/sections
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sections` | object | Yes | Section key-value pairs |

**Example Request:**

```bash
curl -X PATCH http://localhost:8000/v1/workshops/990e8400-e29b-41d4-a716-446655440000/sections \
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

Update workshop status.

```
PATCH /v1/workshops/{workshop_id}/status
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | New status (enum) |

---

### Preview Writeback

Preview writing edited content back to the vault.

```
POST /v1/workshops/{workshop_id}/writeback/preview
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

```
POST /v1/workshops/{workshop_id}/writeback
```

**Request Body:**

Same as preview.

**Response (200 OK):**

Returns the created or updated block.

---

### Export Workshop

Export the workshop resume to a file.

```
POST /v1/workshops/{workshop_id}/export
```

**Request Body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | "pdf" | pdf, docx, txt, json |
| `template` | string | None | Template name |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/workshops/990e8400-e29b-41d4-a716-446655440000/export \
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

### WorkshopResponse

```typescript
{
  id: string;
  user_id: string;
  job_title: string;
  job_company: string | null;
  job_description: string;
  status: WorkshopStatus;
  sections: object;
  pulled_block_ids: string[];
  pending_diffs: DiffSuggestion[];
  created_at: string;
  updated_at: string;
}
```

## Usage Notes

- Workshops provide a structured way to build tailored resumes
- Pull relevant blocks from your vault to start building
- Use AI suggestions to improve content and fill gaps
- Review and accept/reject suggestions individually
- Writeback allows updating your vault with improved content
- Export when ready to apply for the job

## Related Endpoints

- [Blocks](180226_blocks.md) - Manage content blocks
- [Semantic Match](180226_tailor-match.md) - Find matching blocks for jobs
- [ATS Analysis](180226_ats.md) - Check ATS compatibility
