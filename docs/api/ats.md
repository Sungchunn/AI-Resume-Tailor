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

**What it checks:**

- Standard section headers (Experience, Education, Skills, etc.)
- Contact information presence
- **Section order validation** - Some ATS systems like Taleo penalize non-standard section ordering
- Formatting issues that may cause parsing problems

**Section Order Scoring:**

- **100 (standard):** Contact → Summary → Experience → Education → Skills → Certifications
- **95 (minor):** Skills before Education
- **85 (major):** Education before Experience, or Contact not first
- **75 (non_standard):** Completely non-standard ordering

**Request Body:**

| Field | Type | Required | Description |
| ----- | ------ | ---------- | ------------- |
| `resume_content` | object | Yes | Parsed resume content as dictionary |

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
  "section_order_score": 100,
  "section_order_details": {
    "detected_order": ["contact", "experience", "skills"],
    "expected_order": ["contact", "experience", "skills"],
    "deviation_type": "standard",
    "issues": []
  },
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
| ------ | ------ | -------- | ----------- |
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
| ------ | ------ | -------- | ----------- |
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

### Analyze Keywords (Enhanced - Stage 2)

Perform comprehensive keyword analysis with weighted scoring based on placement, density, recency, and importance tiers.

This is the most sophisticated keyword analysis endpoint, implementing the full Stage 2 scoring pipeline.

```http
POST /v1/ats/keywords/enhanced
```

**Scoring Factors:**

| Factor | Description | Weights |
| ------ | ----------- | ------- |
| **Placement (2.1)** | Where keywords appear in resume | Experience: 1.0x, Projects: 0.9x, Skills: 0.7x, Summary: 0.6x, Education: 0.5x |
| **Density (2.2)** | Repetition with diminishing returns | 1 occ: 1.0x, 2 occ: 1.3x, 3+ occ: 1.5x (capped) |
| **Recency (2.3)** | Recent roles weighted higher | Recent 2 roles: 2.0x, Third: 1.0x, Older: 0.8x |
| **Importance (2.4)** | Keyword importance tier | Required: 3.0x, Strongly Preferred: 2.0x, Preferred: 1.5x, Nice to Have: 1.0x |

**Request Body:**

| Field | Type | Required | Description |
| ------ | ------ | -------- | ----------- |
| `job_description` | string | Yes | Job description to match against (min 50 chars) |
| `resume_id` | number | No | Resume ID (uses parsed_content from database) |
| `resume_content` | object | No | Parsed resume content as dictionary (fallback) |

**Note:** Either `resume_id` or `resume_content` must be provided.

**Example Request:**

```bash
curl -X POST http://localhost:8000/v1/ats/keywords/enhanced \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_description": "Looking for a Senior Engineer with Python, AWS, Kubernetes. Required: 5+ years Python, AWS certification strongly preferred. Nice to have: Go, Terraform.",
    "resume_id": 123
  }'
```

**Response (200 OK):**

```json
{
  "keyword_score": 78.5,
  "raw_coverage": 65.0,
  "required_coverage": 0.80,
  "strongly_preferred_coverage": 1.00,
  "preferred_coverage": 0.50,
  "nice_to_have_coverage": 0.00,
  "placement_contribution": 5.2,
  "density_contribution": 8.3,
  "recency_contribution": 12.1,
  "required_matched": ["Python", "AWS", "Senior"],
  "required_missing": ["Kubernetes"],
  "strongly_preferred_matched": ["AWS certification"],
  "strongly_preferred_missing": [],
  "preferred_matched": [],
  "preferred_missing": ["team leadership"],
  "nice_to_have_matched": [],
  "nice_to_have_missing": ["Go", "Terraform"],
  "missing_available_in_vault": ["Kubernetes", "team leadership"],
  "missing_not_in_vault": ["Go", "Terraform"],
  "gap_list": [
    {
      "keyword": "Kubernetes",
      "importance": "required",
      "in_vault": true,
      "suggestion": "Add 'Kubernetes' from your vault"
    },
    {
      "keyword": "team leadership",
      "importance": "preferred",
      "in_vault": true,
      "suggestion": "Add 'team leadership' from your vault"
    },
    {
      "keyword": "Go",
      "importance": "nice_to_have",
      "in_vault": false,
      "suggestion": "Consider gaining experience with 'Go'"
    }
  ],
  "all_keywords": [
    {
      "keyword": "Python",
      "importance": "required",
      "found_in_resume": true,
      "found_in_vault": true,
      "frequency_in_job": 2,
      "context": "...5+ years Python experience...",
      "matches": [
        {
          "section": "experience",
          "role_index": 0,
          "text_snippet": "Built Python applications on AWS"
        },
        {
          "section": "skills",
          "role_index": null,
          "text_snippet": "Python"
        }
      ],
      "occurrence_count": 4,
      "base_score": 1.0,
      "placement_score": 1.0,
      "density_score": 1.5,
      "recency_score": 2.0,
      "importance_weight": 3.0,
      "weighted_score": 9.0
    }
  ],
  "suggestions": [
    "CRITICAL: Add 'Kubernetes' (required) from your TechCorp experience",
    "Add 'team leadership' (preferred) from your vault"
  ],
  "warnings": [
    "Missing 1 required keywords. Focus on adding these to your resume.",
    "2 keywords not found in your vault. Consider if you have transferable skills."
  ]
}
```

