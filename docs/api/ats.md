# ATS Analysis API

## Overview

The ATS (Applicant Tracking System) Analysis API provides tools to optimize resumes for automated screening systems. These endpoints analyze resume structure, keyword coverage, and provide actionable suggestions for improvement.

**Base Path:** `/v1/ats`

**Authentication:** All endpoints require authentication.

---

## Endpoints

### Analyze Structure

Analyze resume structure for ATS compatibility.

```http
POST /v1/ats/structure
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Resume content to analyze |
| `format` | string | No | Content format (text, html, markdown) |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/ats/structure \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "John Doe\nSenior Software Engineer\n\nExperience:\n- TechCorp (2022-Present)...\n\nSkills:\n- Python, AWS..."
  }'
```

**Response (200 OK):**

```json
{
  "format_score": 85,
  "sections_found": [
    "contact",
    "experience",
    "skills"
  ],
  "sections_missing": [
    "education",
    "summary"
  ],
  "warnings": [
    "No education section found - many ATS systems filter by education",
    "Consider adding a professional summary at the top"
  ],
  "suggestions": [
    "Add an education section with degree and institution",
    "Include a brief professional summary (2-3 sentences)",
    "Use standard section headers (Experience, Education, Skills)",
    "Avoid tables, images, or complex formatting"
  ]
}
```

---

### Analyze Keywords

Analyze keyword coverage against job requirements.

```http
POST /v1/ats/keywords
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resume_content` | string | Yes | Resume content |
| `job_description` | string | Yes | Job description to match against |
| `include_vault` | boolean | No | Check vault for missing keywords |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/ats/keywords \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_content": "John Doe\nSenior Software Engineer\n\nPython developer with AWS experience...",
    "job_description": "Looking for a Senior Engineer with Python, AWS, Kubernetes, and team leadership experience...",
    "include_vault": true
  }'
```

**Response (200 OK):**

```json
{
  "keyword_coverage": 0.65,
  "matched_keywords": [
    {
      "keyword": "Python",
      "frequency_in_resume": 3,
      "importance": "required",
      "context": "Python developer with 5+ years experience"
    },
    {
      "keyword": "AWS",
      "frequency_in_resume": 2,
      "importance": "required",
      "context": "AWS experience including EC2, S3"
    },
    {
      "keyword": "Senior",
      "frequency_in_resume": 1,
      "importance": "required",
      "context": "Senior Software Engineer"
    }
  ],
  "missing_keywords": [
    {
      "keyword": "Kubernetes",
      "importance": "required",
      "suggestion": "Add Kubernetes experience if applicable"
    },
    {
      "keyword": "team leadership",
      "importance": "preferred",
      "suggestion": "Include examples of team leadership or mentoring"
    }
  ],
  "missing_from_vault": [
    {
      "keyword": "Kubernetes",
      "found_in_vault": false,
      "suggestion": "Consider adding a block about container orchestration experience"
    }
  ],
  "warnings": [
    "Only 65% keyword match - aim for 75%+ for best ATS results"
  ],
  "suggestions": [
    "Add 'Kubernetes' if you have relevant experience",
    "Include team leadership examples in your experience bullets",
    "Mirror exact phrases from the job description when accurate"
  ]
}
```

---

### Analyze Keywords (Detailed)

Perform detailed keyword analysis with importance levels and grouping.

```http
POST /v1/ats/keywords/detailed
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_description` | string | Yes | Job description to match against (min 50 chars) |
| `resume_content` | string | No | Resume text content to analyze |
| `resume_block_ids` | number[] | No | Block IDs to use for resume content |

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/ats/keywords/detailed \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_description": "Looking for a Senior Engineer with Python, AWS, Kubernetes, and team leadership experience. Required: 5+ years Python, AWS certification. Preferred: Kubernetes experience, CI/CD pipelines. Nice to have: Go, Terraform.",
    "resume_content": "John Doe\nSenior Software Engineer\n\nPython developer with AWS experience..."
  }'
```

**Response (200 OK):**

```json
{
  "coverage_score": 0.65,
  "required_coverage": 0.75,
  "preferred_coverage": 0.50,
  "required_matched": ["Python", "AWS", "Senior"],
  "required_missing": ["Kubernetes"],
  "preferred_matched": ["CI/CD"],
  "preferred_missing": ["team leadership"],
  "nice_to_have_matched": [],
  "nice_to_have_missing": ["Go", "Terraform"],
  "missing_available_in_vault": ["Kubernetes", "team leadership"],
  "missing_not_in_vault": ["Go", "Terraform"],
  "all_keywords": [
    {
      "keyword": "Python",
      "importance": "required",
      "found_in_resume": true,
      "found_in_vault": true,
      "frequency_in_job": 2,
      "context": "...Required: 5+ years Python, AWS..."
    },
    {
      "keyword": "Kubernetes",
      "importance": "required",
      "found_in_resume": false,
      "found_in_vault": true,
      "frequency_in_job": 1,
      "context": "...Preferred: Kubernetes experience..."
    }
  ],
  "suggestions": [
    "Add 'Kubernetes' (required) from your TechCorp experience",
    "Add 'team leadership' (preferred) from your vault"
  ],
  "warnings": [
    "Only 75% of required keywords found. This may significantly reduce your chances."
  ]
}
```

**Notes:**
- If neither `resume_content` nor `resume_block_ids` is provided, all vault blocks are used
- Keywords are categorized by importance: `required`, `preferred`, `nice_to_have`
- Missing keywords are checked against the user's vault for availability

