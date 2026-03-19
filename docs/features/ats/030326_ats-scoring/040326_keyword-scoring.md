# Enhanced Keyword Scoring

**Parent Document:** `040326_revised-master-plan.md`

**Stage:** 2 (Weight: 40%)

**Priority:** MEDIUM-HIGH

**Status:** Planning

---

## Executive Summary

This stage enhances the layered keyword matching system from Phase 6 with four new scoring dimensions that reflect how real ATS systems evaluate keyword matches:

1. **Placement Weighting** - Keywords in experience section > skills section
2. **Density Scoring** - Repetition matters, with diminishing returns
3. **Recency Weighting** - Recent roles weighted higher
4. **Importance Tiers** - Required keywords weighted more than preferred

These enhancements move keyword scoring from "did you include the keyword?" to "where and how did you demonstrate the skill?"

---

## Why These Enhancements Matter

### Current State (Phase 6 Design)

The existing Phase 6 layered matching focuses on **detecting keyword presence**:

```text
Job requires: "Python"
Resume contains: "Python" in Skills section
Result: ✅ Match found (confidence: 1.0)
```

This is necessary but insufficient. Real ATS systems also evaluate **quality of match**:

```text
Job requires: "Python"
Resume A: "Python" listed in Skills
Resume B: "Developed REST APIs using Python, reducing latency by 40%"

ATS ranking: Resume B > Resume A (demonstrated experience)
```

### Target State (Enhanced Scoring)

The enhanced scorer considers:

| Signal | Impact |
| ------ | ------ |
| Where is the keyword? | Experience > Projects > Skills > Summary |
| How many times? | More = better (up to cap) |
| How recently? | Last 2 roles weighted 2x |
| How important to job? | Required 3x > Preferred 1.5x > Mentioned 1x |

---

## Enhancement 1: Placement Weighting

### Rationale

ATS systems (Workday in particular) weight keywords that appear in the **context of demonstrated experience** higher than keywords merely listed in a skills section.

A recruiter reading:

- "Python" in Skills section → "Candidate claims Python"
- "Optimized database queries using Python, improving performance by 60%" → "Candidate demonstrated Python"

### Section Weights

| Section | Weight | Rationale |
| ------- | ------ | --------- |
| Work Experience bullets | 1.0 | Demonstrated, verified by employer |
| Project descriptions | 0.9 | Applied knowledge, but less formal |
| Skills section | 0.7 | Listed, not demonstrated |
| Summary / Objective | 0.6 | Self-description, unverified claims |
| Education coursework | 0.5 | Academic context, not professional |
| Certifications | 0.8 | Third-party validated |

### Implementation

```python
SECTION_WEIGHTS = {
    "experience": 1.0,
    "projects": 0.9,
    "certifications": 0.8,
    "skills": 0.7,
    "summary": 0.6,
    "education": 0.5,
}

class KeywordMatch:
    keyword: str
    section: str
    confidence: float  # from matching layer

    @property
    def weighted_score(self) -> float:
        section_weight = SECTION_WEIGHTS.get(self.section, 0.5)
        return self.confidence * section_weight
```

### Edge Cases

- **Keywords spanning sections:** If "Python" appears in both Experience and Skills, use the highest-weighted occurrence.
- **Unclear section boundaries:** Fall back to 0.7 (skills weight) if section unknown.
- **Combined sections:** "Skills & Experience" → treat as experience (1.0).

---

## Enhancement 2: Density Scoring

### Why Density Matters

Keyword repetition signals depth of experience. Someone who mentions "Python" in 4 different roles has more Python experience than someone who mentions it once.

However, keyword stuffing (repeating "Python" 10 times) is penalized by modern ATS and easily detected. Apply diminishing returns.

### Density Formula

```python
def calculate_density_multiplier(occurrences: int) -> float:
    """
    Diminishing returns formula:
    1 occurrence  → 1.0x
    2 occurrences → 1.3x
    3 occurrences → 1.5x
    4+ occurrences → 1.5x (capped)
    """
    if occurrences <= 0:
        return 0.0
    if occurrences == 1:
        return 1.0
    if occurrences == 2:
        return 1.3
    return min(1.5, 1.0 + (0.5 * math.log2(occurrences)))
```

