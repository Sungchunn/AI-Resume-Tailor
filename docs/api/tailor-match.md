# Tailor & Match API

## Overview

The Tailor and Match APIs provide AI-powered resume customization and semantic search capabilities. These endpoints analyze job requirements and match them against resume content to optimize applications.

---

## 3-Step Tailor Flow (v2)

The redesigned tailor flow provides a linear wizard experience:

```text
Job Detail Page
      │
      │ Click "Optimize Resume for This Job"
      ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Select Resume                                      │
│  /tailor?job_listing_id=X                                   │
│                                                             │
│  - Job context card (pre-selected from job detail page)     │
│  - Resume selector with master resume pre-selected          │
│  - CTA: "Analyze Match →"                                   │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Review Match Analysis                              │
│  /tailor/analyze?resume_id=X&job_listing_id=Y               │
│                                                             │
│  - ATS Progress Stepper (5-stage streaming analysis)        │
│  - Interactive Keyword Selection:                           │
│    • "Skills You Have" - vault-backed, selectable           │
│    • "Skills You Don't Have" - grayed out, not selectable   │
│  - CTA: "Generate Tailored Resume →"                        │
└─────────────────────────────────────────────────────────────┘
      │
      │ POST /api/tailor with focus_keywords
      ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Tailored Resume Detail                             │
│  /tailor/[id]                                               │
│                                                             │
│  - Human-readable title: "Software Engineer @ Acme — Mar 5" │
│  - Score dashboard with ATS cache info                      │
│  - Version history sidebar (grouped by job)                 │
│  - Actions: Edit, Download, Re-analyze, Delete              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tailor API

**Base Path:** `/api/tailor`

**Authentication:** All endpoints require authentication.

## Endpoints

### Create Tailored Resume

Generate an AI-tailored resume for a specific job.

```http
POST /api/tailor
```

**Request Body:**

| Field | Type | Required | Description |
| ----- | ------ | ---------- | ------------- |
| `resume_id` | string | Yes | Source resume ID (MongoDB ObjectId) |
| `job_id` | integer | Conditional | Target job ID (user-created) |
| `job_listing_id` | integer | Conditional | Target job listing ID (scraped) |
| `focus_keywords` | string[] | No | User-selected keywords to emphasize |

> **Note:** Either `job_id` or `job_listing_id` must be provided, but not both.

**Focus Keywords (User-in-the-Loop):**

The `focus_keywords` field enables resume integrity by letting users control which skills the AI emphasizes:

- If provided: AI only optimizes for these specific skills
- If `null`/`undefined`: AI uses all vault-backed keywords by default
- AI will NOT add skills outside the focus list (prevents lying on resumes)

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/tailor \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_id": "67890abcdef123456789abcd",
    "job_listing_id": 123,
    "focus_keywords": ["Python", "FastAPI", "AWS"]
  }'
```

**Response (201 Created):**

```json
{
  "id": "abcdef123456789012345678",
  "resume_id": "67890abcdef123456789abcd",
  "job_id": null,
  "job_listing_id": 123,
  "tailored_data": {
    "contact": {"name": "John Doe", "email": "john@example.com"},
    "summary": "Senior Software Engineer with 5+ years of Python and AWS experience...",
    "experience": [...],
    "skills": ["Python", "FastAPI", "AWS", "PostgreSQL"]
  },
  "status": "pending",
  "match_score": 78.5,
  "skill_matches": ["Python", "FastAPI", "AWS"],
  "skill_gaps": ["Kubernetes"],
  "keyword_coverage": 0.72,
  "job_title": "Senior Software Engineer",
  "company_name": "Acme Corp",
  "focus_keywords_used": ["Python", "FastAPI", "AWS"],
  "created_at": "2026-03-05T10:30:00.000000"
}
```

---

### Quick Match

Get a quick match analysis without generating a tailored resume.

```http
POST /api/tailor/quick-match
```

**Request Body:**

| Field | Type | Required |
| ----- | ------ | ---------- |
| `resume_id` | UUID | Yes |
| `job_id` | UUID | Conditional |
| `job_listing_id` | integer | Conditional |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/tailor/quick-match \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_id": "770e8400-e29b-41d4-a716-446655440000"
  }'
```

**Response (200 OK):**

```json
{
  "match_score": 78.5,
  "keyword_coverage": 0.72,
  "skill_matches": [
    {"skill": "Python", "level": "expert", "relevance": "high"},
    {"skill": "AWS", "level": "intermediate", "relevance": "high"}
  ],
  "skill_gaps": [
    {"skill": "Kubernetes", "importance": "preferred"}
  ]
}
```

---

### Get Tailored Resume

Retrieve a previously generated tailored resume with ATS cache metadata.

```http
GET /api/tailor/{tailored_id}
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ------ | ------------- |
| `tailored_id` | string | Tailored resume identifier (MongoDB ObjectId) |

**Response (200 OK):**

