# ATS Scoring System — Architecture Proposal

Reverse-engineering real ATS behavior for job seekers

---

## The Core Problem with Your Current Design

Your current ATS score is built as three additive signals:

```text
Final Score = Structure (P2) + Keywords (P6) + Block Weight (P3)
```

This is directionally correct but architecturally incomplete when compared to how real ATS systems like Workday, Greenhouse, Lever, iCIMS, and Taleo actually score candidates. The gap isn't in your individual phases — your individual phase decisions are well-reasoned — but in **what the scoring formula itself models**.

Real ATS systems don't just check "did you say the keyword." They score across multiple axes simultaneously, some of which your pipeline currently doesn't capture at all.

---

## How Real ATS Systems Actually Score

Based on publicly documented behavior and reverse-engineering from tools like Jobscan, Resume Worded, and known Workday/Taleo parser behavior, here's what major ATS systems actually evaluate:

### Axis 1: Keyword Presence + Density (your Phase 6)

The most commonly misunderstood signal. Real ATS systems don't just check presence — they also check:

- **Frequency:** Does the keyword appear once vs. multiple times? (most systems weight repetition, capped at 3-4x)
- **Section placement:** A keyword in a "Skills" section counts less than the same keyword inside a work experience bullet in most systems. Workday in particular heavily weights keywords that appear in the context of *demonstrated experience*, not just listed skills.
- **Recency:** Keywords associated with recent roles are weighted more than those buried in older experience.

**Current gap:** Your P6 scores keyword presence but not placement, density, or recency.

---

### Axis 2: Structural Parsability (your Phase 2)

Your current Phase 2 design is actually the most correctly aligned of all phases — this one is architecturally sound because ATS parsers really are rule-based. The migration to rule-based is correct.

**One gap to address:** "Section order" matters in some parsers (Taleo notably penalizes non-standard orderings like placing Skills before Work Experience). Add a section order check to Phase 2.

---

### Axis 3: Qualification Match — Hard Cutoffs (not yet in your system)

This is arguably the **most impactful** axis and it's missing from your pipeline entirely.

Real ATS systems (especially enterprise ones like Workday and iCIMS) apply **binary knockout rules** before scoring begins. These are the "minimum requirements" gates that many systems auto-reject on:

- **Years of experience:** "5+ years" as a hard cutoff. If the resume doesn't demonstrate it, score = 0 regardless of keywords.
- **Education requirements:** "Bachelor's required." Some systems auto-reject if degree isn't detected.
- **Location/authorization:** "Must be authorized to work in [country]."
- **Certification requirements:** "PMP required," "AWS Certified," etc.

These are threshold rules, not continuous scoring, and most job seekers don't understand they exist. Your app has a major UX and accuracy opportunity here: **show knockout risk explicitly before the keyword score**.

**Proposed addition:** A pre-score "Knockout Risk Check" that surfaces binary disqualifiers separately from the match percentage. This is high-impact because a 90% keyword match means nothing if the candidate trips a hard cutoff.

---

### Axis 4: Title/Role Proximity (partially in your system via semantic matching)

Many ATS systems match the applicant's most recent job title against the target role title. Systems like Greenhouse use this to rank candidates within a pipeline. The closer your title history is to the target title, the higher you rank among candidates with similar keyword scores.

Your semantic matcher partially handles this but it's being used for vault block matching, not for a dedicated title proximity score. Consider separating this out as a distinct scoring signal.

---

### Axis 5: Content Quality Signals (your Phase 3)

Your Phase 3 block classification (Achievement vs Responsibility) is correct and aligns with how modern ATS systems like Greenhouse and Lever score content quality. Achievements with quantified impact score higher.

The gap: you weight block types for scoring but the **density of quantification** matters separately. A bullet that says "Increased revenue by 40%" outscores "Responsible for revenue growth" not just because of its block type but because of the presence of a numeric metric. This is detectable with a simple regex pass and should be a separate signal.

---

