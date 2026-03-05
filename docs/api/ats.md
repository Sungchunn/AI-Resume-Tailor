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

### Analyze Content Quality (Stage 3)

Perform content quality analysis on resume bullets.

This is Stage 3 of the ATS scoring pipeline. It analyzes the quality of resume content across three dimensions: block type distribution, quantification density, and action verb usage.

```http
POST /v1/ats/content-quality
```

**What it analyzes:**

- **Block Type Distribution (40% weight):** Ratio of achievement-oriented vs responsibility-oriented bullets
- **Quantification Density (35% weight):** Percentage of bullets containing measurable metrics
- **Action Verb Usage (25% weight):** Strong action verbs vs weak/passive phrases

**Request Body:**

| Field | Type | Required | Description |
| ------ | ------ | -------- | ----------- |
| `resume_id` | number | No | Resume ID to analyze (uses parsed_content from database) |
| `resume_content` | object | No | Parsed resume content as dictionary (fallback) |

**Note:** Either `resume_id` or `resume_content` must be provided. `resume_id` takes precedence.

**Example Request (Using Resume ID):**

```bash
curl -X POST http://localhost:8000/v1/ats/content-quality \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_id": 123
  }'
```

**Example Request (Using Content):**

```bash
curl -X POST http://localhost:8000/v1/ats/content-quality \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_content": {
      "experience": [
        {
          "title": "Senior Software Engineer",
          "company": "TechCorp",
          "bullets": [
            "Led team of 5 engineers to deliver ML pipeline, reducing inference latency by 60%",
            "Built microservices architecture serving 1M+ daily requests",
            "Responsible for backend maintenance"
          ]
        }
      ]
    }
  }'
```

**Response (200 OK):**

```json
{
  "content_quality_score": 78.5,
  "block_type_score": 85.0,
  "quantification_score": 72.0,
  "action_verb_score": 80.0,
  "block_type_weight": 0.4,
  "quantification_weight": 0.35,
  "action_verb_weight": 0.25,
  "block_type_analysis": {
    "total_bullets": 6,
    "achievement_count": 3,
    "responsibility_count": 2,
    "project_count": 1,
    "other_count": 0,
    "achievement_ratio": 0.67,
    "quality_score": 100.0
  },
  "quantification_analysis": {
    "total_bullets": 6,
    "quantified_bullets": 3,
    "quantification_density": 0.5,
    "quality_score": 100.0,
    "metrics_found": ["60%", "1m+", "5"],
    "bullets_needing_metrics": [
      "Built new authentication system..."
    ]
  },
  "action_verb_analysis": {
    "total_bullets": 6,
    "bullets_with_action_verbs": 5,
    "bullets_with_weak_phrases": 1,
    "action_verb_coverage": 0.833,
    "weak_phrase_ratio": 0.167,
    "quality_score": 87.0,
    "verb_category_distribution": {
      "leadership": 2,
      "creation": 2,
      "improvement": 1
    }
  },
  "total_bullets_analyzed": 6,
  "high_quality_bullets": 4,
  "low_quality_bullets": 1,
  "suggestions": [
    "Your achievement/responsibility ratio is excellent.",
    "Strong quantification: 3/6 bullets contain measurable metrics."
  ],
  "warnings": [
    "17% of your bullets contain weak phrases like 'Responsible for' or 'Assisted with'. Replace with action-oriented language."
  ]
}
```

**Quantification Patterns Detected:**

| Pattern | Examples |
| ------- | -------- |
| Percentages | `40%`, `40 percent` |
| Currency | `$50K`, `$1.2M`, `$50,000` |
| User counts | `100K users`, `1M customers` |
| Multiples | `3x improvement`, `2x faster` |
| Time metrics | `2 hours`, `15 minutes` |
| Rankings | `top 5`, `#1 ranking` |
| Fractions | `4 out of 5`, `8 to 10` |

**Action Verb Categories:**

