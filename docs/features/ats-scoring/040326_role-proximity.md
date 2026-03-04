# Role Proximity Score

**Parent Document:** `040326_revised-master-plan.md`

**Stage:** 4 (Weight: 20%)

**Priority:** MEDIUM

**Status:** Planning

---

## Executive Summary

The Role Proximity Score is a **new scoring stage** that measures how closely the candidate's career trajectory aligns with the target role. While keyword matching answers "do you have the skills?", role proximity answers "are you the right person for this level and type of role?"

This stage uses the existing semantic matcher infrastructure to compare:

- **Title match:** Does your recent job title align with the target?
- **Career trajectory:** Are you moving toward or away from this role?
- **Industry alignment:** Are you in the same or adjacent industry?

---

## Why This Stage Matters

### The Keyword Trap

A candidate can have 95% keyword match and still be wrong for the role:

```text
Job: "Senior Frontend Engineer"
Candidate: "Junior Backend Developer with Python, React, Node.js, AWS, Docker..."

Keyword match: 90%
Role proximity: 30%

Reality: Candidate is wrong level AND wrong specialization
ATS ranking: Low despite keyword match
```

### How ATS Systems Use Title Matching

Enterprise ATS systems (Greenhouse, Lever, Workday) use title proximity to:

1. **Rank candidates** within a pipeline (closer title = higher rank)
2. **Filter by seniority** (exclude if level mismatch too large)
3. **Identify career changers** (flag for manual review)

By surfacing this signal explicitly, we help users understand why they might rank lower despite good keyword scores.

---

## Component 1: Title Match Score

### What We Compare

| Resume Element | Job Element |
| -------------- | ----------- |
| Most recent job title | Target job title |
| Previous job title (progression context) | - |
| All job titles (pattern detection) | - |

### Similarity Scoring

Use semantic embeddings to compare titles:

```python
def calculate_title_similarity(
    resume_title: str,
    job_title: str,
    embedder: SentenceEmbedder
) -> float:
    """
    Returns 0.0 - 1.0 similarity score between titles.
    """
    resume_embedding = embedder.encode(normalize_title(resume_title))
    job_embedding = embedder.encode(normalize_title(job_title))

    return cosine_similarity(resume_embedding, job_embedding)
```

### Title Normalization

Before embedding, normalize titles to reduce noise:

```python
def normalize_title(title: str) -> str:
    """
    Normalize job title for comparison.

    Examples:
    - "Sr. Software Engineer" → "Senior Software Engineer"
    - "SWE III" → "Software Engineer III"
    - "Full-Stack Developer" → "Full Stack Developer"
    """
    title = title.lower()

    # Expand abbreviations
    ABBREVIATIONS = {
        "sr.": "senior",
        "sr": "senior",
        "jr.": "junior",
        "jr": "junior",
        "swe": "software engineer",
        "sde": "software development engineer",
        "pm": "product manager",
        "eng": "engineer",
        "mgr": "manager",
        "vp": "vice president",
        "dir": "director",
    }

    for abbrev, full in ABBREVIATIONS.items():
        title = re.sub(rf'\b{abbrev}\b', full, title)

    # Remove special characters
    title = re.sub(r'[^\w\s]', ' ', title)

    return title.strip()
```

### Title Match Tiers

| Match Type | Score | Example |
| ---------- | ----- | ------- |
| Exact match | 100 | "Senior Software Engineer" → "Senior Software Engineer" |
| Same level, same function | 90 | "Senior Software Engineer" → "Senior Backend Engineer" |
| Adjacent level, same function | 75 | "Software Engineer" → "Senior Software Engineer" |
| Same level, related function | 65 | "Senior Software Engineer" → "Senior DevOps Engineer" |
| Different level (2+ steps) | 50 | "Junior Developer" → "Staff Engineer" |
| Different function | 30 | "Software Engineer" → "Product Manager" |

### Level Detection

Extract seniority level from title:

```python
LEVEL_HIERARCHY = {
    "intern": 0,
    "junior": 1,
    "associate": 1,
    "mid": 2,
    "senior": 3,
    "staff": 4,
    "principal": 5,
    "lead": 4,
    "manager": 5,
    "director": 6,
    "vp": 7,
    "c-level": 8,
}

def extract_level(title: str) -> int:
    """
    Extract seniority level from title. Default to mid (2) if unclear.
    """
    title_lower = title.lower()

    for level_name, level_rank in LEVEL_HIERARCHY.items():
        if level_name in title_lower:
            return level_rank

    # Default assumptions
    if "ii" in title_lower or "2" in title_lower:
        return 2
    if "iii" in title_lower or "3" in title_lower:
        return 3

    return 2  # Default to mid-level
```