---

### Get ATS Tips

Get general ATS optimization tips and best practices.

```http
GET /v1/ats/tips
```

**Example Request:**

```bash
curl http://localhost:8000/v1/ats/tips \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**

```json
{
  "formatting_tips": [
    "Use a clean, single-column layout",
    "Avoid tables, text boxes, headers/footers",
    "Use standard fonts (Arial, Calibri, Times New Roman)",
    "Save as PDF to preserve formatting, or DOCX for editing",
    "Use standard section headers (Experience, Education, Skills)"
  ],
  "content_tips": [
    "Include exact keywords from the job description",
    "Spell out acronyms at least once (e.g., 'Applicant Tracking System (ATS)')",
    "Use bullet points for easy parsing",
    "Quantify achievements with numbers and percentages",
    "Include both hard skills and soft skills"
  ],
  "section_tips": [
    "Contact information: Include name, phone, email, LinkedIn",
    "Summary: 2-3 sentences highlighting your value proposition",
    "Experience: Reverse chronological order, include dates",
    "Skills: List technical skills matching job requirements",
    "Education: Include degree, institution, graduation year"
  ],
  "common_mistakes": [
    "Using images or graphics for important information",
    "Fancy fonts or unusual formatting",
    "Missing contact information",
    "Incorrect file format (always use PDF or DOCX)",
    "Keyword stuffing (unnaturally high keyword density)"
  ]
}
```

---

## Data Models

### ATSStructureRequest

```typescript
{
  content: string;          // Resume content to analyze
  format?: string;          // Content format (text, html, markdown)
}
```

### ATSStructureResponse

```typescript
{
  format_score: number;           // 0-100 score
  sections_found: string[];       // Detected sections
  sections_missing: string[];     // Missing recommended sections
  warnings: string[];             // Potential issues
  suggestions: string[];          // Improvement suggestions
}
```

### ATSKeywordRequest

```typescript
{
  resume_content: string;         // Resume content
  job_description: string;        // Job description to match
  include_vault?: boolean;        // Check vault for missing keywords
}
```

### ATSKeywordResponse

```typescript
{
  keyword_coverage: number;       // 0-1 coverage ratio
  matched_keywords: KeywordMatch[];
  missing_keywords: MissingKeyword[];
  missing_from_vault?: VaultKeyword[];
  warnings: string[];
  suggestions: string[];
}
```

### KeywordMatch

```typescript
{
  keyword: string;
  frequency_in_resume: number;
  importance: string;             // "required" | "preferred" | "bonus"
  context: string;                // Where keyword was found
}
```

### MissingKeyword

```typescript
{
  keyword: string;
  importance: string;             // "required" | "preferred" | "bonus"
  suggestion: string;             // How to add this keyword
}
```

### VaultKeyword

```typescript
{
  keyword: string;
  found_in_vault: boolean;
  suggestion: string;
}
```

### ATSKeywordDetailedRequest

```typescript
{
  job_description: string;        // Job description (min 50 chars)
  resume_content?: string;        // Resume text content to analyze
  resume_block_ids?: number[];    // Block IDs to use for resume
}
```

### ATSKeywordDetailedResponse

```typescript
{
  coverage_score: number;                // 0-1 overall coverage
  required_coverage: number;             // 0-1 required keywords coverage
  preferred_coverage: number;            // 0-1 preferred keywords coverage

  // Grouped by importance
  required_matched: string[];
  required_missing: string[];
  preferred_matched: string[];
  preferred_missing: string[];
  nice_to_have_matched: string[];
  nice_to_have_missing: string[];

  // Vault availability
  missing_available_in_vault: string[];  // Can be added from vault
  missing_not_in_vault: string[];        // User lacks this experience

  // Full keyword details
  all_keywords: KeywordDetail[];

  // Suggestions and warnings
  suggestions: string[];
  warnings: string[];
}
```

### KeywordDetail

```typescript
{
  keyword: string;
  importance: "required" | "preferred" | "nice_to_have";
  found_in_resume: boolean;
  found_in_vault: boolean;
  frequency_in_job: number;       // Times appearing in job description
  context: string | null;         // Sample context from job description
}
```

### ATSTipsResponse

```typescript
{
  formatting_tips: string[];
  content_tips: string[];
  section_tips: string[];
  common_mistakes: string[];
}
```

## Scoring Guide

### Format Score

| Score | Rating | Description |
|-------|--------|-------------|
| 90-100 | Excellent | ATS-optimized, all sections present |
| 75-89 | Good | Minor improvements needed |
| 60-74 | Fair | Several issues to address |
| < 60 | Poor | Significant restructuring needed |

### Keyword Coverage

| Coverage | Rating | Description |
|----------|--------|-------------|
| 75%+ | Excellent | High match rate |
| 60-74% | Good | Competitive match |
| 45-59% | Fair | May be filtered out |
| < 45% | Poor | Likely to be rejected |

## Usage Notes

- Run structure analysis first to identify formatting issues
- Keyword analysis should be done against specific job descriptions
- Use vault checking to find missing content you already have
- Tips endpoint is useful for general guidance without specific analysis

## Related Endpoints

- [Blocks](blocks.md) - Manage content blocks
- [Tailor](tailor-match.md) - Create tailored resumes
- [Resume Builds](resume-builds.md) - Build resumes with vault content