| Category | Examples |
| -------- | -------- |
| Leadership | Led, Managed, Directed, Mentored |
| Achievement | Achieved, Delivered, Exceeded, Won |
| Creation | Built, Created, Designed, Launched |
| Improvement | Improved, Optimized, Increased, Reduced |
| Analysis | Analyzed, Evaluated, Researched, Identified |
| Influence | Negotiated, Collaborated, Presented |

**Weak Phrases to Avoid:**

- "Responsible for..."
- "Duties included..."
- "Assisted with..."
- "Helped with..."
- "Worked on..."
- "Involved in..."
- "Participated in..."

**Scoring Thresholds:**

| Metric | Target | Description |
| ------ | ------ | ----------- |
| Achievement Ratio | 60%+ | High-value bullets (achievements + projects) |
| Quantification Density | 50%+ | Bullets with measurable metrics |
| Action Verb Coverage | 80%+ | Bullets with strong action verbs |
| Weak Phrase Ratio | <20% | Bullets with weak/passive phrases |

**Score Interpretation:**

| Score | Rating | Description |
| ----- | ------ | ----------- |
| 85+ | Excellent | Strong, achievement-oriented content with metrics |
| 70-84 | Good | Solid content with some room for improvement |
| 50-69 | Fair | Needs more quantification or achievement focus |
| < 50 | Poor | Responsibility-heavy content lacking metrics |

---

### Analyze Role Proximity (Stage 4)

Analyze how closely the candidate's career trajectory aligns with the target role.

This is Stage 4 of the ATS scoring pipeline. It goes beyond keyword matching to assess whether the candidate is a realistic fit based on their career progression.

```http
POST /v1/ats/role-proximity
```

**Why This Matters:**

A candidate can have 95% keyword match but still be wrong for the role if there's a significant level mismatch or function change. Role proximity explains why high keyword scores don't always translate to ATS success.

**What it analyzes:**

- **Title Match (Base Score 0-100):** Semantic similarity between current and target job titles
- **Career Trajectory (Modifier -20 to +20):** Is this a logical next step in the candidate's career?
- **Industry Alignment (Modifier 0 to +10):** Same industry, adjacent, or unrelated?

**Request Body:**

| Field | Type | Required | Description |
| ------ | ------ | -------- | ----------- |
| `resume_id` | number | No | Resume ID (uses parsed_content from database) |
| `job_id` | number | No | Job description ID to analyze against |
| `resume_content` | object | No | Parsed resume content (fallback if resume_id not provided) |
| `job_content` | object | No | Parsed job content (fallback if job_id not provided) |

**Note:** Either `resume_id` or `resume_content` must be provided. Either `job_id` or `job_content` must be provided.

**Example Request (Using IDs):**

```bash
curl -X POST http://localhost:8000/v1/ats/role-proximity \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_id": 123,
    "job_id": 456
  }'
```

**Example Request (Using Content):**

```bash
curl -X POST http://localhost:8000/v1/ats/role-proximity \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_content": {
      "experience": [
        {"title": "Senior Software Engineer", "company": "TechCorp"},
        {"title": "Software Engineer", "company": "StartupInc"}
      ]
    },
    "job_content": {
      "title": "Staff Software Engineer",
      "company": "BigTech"
    }
  }'
```

**Response (200 OK):**

```json
{
  "role_proximity_score": 95.2,
  "title_match": {
    "resume_title": "Senior Software Engineer",
    "job_title": "Staff Software Engineer",
    "normalized_resume_title": "senior software engineer",
    "normalized_job_title": "staff software engineer",
    "similarity_score": 0.85,
    "title_score": 85.0,
    "resume_level": 3,
    "job_level": 4,
    "level_gap": 1,
    "resume_function": "engineering",
    "job_function": "engineering",
    "function_match": true
  },
  "trajectory": {
    "trajectory_type": "progressing_toward",
    "modifier": 20,
    "current_level": 3,
    "target_level": 4,
    "level_gap": 1,
    "level_progression": [1, 2, 3],
    "is_ascending": true,
    "function_match": true,
    "explanation": "This role is a natural next step in your career progression"
  },
  "industry_alignment": {
    "resume_industries": ["tech"],
    "most_recent_industry": "tech",
    "target_industry": "tech",
    "alignment_type": "same",
    "modifier": 10
  },
  "explanation": "Your title 'Senior Software Engineer' closely matches the target role 'Staff Software Engineer'. This role is a natural next step in your career progression. You have direct industry experience.",
  "concerns": [],
  "strengths": [
    "Strong title alignment with target role",
    "Target role is a natural next step (one level up)",
    "Career shows clear upward progression",
    "Direct tech industry experience"
  ]
}
```

