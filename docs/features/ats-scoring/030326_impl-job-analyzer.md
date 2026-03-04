# Job Analyzer Implementation Guide

**Parent Document:** `040326_revised-master-plan.md`

**Role:** Shared Infrastructure - feeds into Stage 0 (Knockout Check) and Stage 2 (Keyword Scoring)

> **Enhancement Required:**
> This component must extract **hard requirements** for the Knockout Check (Stage 0):
>
> - `required_years_experience: int | None`
> - `required_education: Literal["none", "bachelors", "masters", "phd"] | None`
> - `required_certifications: list[str]`
> - `location_requirements: LocationRequirement`
>
> Additionally, for Stage 2 enhanced keyword scoring, extract **importance tiers** per skill:
>
> - Required (3x weight): "must have", "required", "mandatory"
> - Strongly Preferred (2x): "strongly preferred", "ideal candidate"
> - Preferred (1.5x): "nice to have", "bonus", "plus"
> - Mentioned (1x): No qualifier
>
> See `040326_knockout-check.md` and `040326_keyword-scoring.md` for details.

## Overview

This document provides an in-depth analysis of the hybrid Job Analyzer implementation, examining tradeoffs between accuracy, cost, effectiveness, correctness, and robustness. Unlike the previous phases which optimize auxiliary features, the Job Analyzer sits at the **core of the application's value proposition**—incorrect job analysis directly degrades resume tailoring quality.

---

## Application Purpose: Why This Feature Matters

### The Job Analyzer's Role in the System

The Job Analyzer is not an isolated feature. It is the **upstream data source** for:

1. **Resume Tailoring Engine** - Determines which skills/experiences to emphasize
2. **ATS Match Scoring** - Calculates how well a resume aligns with job requirements
3. **Gap Analysis** - Identifies missing qualifications the user should address
4. **Prioritization Guidance** - Tells users what matters most for each application

This creates a **cascading dependency**: if the Job Analyzer misses a required skill, the tailoring engine won't recommend adding it, the ATS score will show a false positive (claiming alignment that doesn't exist), and the user submits a resume that fails ATS screening.

### The Accuracy Imperative

Unlike Phase 1-3 features where small accuracy drops have limited impact:

- **Keyword extraction errors** → slightly suboptimal keyword emphasis
- **ATS structure errors** → minor formatting suggestions may be wrong
- **Block classification errors** → vault organization is less helpful

Job Analyzer errors have **multiplicative downstream effects**:

- **Missed skill extraction** → User doesn't add the skill → Resume rejected by ATS
- **Misclassified importance** → User deprioritizes a required skill → Resume ranked lower
- **Wrong salary extraction** → User has incorrect compensation expectations

**The stakes are higher here than in any previous phase.**

---

## Current State Analysis

### What the LLM Does Well

The current LLM-based analyzer excels at:

| Capability | Why LLM Handles It Well |
| ---------- | ----------------------- |
| **Importance categorization** | Requires contextual understanding ("must have 5+ years" vs "experience preferred") |
| **Soft skill detection** | Hidden in prose ("collaborative environment" implies teamwork) |
| **Ambiguity resolution** | "Python or similar" - what counts as similar? |
| **Novel terminology** | New frameworks, emerging tech not in any taxonomy |
| **Implicit requirements** | "Fast-paced startup" implies adaptability, long hours |

### What the LLM Does Poorly (or Expensively)

| Capability | Why ML/NLP Is Better |
| ---------- | -------------------- |
| **Salary extraction** | Pattern matching problem: "$X-$Y", "XK-YK", "$X/hr" |
| **Location detection** | Keyword matching: city names, "remote", "hybrid" |
| **Known skill extraction** | Taxonomy lookup: "Python", "React", "AWS" |
| **Years of experience** | Regex: "X+ years", "X-Y years experience" |
| **Education requirements** | Pattern: "Bachelor's", "BS/MS", "PhD preferred" |

---

## Tradeoff Analysis

### Dimension 1: Accuracy vs Cost

**The Core Question:** How much accuracy can we sacrifice to reduce costs by 50%+?

#### Accuracy Budget