```json
{
  "id": "abcdef123456789012345678",
  "resume_id": "67890abcdef123456789abcd",
  "job_id": null,
  "job_listing_id": 123,
  "tailored_data": {...},
  "finalized_data": null,
  "status": "pending",
  "match_score": 78.5,
  "job_title": "Senior Software Engineer",
  "company_name": "Acme Corp",
  "formatted_name": "Senior Software Engineer @ Acme Corp — Mar 5",
  "style_settings": {},
  "section_order": ["summary", "experience", "skills", "education"],
  "created_at": "2026-03-05T10:30:00.000000",
  "updated_at": "2026-03-05T10:30:00.000000",
  "finalized_at": null,
  "ats_score": 82.5,
  "ats_cached_at": "2026-03-05T14:30:00.000000",
  "is_outdated": false
}
```

**ATS Cache Metadata Fields:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `ats_score` | number \| null | Cached ATS composite score (0-100) |
| `ats_cached_at` | string \| null | ISO timestamp of last ATS analysis |
| `is_outdated` | boolean | True if resume content changed since analysis |

**Formatted Name:**

The `formatted_name` computed field provides a human-readable version name:

- Format: `{job_title} @ {company_name} — {date}`
- Falls back gracefully: `{job_title} — {date}` or `{company_name} — {date}`
- Ultimate fallback: `Tailored Resume — {date}`

---

### Update Tailored Resume

Update an existing tailored resume.

```http
PATCH /api/tailor/{tailored_id}
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ------ | ------------- |
| `tailored_id` | UUID | Tailored resume identifier |

**Request Body:**

| Field | Type | Description |
| ----- | ------ | ------------- |
| `tailored_content` | string | Updated content |
| `style_settings` | object | Style configuration |
| `section_order` | string[] | Order of sections |

**Response (200 OK):**

Returns the updated tailored resume.

---

### List Tailored Resumes

List all tailored resumes with optional filtering.

```http
GET /api/tailor
```

**Query Parameters:**

| Parameter | Type | Description |
| --------- | ------ | ------------- |
| `resume_id` | UUID | Filter by source resume |
| `job_id` | UUID | Filter by target job |
| `job_listing_id` | integer | Filter by job listing |
| `skip` | integer | Pagination offset |
| `limit` | integer | Maximum results |

**Response (200 OK):**

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "resume_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_id": "770e8400-e29b-41d4-a716-446655440000",
    "job_listing_id": null,
    "match_score": 78.5,
    "created_at": "2026-02-18T10:30:00.000000"
  }
]
```

---

### Delete Tailored Resume

Delete a tailored resume.

```http
DELETE /api/tailor/{tailored_id}
```

**Response (204 No Content):**

No response body.

---

## Semantic Match API

**Base Path:** `/v1/match`

**Authentication:** All endpoints require authentication.

The Semantic Match API uses vector embeddings to find the most relevant content blocks from your vault that match job requirements.

### Semantic Search

Find blocks matching a job description.

```http
POST /v1/match
```

**Request Body:**

| Field             | Type      | Default  | Description                |
| ----------------- | --------- | -------- | -------------------------- |
| `job_description` | string    | Required | Job description text       |
| `limit`           | integer   | 10       | Max results (1-100)        |
| `block_types`     | string[]  | All      | Filter by block types      |
| `tags`            | string[]  | None     | Filter by tags             |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/match \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_description": "Looking for a Senior Software Engineer with Python experience, AWS expertise, and leadership skills...",
    "limit": 5,
    "block_types": ["ACHIEVEMENT", "RESPONSIBILITY"]
  }'
```

**Response (200 OK):**

```json
{
  "matches": [
    {
      "block": {
        "id": "880e8400-e29b-41d4-a716-446655440001",
        "content": "Led migration of monolithic application to microservices architecture, reducing deployment time by 75%",
        "block_type": "ACHIEVEMENT",
        "tags": ["architecture", "leadership"]
      },
      "score": 0.89,
      "matched_keywords": ["architecture", "leadership", "scalable"]
    },
    {
      "block": {
        "id": "880e8400-e29b-41d4-a716-446655440002",
        "content": "Managed team of 5 engineers, conducting code reviews and mentoring junior developers",
        "block_type": "RESPONSIBILITY",
        "tags": ["leadership", "mentoring"]
      },
      "score": 0.82,
      "matched_keywords": ["leadership", "mentoring", "team"]
    }
  ],
  "query_keywords": ["python", "aws", "leadership", "senior", "software engineer"],
  "total_vault_blocks": 47
}
```

---

### Gap Analysis

Analyze skill gaps between your vault and job requirements.

```http
POST /v1/match/analyze
```

**Request Body:**

Same as `/v1/match`.

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/match/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_description": "Looking for a Senior Software Engineer with Python, AWS, Kubernetes, and machine learning experience..."
  }'
```

**Response (200 OK):**