**Trajectory Types:**

| Type | Modifier | Description |
| ---- | -------- | ----------- |
| `progressing_toward` | +20 | Natural next step up in the same function |
| `lateral` | +10 | Same level move in same function |
| `slight_stretch` | +5 | Two level jump, achievable with experience |
| `step_down` | -10 | Moving to lower level |
| `large_gap` | -15 | 3+ level jump, likely unrealistic |
| `career_change` | -5 | Different function (engineering → product) |
| `unclear` | 0 | Unable to determine trajectory |

**Level Hierarchy:**

| Level | Value | Examples |
| ----- | ----- | -------- |
| Intern | 0 | Intern Developer |
| Junior | 1 | Junior Engineer, Associate |
| Mid | 2 | Software Engineer, Developer |
| Senior | 3 | Senior Engineer, Senior Developer |
| Staff/Lead | 4 | Staff Engineer, Tech Lead |
| Principal/Manager | 5 | Principal Engineer, Engineering Manager |
| Director | 6 | Engineering Director, Head of Engineering |
| VP | 7 | VP of Engineering |
| C-Level | 8 | CTO, Chief Technology Officer |

**Function Categories:**

- `engineering` - Software Engineer, Developer, Architect
- `product` - Product Manager, Product Owner
- `design` - UX Designer, UI Designer
- `data` - Data Scientist, ML Engineer, Data Analyst
- `devops` - DevOps Engineer, SRE, Platform Engineer
- `qa` - QA Engineer, SDET, Automation Engineer
- `security` - Security Engineer, InfoSec, AppSec
- `management` - Manager, Director, VP
- `sales` - Sales, Account Executive, BDR
- `marketing` - Marketing, Growth, Content
- `support` - Customer Success, Solutions Engineer

**Industry Alignment:**

| Alignment | Modifier | Description |
| --------- | -------- | ----------- |
| `same` | +10 | Candidate has direct industry experience |
| `adjacent` | +5 | Related industry (fintech → finance) |
| `unrelated` | +0 | No industry overlap |

**Score Interpretation:**

| Score | Rating | Description |
| ----- | ------ | ----------- |
| 80-100 | Strong Fit | Title, trajectory, and industry align well |
| 60-79 | Good Fit | Minor gaps in level or function |
| 40-59 | Moderate Fit | Career change or level jump |
| 20-39 | Weak Fit | Significant mismatch |
| 0-19 | Poor Fit | Very different role type |

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

### ContentQualityRequest

```typescript
{
  resume_id?: number;           // Resume ID from database
  resume_content?: object;      // Parsed resume content as dictionary
}
```

### ContentQualityResponse

```typescript
{
  // Overall score
  content_quality_score: number;   // 0-100 weighted score

  // Component scores
  block_type_score: number;        // 0-100 block type distribution
  quantification_score: number;    // 0-100 quantification density
  action_verb_score: number;       // 0-100 action verb usage

  // Component weights
  block_type_weight: number;       // Weight applied (default 0.4)
  quantification_weight: number;   // Weight applied (default 0.35)
  action_verb_weight: number;      // Weight applied (default 0.25)

  // Detailed analyses
  block_type_analysis: BlockTypeAnalysis;
  quantification_analysis: QuantificationAnalysis;
  action_verb_analysis: ActionVerbAnalysis;

  // Summary stats
  total_bullets_analyzed: number;
  high_quality_bullets: number;    // Score > 0.7
  low_quality_bullets: number;     // Score < 0.4

  // Suggestions and warnings
  suggestions: string[];
  warnings: string[];
}
```

### BlockTypeAnalysis

