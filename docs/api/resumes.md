# Resumes API

## Overview

The Resumes API provides CRUD operations for managing user resumes. Resumes store raw content that can be parsed and tailored for specific job applications.

**Base Path:** `/api/resumes`

**Authentication:** All endpoints require authentication.

---

## Endpoints

### Create Resume

Create a new resume for the authenticated user.

```http
POST /api/resumes
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Resume title |
| `raw_content` | string | Yes | Resume content text |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/resumes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Software Engineer Resume",
    "raw_content": "John Doe\nSenior Software Engineer\n\nExperience:\n- Led development of microservices architecture..."
  }'
```

**Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Senior Software Engineer Resume",
  "raw_content": "John Doe\nSenior Software Engineer...",
  "owner_id": "660e8400-e29b-41d4-a716-446655440001",
  "parsed_content": null,
  "created_at": "2026-02-18T10:30:00.000000",
  "updated_at": "2026-02-18T10:30:00.000000"
}
```

---

### Get Resume

Retrieve a specific resume by ID.

```http
GET /api/resumes/{resume_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resume_id` | UUID | Resume identifier |

**Example Request:**

```bash
curl http://localhost:8000/api/resumes/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Senior Software Engineer Resume",
  "raw_content": "John Doe\nSenior Software Engineer...",
  "owner_id": "660e8400-e29b-41d4-a716-446655440001",
  "parsed_content": {
    "name": "John Doe",
    "title": "Senior Software Engineer",
    "experience": [...],
    "skills": [...]
  },
  "created_at": "2026-02-18T10:30:00.000000",
  "updated_at": "2026-02-18T10:30:00.000000"
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 403 | Resume belongs to another user |
| 404 | Resume not found |

---

### List Resumes

Retrieve all resumes for the authenticated user.

```http
GET /api/resumes
```

**Query Parameters:**

| Parameter | Type | Default | Constraints |
|-----------|------|---------|-------------|
| `skip` | integer | 0 | >= 0 |
| `limit` | integer | 10 | 1-100 |

**Example Request:**

```bash
curl "http://localhost:8000/api/resumes?skip=0&limit=20" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Senior Software Engineer Resume",
    "raw_content": "...",
    "owner_id": "660e8400-e29b-41d4-a716-446655440001",
    "parsed_content": {...},
    "created_at": "2026-02-18T10:30:00.000000",
    "updated_at": "2026-02-18T10:30:00.000000"
  }
]
```

---

### Update Resume

Update an existing resume.

```http
PUT /api/resumes/{resume_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resume_id` | UUID | Resume identifier |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `title` | string | No |
| `raw_content` | string | No |

**Example Request:**

```bash
curl -X PUT http://localhost:8000/api/resumes/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Staff Software Engineer Resume",
    "raw_content": "Updated resume content..."
  }'
```

**Response (200 OK):**

Returns the updated resume.

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 403 | Resume belongs to another user |
| 404 | Resume not found |

---

### Delete Resume

Delete a resume.

```http
DELETE /api/resumes/{resume_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resume_id` | UUID | Resume identifier |

**Example Request:**

```bash
curl -X DELETE http://localhost:8000/api/resumes/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Response (204 No Content):**

No response body.

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 403 | Resume belongs to another user |
| 404 | Resume not found |

---

## Data Models

### ResumeCreate

```typescript
{
  title: string;       // Resume title, required
  raw_content: string; // Resume text content, required
}
```

### ResumeUpdate

```typescript
{
  title?: string;       // Resume title, optional
  raw_content?: string; // Resume text content, optional
}
```

### ResumeResponse

```typescript
{
  id: string;                    // UUID
  title: string;
  raw_content: string;
  owner_id: string;              // UUID of the user
  parsed_content: object | null; // Parsed resume structure
  created_at: string;            // ISO 8601 datetime
  updated_at: string;            // ISO 8601 datetime
}
```

## Parsed Content Structure

When a resume is processed, the `parsed_content` field contains extracted information:

```json
{
  "name": "John Doe",
  "title": "Senior Software Engineer",
  "contact": {
    "email": "john@example.com",
    "phone": "+1-555-0123",
    "location": "San Francisco, CA"
  },
  "summary": "Experienced software engineer with 8+ years...",
  "experience": [
    {
      "company": "TechCorp",
      "title": "Senior Software Engineer",
      "start_date": "2022-01",
      "end_date": "present",
      "bullets": [
        "Led migration to microservices",
        "Mentored junior developers"
      ]
    }
  ],
  "education": [...],
  "skills": ["Python", "AWS", "Kubernetes"]
}
```

## Usage Notes

- Resumes are automatically parsed when created/updated to extract structured content
- The parsed content is used by the tailoring system for matching
- Raw content is preserved for export and editing
- Each user can have multiple resumes for different purposes

## Related Endpoints

- [Tailor](tailor-match.md) - Match resumes to jobs and generate tailored versions
- [Upload](upload-export.md) - Extract resume text from PDF/DOCX files
- [Blocks](blocks.md) - Import resume content as reusable blocks