### Counting Rules

| Scenario | Count |
| -------- | ----- |
| Exact same word | 1 per occurrence |
| Variations (Python, python, PYTHON) | 1 per occurrence (case-insensitive) |
| Synonym variants (ML, Machine Learning) | Count as same keyword |
| Same keyword in different sections | Count each |
| Same keyword in same bullet point | Count as 1 |

### Density Implementation

```python
def count_keyword_occurrences(
    keyword: str,
    resume_text: str,
    resume_sections: dict[str, str]
) -> int:
    """
    Count keyword occurrences, normalizing for case and basic variants.
    """
    pattern = build_keyword_pattern(keyword)  # Handles case, lemma

    occurrences = 0
    for section_name, section_text in resume_sections.items():
        # Count by paragraph/bullet to avoid double-counting within single points
        paragraphs = split_into_paragraphs(section_text)
        for para in paragraphs:
            if pattern.search(para):
                occurrences += 1

    return occurrences
```

---

## Enhancement 3: Recency Weighting

### Why Recency Matters

ATS systems rank candidates partly based on **recency of relevant experience**. A skill used in the last 2 years is more relevant than a skill used 10 years ago (technologies evolve, skills atrophy).

### Recency Formula

| Role Position | Weight |
| ------------- | ------ |
| Most recent role | 2.0x |
| Second most recent | 2.0x |
| Third most recent | 1.0x |
| Fourth most recent | 0.8x |
| Older roles | 0.6x |

### Determining Role Order

1. Parse experience entries with dates
2. Sort by end date (or start if end is "Present")
3. Assign recency rank

```python
def assign_recency_weights(
    experience_entries: list[ExperienceEntry]
) -> dict[str, float]:
    """
    Returns mapping of experience_id -> recency_weight
    """
    # Sort by end date descending
    sorted_entries = sorted(
        experience_entries,
        key=lambda e: e.end_date or datetime.max,
        reverse=True
    )

    weights = {}
    for i, entry in enumerate(sorted_entries):
        if i < 2:
            weights[entry.id] = 2.0
        elif i == 2:
            weights[entry.id] = 1.0
        elif i == 3:
            weights[entry.id] = 0.8
        else:
            weights[entry.id] = 0.6

    return weights
```

### Recency Edge Cases

- **Concurrent roles:** Both get their respective recency weight.
- **Freelance/ongoing projects:** Treat current end date as "Present".
- **Education keywords:** Apply 0.5x base, no recency (education is one-time).
- **Skills section keywords:** No recency (section not tied to timeframe).

---

## Enhancement 4: Importance Tiers

### Why Importance Tiers Matter

Not all job requirements are equal. ATS systems differentiate between:

- **Required:** "Must have", "Required", triggers auto-reject if missing
- **Strongly Preferred:** "Strongly preferred", "Ideal candidate has"
- **Preferred:** "Nice to have", "Bonus"
- **Mentioned:** Simply listed, no qualifier

### Importance Weights

| Importance | Weight | Detection Triggers |
| ---------- | ------ | ------------------ |
| Required | 3.0x | "required", "must have", "X+ years required", "mandatory" |
| Strongly Preferred | 2.0x | "strongly preferred", "ideal candidate", "highly desirable" |
| Preferred | 1.5x | "preferred", "nice to have", "bonus", "plus" |
| Mentioned | 1.0x | No qualifier, just listed in requirements |

### Extraction from Job Description

This requires Job Analyzer (Phase 5) enhancement:

```python
class SkillRequirement(BaseModel):
    skill: str
    importance: Literal["required", "strongly_preferred", "preferred", "mentioned"]
    context: str | None = None  # Original text: "5+ years Python required"

# Example extraction:
# "Must have: Python, SQL. Nice to have: Go, Rust"
# → [
#     SkillRequirement(skill="Python", importance="required"),
#     SkillRequirement(skill="SQL", importance="required"),
#     SkillRequirement(skill="Go", importance="preferred"),
#     SkillRequirement(skill="Rust", importance="preferred"),
# ]
```

### Detection Patterns