## Proposed Scoring Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 0: KNOCKOUT CHECK                         │
│                    (binary pass/fail, before scoring)              │
│                                                                    │
│  • Years of experience vs. requirement                             │
│  • Education level vs. requirement                                 │
│  • Required certifications detected?                               │
│  • Location / work auth (if extractable)                           │
│                                                                    │
│  Output: ✅ Qualified to score  |  ⚠️ Knockout risk detected       │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼  (only if no hard knockouts)
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: STRUCTURAL SCORE (P2)                  │
│                    Weight: 15%                                      │
│                                                                    │
│  • Section detection (regex + fuzzy)                               │
│  • Contact info parsability                                        │
│  • Date format consistency                                         │
│  • Section order validity  ← new                                   │
│                                                                    │
│  Output: 0-100 structural score                                    │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: KEYWORD SCORE (P6)                     │
│                    Weight: 40%                                      │
│                                                                    │
│  Layered matching (your existing design is correct):               │
│  Layer 1: Exact → Layer 2: Lemma → Layer 3: Abbrev →               │
│  Layer 4: Taxonomy → Layer 5: Fuzzy → Layer 6: Embedding           │
│                                                                    │
│  Enhanced signals:                                                 │
│  • Keyword placement: experience section > skills section          │
│  • Keyword density: diminishing returns after 3 appearances        │
│  • Keyword recency: last 2 roles weighted 2x                       │
│  • Required vs. preferred: required keywords weighted 3x           │
│                                                                    │
│  Output: 0-100 keyword score + gap list with importance tier        │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 3: CONTENT QUALITY SCORE (P3 + new)       │
│                    Weight: 25%                                      │
│                                                                    │
│  Block classification (your existing P3):                          │
│  • Achievement/Responsibility ratio                                │
│  • Achievement blocks weighted higher                              │
│                                                                    │
│  Quantification density (new):                                     │
│  • Percentage of bullets containing numeric metrics                │
│  • Penalty for bullets with no action verb                         │
│                                                                    │
│  Output: 0-100 content quality score                               │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: ROLE PROXIMITY SCORE (new)             │
│                    Weight: 20%                                      │
│                                                                    │
│  • Title match: most recent title vs. target title                 │
│  • Career trajectory: are they moving toward this role?            │
│  • Industry alignment: same sector or adjacent?                    │
│                                                                    │
│  Output: 0-100 proximity score                                     │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    FINAL COMPOSITE SCORE                           │
│                                                                    │
│  Structural:      15%  ×  P2 score                                 │
│  Keywords:        40%  ×  P6 score                                 │
│  Content Quality: 25%  ×  P3 + quantification score               │
│  Role Proximity:  20%  ×  title + trajectory score                 │
│                                                                    │
│  Output: 0-100 ATS score                                           │
│  Note: Score is suppressed / flagged if knockout risk detected     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Weights Rationale

These weights are based on documented ATS behavior and the relative impact of each axis on actual pass/fail outcomes:

| Signal | Weight | Rationale |
| -------- | -------- | ----------- |
| Keywords | 40% | Primary differentiator in all major ATS systems. Highest user control. |
| Content Quality | 25% | Modern ATS (Greenhouse, Lever) increasingly score content quality, not just presence. |
| Role Proximity | 20% | Candidate ranking is heavily influenced by title match in enterprise ATS. |
| Structure | 15% | Binary qualifier more than a differentiator — most resumes pass structure checks. |

---

## The Knockout Stage: UX Design Principle

This is the biggest UX improvement you can make.

Display knockout risk **before** the composite score, not as a component of it. If you have a user who has a 90% keyword score but is a fresh grad applying to a role that requires 5 years — showing them "90% match" is actively harmful. It leads to a wasted application and erodes trust when they get auto-rejected.

Suggested UI behavior:

```text
⚠️  Knockout Risk Detected
    - Role requires 5+ years of experience (your resume shows ~1 year)
    - AWS certification listed as required — not found on your resume

    These are hard disqualifiers in most ATS systems. Consider addressing
    them before applying, or applying to roles better matched to your experience level.

    [View your ATS score anyway →]  ←  still show score, but as secondary info
```

This is the kind of honest, differentiated feedback that resume tools in the market (Jobscan, Resume Worded) either don't show, or show poorly. It's also directly aligned with your app's mission: reverse-engineering the system *for the applicant*.

---

## What Changes vs. Your Current Phase Plan

| Phase | Change Needed | Priority |
| ------- | -------------- | ---------- |
| P2 (Structure) | Add section-order validation | Low |
| P6 (Keywords) | Add placement + density + recency weighting | Medium |
| P5 (Job Analyzer) | Extract hard-requirement signals (years, degree, certs) | High |
| New: Knockout Stage | Build binary qualifier check before scoring | High |
| New: Role Proximity | Add title/trajectory scoring using semantic matcher | Medium |
| P3 (Block Classification) | Add quantification density as separate signal | Low |

---

## Execution Recommendation

Given your current phase order, here's what to prioritize for best outcome:

**Do immediately:**

1. **Knockout check** — extract from the Job Analyzer (P5) and surface separately in UI. This is a pure product win.
2. **Keyword placement/recency weighting in P6** — high accuracy uplift, low implementation cost.

**Do next:**
3. **Role proximity score** — reuse your existing semantic matcher infrastructure, add dedicated title comparison.
4. **Quantification density signal** — simple regex pass, feeds into P3 output.

**Do last:**
5. **Section order check in P2** — low impact, high edge-case specificity.

---

## What This Means for User Trust

The central insight of your app is that you're the applicant's ally against a system they can't see. The improvements above serve that mission directly:

- **Knockout detection** tells users what they genuinely cannot fix with keywords alone.
- **Placement/recency weighting** explains *where* to put keywords, not just *which* keywords.
- **Role proximity** contextualizes the score: "you're a 90% keyword match but a 40% role match — here's why."
- **Quantification density** gives users a concrete, actionable editing target beyond keywords.

Together, these move your ATS score from "a number that kind of makes sense" to "a diagnostic that mirrors how the system actually filters them."
