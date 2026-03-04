# Knockout Check

**Parent Document:** `040326_revised-master-plan.md`

**Stage:** 0 (Pre-scoring binary qualifier)

**Priority:** HIGH - Biggest UX differentiator

**Status:** Planning

---

## Executive Summary

The Knockout Check is a **pre-scoring binary qualifier** that identifies hard disqualifiers before calculating the ATS match score. This is the highest-impact addition to the ATS scoring system because it addresses a fundamental gap: a 90% keyword match means nothing if the candidate fails a hard cutoff.

---

## The Problem

Real ATS systems (especially enterprise ones like Workday, iCIMS, Taleo) apply **binary knockout rules** before scoring begins. These are "minimum requirements" gates that auto-reject candidates:

- **Years of experience:** "5+ years required" - if resume shows 2 years, score = 0
- **Education requirements:** "Bachelor's required" - no degree detected = auto-reject
- **Required certifications:** "PMP required", "AWS Certified" - missing = filtered out
- **Location/authorization:** "Must be authorized to work in US" - visa status matters

Most resume tools (Jobscan, Resume Worded) either don't show these signals or show them poorly. This is our differentiation opportunity.

---

## User Impact

### Current Experience (Without Knockout Check)

```text
User sees:   "ATS Match: 92%"
User thinks: "Great match! I'll apply."
Reality:     Job requires 5+ years, user has 2 years
Outcome:     Auto-rejected before human review
User feels:  "This tool is useless, it said 92%"
```

### Target Experience (With Knockout Check)

```text
User sees:   ⚠️ Knockout Risk Detected
             - Role requires 5+ years of experience (your resume shows ~2 years)
             - AWS certification listed as required — not found

             Your keyword match is 92%, but these requirements may
             auto-reject your application.

             [View full ATS analysis →]

User thinks: "I should either address this or apply elsewhere"
Outcome:     User makes informed decision
User feels:  "This tool is honest and helpful"
```

---

## What To Check

### 1. Years of Experience

**Detection in Job Description:**

| Pattern | Example | Extracted |
| ------- | ------- | --------- |
| `X+ years` | "5+ years of experience in Python" | `required_years: 5` |
| `X-Y years` | "3-5 years of backend development" | `required_years: 3` (minimum) |
| `minimum X years` | "Minimum 7 years of engineering experience" | `required_years: 7` |
| `at least X years` | "At least 3 years in a similar role" | `required_years: 3` |

**Calculation from Resume:**