| Component | Current LLM Accuracy (est.) | Target ML Accuracy | Acceptable Drop? |
| --------- | --------------------------- | ------------------ | ---------------- |
| Skill extraction | 95% | 90% | **NO** - Missed skills have direct user impact |
| Salary parsing | 92% | 95% | **YES** - Regex can exceed LLM for structured formats |
| Location detection | 98% | 99% | **YES** - Pattern matching is more reliable |
| Importance categorization | 88% | N/A (keep LLM) | N/A |
| Years requirement | 95% | 97% | **YES** - Regex is more precise |

**The Problem with 90% Skill Extraction:**

If we process 100 job postings with 10 skills each:

- Current: 95% accuracy → 50 missed skills total
- Target: 90% accuracy → 100 missed skills total

That's **50 additional resume-job mismatches per 100 jobs analyzed**. For a user applying to 20 jobs, that's ~10 missing skills they won't be prompted to add.

**Recommendation:** Skill extraction cannot accept accuracy degradation. This is where the hybrid approach is non-negotiable—unknown skills must fall back to LLM.

#### Cost Analysis

| Scenario | Per-Analysis Cost | Monthly Cost (1000/day) | % Savings |
| -------- | ----------------- | ----------------------- | --------- |
| Current (full LLM) | $0.02 | $600 | - |
| Hybrid (50% LLM tokens) | $0.01 | $300 | 50% |
| Aggressive hybrid (30% LLM) | $0.006 | $180 | 70% |
| ML-only (no LLM) | $0.00 | $0 | 100% |

**The 30-50% LLM zone is optimal.** Going ML-only sacrifices too much accuracy for importance categorization and novel skill detection.

---

### Dimension 2: Correctness vs Robustness

**Correctness:** Does the system give the right answer for well-formed inputs?
**Robustness:** Does the system degrade gracefully for messy/unusual inputs?

#### Job Posting Reality Check

Job postings are **not** clean, structured documents. Real-world examples:

```text
❌ Poorly formatted posting:
"Looking for ninja rockstar who can Python and also maybe some JS
idk we're a startup. Remote-ish. Comp is competitive lol"

❌ Overly formal enterprise posting:
"The successful candidate will demonstrate proficiency in enterprise-grade
distributed systems architecture leveraging cloud-native paradigms..."

❌ Copy-paste errors:
"Requirements:
- 5+ years Python
- 3+ years Python
- Experience with Python preferred"

❌ Mixed formatting:
"Skills: Python, Java. Also need: React (required), Vue.js (nice to have)
Must know: SQL"
```

#### The Robustness-Correctness Tradeoff Matrix

| Approach | Correctness (clean input) | Robustness (messy input) |
| -------- | ------------------------- | ------------------------ |
| Strict regex only | HIGH | LOW - Breaks on variations |
| Fuzzy matching | MEDIUM | HIGH - Tolerates noise |
| Taxonomy lookup | HIGH | MEDIUM - Misses synonyms |
| LLM | MEDIUM-HIGH | HIGH - Handles anything |
| Hybrid | HIGH | HIGH - Best of both |

**The ML-only trap:** A regex-based salary extractor that only handles "$X-$Y/year" format will fail on:

- "$80,000 - $100,000 annually"
- "80-100K"
- "Competitive (80-100k range)"
- "$85k base + bonus"

**Recommendation:** Use ML for extraction with **LLM fallback for low-confidence cases**. When regex/NER confidence is below threshold, invoke LLM for that specific field.

---

### Dimension 3: Effectiveness vs Complexity

**Effectiveness:** Does the system achieve its goal?
**Complexity:** How hard is the system to build, maintain, and debug?

#### Complexity Cost of Hybrid Architecture

```text
Simple (current):
  Job Text → LLM → Structured Output → Done

Hybrid (proposed):
  Job Text → [Splitter]
              ├── Known patterns → Regex/NER → Structured Fields
              ├── Taxonomy matches → Skill Lookup → Skill List
              ├── Unknown patterns → LLM → Remaining Fields
              └── Merger → Combined Output → Validation → Done
```

**Hidden Complexity:**

1. **Orchestration logic** - Which fields go to which extractor?
2. **Confidence thresholds** - When does ML result trigger LLM fallback?
3. **Result merging** - How to combine ML and LLM outputs?
4. **Schema consistency** - Both paths must produce identical output structure
5. **Error handling** - Partial failures (ML succeeds, LLM fails)
6. **Testing matrix** - Every field × every extractor path

