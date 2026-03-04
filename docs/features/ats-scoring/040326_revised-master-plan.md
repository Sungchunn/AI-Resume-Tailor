# ATS Scoring System - Revised Master Plan

**Purpose:** Define the comprehensive ATS scoring architecture that reverse-engineers real ATS behavior for job seekers.

**Supersedes:** `030326_ml-nlp-optimization-master-plan.md` (now deprecated)

**Based On:** `ats-scoring-proposal.md` architectural improvements

---

## Executive Summary

This revised plan restructures the ATS scoring system from a 6-phase ML/NLP migration into a **5-stage scoring architecture** that better reflects how real ATS systems evaluate candidates. The key insight is that ATS systems don't just check keyword presence—they evaluate candidates across multiple axes simultaneously.

### What Changed

| Aspect | Old Plan | New Plan |
| ------ | -------- | -------- |
| Architecture | 6 independent optimization phases | 5-stage scoring pipeline |
| Pre-scoring | None | **Knockout Check (Stage 0)** - binary qualifiers |
| Keywords | Presence-based matching | Placement + density + recency weighting |
| Content Quality | Block classification only | + Quantification density signal |
| Role Fit | Via semantic matcher (indirect) | **Dedicated Role Proximity Score** |
| Structure | Basic parsability | + Section order validation |
| Weights | Implicit/undefined | Explicit: 15% / 40% / 25% / 20% |

### Why This Matters

The original plan focused on **cost optimization** (migrating LLM to ML/NLP). This revised plan focuses on **accuracy optimization** (matching real ATS behavior) while retaining the ML/NLP cost benefits. The biggest UX win is the **Knockout Check**—showing users binary disqualifiers *before* they see a match percentage.

---

## Scoring Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 0: KNOCKOUT CHECK                         │
│                    (binary pass/fail, BEFORE scoring)              │
│                                                                    │
│  Input: Resume + Job Description                                   │
│  Checks:                                                           │
│    • Years of experience vs. requirement                           │
│    • Education level vs. requirement                               │
│    • Required certifications detected?                             │
│    • Location / work authorization (if extractable)                │
│                                                                    │
│  Output: ✅ Qualified to score  |  ⚠️ Knockout risk detected       │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼  (proceed regardless, but flag risk)
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: STRUCTURAL SCORE                       │
│                    Weight: 15%                                     │
│                                                                    │
│  Components:                                                       │
│    • Section detection (regex + fuzzy matching)                    │
│    • Contact info parsability                                      │
│    • Date format consistency                                       │
│    • Section order validity (NEW)                                  │
│                                                                    │
│  Output: 0-100 structural score                                    │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: KEYWORD SCORE                          │
│                    Weight: 40%                                     │
│                                                                    │
│  Layered matching:                                                 │
│    Layer 1: Exact match                                            │
│    Layer 2: Lemmatized match                                       │
│    Layer 3: Abbreviation expansion                                 │
│    Layer 4: Taxonomy synonyms                                      │
│    Layer 5: Fuzzy match (high threshold)                           │
│    Layer 6: Embedding similarity (fallback)                        │
│                                                                    │
│  Enhanced signals (NEW):                                           │
│    • Placement weighting: experience section > skills section      │
│    • Density scoring: diminishing returns after 3 appearances      │
│    • Recency weighting: last 2 roles weighted 2x                   │
│    • Importance tiers: required keywords weighted 3x vs preferred  │
│                                                                    │
│  Output: 0-100 keyword score + gap list with importance tier       │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 3: CONTENT QUALITY SCORE                  │
│                    Weight: 25%                                     │
│                                                                    │
│  Block classification (existing):                                  │
│    • Achievement vs Responsibility ratio                           │
│    • Achievement blocks weighted higher                            │
│                                                                    │
│  Quantification density (NEW):                                     │
│    • Percentage of bullets containing numeric metrics              │
│    • Regex-based detection of quantified achievements              │
│    • Penalty for bullets lacking action verbs                      │
│                                                                    │
│  Output: 0-100 content quality score                               │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: ROLE PROXIMITY SCORE                   │
│                    Weight: 20%                                     │
│                    (NEW STAGE)                                     │
│                                                                    │
│  Components:                                                       │
│    • Title match: most recent title vs. target title               │
│    • Career trajectory: moving toward or away from role?           │
│    • Industry alignment: same sector or adjacent?                  │
│                                                                    │
│  Uses existing semantic matcher infrastructure                     │
│                                                                    │
│  Output: 0-100 proximity score                                     │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    FINAL COMPOSITE SCORE                           │
│                                                                    │
│  Calculation:                                                      │
│    Structural:      15%  ×  Stage 1 score                          │
│    Keywords:        40%  ×  Stage 2 score                          │
│    Content Quality: 25%  ×  Stage 3 score                          │
│    Role Proximity:  20%  ×  Stage 4 score                          │
│                                                                    │
│  Knockout flag handling:                                           │
│    If knockout detected → Score shown with warning                 │
│    "90% keyword match, but knockout risk detected"                 │
│                                                                    │
│  Output: 0-100 ATS score + knockout warnings + gap analysis        │
└────────────────────────────────────────────────────────────────────┘
```

---

## Weight Rationale

| Signal | Weight | Rationale |
| ------ | ------ | --------- |
| Keywords | 40% | Primary differentiator in all major ATS systems. Highest user control. |
| Content Quality | 25% | Modern ATS (Greenhouse, Lever) increasingly score content quality, not just presence. |
| Role Proximity | 20% | Candidate ranking heavily influenced by title match in enterprise ATS. |
| Structure | 15% | Binary qualifier more than differentiator—most resumes pass structure checks. |

---

## Implementation Stages

### Stage 0: Knockout Check

**Priority:** HIGH (Biggest UX differentiator)

**Sub-document:** `040326_knockout-check.md`

**Problem Solved:** A user with a 90% keyword match but missing a hard requirement (5+ years, required certification) will be auto-rejected. Showing them "90% match" without the knockout warning is actively harmful.

**What It Checks:**

| Qualifier | Detection Method | Source |
| --------- | ---------------- | ------ |
| Years of experience | Regex extraction from job + resume date math | Job Analyzer (Phase 5) + Resume Parser |
| Education level | Pattern matching ("Bachelor's required") | Job Analyzer |
| Required certifications | Taxonomy + exact match | Job Analyzer + Resume Parser |
| Location/authorization | Keyword matching | Job Analyzer + Resume contact info |

**Key Signals to Extract from Job Analyzer:**

The existing Phase 5 (Job Analyzer) must be enhanced to explicitly extract:

- `required_years_experience: int | None`
- `required_education: Literal["none", "bachelors", "masters", "phd"] | None`
- `required_certifications: list[str]`
- `location_requirements: LocationRequirement`

**UI Behavior:**

```text
⚠️  Knockout Risk Detected
    - Role requires 5+ years of experience (your resume shows ~1 year)
    - AWS certification listed as required — not found on your resume

    These are hard disqualifiers in most ATS systems. Consider addressing
    them before applying, or applying to roles better matched to your
    experience level.

    [View your ATS score anyway →]