### Function Detection

Categorize title into functional area:

```python
FUNCTION_CATEGORIES = {
    "engineering": ["engineer", "developer", "programmer", "architect", "swe", "sde"],
    "product": ["product manager", "product owner", "pm", "product lead"],
    "design": ["designer", "ux", "ui", "visual", "creative"],
    "data": ["data scientist", "data analyst", "data engineer", "ml engineer", "machine learning"],
    "devops": ["devops", "sre", "infrastructure", "platform", "reliability"],
    "management": ["manager", "director", "vp", "head of", "chief"],
    "qa": ["qa", "quality", "test", "sdet"],
    "security": ["security", "infosec", "appsec", "cybersecurity"],
}

def extract_function(title: str) -> str:
    """
    Extract functional category from title.
    """
    title_lower = title.lower()

    for category, keywords in FUNCTION_CATEGORIES.items():
        for keyword in keywords:
            if keyword in title_lower:
                return category

    return "other"
```

---

## Component 2: Career Trajectory

### What We Analyze

Looking at the candidate's career progression:

1. Are titles increasing in seniority over time?
2. Is the candidate moving toward or away from the target role?
3. Is this a logical next step?

### Trajectory Scoring

```python
def calculate_trajectory_score(
    experience_entries: list[ExperienceEntry],
    target_title: str,
    target_level: int,
    target_function: str,
) -> TrajectoryResult:
    """
    Analyze career trajectory relative to target role.
    """
    # Sort by date (oldest first)
    sorted_entries = sorted(experience_entries, key=lambda e: e.start_date)

    # Extract levels over time
    levels = [extract_level(e.title) for e in sorted_entries]
    most_recent_level = levels[-1] if levels else 2

    # Check if levels are generally increasing
    is_ascending = all(levels[i] <= levels[i+1] for i in range(len(levels)-1))

    # Calculate level gap to target
    level_gap = target_level - most_recent_level

    # Check function alignment
    most_recent_function = extract_function(sorted_entries[-1].title) if sorted_entries else "other"
    function_match = most_recent_function == target_function

    # Score calculation
    if level_gap == 1 and function_match:
        # Perfect: one step up in same function
        modifier = +20
        trajectory = "progressing_toward"
    elif level_gap == 0 and function_match:
        # Lateral move in same function
        modifier = +10
        trajectory = "lateral"
    elif level_gap < 0:
        # Step down
        modifier = -10
        trajectory = "step_down"
    elif level_gap > 2:
        # Too big a jump
        modifier = -15
        trajectory = "large_gap"
    elif not function_match and level_gap >= 0:
        # Career change
        modifier = -5
        trajectory = "career_change"
    else:
        modifier = 0
        trajectory = "unclear"

    return TrajectoryResult(
        modifier=modifier,
        trajectory_type=trajectory,
        level_progression=levels,
        current_level=most_recent_level,
        target_level=target_level,
    )
```

### Trajectory Types

| Type | Description | Score Modifier |
| ---- | ----------- | -------------- |
| `progressing_toward` | Natural next step | +20 |
| `lateral` | Same level, same function | +10 |
| `step_down` | Moving to lower level | -10 |
| `large_gap` | 3+ level jump | -15 |
| `career_change` | Different function | -5 |
| `unclear` | Can't determine | 0 |

---

## Component 3: Industry Alignment

### Industry Analysis

Is the candidate's industry experience relevant to the target role?

### Industry Taxonomy

```python
INDUSTRY_TAXONOMY = {
    "tech": {
        "names": ["technology", "software", "saas", "tech"],
        "adjacent": ["fintech", "healthtech", "edtech", "media"],
    },
    "finance": {
        "names": ["finance", "banking", "investment", "financial services"],
        "adjacent": ["fintech", "insurance", "consulting"],
    },
    "healthcare": {
        "names": ["healthcare", "health", "medical", "pharma", "biotech"],
        "adjacent": ["healthtech", "insurance", "research"],
    },
    "retail": {
        "names": ["retail", "ecommerce", "consumer goods"],
        "adjacent": ["logistics", "marketing", "tech"],
    },
    # ... more industries
}

def extract_industry(company: str, role_description: str) -> str:
    """
    Infer industry from company name and role context.
    This may use external enrichment (Clearbit, LinkedIn) in production.
    """
    # Simplified: keyword matching
    combined = f"{company} {role_description}".lower()

    for industry, data in INDUSTRY_TAXONOMY.items():
        for name in data["names"]:
            if name in combined:
                return industry

    return "other"
```