```typescript
{
  total_bullets: number;
  achievement_count: number;       // Bullets with metrics/outcomes
  responsibility_count: number;    // Duty-focused bullets
  project_count: number;           // Creation-focused bullets
  other_count: number;
  achievement_ratio: number;       // 0-1 ratio of high-value bullets
  quality_score: number;           // 0-100 score
}
```

### QuantificationAnalysis

```typescript
{
  total_bullets: number;
  quantified_bullets: number;      // Bullets with metrics
  quantification_density: number;  // 0-1 ratio
  quality_score: number;           // 0-100 score
  metrics_found: string[];         // Extracted metrics (e.g., "40%", "$1M")
  bullets_needing_metrics: string[];  // Bullets to improve
}
```

### ActionVerbAnalysis

```typescript
{
  total_bullets: number;
  bullets_with_action_verbs: number;
  bullets_with_weak_phrases: number;
  action_verb_coverage: number;    // 0-1 ratio
  weak_phrase_ratio: number;       // 0-1 ratio (lower is better)
  quality_score: number;           // 0-100 score
  verb_category_distribution: {    // Count by category
    leadership?: number;
    achievement?: number;
    creation?: number;
    improvement?: number;
    analysis?: number;
    influence?: number;
  };
}
```

### RoleProximityRequest

```typescript
{
  resume_id?: number;           // Resume ID from database
  job_id?: number;              // Job description ID from database
  resume_content?: object;      // Parsed resume content (fallback)
  job_content?: object;         // Parsed job content (fallback)
}
```

### RoleProximityResponse

```typescript
{
  // Overall score
  role_proximity_score: number;    // 0-100 combined score

  // Component results
  title_match: TitleMatchResult;
  trajectory: TrajectoryResult;
  industry_alignment: IndustryAlignmentResult;

  // Human-readable summary
  explanation: string;

  // Actionable insights
  concerns: string[];              // e.g., ["Large level gap: 3 levels"]
  strengths: string[];             // e.g., ["Direct industry experience"]
}
```

### TitleMatchResult

```typescript
{
  resume_title: string;            // Most recent job title from resume
  job_title: string;               // Target job title
  normalized_resume_title: string; // Normalized resume title
  normalized_job_title: string;    // Normalized job title
  similarity_score: number;        // 0-1 semantic similarity
  title_score: number;             // 0-100 converted score
  resume_level: number;            // Extracted seniority level (0-8)
  job_level: number;               // Extracted seniority level (0-8)
  level_gap: number;               // job_level - resume_level
  resume_function: string;         // Functional category
  job_function: string;            // Functional category
  function_match: boolean;         // Whether functions match
}
```

### TrajectoryResult

```typescript
{
  trajectory_type: "progressing_toward" | "lateral" | "slight_stretch" |
                   "step_down" | "large_gap" | "career_change" | "unclear";
  modifier: number;                // Score modifier (-20 to +20)
  current_level: number;           // Most recent role level
  target_level: number;            // Target job level
  level_gap: number;               // target - current
  level_progression: number[];     // Historical levels (oldest to newest)
  is_ascending: boolean;           // Whether career is progressing upward
  function_match: boolean;         // Whether moving in same function
  explanation: string;             // Human-readable explanation
}
```

### IndustryAlignmentResult