```json
{
  "match_score": 72,
  "skill_matches": [
    {"skill": "Python", "evidence": "Multiple blocks demonstrate Python expertise"},
    {"skill": "AWS", "evidence": "EC2, S3, Lambda experience documented"},
    {"skill": "Leadership", "evidence": "Team management and mentoring experience"}
  ],
  "skill_gaps": [
    {"skill": "Kubernetes", "importance": "required", "suggestion": "Consider adding Kubernetes experience or certifications"},
    {"skill": "Machine Learning", "importance": "preferred", "suggestion": "ML experience would strengthen your application"}
  ],
  "keyword_coverage": 0.68,
  "recommendations": [
    "Add blocks highlighting any container orchestration experience",
    "Consider mentioning any exposure to ML/AI projects",
    "Your leadership experience is strong - emphasize team scaling achievements"
  ]
}
```

---

### Match by Job ID

Find matching blocks for a saved job posting.

```http
GET /v1/match/job/{job_id}
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ------ | ------------- |
| `job_id` | UUID | Job posting identifier |

**Query Parameters:**

| Parameter | Type    | Default |
| --------- | ------- | ------- |
| `limit`   | integer | 10      |

**Response (200 OK):**

Same format as `/v1/match`.

---

## Caching

Match results are cached with a 15-minute TTL to improve performance:

- Cache key includes: user ID, job description hash, filters
- Subsequent identical queries return cached results
- Cache is invalidated when blocks are added/updated

---

## Data Models

### TailorRequest

```typescript
{
  resume_id: string;           // MongoDB ObjectId as string
  job_id?: number;             // PostgreSQL job_descriptions.id
  job_listing_id?: number;     // PostgreSQL job_listings.id
  focus_keywords?: string[];   // User-selected keywords to emphasize
}
```

### TailorResponse

```typescript
{
  id: string;                    // MongoDB ObjectId
  resume_id: string;             // MongoDB ObjectId
  job_id: number | null;
  job_listing_id: number | null;
  tailored_data: ParsedContent;  // Complete tailored resume structure
  status: "pending" | "finalized" | "archived";
  match_score: number;           // 0-100
  skill_matches: string[];
  skill_gaps: string[];
  keyword_coverage: number;      // 0-1
  job_title: string | null;
  company_name: string | null;
  focus_keywords_used: string[] | null;  // Keywords that were used
  created_at: string;
}
```

### TailoredResumeFullResponse

```typescript
{
  id: string;
  resume_id: string;
  job_id: number | null;
  job_listing_id: number | null;
  tailored_data: ParsedContent;
  finalized_data: ParsedContent | null;
  status: "pending" | "finalized" | "archived";
  match_score: number | null;
  job_title: string | null;
  company_name: string | null;
  formatted_name: string;        // Computed: "{job_title} @ {company_name} — {date}"
  style_settings: object;
  section_order: string[];
  created_at: string;
  updated_at: string | null;
  finalized_at: string | null;
  // ATS cache metadata
  ats_score: number | null;      // Cached ATS composite score
  ats_cached_at: string | null;  // When ATS analysis was cached
  is_outdated: boolean;          // True if content changed since analysis
}
```

### QuickMatchResponse

```typescript
{
  match_score: number;           // 0-100
  keyword_coverage: number;      // 0-1
  skill_matches: string[];
  skill_gaps: string[];
}
```

### MatchRequest

```typescript
{
  job_description: string;       // Required
  limit?: number;                // 1-100, default 10
  block_types?: string[];        // Filter by type
  tags?: string[];               // Filter by tags
}
```

### MatchResponse

```typescript
{
  matches: SemanticMatchResult[];
  query_keywords: string[];
  total_vault_blocks: number;
}
```

### SemanticMatchResult

```typescript
{
  block: BlockResponse;
  score: number;                 // 0-1 similarity score
  matched_keywords: string[];
}
```

### GapAnalysisResponse

```typescript
{
  match_score: number;           // 0-100
  skill_matches: SkillMatch[];
  skill_gaps: SkillGap[];
  keyword_coverage: number;      // 0-1
  recommendations: string[];
}
```

### SkillMatch

```typescript
{
  skill: string;
  level?: string;                // "expert" | "advanced" | "intermediate"
  relevance?: string;            // "high" | "medium" | "low"
  evidence?: string;             // Supporting evidence from blocks
}
```

### SkillGap

```typescript
{
  skill: string;
  importance: string;            // "required" | "preferred" | "nice-to-have"
  suggestion?: string;           // How to address the gap
}
```

## Rate Limiting

AI-powered endpoints have specific rate limits:

| Endpoint | Per Minute | Per Hour |
| -------- | ---------- | -------- |
| `/api/tailor` | 10 | 100 |
| `/api/tailor/quick-match` | 10 | 100 |
| `/v1/match` | 10 | 100 |
| `/v1/match/analyze` | 10 | 100 |

## Usage Notes

- Use quick-match for fast compatibility checks
- Generate full tailored resumes for serious applications
- Semantic matching requires blocks to have embeddings (use `/v1/blocks/embed`)
- Gap analysis helps identify areas to improve in your vault
- Higher scores indicate better alignment with job requirements

## Related Endpoints

- [Resumes](resumes.md) - Manage source resumes
- [Jobs](jobs.md) - Manage user-created job postings
- [Job Listings](job-listings.md) - Browse scraped job listings
- [Blocks](blocks.md) - Manage content blocks
- [Export](upload-export.md) - Export tailored resumes