### Industry Scoring

```python
def calculate_industry_alignment(
    resume_industries: list[str],  # Industries from each experience
    target_industry: str,
) -> int:
    """
    Returns modifier based on industry alignment.
    """
    most_recent_industry = resume_industries[-1] if resume_industries else "other"

    if most_recent_industry == target_industry:
        return +10  # Same industry

    # Check if adjacent
    if target_industry in INDUSTRY_TAXONOMY:
        adjacent = INDUSTRY_TAXONOMY[target_industry]["adjacent"]
        if most_recent_industry in adjacent:
            return +5  # Adjacent industry

    return 0  # Unrelated
```

---

## Combined Role Proximity Score

### Formula

```python
def calculate_role_proximity_score(
    resume: ParsedResume,
    job: ParsedJob,
    embedder: SentenceEmbedder,
) -> RoleProximityResult:
    """
    Calculate overall role proximity score (0-100).
    """
    # Component 1: Title match (0-100)
    title_similarity = calculate_title_similarity(
        resume.most_recent_title,
        job.title,
        embedder
    )
    title_score = title_similarity * 100

    # Component 2: Trajectory modifier (-20 to +20)
    trajectory = calculate_trajectory_score(
        resume.experience_entries,
        job.title,
        extract_level(job.title),
        extract_function(job.title),
    )

    # Component 3: Industry modifier (-0 to +10)
    industry_modifier = calculate_industry_alignment(
        [extract_industry(e.company, e.description) for e in resume.experience_entries],
        extract_industry(job.company, job.description),
    )

    # Combine: Title is base, modifiers adjust
    raw_score = title_score + trajectory.modifier + industry_modifier

    # Clamp to 0-100
    final_score = max(0, min(100, raw_score))

    return RoleProximityResult(
        score=final_score,
        title_match_score=title_score,
        trajectory=trajectory,
        industry_alignment=industry_modifier,
        explanation=generate_explanation(...),
    )
```

### Score Interpretation

| Score | Interpretation |
| ----- | -------------- |
| 80-100 | Strong fit: Title, trajectory, and industry align |
| 60-79 | Good fit: Minor gaps in level or function |
| 40-59 | Moderate fit: Career change or level jump |
| 20-39 | Weak fit: Significant mismatch |
| 0-19 | Poor fit: Very different role type |

---

## Using Existing Semantic Matcher

The semantic matcher (`/backend/app/services/ai/semantic_matcher.py`) already provides embedding-based similarity. Reuse this infrastructure:

```python
# Existing semantic matcher usage for keyword/block matching
from app.services.ai.semantic_matcher import SemanticMatcher

class RoleProximityService:
    def __init__(self, semantic_matcher: SemanticMatcher):
        self.matcher = semantic_matcher

    def calculate_title_similarity(
        self,
        resume_title: str,
        job_title: str
    ) -> float:
        # Reuse embedding infrastructure
        return self.matcher.calculate_similarity(
            normalize_title(resume_title),
            normalize_title(job_title)
        )
```

This avoids duplicating embedding model loading and provides consistency with other semantic features.

---

## API Schema

### Request

```python
class RoleProximityRequest(BaseModel):
    resume_id: UUID
    job_id: UUID
```

### Response

```python
class TrajectoryResult(BaseModel):
    trajectory_type: Literal["progressing_toward", "lateral", "step_down", "large_gap", "career_change", "unclear"]
    modifier: int
    current_level: int
    target_level: int
    level_progression: list[int]  # Historical level changes

class RoleProximityResponse(BaseModel):
    score: float  # 0-100

    title_match: TitleMatchResult
    trajectory: TrajectoryResult
    industry_alignment: int  # Modifier value

    explanation: str  # Human-readable summary

    # Actionable insights
    concerns: list[str]  # ["Large level gap: Junior → Staff"]
    strengths: list[str]  # ["Same industry", "Clear progression toward role"]
```

### Explanation Generation

```python
def generate_explanation(result: RoleProximityResult) -> str:
    parts = []

    # Title match
    if result.title_match_score >= 80:
        parts.append(f"Your title '{result.resume_title}' closely matches the target role")
    elif result.title_match_score >= 50:
        parts.append(f"Your title is somewhat related to the target role")
    else:
        parts.append(f"Your title '{result.resume_title}' differs significantly from '{result.job_title}'")

    # Trajectory
    trajectory_messages = {
        "progressing_toward": "This appears to be a natural next step in your career",
        "lateral": "This is a lateral move at your current level",
        "step_down": "This role is at a lower level than your current position",
        "large_gap": "This role represents a significant level jump",
        "career_change": "This represents a career change to a different function",
    }
    parts.append(trajectory_messages.get(result.trajectory.trajectory_type, ""))

    # Industry
    if result.industry_alignment >= 10:
        parts.append("You have direct industry experience")
    elif result.industry_alignment >= 5:
        parts.append("You have experience in an adjacent industry")

    return ". ".join(filter(None, parts)) + "."
```