```typescript
{
  resume_industries: string[];     // Industries detected from resume
  most_recent_industry: string;    // Industry from most recent role
  target_industry: string;         // Industry of target job
  alignment_type: "same" | "adjacent" | "unrelated";
  modifier: number;                // Score modifier (0 to +10)
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

1. **Knockout Check** (`/knockout-check`) - Stage 0: Identify deal-breakers first
2. **Structure Analysis** (`/structure`) - Stage 1: Ensure ATS-parseable format
3. **Enhanced Keyword Analysis** (`/keywords/enhanced`) - Stage 2: Get comprehensive scoring with placement, density, and recency factors
4. **Content Quality Analysis** (`/content-quality`) - Stage 3: Evaluate achievement ratio, quantification density, and action verb usage
5. **Role Proximity Analysis** (`/role-proximity`) - Stage 4: Assess career trajectory alignment with target role
6. **Apply fixes** using prioritized gap analysis and re-run checks as needed

**Alternative:** Use `/keywords/detailed` for simpler analysis without Stage 2 weighting factors.

## Related Endpoints

- [Blocks](blocks.md) - Manage content blocks
- [Tailor](tailor-match.md) - Create tailored resumes
- [Resume Builds](resume-builds.md) - Build resumes with vault content

---

## Progressive ATS Analysis (Server-Sent Events)

### POST `/api/v1/ats/analyze-progressive`

Runs complete ATS analysis with real-time progress updates via Server-Sent Events (SSE). This endpoint orchestrates all 5 ATS stages sequentially and streams progress events to the client in real-time.

**Query Parameters:**

- `resume_id` (optional): Resume database ID
- `job_id` (optional): Job database ID

**Request Body:** (multipart form-data)

Either provide `resume_id` + `job_id` or `resume_content` + `job_description`:

```json
{
  "resume_id": 123,
  "job_id": 456
}
```

or

```json
{
  "resume_content": {
    "experience": "...",
    "education": "..."
  },
  "job_description": "We are looking for..."
}
```

**Authentication:** Required (Bearer token in Authorization header)

**Response:** Server-Sent Events stream with the following event types:

#### Event: `stage_start`

Emitted when a stage begins processing.

```json
{
  "stage": 0,
  "stage_name": "Knockout Risk Check",
  "status": "running",
  "progress_percent": 0
}
```

#### Event: `stage_complete`

Emitted when a stage completes successfully. Includes full stage result data.

```json
{
  "stage": 0,
  "stage_name": "Knockout Risk Check",
  "status": "completed",
  "progress_percent": 20,
  "elapsed_ms": 485,
  "result": {
    "passes_all_checks": true,
    "risks": []
  }
}
```

#### Event: `stage_error`

Emitted when a stage fails. Analysis continues with remaining stages.

```json
{
  "stage": 2,
  "stage_name": "Keyword Matching",
  "status": "failed",
  "progress_percent": 40,
  "elapsed_ms": 2500,
  "error": "Failed to analyze keywords: AI service timeout"
}
```

#### Event: `score_calculation`

Emitted when composite score calculation begins.

```json
{
  "stage": 5,
  "stage_name": "Calculating Final Score",
  "status": "running",
  "progress_percent": 95
}
```

#### Event: `complete`

Emitted when all stages finish and composite score is calculated. This is the final event.

```json
{
  "stage": 5,
  "stage_name": "Complete",
  "status": "completed",
  "progress_percent": 100,
  "elapsed_ms": 8250,
  "composite_score": {
    "final_score": 82.5,
    "stage_breakdown": {
      "structure": 12.75,
      "keywords-enhanced": 36.0,
      "content-quality": 18.75,
      "role-proximity": 16.0
    },
    "weights_used": {
      "structure": 0.15,
      "keywords-enhanced": 0.40,
      "content-quality": 0.25,
      "role-proximity": 0.20
    },
    "normalization_applied": false,
    "failed_stages": []
  }
}
```

#### Event: `error`

Emitted if a fatal error occurs that aborts the entire analysis.

```json
{
  "error": "Fatal error during ATS analysis: Resume not found"
}
```

### Stage Execution Timeline

Stages execute sequentially to avoid overwhelming AI services:

| Stage | Name | Typical Duration | Description |
| ------- | ------- | ----------- | ----------- |
| 0 | Knockout Check | ~500ms | Binary hard requirement validation |
| 1 | Structure Analysis | ~200ms | Resume format and parsability (15% weight) |
| 2 | Keyword Matching | ~2-3s | Enhanced keyword matching (40% weight) |
| 3 | Content Quality | ~1s | Block classification and quantification (25% weight) |
| 4 | Role Proximity | ~2-3s | Title and trajectory matching (20% weight) |
| - | Final Calculation | ~50ms | Composite score calculation |

**Total Expected Duration:** 6-8 seconds

### Composite Score Calculation

The final score combines all stage results with these weights:

- **Structure:** 15%
- **Keywords:** 40%
- **Content Quality:** 25%
- **Role Proximity:** 20%

If a stage fails, remaining weights are renormalized to sum to 100%. For example, if Keywords (40%) fails, the remaining weights become:

- Structure: 15 ÷ 60 = 25%
- Content Quality: 25 ÷ 60 = 41.67%
- Role Proximity: 20 ÷ 60 = 33.33%

The `composite_score.normalization_applied` flag indicates when this renormalization occurred.

### Client Implementation Example

#### JavaScript/TypeScript

```javascript
const eventSource = new EventSource(
  '/api/v1/ats/analyze-progressive?resume_id=123&job_id=456',
  { withCredentials: true } // Include auth cookies
);

