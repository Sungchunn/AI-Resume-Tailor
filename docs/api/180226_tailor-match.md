# Tailor & Match API

## Overview

The Tailor and Match APIs provide AI-powered resume customization and semantic search capabilities. These endpoints analyze job requirements and match them against resume content to optimize applications.

---

# Tailor API

**Base Path:** `/api/tailor`

**Authentication:** All endpoints require authentication.

## Endpoints

### Create Tailored Resume

Generate an AI-tailored resume for a specific job.

```
POST /api/tailor
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resume_id` | UUID | Yes | Source resume ID |
| `job_id` | UUID | Yes | Target job ID |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/tailor \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_id": "770e8400-e29b-41d4-a716-446655440000"
  }'
```

**Response (201 Created):**

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000",
  "resume_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_id": "770e8400-e29b-41d4-a716-446655440000",
  "tailored_content": "John Doe\nSenior Software Engineer\n\n[Tailored content optimized for the job...]",
  "suggestions": [
    "Consider adding more details about your AWS experience",
    "Highlight your team leadership achievements",
    "Add quantified metrics to your accomplishments"
  ],
  "match_score": 78.5,
  "skill_matches": [
    {"skill": "Python", "level": "expert", "relevance": "high"},
    {"skill": "AWS", "level": "intermediate", "relevance": "high"},
    {"skill": "Docker", "level": "advanced", "relevance": "medium"}
  ],
  "skill_gaps": [
    {"skill": "Kubernetes", "importance": "preferred"},
    {"skill": "Machine Learning", "importance": "nice-to-have"}
  ],
  "keyword_coverage": 0.72,
  "created_at": "2026-02-18T10:30:00.000000"
}
```

---

### Quick Match

Get a quick match analysis without generating a tailored resume.

```
POST /api/tailor/quick-match
```

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `resume_id` | UUID | Yes |
| `job_id` | UUID | Yes |

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

Retrieve a previously generated tailored resume.

```
GET /api/tailor/{tailored_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tailored_id` | UUID | Tailored resume identifier |

**Response (200 OK):**

Full TailorResponse object.

---

### List Tailored Resumes

List all tailored resumes with optional filtering.

```
GET /api/tailor
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resume_id` | UUID | Filter by source resume |
| `job_id` | UUID | Filter by target job |
| `skip` | integer | Pagination offset |
| `limit` | integer | Maximum results |

**Response (200 OK):**

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "resume_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_id": "770e8400-e29b-41d4-a716-446655440000",
    "match_score": 78.5,
    "created_at": "2026-02-18T10:30:00.000000"
  }
]
```

---

### Delete Tailored Resume

Delete a tailored resume.

```
DELETE /api/tailor/{tailored_id}
```

**Response (204 No Content):**

No response body.

---

# Semantic Match API

**Base Path:** `/v1/match`

**Authentication:** All endpoints require authentication.

The Semantic Match API uses vector embeddings to find the most relevant content blocks from your vault that match job requirements.

## Endpoints

### Semantic Search

Find blocks matching a job description.

```
POST /v1/match
```

**Request Body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `job_description` | string | Required | Job description text |
| `limit` | integer | 10 | Max results (1-100) |
| `block_types` | string[] | All | Filter by block types |
| `tags` | string[] | None | Filter by tags |

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
        "tags": ["architecture", "leadership"],
        ...
      },
      "score": 0.89,
      "matched_keywords": ["architecture", "leadership", "scalable"]
    },
    {
      "block": {
        "id": "880e8400-e29b-41d4-a716-446655440002",
        "content": "Managed team of 5 engineers, conducting code reviews and mentoring junior developers",
        "block_type": "RESPONSIBILITY",
        "tags": ["leadership", "mentoring"],
        ...
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

```
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

```
GET /v1/match/job/{job_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | UUID | Job posting identifier |

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `limit` | integer | 10 |

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
  resume_id: string;  // UUID
  job_id: string;     // UUID
}
```

### TailorResponse

```typescript
{
  id: string;                    // UUID
  resume_id: string;             // UUID
  job_id: string;                // UUID
  tailored_content: string;      // Optimized resume text
  suggestions: string[];         // Improvement suggestions
  match_score: number;           // 0-100
  skill_matches: SkillMatch[];
  skill_gaps: SkillGap[];
  keyword_coverage: number;      // 0-1
  created_at: string;
}
```

### QuickMatchResponse

```typescript
{
  match_score: number;           // 0-100
  keyword_coverage: number;      // 0-1
  skill_matches: SkillMatch[];
  skill_gaps: SkillGap[];
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
|----------|-----------|----------|
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

- [Resumes](180226_resumes.md) - Manage source resumes
- [Jobs](180226_jobs.md) - Manage job postings
- [Blocks](180226_blocks.md) - Manage content blocks
- [Export](180226_upload-export.md) - Export tailored resumes
