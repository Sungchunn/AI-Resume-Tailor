# Resumes API

## Overview

The Resumes API provides CRUD operations for managing user resumes. Each resume belongs to a specific user and contains raw content that can be parsed and used for tailoring.

**Base Path:** `/api/resumes`

**Authentication:** All endpoints require authentication.

---

## Endpoints

### Create Resume

Create a new resume for the authenticated user.

```
POST /api/resumes
```

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | Yes | 1-255 characters |
| `raw_content` | string | Yes | Resume text content |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/resumes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Software Engineer Resume",
    "raw_content": "John Doe\nSoftware Engineer\n\nExperience:\n- Senior Developer at TechCorp (2022-Present)\n  - Led team of 5 engineers\n  - Implemented microservices architecture\n\nSkills:\n- Python, JavaScript, Go\n- AWS, Docker, Kubernetes"
  }'
```

**Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Software Engineer Resume",
  "raw_content": "John Doe\nSoftware Engineer\n\nExperience:\n...",
  "owner_id": "660e8400-e29b-41d4-a716-446655440001",
  "parsed_content": null,
  "created_at": "2026-02-18T10:30:00.000000",
  "updated_at": "2026-02-18T10:30:00.000000"
}
```

---

### Get Resume

Retrieve a specific resume by ID.

```
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
  "title": "Software Engineer Resume",
  "raw_content": "John Doe\nSoftware Engineer\n...",
  "owner_id": "660e8400-e29b-41d4-a716-446655440001",
  "parsed_content": {
    "contact": {
      "name": "John Doe",
      "title": "Software Engineer"
    },
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

```
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
    "title": "Software Engineer Resume",
    "raw_content": "...",
    "owner_id": "660e8400-e29b-41d4-a716-446655440001",
    "parsed_content": {...},
    "created_at": "2026-02-18T10:30:00.000000",
    "updated_at": "2026-02-18T10:30:00.000000"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "title": "Data Science Resume",
    "raw_content": "...",
    "owner_id": "660e8400-e29b-41d4-a716-446655440001",
    "parsed_content": {...},
    "created_at": "2026-02-17T15:00:00.000000",
    "updated_at": "2026-02-17T15:00:00.000000"
  }
]
```

---

### Update Resume

Update an existing resume.

```
PUT /api/resumes/{resume_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resume_id` | UUID | Resume identifier |

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | No | 1-255 characters |
| `raw_content` | string | No | Resume text content |

**Example Request:**

```bash
curl -X PUT http://localhost:8000/api/resumes/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Software Engineer Resume",
    "raw_content": "John Doe\nSenior Software Engineer\n..."
  }'
```

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Senior Software Engineer Resume",
  "raw_content": "John Doe\nSenior Software Engineer\n...",
  "owner_id": "660e8400-e29b-41d4-a716-446655440001",
  "parsed_content": {...},
  "created_at": "2026-02-18T10:30:00.000000",
  "updated_at": "2026-02-18T11:00:00.000000"
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 403 | Resume belongs to another user |
| 404 | Resume not found |

---

### Delete Resume

Delete a resume.

```
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
  title: string;       // 1-255 characters, required
  raw_content: string; // Resume text content, required
}
```

### ResumeUpdate

```typescript
{
  title?: string;       // 1-255 characters, optional
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

When a resume is processed, the `parsed_content` field contains a structured representation:

```json
{
  "contact": {
    "name": "John Doe",
    "title": "Software Engineer",
    "email": "john@example.com",
    "phone": "+1-555-123-4567",
    "location": "San Francisco, CA"
  },
  "summary": "Experienced software engineer with 8+ years...",
  "experience": [
    {
      "company": "TechCorp",
      "title": "Senior Developer",
      "start_date": "2022-01",
      "end_date": "present",
      "highlights": [
        "Led team of 5 engineers",
        "Implemented microservices architecture"
      ]
    }
  ],
  "education": [
    {
      "institution": "State University",
      "degree": "BS Computer Science",
      "graduation_date": "2016"
    }
  ],
  "skills": ["Python", "JavaScript", "Go", "AWS", "Docker", "Kubernetes"],
  "certifications": [],
  "projects": []
}
```

## Usage Notes

- Resumes are automatically parsed when created or updated
- The `parsed_content` is used by the tailoring system to match against job requirements
- Raw content should be plain text (extracted from PDF/DOCX via the upload endpoint)
- Each user can have multiple resumes for different roles or versions

## Related Endpoints

- [Upload](180226_upload-export.md) - Extract text from PDF/DOCX files
- [Tailor](180226_tailor-match.md) - Tailor resumes to job descriptions
- [Blocks](180226_blocks.md) - Manage individual content blocks from resumes