// Track progress
eventSource.addEventListener('stage_start', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Starting: ${data.stage_name}`);
  updateProgressBar(data.progress_percent);
});

// Show results as they complete
eventSource.addEventListener('stage_complete', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Completed: ${data.stage_name}`, data.result);
  displayStageResult(data);
});

// Handle stage failures gracefully
eventSource.addEventListener('stage_error', (e) => {
  const data = JSON.parse(e.data);
  console.warn(`Stage ${data.stage} failed: ${data.error}`);
  showWarning(`${data.stage_name} failed, continuing with remaining stages...`);
});

// Get final score
eventSource.addEventListener('complete', (e) => {
  const data = JSON.parse(e.data);
  console.log('Final ATS Score:', data.composite_score.final_score);
  displayFinalScore(data.composite_score);
  eventSource.close(); // Clean up
});

// Handle errors
eventSource.addEventListener('error', (e) => {
  const data = JSON.parse(e.data);
  console.error('Analysis failed:', data.error);
  eventSource.close();
  showError(data.error);
});

// Handle network errors
eventSource.onerror = (error) => {
  console.error('Connection error:', error);
  if (eventSource.readyState === EventSource.CLOSED) {
    showError('Connection lost. Try again?');
  }
};
```

#### React with Zustand

```typescript
import { useATSProgressiveAnalysis } from '@/lib/api/hooks';