```python
IMPORTANCE_PATTERNS = {
    "required": [
        r"must have",
        r"required",
        r"mandatory",
        r"\d+\+? years? (?:of )?(?:experience (?:in|with) )?(\w+) required",
        r"essential",
    ],
    "strongly_preferred": [
        r"strongly prefer",
        r"ideal candidate",
        r"highly desirable",
        r"significant experience",
    ],
    "preferred": [
        r"nice to have",
        r"prefer",
        r"bonus",
        r"plus",
        r"desired",
        r"advantageous",
    ],
}
```

---

## Combined Scoring Formula

### Per-Keyword Score

```python
def calculate_keyword_score(
    match: KeywordMatch,
    occurrences: int,
    recency_weight: float,
    importance: str,
) -> float:
    """
    Calculate final score for a single keyword match.
    """
    # Base: Match confidence (from layered matching)
    base_score = match.confidence

    # Apply section placement weight
    section_weight = SECTION_WEIGHTS.get(match.section, 0.7)

    # Apply density multiplier
    density_mult = calculate_density_multiplier(occurrences)

    # Apply recency weight (only for experience-based matches)
    if match.section == "experience":
        recency_mult = recency_weight
    else:
        recency_mult = 1.0

    # Apply importance weight
    importance_weights = {
        "required": 3.0,
        "strongly_preferred": 2.0,
        "preferred": 1.5,
        "mentioned": 1.0,
    }
    importance_mult = importance_weights.get(importance, 1.0)

    return base_score * section_weight * density_mult * recency_mult * importance_mult
```

### Overall Keyword Stage Score

```python
def calculate_stage2_score(
    job_requirements: list[SkillRequirement],
    resume_matches: list[KeywordMatch],
) -> Stage2Result:
    """
    Calculate the overall keyword score (0-100).
    """
    total_weighted = 0.0
    total_importance = 0.0

    for req in job_requirements:
        importance_weight = {"required": 3.0, "strongly_preferred": 2.0, "preferred": 1.5, "mentioned": 1.0}[req.importance]
        total_importance += importance_weight

        match = find_best_match(req.skill, resume_matches)
        if match:
            score = calculate_keyword_score(match, ...)
            total_weighted += min(score, importance_weight)  # Cap at importance weight
        # If no match: adds 0 to total_weighted

    raw_score = (total_weighted / total_importance) * 100 if total_importance > 0 else 0

    return Stage2Result(
        score=raw_score,
        matched_keywords=[...],
        missing_keywords=[...],  # For gap analysis
        keyword_details=[...],   # Per-keyword breakdown
    )
```

---

## Gap Analysis Enhancement

### Current Gap Analysis

```text
Missing keywords:
- Kubernetes
- Docker
- CI/CD
```

### Enhanced Gap Analysis

```text
Missing keywords (by priority):

❌ REQUIRED (address before applying):
   • Kubernetes (mentioned in 2 requirements)
   • 5+ years Python (you show ~3 years)

⚠️ STRONGLY PREFERRED:
   • Docker
   • CI/CD experience

💡 NICE TO HAVE:
   • Terraform
   • ArgoCD
```

---

## API Schema

### Request

```python
class KeywordScoreRequest(BaseModel):
    resume_id: UUID
    job_id: UUID

### Response

class KeywordMatch(BaseModel):
    job_keyword: str
    resume_keyword: str | None
    match_type: Literal["exact", "lemma", "abbreviation", "synonym", "fuzzy", "semantic"]
    confidence: float
    section: str | None
    occurrence_count: int
    recency_weight: float
    importance: Literal["required", "strongly_preferred", "preferred", "mentioned"]
    weighted_score: float
    explanation: str  # "Matched 'Python' (exact) in Experience section, 3 occurrences"

class GapItem(BaseModel):
    keyword: str
    importance: Literal["required", "strongly_preferred", "preferred", "mentioned"]
    suggestion: str  # "Add Kubernetes experience to your resume"

class KeywordScoreResponse(BaseModel):
    score: float  # 0-100
    matched_keywords: list[KeywordMatch]
    missing_keywords: list[GapItem]
    match_rate: float  # Percentage of job keywords matched
    required_match_rate: float  # Percentage of REQUIRED keywords matched
```

---

## Integration with Phase 6 Layered Matching