```

**Definition of Completion:**

- [ ] Extract hard requirements from Job Analyzer
- [ ] Calculate experience duration from resume dates
- [ ] Match certifications against resume
- [ ] Surface knockout warnings separately from score
- [ ] UI component for knockout warning display

---

### Stage 1: Structural Score

**Priority:** LOW (Minor enhancement to existing Phase 2)

**Sub-document:** `030326_impl-structural-analysis.md` (update with section order)

**Existing Components (Phase 2):**

- Section header detection via regex + fuzzy matching
- Contact info extraction validation
- Date format consistency checking
- Section completeness checklist

**New Addition: Section Order Validation:**

Some ATS systems (Taleo notably) penalize non-standard section ordering.

**Expected Order (standard):**

1. Contact Information / Header
2. Summary / Objective (optional)
3. Work Experience
4. Education
5. Skills
6. Certifications / Awards (optional)

**Scoring:**

- Standard order: 100%
- Minor deviation (Skills before Education): 95%
- Major deviation (Education before Experience): 85%
- Completely non-standard: 75%

**Implementation:**

- Extract section positions during parsing
- Compare against expected order
- Apply penalty factor to structural score

---

### Stage 2: Keyword Score

**Priority:** MEDIUM-HIGH (Significant accuracy improvement)

**Sub-document:** `040326_keyword-scoring.md`

**Existing Layered Matching (Phase 6):**

1. Exact match → Lemmatized → Abbreviation → Taxonomy → Fuzzy → Embedding

**New Enhancements:**

#### 2.1 Placement Weighting

Keywords found in different sections should score differently:

| Section | Weight | Rationale |
| ------- | ------ | --------- |
| Work Experience bullets | 1.0x | Demonstrated experience |
| Project descriptions | 0.9x | Applied knowledge |
| Skills section | 0.7x | Listed but not demonstrated |
| Summary/Objective | 0.6x | Claims without evidence |
| Education | 0.5x | Academic context |

**Implementation:**

- Track which section each keyword match comes from
- Apply section weight to match confidence

#### 2.2 Density Scoring with Diminishing Returns

Keyword repetition matters, but with diminishing returns:

| Occurrences | Score Multiplier |
| ----------- | ---------------- |
| 1 | 1.0x |
| 2 | 1.3x |
| 3 | 1.5x |
| 4+ | 1.5x (capped) |

**Implementation:**

- Count keyword occurrences across resume
- Apply logarithmic scaling, capped at 3 occurrences

#### 2.3 Recency Weighting

Keywords in recent roles matter more:

| Role Position | Weight |
| ------------- | ------ |
| Most recent role | 2.0x |
| Second most recent | 2.0x |
| Third most recent | 1.0x |
| Older roles | 0.8x |

**Implementation:**

- Order experience entries by date
- Apply recency multiplier to keyword matches in each section

#### 2.4 Required vs Preferred Tiers

Not all keywords are equal importance:

| Importance | Weight | Detection |
| ---------- | ------ | --------- |
| Required | 3.0x | "must have", "required", "X+ years required" |
| Strongly Preferred | 2.0x | "strongly preferred", "ideal candidate" |
| Preferred | 1.5x | "preferred", "nice to have", "bonus" |
| Mentioned | 1.0x | No qualifier, just listed |

**Implementation:**

- Job Analyzer extracts importance tier per requirement
- Keyword score weights by importance tier
- Gap analysis prioritizes by importance

---

### Stage 3: Content Quality Score

**Priority:** LOW (Minor enhancement to existing Phase 3)

**Sub-document:** `030326_impl-content-quality.md` (update with quantification)

**Existing Components (Phase 3):**

- Block classification (Achievement vs Responsibility)
- Achievement/Responsibility ratio scoring
- Achievement blocks weighted higher

**New Addition: Quantification Density:**

**Rationale:** A bullet that says "Increased revenue by 40%" outscores "Responsible for revenue growth" not just because of block type, but because of the numeric metric.

**Detection:**

- Regex patterns for numeric achievements:
  - Percentages: `\d+%`, `X percent`
  - Currency: `\$[\d,]+[KMB]?`, `saved \$X`
  - Quantities: `\d+[+]? (users|customers|projects|team members)`
  - Time: `reduced by X (hours|days|weeks)`
  - Multiples: `Xx improvement`, `X-fold increase`

**Scoring:**

- Calculate percentage of bullets containing quantified metrics
- Target: 50%+ of achievement bullets should be quantified
- Apply bonus for quantification density above threshold

**Implementation:**

```python
QUANTIFICATION_PATTERNS = [
    r'\d+%',                           # Percentages
    r'\$[\d,]+[KMB]?',                 # Currency
    r'\d+[+]?\s*(users|customers|...)', # Quantities
    r'\d+[xX]\s*(improvement|...)',    # Multiples
    r'(reduced|increased).*\d+',       # Comparative metrics
]