function MyComponent() {
  const { startAnalysis, stages, compositeScore, isAnalyzing } = 
    useATSProgressiveAnalysis();

  const runAnalysis = () => {
    startAnalysis(resumeId, jobId);
  };

  return (
    <div>
      <button onClick={runAnalysis} disabled={isAnalyzing}>
        {isAnalyzing ? 'Analyzing...' : 'Analyze Resume'}
      </button>

      {Object.entries(stages).map(([stageNum, data]) => (
        <div key={stageNum}>
          <h3>{data.stageName}</h3>
          <p>Status: {data.status}</p>
          {data.result && <pre>{JSON.stringify(data.result)}</pre>}
        </div>
      ))}

      {compositeScore && (
        <div>
          <h2>Final Score: {compositeScore.finalScore}/100</h2>
        </div>
      )}
    </div>
  );
}
```

### Background Execution

Analysis continues even if the client disconnects or navigates away. To resume watching results:

1. Store the `analysisId` returned from initial request
2. Reconnect to SSE stream with same parameters
3. Client-side storage (Zustand store) persists stage results
4. Notification fires when analysis completes in background

### Error Handling

**Partial Failures:**

- If one stage fails, analysis continues with remaining stages
- `stage_error` event indicates which stage failed and why
- Final `composite_score.failed_stages` lists failed stages
- Score is recalculated with remaining stages

**Connection Loss:**

- If network drops, `error` event is emitted
- Client can retry from `error` event
- Stages already completed are not re-run

**Rate Limiting:**

- SSE stream respects API rate limits
- 429 responses will close the stream with error event
- Exponential backoff recommended for retries

### Performance Notes

- Stages execute sequentially (not parallel) to manage resource usage
- AI-heavy stages (Keywords, Role Proximity) take 2-3s each
- Progress updates stream ~every 0.5-3 seconds
- No impact on other API endpoints during analysis

### Related Endpoint

- [Knockout Check](/api/ats.md#post-atsknight-check) - Stage 0 only
- [Structure Analysis](/api/ats.md#post-atsstructure) - Stage 1 only
- [Keyword Analysis](/api/ats.md#post-atkeywordsenhanced) - Stage 2 only
- [Content Quality](/api/ats.md#post-atscontent-quality) - Stage 3 only
- [Role Proximity](/api/ats.md#post-atsrole-proximity) - Stage 4 only

---

## ATS Result Caching

ATS analysis results are cached in Redis to improve performance and reduce redundant API calls.

### Cache Key Structure

```text
ats:{resume_content_hash[:16]}:{job_id}
```

**Example:**

```text
ats:a1b2c3d4e5f6g7h8:123
```

### Cached Data Structure

```json
{
  "composite_score": {
    "final_score": 82.5,
    "stage_breakdown": {
      "structure": 12.75,
      "keywords-enhanced": 36.0,
      "content-quality": 18.75,
      "role-proximity": 16.0
    },
    "weights_used": {
      "structure": 0.15,
      "keywords-enhanced": 0.40,
      "content-quality": 0.25,
      "role-proximity": 0.20
    },
    "normalization_applied": false,
    "failed_stages": []
  },
  "stage_results": {
    "knockout": {...},
    "structure": {...},
    "keywords": {...},
    "content-quality": {...},
    "role-proximity": {...}
  },
  "cached_at": "2026-03-05T14:30:00Z",
  "resume_content_hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

### Cache Configuration

| Parameter | Value | Description |
| --------- | ----- | ----------- |
| TTL | 24 hours | Cache expires after 24 hours |
| Key Format | `ats:{hash}:{job_id}` | Content hash ensures cache invalidation on changes |
| Hash Length | 16 chars | First 16 characters of SHA-256 |

### Cache Behavior

**On Progressive Analysis Request:**

1. Compute content hash from resume content
2. Check cache with key `ats:{hash}:{job_id}`
3. If cache hit: Stream cached results as SSE events (fast playback)
4. If cache miss: Run full 5-stage analysis with real-time streaming
5. On completion: Cache results with 24-hour TTL

**Staleness Detection:**

The cache includes `resume_content_hash` to detect when content has changed:

```python
# When fetching tailored resume
current_hash = hash_content(resume.raw_content)
cached_hash = ats_metadata.get("resume_content_hash")

if cached_hash != current_hash:
    is_outdated = True  # Content changed since analysis
```

**Cache-Aware Response Fields:**

When fetching tailored resumes via `GET /api/tailor/{id}`, the response includes:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `ats_score` | number \| null | Cached ATS composite score |
| `ats_cached_at` | string \| null | ISO timestamp of last ATS analysis |
| `is_outdated` | boolean | True if resume changed since analysis |

### Re-Analysis Behavior

The detail page (`/tailor/[id]`) includes a "Re-analyze" button that:

1. Opens modal with ATSProgressStepper component
2. Streams fresh ATS analysis (bypasses cache)
3. Updates cached results on completion
4. Displays updated scores in-place

**UI States:**

- **Fresh Cache:** Shows scores with "Cached as of {timestamp}" label
- **Outdated Cache:** Shows "Outdated" badge, prompts re-analysis
- **No Cache:** Triggers analysis automatically or shows loading state

### Cache Invalidation

Cache is automatically invalidated when:

1. **TTL Expires:** After 24 hours
2. **Content Changes:** New content hash doesn't match cached hash
3. **Manual Re-analysis:** User clicks "Re-analyze" button

### Performance Impact

| Scenario | Typical Latency | Description |
| -------- | --------------- | ----------- |
| Cache Hit | <200ms | Fast playback of cached SSE events |
| Cache Miss | 6-8 seconds | Full 5-stage analysis with streaming |
| Re-analysis | 6-8 seconds | Fresh analysis, updates cache |

### Related Endpoints

- [GET /api/tailor/{id}](tailor-match.md#get-tailored-resume) - Returns ATS cache metadata
- [POST /v1/ats/analyze-progressive](#post-apiv1atsanalyze-progressive) - Progressive analysis with caching