**Score Interpretation:**

| Score | Rating | Description |
| ----- | ------ | ----------- |
| 90+ | Excellent | Strong match with bonus from placement, density, and recency |
| 75-89 | Good | Solid match, minor gaps |
| 60-74 | Fair | Missing important keywords or poor placement |
| < 60 | Poor | Significant gaps, especially in required keywords |

**Key Differences from `/keywords/detailed`:**

| Feature | `/keywords/detailed` | `/keywords/enhanced` |
| ------- | -------------------- | -------------------- |
| Importance Tiers | 3 (required, preferred, nice_to_have) | 4 (adds strongly_preferred) |
| Placement Weighting | No | Yes (experience > skills) |
| Density Scoring | No | Yes (diminishing returns) |
| Recency Weighting | No | Yes (recent roles weighted higher) |
| Score Range | 0-1 coverage | 0-100+ weighted score |
| Gap Analysis | Basic | Prioritized with suggestions |

---

### Knockout Check (Stage 0)

Perform knockout check to identify binary disqualifiers before scoring.

This is Stage 0 of the ATS scoring pipeline. It identifies hard disqualifiers that would cause automatic rejection by most ATS systems BEFORE calculating the actual match score.

```http
POST /v1/ats/knockout-check
```

**What it checks:**

- **Years of experience** vs. job requirement
- **Education level** vs. job requirement
- **Required certifications** presence on resume
- **Location/work authorization** compatibility

**Request Body:**

| Field | Type | Required | Description |
| ------ | ------ | -------- | ----------- |
| `resume_id` | number | No | Resume ID to analyze (uses parsed_content from database) |
| `job_id` | number | No | Job description ID to analyze against |
| `resume_content` | string | No | Raw resume text (fallback if resume_id not provided) |
| `job_description` | string | No | Raw job description text (fallback if job_id not provided) |

**Note:** Either `resume_id` or `resume_content` must be provided. Either `job_id` or `job_description` must be provided. If both ID and content are provided, IDs take precedence.

**Example Request (Using IDs):**

```bash
curl -X POST http://localhost:8000/v1/ats/knockout-check \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_id": 123,
    "job_id": 456
  }'
```

**Example Request (Using Raw Content):**

```bash
curl -X POST http://localhost:8000/v1/ats/knockout-check \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_content": "John Doe\nSoftware Engineer\n\nExperience:\nStartupInc (Jan 2023 - Present)...\n\nEducation:\nBachelor'\''s in CS...",
    "job_description": "Senior Software Engineer\n\nRequirements:\n- 5+ years of experience\n- Bachelor'\''s degree in Computer Science\n- AWS Certified Solutions Architect required..."
  }'
```

**Response (200 OK) - No Risks:**

```json
{
  "passes_all_checks": true,
  "risks": [],
  "summary": "No knockout risks detected. You meet the basic qualifications.",
  "recommendation": "Proceed with optimizing your resume for keyword matching.",
  "analysis": {
    "experience": {
      "user_years": 7.5,
      "required_years": 5,
      "risk": null
    },
    "education": {
      "user_level": "bachelors",
      "required_level": "bachelors",
      "risk": null
    },
    "certifications": {
      "user_certifications": ["AWS Certified Solutions Architect"],
      "required_certifications": [{"name": "AWS Certified Solutions Architect", "importance": "required"}],
      "matched": ["AWS Certified Solutions Architect"],
      "missing": [],
      "risks": []
    },
    "location": {
      "user_location": "San Francisco, CA",
      "job_location": "San Francisco, CA",
      "remote_type": "hybrid",
      "risk": null
    }
  }
}
```