def calculate_quantification_density(bullets: list[str]) -> float:
    quantified = sum(1 for b in bullets if any(re.search(p, b) for p in QUANTIFICATION_PATTERNS))
    return quantified / len(bullets) if bullets else 0.0
```

---

### Stage 4: Role Proximity Score

**Priority:** MEDIUM (New stage using existing infrastructure)

**Sub-document:** `040326_role-proximity.md`

**Purpose:** Many ATS systems match the applicant's job title history against the target role. This stage explicitly scores that proximity.

**Components:**

#### 4.1 Title Match

Compare candidate's most recent title(s) to target job title:

| Match Type | Score |
| ---------- | ----- |
| Exact title match | 100 |
| Same level, same function | 90 |
| Adjacent level (one step up/down) | 75 |
| Same function, different level (2+ steps) | 50 |
| Different function | 25 |

**Implementation:**

- Use semantic matcher embeddings for title similarity
- Maintain title hierarchy (Junior → Mid → Senior → Lead → Manager → Director)
- Map titles to function categories (Engineering, Design, Product, etc.)

#### 4.2 Career Trajectory

Is the candidate moving toward or away from this role?

| Trajectory | Score Modifier |
| ---------- | -------------- |
| Clear progression toward role | +20 |
| Lateral move (same level) | +0 |
| Step down / career change | -10 |

**Detection:**

- Analyze title progression across experiences
- Determine if target role is a logical next step

#### 4.3 Industry Alignment

Same sector or adjacent industry?

| Alignment | Score Modifier |
| --------- | -------------- |
| Same industry | +10 |
| Adjacent industry | +5 |
| Unrelated industry | +0 |

**Implementation:**

- Extract company industry from resume (manual or via enrichment)
- Extract target company industry from job posting
- Use industry taxonomy for adjacency

---

## Implementation Priority

Based on impact analysis from the proposal:

| Priority | Stage/Enhancement | Rationale |
| -------- | ----------------- | --------- |
| **1** | Knockout Check (Stage 0) | Biggest UX win. Pure product differentiation. |
| **2** | Keyword importance tiers (Stage 2.4) | High accuracy uplift, low implementation cost. |
| **3** | Keyword placement weighting (Stage 2.1) | Explains *where* to put keywords, not just *which*. |
| **4** | Role Proximity Score (Stage 4) | Contextualizes score: "90% keywords, 40% role match". |
| **5** | Quantification density (Stage 3) | Concrete, actionable editing target. |
| **6** | Keyword density/recency (Stage 2.2, 2.3) | Refinement, lower impact than core changes. |
| **7** | Section order (Stage 1) | Low impact, high edge-case specificity. |

---

## Mapping: Old Phases → New Stages

| Old Phase | New Location | Changes |
| --------- | ------------ | ------- |
| Phase 1: Keyword Extraction | Shared Infrastructure | No change to scope |
| Phase 2: ATS Structure Analysis | Stage 1: Structural Score | + Section order validation |
| Phase 3: Block Classification | Stage 3: Content Quality | + Quantification density |
| Phase 4: Resume Parser | Shared Infrastructure | + Extract years of experience for knockout |
| Phase 5: Job Analyzer | Stage 0 + Stage 2 | + Extract hard requirements + importance tiers |
| Phase 6: Keyword Matching | Stage 2: Keyword Score | + Placement + density + recency |
| (New) | Stage 0: Knockout Check | Binary qualifier detection |
| (New) | Stage 4: Role Proximity | Title/trajectory/industry scoring |

---

## Document Index

### Architecture Documents (What to Score)

| Document | Status | Purpose |
| -------- | ------ | ------- |
| `040326_revised-master-plan.md` | **Active** | This document - overall architecture |
| `040326_knockout-check.md` | Pending | Stage 0: Knockout check design |
| `040326_keyword-scoring.md` | Pending | Stage 2: Enhanced keyword scoring |
| `040326_role-proximity.md` | Pending | Stage 4: Role proximity scoring |

### Implementation Documents (How to Build)

| Document | Status | Purpose |
| -------- | ------ | ------- |
| `030326_impl-keyword-extraction.md` | Active | Shared infra: ML/NLP keyword extraction |
| `030326_impl-structural-analysis.md` | ✅ Complete | Stage 1: Structural score with section order validation |
| `030326_impl-content-quality.md` | Update Pending | Stage 3: Content quality implementation |
| `030326_impl-resume-parser.md` | Active | Shared infra: Resume parser (feeds all stages) |
| `030326_impl-job-analyzer.md` | Update Pending | Shared infra: Job analyzer (feeds Stage 0 + 2) |

### Reference

| Document | Status | Purpose |
| -------- | ------ | ------- |
| `ats-scoring-proposal.md` | Reference | Original architecture proposal |

---

## Success Metrics

| Metric | Target | Measurement |
| ------ | ------ | ----------- |
| Knockout detection accuracy | ≥95% | Manual review of flagged cases |
| Keyword score correlation with ATS pass rate | ≥0.8 | User feedback + outcome tracking |
| User trust (qualitative) | Improved | Survey / NPS |
| Gap analysis actionability | ≥90% actionable items | User feedback |
| Overall ATS score accuracy | Within 10% of actual ATS outcome | Outcome tracking |

---

## Session Management Notes

**For AI assistants working on this feature:**

1. Start each session by reading this master plan
2. Check the Document Index for current status of each sub-document
3. Work on ONE stage per session to maintain focus
4. Update the Document Index status after completing each stage
5. Do not assume context from previous sessions - verify by reading docs
6. Prioritize implementation per the Priority table above

---

## Changelog

| Date | Change |
| ---- | ------ |
| 2026-03-04 | Initial creation, superseding 030326_ml-nlp-optimization-master-plan.md |