---

## Integration with ATS Score

### Weight in Final Score

Per the master plan, Role Proximity is **20%** of the final ATS score:

```text
Final Score =
    (Structural × 0.15) +
    (Keywords × 0.40) +
    (Content Quality × 0.25) +
    (Role Proximity × 0.20)  ← This stage
```

### Contextualizing Keyword Scores

Role Proximity explains why high keyword scores don't guarantee success:

```text
┌─────────────────────────────────────────────────────────────────┐
│  ATS ANALYSIS SUMMARY                                           │
│                                                                 │
│  Overall Score: 72%                                             │
│                                                                 │
│  ├── Keywords:        92% ████████████████████░░  Great match   │
│  ├── Content Quality: 78% ███████████████░░░░░░  Good           │
│  ├── Structure:       85% █████████████████░░░░  Good           │
│  └── Role Proximity:  45% █████████░░░░░░░░░░░░  Concern        │
│                                                                 │
│  💡 Your keyword match is strong, but you may rank lower        │
│     because this role is a significant level jump from your     │
│     current position (Junior → Staff Engineer).                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

| Test Case | Input | Expected |
| --------- | ----- | -------- |
| Exact title match | "Senior SWE" → "Senior SWE" | Score ≈ 100 |
| Level abbreviation | "Sr. Engineer" → "Senior Engineer" | Score ≈ 100 (normalization) |
| One level up | "SWE" → "Senior SWE" | Score ≈ 75, trajectory: progressing |
| Function change | "Backend Dev" → "Product Manager" | Score ≈ 30 |
| Large gap | "Junior Dev" → "Director" | Score ≈ 35, trajectory: large_gap |

### Integration Tests

| Scenario | Expected |
| -------- | -------- |
| Resume + Job with same title | High proximity score |
| Career progression data | Correct trajectory detection |
| Industry alignment | Correct modifier application |

### Benchmark

- 100 resume-job pairs with human-labeled "fit" score
- Correlation target: ≥ 0.7 with human judgment

---

## Implementation Plan

### Phase 4.1: Title Matching (Priority 4A)

1. Implement title normalization
2. Integrate with semantic matcher for embedding similarity
3. Build level extraction
4. Build function extraction
5. Test on 100+ title pairs

### Phase 4.2: Trajectory Analysis (Priority 4B)

1. Parse experience dates for ordering
2. Calculate level progression
3. Determine trajectory type
4. Apply modifiers
5. Test edge cases (career gaps, concurrent roles)

### Phase 4.3: Industry Alignment (Priority 4C)

1. Build industry taxonomy
2. Implement company → industry inference
3. Calculate alignment scores
4. Test across industries

### Phase 4.4: Combined Scoring (Priority 4D)

1. Combine all components
2. Generate explanations
3. Build API endpoint
4. Integration test

### Phase 4.5: UI Integration (Priority 4E)

1. Display role proximity in ATS breakdown
2. Show trajectory insights
3. Provide actionable feedback
4. User testing

---

## Definition of Completion

- [ ] Title similarity using semantic embeddings
- [ ] Title normalization handles common abbreviations
- [ ] Level extraction accurate for standard titles
- [ ] Function categorization covers major job families
- [ ] Trajectory analysis from career progression
- [ ] Industry alignment scoring
- [ ] Combined score calculation
- [ ] Explanation generation
- [ ] API endpoint integrated with ATS score
- [ ] UI displays role proximity breakdown

---

## Open Questions

1. **Title normalization depth:** How many abbreviations to support? Start with top 20?

2. **Level detection ambiguity:** "Engineer II" vs "Senior Engineer" - are these equivalent?

3. **Industry detection accuracy:** Manual tagging vs inference? Consider external enrichment API.

4. **Trajectory for career changers:** Should we penalize or just flag? Career changers aren't necessarily bad.

5. **Weight adjustment:** Is 20% the right weight? May need A/B testing.

---

## Document Metadata

| Field | Value |
| ----- | ----- |
| Created | 2026-03-04 |
| Status | Planning |
| Priority | MEDIUM |
| Dependencies | Semantic Matcher, Resume Parser (Phase 4), Job Analyzer (Phase 5) |
| Parent | `040326_revised-master-plan.md` |