**Response (200 OK) - With Risks:**

```json
{
  "passes_all_checks": false,
  "risks": [
    {
      "risk_type": "experience_years",
      "severity": "critical",
      "description": "Role requires 5+ years of experience, your resume shows ~1.2 years.",
      "job_requires": "5+ years",
      "user_has": "~1.2 years"
    },
    {
      "risk_type": "certification",
      "severity": "critical",
      "description": "AWS Certified Solutions Architect is listed as required but not found on your resume.",
      "job_requires": "AWS Certified Solutions Architect (required)",
      "user_has": null
    }
  ],
  "summary": "2 potential knockout risk(s) detected (2 critical).",
  "recommendation": "Address the critical risks before applying, or consider roles better matched to your current qualifications.",
  "analysis": {
    "experience": {
      "user_years": 1.2,
      "required_years": 5,
      "risk": {...}
    },
    "education": {...},
    "certifications": {...},
    "location": {...}
  }
}
```

**Risk Types:**

| Type | Description |
| --------- | ----------- |
| `experience_years` | User's years of experience don't meet job requirement |
| `education_level` | User's education level is below job requirement |
| `certification` | Required/preferred certification not found on resume |
| `location` | Location mismatch for on-site roles |
| `work_authorization` | Work authorization issues detected |

**Severity Levels:**

| Severity | Description |
| -------- | ----------- |
| `critical` | Likely auto-rejection by ATS. Large gaps in requirements. |
| `warning` | May affect application. Small gaps or preferred requirements. |
| `info` | Informational note, unlikely to cause rejection. |

**Response Interpretation:**