1. Extract start/end dates from each experience entry
2. Handle "Present" as current date
3. Sum total professional experience
4. Handle overlapping roles (don't double-count)

**Matching Logic:**

```python
def check_experience_knockout(
    required_years: int | None,
    resume_years: float
) -> KnockoutResult:
    if required_years is None:
        return KnockoutResult(passed=True, reason=None)

    # Allow 20% buffer (4.0 years meets "5+ years" requirement)
    threshold = required_years * 0.8

    if resume_years < threshold:
        return KnockoutResult(
            passed=False,
            reason=f"Role requires {required_years}+ years (your resume shows ~{resume_years:.0f} years)"
        )

    return KnockoutResult(passed=True, reason=None)
```

**Edge Cases:**

- Career gaps: Should they reduce total years?
- Part-time roles: Count at 0.5x?
- Internships: Typically excluded from "years of experience"
- Multiple concurrent roles: Don't double-count

### 2. Education Level

**Detection in Job Description:**

| Pattern | Example | Extracted |
| ------- | ------- | --------- |
| `Bachelor's required` | "Bachelor's degree in CS required" | `required_education: bachelors` |
| `BS/BA required` | "BS/BA in related field" | `required_education: bachelors` |
| `Master's preferred` | "Master's degree preferred" | `preferred_education: masters` |
| `PhD required` | "PhD in Machine Learning required" | `required_education: phd` |
| `degree required` | "College degree required" | `required_education: bachelors` |

**Education Hierarchy:**

```text
None < Associate < Bachelors < Masters < PhD
```

**Detection in Resume:**

| Pattern | Example | Detected Level |
| ------- | ------- | -------------- |
| `B.S.`, `BS`, `Bachelor` | "B.S. in Computer Science" | `bachelors` |
| `M.S.`, `MS`, `Master` | "Master of Science" | `masters` |
| `PhD`, `Ph.D.`, `Doctorate` | "Ph.D. in Physics" | `phd` |
| `A.S.`, `Associate` | "Associate Degree in IT" | `associate` |

**Matching Logic:**

```python
EDUCATION_LEVELS = {
    "none": 0,
    "associate": 1,
    "bachelors": 2,
    "masters": 3,
    "phd": 4
}

def check_education_knockout(
    required: str | None,
    resume_level: str
) -> KnockoutResult:
    if required is None:
        return KnockoutResult(passed=True, reason=None)

    required_rank = EDUCATION_LEVELS.get(required, 0)
    resume_rank = EDUCATION_LEVELS.get(resume_level, 0)

    if resume_rank < required_rank:
        return KnockoutResult(
            passed=False,
            reason=f"Role requires {required} degree (your resume shows {resume_level or 'none detected'})"
        )

    return KnockoutResult(passed=True, reason=None)
```

**Edge Cases:**

- "Degree or equivalent experience": How to handle?
- Non-US degree terminology (Diploma, Honours, etc.)
- Bootcamp certifications vs traditional degrees
- In-progress degrees

### 3. Required Certifications

**Detection in Job Description:**

| Pattern | Example | Extracted |
| ------- | ------- | --------- |
| `[Cert] required` | "PMP certification required" | `["PMP"]` |
| `must have [Cert]` | "Must have AWS certification" | `["AWS certification"]` |
| `[Cert] certified` | "CISSP certified" | `["CISSP"]` |
| List of certs | "Required: PMP, Scrum Master" | `["PMP", "Scrum Master"]` |

**Common Certifications Taxonomy:**

```python
CERT_ALIASES = {
    "pmp": ["pmp", "project management professional"],
    "aws": ["aws certified", "aws solutions architect", "aws developer", "aws sysops"],
    "scrum": ["csm", "certified scrum master", "scrum master"],
    "cissp": ["cissp", "certified information systems security"],
    "cpa": ["cpa", "certified public accountant"],
    "cfa": ["cfa", "chartered financial analyst"],
    # ... extensive list
}
```

**Detection in Resume:**

- Check certifications section explicitly
- Also scan education and skills sections
- Use fuzzy matching for variations

**Matching Logic:**

```python
def check_certification_knockout(
    required_certs: list[str],
    resume_certs: list[str]
) -> KnockoutResult:
    missing = []

    for required in required_certs:
        # Normalize and check against taxonomy
        if not cert_matches(required, resume_certs):
            missing.append(required)

    if missing:
        return KnockoutResult(
            passed=False,
            reason=f"Required certifications not found: {', '.join(missing)}"
        )

    return KnockoutResult(passed=True, reason=None)
```

### 4. Location / Work Authorization

**Detection in Job Description:**

| Pattern | Example | Requirement |
| ------- | ------- | ----------- |
| Location city | "San Francisco, CA" | `location: "San Francisco"` |
| Remote status | "Remote", "Hybrid", "On-site" | `remote_type: "remote"` |
| Authorization | "Must be authorized to work in US" | `requires_authorization: true` |
| No sponsorship | "No visa sponsorship available" | `offers_sponsorship: false` |

**Detection in Resume:**

- Contact info: City/State/Country
- Work history locations
- Explicit authorization statements (rare)

**Matching Logic:**

This is the **weakest knockout signal** because:

1. Location preferences often negotiable
2. Remote policies evolving rapidly
3. Authorization hard to detect from resume

**Recommendation:** Flag as "potential concern" rather than hard knockout:

```python
def check_location_knockout(
    job_location: str | None,
    job_remote: str | None,  # "remote", "hybrid", "onsite"
    resume_location: str | None
) -> KnockoutResult:
    # Don't hard-fail, just warn
    if job_remote == "onsite" and resume_location:
        # Check distance / same metro
        if not same_metro(job_location, resume_location):
            return KnockoutResult(
                passed=True,  # Soft warning
                warning=f"Role is on-site in {job_location} (your location: {resume_location})"
            )

    return KnockoutResult(passed=True, reason=None)
```

---

## Integration Points

### Dependencies on Other Components

| Component | What We Need | Status |
| --------- | ------------ | ------ |
| Job Analyzer (Phase 5) | Extract `required_years`, `required_education`, `required_certs` | Enhancement needed |
| Resume Parser (Phase 4) | Extract total years, education level, certifications | Enhancement needed |
| Semantic Matcher | Certification fuzzy matching | Existing |

### Job Analyzer Enhancements

Add to `JobAnalysis` schema:

```python
class HardRequirements(BaseModel):
    years_experience: int | None = None
    years_experience_context: str | None = None  # "5+ years Python"

    education_level: Literal["none", "associate", "bachelors", "masters", "phd"] | None = None
    education_required: bool = False  # vs "preferred"

    certifications_required: list[str] = []
    certifications_preferred: list[str] = []

    location: str | None = None
    remote_type: Literal["remote", "hybrid", "onsite"] | None = None
    offers_visa_sponsorship: bool | None = None
```

### Resume Parser Enhancements

Add to resume analysis:

```python
class ResumeQualifications(BaseModel):
    total_years_experience: float
    experience_breakdown: list[ExperienceSpan]  # For date math transparency

    highest_education: Literal["none", "associate", "bachelors", "masters", "phd"]
    education_entries: list[EducationEntry]

    certifications: list[str]

    location_city: str | None = None
    location_country: str | None = None
```

---

## API Design

### Knockout Check Endpoint

```python
class KnockoutCheckRequest(BaseModel):
    resume_id: UUID
    job_id: UUID

class KnockoutRisk(BaseModel):
    category: Literal["experience", "education", "certification", "location"]
    severity: Literal["hard", "soft"]  # hard = likely auto-reject, soft = warning
    message: str
    job_requirement: str  # What the job asks for
    resume_value: str     # What the resume shows

class KnockoutCheckResponse(BaseModel):
    qualified: bool  # True if no hard knockouts
    risks: list[KnockoutRisk]
    proceed_with_scoring: bool  # Always true, but with warnings
```

### Integration with ATS Score

```python
class ATSScoreResponse(BaseModel):
    # Existing fields
    overall_score: float
    structural_score: float
    keyword_score: float
    content_quality_score: float
    role_proximity_score: float

    # New fields
    knockout_check: KnockoutCheckResponse
    score_reliable: bool  # False if hard knockouts detected
```

---

## UI/UX Design

### Display Priority

1. **Knockout warnings** (if any) - Show FIRST, before score
2. **Overall ATS score** - Show second, with caveat if knockouts exist
3. **Score breakdown** - Detailed analysis
4. **Gap analysis** - Actionable improvements

### Warning Component

```text
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  KNOCKOUT RISK DETECTED                                     │
│                                                                 │
│  The following requirements may auto-reject your application:   │
│                                                                 │
│  ❌ Experience: Role requires 5+ years                          │
│     Your resume shows approximately 2 years                     │
│                                                                 │
│  ❌ Certification: AWS Solutions Architect required             │
│     Not found on your resume                                    │
│                                                                 │
│  💡 Tip: Consider roles better matched to your experience       │
│     level, or address these gaps before applying.               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  View ATS Score Anyway  │  Find Better Matches  │         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Score Display with Caveat

```text
┌─────────────────────────────────────────────────────────────────┐
│  ATS MATCH SCORE                                                │
│                                                                 │
│  ┌───────────────────────────────────────────┐                  │
│  │ ████████████████████░░░░░░░░  78%         │                  │
│  └───────────────────────────────────────────┘                  │
│                                                                 │
│  ⚠️ This score may not reflect actual ATS outcome due to        │
│  knockout risks detected above.                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Test Cases

| Scenario | Job Requirement | Resume Value | Expected |
| -------- | --------------- | ------------ | -------- |
| Clear pass | 3+ years | 5 years | Pass |
| Clear fail | 5+ years | 2 years | Fail (experience) |
| Edge case | 5+ years | 4 years | Pass (within 20% buffer) |
| No requirement | None stated | 2 years | Pass |
| Education pass | Bachelors | Masters | Pass |
| Education fail | Masters | Bachelors | Fail (education) |
| Cert match | PMP required | "PMP Certified" | Pass |
| Cert mismatch | PMP required | No certs | Fail (certification) |
| Cert variant | AWS required | "AWS Solutions Architect" | Pass |

### Accuracy Targets

| Metric | Target |
| ------ | ------ |
| Experience extraction accuracy | ≥95% |
| Education detection accuracy | ≥98% |
| Certification matching recall | ≥95% |
| False positive rate (incorrect knockouts) | <2% |
| False negative rate (missed knockouts) | <5% |

---

## Implementation Plan

### Phase 1: Job Analyzer Enhancement (Priority 1A)

1. Add hard requirement extraction prompts to LLM
2. Create `HardRequirements` schema
3. Update Job Analyzer to populate new fields
4. Test on 100+ job postings

### Phase 2: Resume Analyzer Enhancement (Priority 1B)

1. Implement experience duration calculation
2. Add education level detection
3. Enhance certification extraction
4. Create `ResumeQualifications` schema

### Phase 3: Knockout Logic (Priority 1C)

1. Implement comparison logic for each qualifier
2. Create `KnockoutCheckService`
3. Define threshold/buffer configuration
4. Unit test all edge cases

### Phase 4: API Integration (Priority 1D)

1. Create knockout check endpoint
2. Integrate with ATS score endpoint
3. Add knockout data to response schema
4. Integration tests

### Phase 5: UI Implementation (Priority 1E)

1. Create knockout warning component
2. Update ATS score display
3. Add "View anyway" flow
4. User testing

---

## Definition of Completion

- [ ] Job Analyzer extracts: years required, education level, required certs
- [ ] Resume Parser provides: total experience, education level, cert list
- [ ] Knockout logic implemented for all 4 categories
- [ ] API endpoint returns knockout risks
- [ ] UI displays warnings before score
- [ ] False positive rate < 2%
- [ ] 100+ job posting validation complete
- [ ] User feedback incorporated

---

## Open Questions

1. **Buffer thresholds:** Should 4 years meet "5+ years required"? Current: 20% buffer.

2. **"Or equivalent experience":** How to handle "Bachelor's or equivalent experience"?

3. **Soft vs hard knockouts:** Should location be a warning or a hard knockout?

4. **User override:** Can users dismiss knockout warnings? Should we track dismissals?

5. **Certification fuzzy matching:** How fuzzy? "AWS Certified" vs "Amazon Web Services certified"?

---

## Document Metadata

| Field | Value |
| ----- | ----- |
| Created | 2026-03-04 |
| Status | Planning |
| Priority | HIGH |
| Dependencies | Phase 4 (Resume Parser), Phase 5 (Job Analyzer) |
| Parent | `040326_revised-master-plan.md` |