The existing Phase 6 layered matching (exact → lemma → abbreviation → taxonomy → fuzzy → embedding) remains the **detection layer**. This stage adds **scoring layer** on top:

```text
Phase 6 (Detection):
  Input: Job keyword "Kubernetes"
  Output: Match found in resume ("k8s", confidence: 0.95, layer: abbreviation)

Stage 2 (Scoring):
  Input: Match from Phase 6 + section info + occurrence count + recency + importance
  Output: Weighted score (e.g., 2.85 out of 3.0 max for required keyword)
```

---

## Testing Strategy

### Unit Tests

| Test Case | Input | Expected |
| --------- | ----- | -------- |
| Section weighting | Match in experience vs skills | Experience score > Skills score |
| Density cap | 5 occurrences | Same score as 3 occurrences (capped) |
| Recency boost | Match in recent role | 2x score vs older role |
| Importance weight | Required vs preferred | Required score 2x preferred |
| Combined | All factors | Correct multiplication |

### Integration Tests

| Scenario | Expected |
| -------- | -------- |
| Resume A: Python in experience | Higher score than Resume B |
| Resume B: Python in skills only | Lower score |
| 100% keyword match, all required | Score ≈ 100 |
| 50% keyword match, all required | Score ≈ 50 |
| 100% match but all "nice to have" | Lower total weight impact |

### Benchmark Dataset

- 200 job postings with manually labeled importance tiers
- 100 resumes with section-annotated keyword locations
- Ground truth: human-ranked match quality

---

## Implementation Plan

### Phase 2.1: Importance Extraction (Priority 2A)

1. Enhance Job Analyzer to extract importance tiers
2. Update `SkillRequirement` schema
3. Test on 100+ job postings
4. Accuracy target: 90% importance tier correct

### Phase 2.2: Placement Detection (Priority 2B)

1. Enhance Resume Parser to track keyword → section mapping
2. Update match result schema
3. Implement section weight lookup
4. Test on 50+ resumes

### Phase 2.3: Density Calculation (Priority 2C)

1. Implement occurrence counting
2. Apply diminishing returns formula
3. Unit test edge cases
4. Validate no keyword stuffing reward

### Phase 2.4: Recency Calculation (Priority 2D)

1. Implement experience date sorting
2. Calculate recency weights per role
3. Apply to experience-based matches
4. Handle edge cases (concurrent roles, gaps)

### Phase 2.5: Combined Scoring (Priority 2E)

1. Implement combined formula
2. Integrate with Phase 6 matching
3. Generate enhanced gap analysis
4. API endpoint updates

### Phase 2.6: UI Updates (Priority 2F)

1. Display importance tiers in gap analysis
2. Show score breakdown by factor
3. Explain weighted scoring to users
4. User testing

---

## Definition of Completion

- [ ] Job Analyzer extracts importance tiers for each skill
- [ ] Resume Parser tracks keyword section locations
- [ ] Occurrence counting implemented with deduplication
- [ ] Recency weights calculated from experience dates
- [ ] Combined scoring formula implemented
- [ ] Gap analysis shows importance-prioritized recommendations
- [ ] API returns detailed keyword match breakdown
- [ ] Score correlates with ATS outcomes (benchmark validation)

---

## Open Questions

1. **Section detection accuracy:** What if we can't determine the section? Default to skills (0.7)?

2. **Cross-section keywords:** If "Python" appears in both Experience and Skills, which section do we use? (Proposal: highest weight)

3. **Importance ambiguity:** Job says "Python required, Go preferred" - what about SQL that's just listed? (Proposal: default to "mentioned")

4. **Recency for short tenure:** If someone was at a job for 3 months, does recency still apply? (Proposal: yes, still recent)

5. **Maximum score normalization:** Should we normalize so 100 = "perfect match"? Or allow scores > 100 for exceptional matches?

---

## Document Metadata

| Field | Value |
| ----- | ----- |
| Created | 2026-03-04 |
| Status | Planning |
| Priority | MEDIUM-HIGH |
| Dependencies | Phase 5 (Job Analyzer), Phase 4 (Resume Parser), Phase 6 (Keyword Matching) |
| Parent | `040326_revised-master-plan.md` |