- `passes_all_checks: true` - No knockout risks, proceed to keyword analysis
- `passes_all_checks: false` - Review the risks before applying
- `severity: critical` - Likely auto-rejection by ATS
- `severity: warning` - May affect application, worth addressing

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
  format_score: number;           // 0-100 score (incorporates section order)
  sections_found: string[];       // Detected sections
  sections_missing: string[];     // Missing recommended sections
  section_order_score: number;    // 75-100 score for section ordering
  section_order_details: SectionOrderDetails;  // Detailed order analysis
  warnings: string[];             // Potential issues
  suggestions: string[];          // Improvement suggestions
}
```

### SectionOrderDetails

```typescript
{
  detected_order: string[];       // Sections in order they appear
  expected_order: string[];       // Expected standard order for detected sections
  deviation_type: "standard" | "minor" | "major" | "non_standard";
  issues: string[];               // Specific order issues found
}
```

**Section Order Scoring:**

| Deviation Type | Score | Example |
| -------------- | ----- | ------- |
| `standard` | 100 | Contact → Summary → Experience → Education → Skills |
| `minor` | 95 | Skills appearing before Education |
| `major` | 85 | Education appearing before Experience, or Contact not first |
| `non_standard` | 75 | Completely non-standard ordering |

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

### ATSKeywordEnhancedRequest

```typescript
{
  job_description: string;        // Job description (min 50 chars)
  resume_id?: number;             // Resume ID from database
  resume_content?: object;        // Parsed resume content as dictionary
}
```

### ATSKeywordEnhancedResponse

```typescript
{
  // Overall scores
  keyword_score: number;          // 0-100+ weighted score
  raw_coverage: number;           // 0-100 simple coverage percentage

  // Coverage by importance tier (0-1)
  required_coverage: number;
  strongly_preferred_coverage: number;
  preferred_coverage: number;
  nice_to_have_coverage: number;

  // Score breakdown - how much each factor contributed
  placement_contribution: number;   // Percentage from placement weighting
  density_contribution: number;     // Percentage from density scoring
  recency_contribution: number;     // Percentage from recency weighting

  // Grouped by importance
  required_matched: string[];
  required_missing: string[];
  strongly_preferred_matched: string[];
  strongly_preferred_missing: string[];
  preferred_matched: string[];
  preferred_missing: string[];
  nice_to_have_matched: string[];
  nice_to_have_missing: string[];

  // Vault availability
  missing_available_in_vault: string[];
  missing_not_in_vault: string[];

  // Gap analysis prioritized by importance
  gap_list: GapAnalysisItem[];

  // Full keyword details
  all_keywords: EnhancedKeywordDetail[];

  // Suggestions and warnings
  suggestions: string[];
  warnings: string[];
}
```

### EnhancedKeywordDetail

```typescript
{
  keyword: string;
  importance: "required" | "strongly_preferred" | "preferred" | "nice_to_have";
  found_in_resume: boolean;
  found_in_vault: boolean;
  frequency_in_job: number;
  context: string | null;

  // Match details
  matches: KeywordMatchDetail[];
  occurrence_count: number;

  // Stage 2 scoring components
  base_score: number;             // 0 or 1 (presence)
  placement_score: number;        // Section weight (0.5-1.0)
  density_score: number;          // Occurrence multiplier (1.0-1.5)
  recency_score: number;          // Role position weight (0.8-2.0)
  importance_weight: number;      // Importance tier multiplier (1.0-3.0)
  weighted_score: number;         // Final combined score
}
```

### KeywordMatchDetail

```typescript
{
  section: string;                // Where match was found (experience, skills, etc.)
  role_index: number | null;      // Role position (0 = most recent) if in experience
  text_snippet: string | null;    // Text context around the match
}
```

### GapAnalysisItem

```typescript
{
  keyword: string;
  importance: "required" | "strongly_preferred" | "preferred" | "nice_to_have";
  in_vault: boolean;
  suggestion: string;
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

### KnockoutCheckRequest

```typescript
{
  resume_id?: number;           // Resume ID from database
  job_id?: number;              // Job description ID from database
  resume_content?: string;      // Raw resume text (fallback)
  job_description?: string;     // Raw job description (fallback)
}
```

### KnockoutCheckResponse

```typescript
{
  passes_all_checks: boolean;   // True if no knockout risks detected
  risks: KnockoutRisk[];        // List of detected risks
  summary: string;              // Human-readable summary
  recommendation: string;       // Recommended action
  analysis: {                   // Detailed breakdown
    experience: ExperienceAnalysis;
    education: EducationAnalysis;
    certifications: CertificationAnalysis;
    location: LocationAnalysis;
  };
}
```

### KnockoutRisk

```typescript
{
  risk_type: "experience_years" | "education_level" | "certification" | "location" | "work_authorization";
  severity: "critical" | "warning" | "info";
  description: string;          // Human-readable description
  job_requires: string;         // What the job posting requires
  user_has: string | null;      // What the user's resume shows
}
```

## Scoring Guide

### Format Score

| Score | Rating | Description |
| ------- | --------- | ----------- |
| 90-100 | Excellent | ATS-optimized, all sections present |
| 75-89 | Good | Minor improvements needed |
| 60-74 | Fair | Several issues to address |
| < 60 | Poor | Significant restructuring needed |

### Keyword Coverage

| Coverage | Rating | Description |
| -------- | --------- | ----------- |
| 75%+ | Excellent | High match rate |
| 60-74% | Good | Competitive match |
| 45-59% | Fair | May be filtered out |
| < 45% | Poor | Likely to be rejected |

## Usage Notes

- **Start with Knockout Check** - Run `/knockout-check` first to identify hard disqualifiers before investing time in keyword optimization
- Run structure analysis to identify formatting issues
- Keyword analysis should be done against specific job descriptions
- Use vault checking to find missing content you already have
- Tips endpoint is useful for general guidance without specific analysis

### Recommended Workflow

1. **Knockout Check** (`/knockout-check`) - Identify deal-breakers first
2. **Structure Analysis** (`/structure`) - Ensure ATS-parseable format
3. **Enhanced Keyword Analysis** (`/keywords/enhanced`) - Get comprehensive scoring with placement, density, and recency factors (Stage 2)
4. **Apply fixes** using prioritized gap analysis and re-run checks as needed

**Alternative:** Use `/keywords/detailed` for simpler analysis without Stage 2 weighting factors.

## Related Endpoints

- [Blocks](blocks.md) - Manage content blocks
- [Tailor](tailor-match.md) - Create tailored resumes
- [Resume Builds](resume-builds.md) - Build resumes with vault content