#### Is the Complexity Worth It?

| Factor | Value |
| ------ | ----- |
| Cost savings | $300-420/month (at 1000/day) |
| Latency improvement | 3-5s → <1s |
| Reliability improvement | No LLM outages for pattern fields |
| Maintenance burden | +1 engineer-week/quarter |

**The math:** At $400/month savings, the hybrid approach pays for ~8 hours of engineering maintenance per month. If maintenance takes less, it's worth it.

**Recommendation:** Accept the complexity but **invest heavily in the abstraction layer**. A clean `FieldExtractor` interface that hides ML vs LLM routing makes the system manageable.

---

### Dimension 4: Speed vs Accuracy (Latency Analysis)

**Current state:** 3-5 second latency is acceptable for "background analysis" but unacceptable for "real-time feedback".

#### User Experience Impact

| Latency | User Perception | UX Implication |
| ------- | --------------- | -------------- |
| <500ms | Instant | Real-time suggestions as user pastes job URL |
| 500ms-2s | Fast | Can show inline during workflow |
| 2-5s | Noticeable | Requires loading state, breaks flow |
| >5s | Slow | Users context-switch, lose focus |

**The hybrid enables a new UX pattern:**

1. **Instant (ML-only):** Show detected skills, salary, location immediately
2. **Background (LLM):** Refine importance categorization, add novel skills
3. **Update:** Stream in LLM results as they complete

This "progressive enhancement" UX is **only possible with hybrid architecture.**

---

### Dimension 5: Novel Skills Problem

**This is the hardest problem in the entire phase.**

The skills taxonomy will never be complete. New frameworks appear constantly:

- 2023: LangChain, ChromaDB
- 2024: Ollama, Cursor
- 2025+: ???

#### Options for Novel Skill Detection

| Approach | Pros | Cons |
| -------- | ---- | ---- |
| **LLM fallback for unknown terms** | Catches everything | Expensive per-query |
| **Embedding similarity to known skills** | Fast, catches related terms | May miss truly novel concepts |
| **Community/crowd-sourced taxonomy updates** | Comprehensive long-term | Slow to update, maintenance burden |
| **Hybrid: embedding + LLM verification** | Balanced accuracy/cost | Complex implementation |

**Recommendation:** Use embedding similarity to flag potential skills, then batch-verify with LLM:

```text
"Bun" → embeddings → similar to ["npm", "yarn", "Node.js"]
      → confidence 0.7 → flag for LLM verification
      → LLM confirms: "Yes, Bun is a JavaScript runtime/package manager"
      → Add to taxonomy for future
```

This creates a **self-improving taxonomy** without per-query LLM costs.

---

## Risk Analysis

### High-Risk Failure Modes

| Risk | Impact | Likelihood | Mitigation |
| ---- | ------ | ---------- | ---------- |
| Missed required skill | User submits weak resume | HIGH (at 90% accuracy) | LLM fallback + conservative thresholds |
| Wrong importance level | User deprioritizes key skill | MEDIUM | Keep importance categorization in LLM |
| Salary parsing error | User has wrong expectations | LOW (formats are standard) | Comprehensive regex + validation |
| Complete extraction failure | No analysis available | LOW | Graceful degradation to full LLM |

### The "Worse Than Nothing" Scenario

A job analyzer that **confidently provides wrong information** is worse than no analyzer at all. User trust is destroyed when:

- Resume gets rejected despite "95% match" score
- User learns they're underpaid because salary was parsed wrong
- Required skill was marked "nice to have" and user didn't add it

**Mitigation:** Always show confidence scores. "85% confident these are the required skills" sets appropriate expectations.

---

## Recommended Architecture

### Field-by-Field Strategy

| Field | Primary Extractor | Fallback | Confidence Threshold |
| ----- | ----------------- | -------- | -------------------- |
| Skills (known) | Taxonomy lookup + NER | LLM | 0.95 |
| Skills (unknown) | Embedding similarity | LLM verification | 0.80 |
| Salary | Regex ensemble | LLM | 0.90 |
| Location | Keyword + geocoding | LLM | 0.95 |
| Remote status | Keyword rules | LLM | 0.90 |
| Years experience | Regex | LLM | 0.95 |
| Education | Regex + keyword | LLM | 0.90 |
| Importance | **LLM only** | N/A | N/A |
| Soft skills | **LLM only** | N/A | N/A |
| Company culture | **LLM only** | N/A | N/A |

### The 40/60 Split

Based on analysis, target:

- **40% of extraction** via ML/NLP (pattern fields)
- **60% of extraction** via LLM (nuanced understanding)

This is more conservative than the master plan's 50% target, but reflects the **critical nature of this feature**.

---

## Definition of Done (Revised)

Based on this analysis, the original completion criteria need adjustment:

### Original Criteria (from master plan)

- [ ] Skill extraction via spaCy NER + skills taxonomy
- [ ] Salary extraction via comprehensive regex patterns
- [ ] Location/remote detection via keyword matching
- [ ] Requirements parsing via keyword triggers
- [ ] LLM for importance categorization
- [ ] Latency under 1 second (p95)
- [ ] Cost reduction >= 50%

### Revised Criteria (accounting for tradeoffs)

**Accuracy Preservation:**

- [ ] Skill extraction accuracy >= 95% (same as LLM baseline)
- [ ] Novel skill detection system with taxonomy self-improvement
- [ ] Confidence scores exposed for all ML-extracted fields
- [ ] LLM fallback trigger rate monitoring (target: <20% of analyses)

**Cost Reduction:**

- [ ] Cost reduction >= 40% (revised from 50% - preserving accuracy matters more)
- [ ] Per-field cost tracking for optimization decisions

**Latency:**

- [ ] ML-only fields returned in <200ms
- [ ] Full analysis (including LLM fields) under 1.5s (p95)
- [ ] Progressive loading support in API response

**Robustness:**

- [ ] Handles 5 different salary format variations
- [ ] Handles international location formats
- [ ] Graceful degradation to full LLM on extraction failure
- [ ] No confidence score below 0.70 exposed to user without warning

**Testing:**

- [ ] Benchmark against 500+ real job postings (diverse industries)
- [ ] A/B test against LLM-only for 1000 analyses before cutover
- [ ] Track downstream impact on ATS match accuracy

---

## Blindspots & Open Questions

### Technical Blindspots

1. **Embedding model selection** - sentence-transformers has many variants. Which balances speed/accuracy for skill similarity?

2. **Taxonomy initialization** - Where does the initial skills list come from? How comprehensive must it be at launch?

3. **Multi-language job postings** - Some postings are in English but include non-English company names or locations.

4. **Duplicate requirement detection** - Same skill listed multiple ways ("Python", "Python 3", "Python programming").

### Product Blindspots

1. **User expectation management** - How do we communicate "this analysis may be incomplete" without undermining confidence?

2. **Correction workflow** - When ML gets it wrong, how does user provide feedback? Does it improve the system?

3. **Industry-specific requirements** - "SEC compliance experience" means nothing to ML but is critical for finance roles.

### Strategic Blindspots

1. **LLM cost trajectory** - If LLM costs drop 80% next year, is this optimization worth the complexity?

2. **Competitive analysis** - What do competitors use? Are they solving this differently?

---

## Conclusion

Phase 5 is the most **consequential** phase in the ML/NLP optimization plan. Unlike infrastructure or auxiliary features, errors here directly impact the core value proposition.

**Key recommendations:**

1. **Prioritize accuracy over cost savings** - Accept 40% savings instead of 50% if it preserves accuracy
2. **Keep importance categorization in LLM** - This requires nuanced understanding
3. **Build self-improving taxonomy** - Novel skill detection is the hardest problem
4. **Implement progressive loading UX** - Show ML results instantly, LLM results on completion
5. **Expose confidence scores** - Never show uncertain results without user awareness
6. **A/B test extensively** - This feature cannot ship without proving parity with LLM

The hybrid architecture is correct, but the implementation must be **conservative where it matters** (skill extraction) and **aggressive where it's safe** (pattern fields like salary, location).

---

## Document Metadata

- **Phase:** 5 - Job Analyzer (Hybrid)
- **Created:** 2026-03-03
- **Status:** Analysis Complete
- **Parent Document:** `030326_ml-nlp-optimization-master-plan.md`
- **Implementation Status:** Pending
