# Keyword Extraction Implementation Guide

**Parent Document:** `040326_revised-master-plan.md`

**Role:** Shared Infrastructure - feeds into Stage 2 (Keyword Scoring) and all matching operations

**Purpose:** This document provides an in-depth analysis of migrating keyword extraction from LLM-based to traditional ML/NLP approaches, with careful examination of tradeoffs specific to a resume tailoring application.

---

## 1. Application Context: Why Keywords Matter

In a resume tailoring application, keyword extraction is not a generic NLP task - it is the **foundation of the entire matching and tailoring pipeline**. Understanding this context is critical before making architectural decisions.

### 1.1 How Keywords Flow Through the System

```text
Job Description ─────────────────────────────────────────────────────┐
        │                                                            │
        ▼                                                            │
┌─────────────────┐                                                  │
│ Keyword Extract │◄──── THIS IS PHASE 1                             │
└────────┬────────┘                                                  │
         │                                                           │
         ▼                                                           │
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│ Skills Required │────►│ Gap Analysis    │────►│ Tailor Recs     │  │
└─────────────────┘     └─────────────────┘     └─────────────────┘  │
         │                       ▲                                   │
         │                       │                                   │
         ▼                       │                                   │
┌─────────────────┐              │                                   │
│ ATS Scoring     │──────────────┘                                   │
└─────────────────┘                                                  │
         ▲                                                           │
         │                                                           │
┌─────────────────┐                                                  │
│ Keyword Extract │◄──── ALSO PHASE 1                                │
└────────┬────────┘                                                  │
         │                                                           │
Resume Content ──────────────────────────────────────────────────────┘
```

**Critical Observation:** Keyword extraction errors cascade. If we miss "Kubernetes" from a job description, the user won't be told to add it. If we incorrectly extract "management" as a skill when it's part of "project management," the matching algorithm will produce false positives.

### 1.2 User-Facing Impact

| Extraction Error Type | User Experience Impact |
| --------------------- | ---------------------- |
| **False Negative** (missed keyword) | User not advised to add a skill they need; lower match score than deserved |
| **False Positive** (non-keyword extracted) | Cluttered recommendations; erodes trust in the system |
| **Granularity Error** (wrong level of specificity) | "Python" vs "Python 3.11" - affects match precision |
| **Compound Splitting** ("machine learning" → "machine" + "learning") | Nonsensical matches; breaks ATS score |

### 1.3 Frequency and Cost Profile

Based on the master plan, keyword extraction occurs:

- Every resume edit → ATS re-analysis
- Every job targeting action → Gap analysis
- Every tailoring session → Match scoring
- Every semantic comparison → Recommendation generation

At moderate scale (500 users, 10 actions/day each):

- **5,000 extractions/day**
- **Current LLM cost:** $50/day = $1,500/month
- **Target ML/NLP cost:** ~$0 marginal (infrastructure only)

The cost reduction is compelling, but only if accuracy holds.

---

## 2. Algorithm Analysis

### 2.1 RAKE (Rapid Automatic Keyword Extraction)

**How it works:**

1. Split text at stopwords and phrase delimiters
2. Build a word co-occurrence graph
3. Score candidates by: `word_degree / word_frequency`
4. Return highest-scoring candidates

**Strengths:**

- Unsupervised - no training data needed
- Fast (pure Python, no models)
- Language-agnostic (just needs stopwords list)
- Deterministic output

**Weaknesses for Resume Domain:**

```text
Input: "Developed machine learning models using Python and TensorFlow"

RAKE Output (typical):
- "developed machine" (score: 4.0)      ← Wrong compound
- "learning models" (score: 4.0)        ← Wrong compound
- "python" (score: 1.0)                 ← Correct
- "tensorflow" (score: 1.0)             ← Correct

Correct Output:
- "machine learning" (skill)
- "Python" (language)
- "TensorFlow" (framework)
```

**Resume Domain Problems:**

1. **Co-occurrence bias:** RAKE scores based on word co-occurrence patterns, not semantic relevance. Technical writing doesn't follow co-occurrence patterns that correlate with skill importance.

2. **No domain understanding:** "Developed" appears in every resume bullet but isn't a skill. RAKE doesn't know this.

3. **Compound term splitting:** "Machine learning," "data science," "project management" - RAKE splits these based on statistical patterns, not domain knowledge.

4. **Acronym blindness:** "AWS" won't score highly because it doesn't co-occur with many words.

### 2.2 KeyBERT

**How it works:**

1. Generate document embedding using BERT
2. Generate candidate keyword embeddings
3. Compute cosine similarity between document and candidates
4. Return candidates most similar to document meaning

**Strengths:**

- Semantic understanding (not just co-occurrence)
- Handles synonyms implicitly
- Better at identifying relevant technical terms
- Pre-trained on massive text corpora

**Weaknesses for Resume Domain:**

```text
Input: "Managed a team of 5 engineers building REST APIs"

KeyBERT Output (typical):
- "REST APIs" (similarity: 0.72)        ← Correct
- "engineers" (similarity: 0.65)        ← Debatable - role or skill?
- "team" (similarity: 0.58)             ← Wrong - not a skill
- "managed" (similarity: 0.55)          ← Wrong - action verb, not skill

Missing:
- "team leadership" (implicit skill)
- "API development" (category skill)
```

**Resume Domain Problems:**

1. **Generic vs. Domain-Specific:** BERT embeddings capture general semantic similarity, not resume-domain relevance. "Team" is semantically related to managing engineers, but it's not a skill keyword.

2. **No skills taxonomy awareness:** KeyBERT doesn't know that "React" is a frontend framework, "AWS" is a cloud provider, or that "Agile" is a methodology.

3. **Model loading overhead:** KeyBERT requires loading a BERT model (~400MB). First request has significant latency; memory footprint is substantial.

4. **Implicit skill extraction:** If someone says "optimized database queries for 10x performance," KeyBERT may not extract "performance optimization" or "database optimization" as skills - these are implicit.

### 2.3 LLM (Current Approach)

**How it works:**

1. Send text + prompt to GPT-4/Gemini
2. Prompt instructs: "Extract technical skills, tools, methodologies..."
3. LLM returns structured keyword list
4. Parse and return

**Strengths:**

- Deep semantic understanding
- World knowledge (knows what technologies exist)
- Can extract implicit skills
- Handles messy/ambiguous input
- Can categorize while extracting (hard skill vs. soft skill)
- Zero-shot - no training data needed

**Resume Domain Performance:**

```text
Input: "Managed a team of 5 engineers building REST APIs"

LLM Output (typical):
- "REST APIs" (technical skill)
- "API Development" (skill category)
- "Team Leadership" (soft skill)
- "Engineering Management" (role-based skill)
- "People Management" (soft skill)

This is actually excellent extraction - it captures both explicit and implicit skills.
```

**Weaknesses:**

1. **Cost:** $0.01 per extraction adds up at scale
2. **Latency:** 2-3 seconds is noticeable in UI
3. **Non-determinism:** Same input may yield slightly different outputs
4. **External dependency:** Rate limits, outages, API changes
5. **Prompt sensitivity:** Output quality depends on prompt engineering

### 2.4 Hybrid: RAKE + Domain Taxonomy

**How it works:**

1. Run RAKE to get candidate keywords
2. Filter candidates against skills taxonomy
3. Augment with direct taxonomy matching (regex/fuzzy)
4. Merge and deduplicate

**Strengths:**

- Fast (RAKE + lookup)
- Domain-aware (taxonomy filtering)
- No model loading overhead
- Deterministic
- Extensible (add to taxonomy as needed)

**Weaknesses:**

- **Taxonomy maintenance burden:** Someone must maintain the skills database
- **Coverage gaps:** New technologies won't be extracted until added to taxonomy
- **No implicit extraction:** Only extracts terms literally present in text
- **Compound term handling:** Requires explicit taxonomy entries for compound skills

---

## 3. Tradeoff Analysis

### 3.1 Accuracy vs. Cost Matrix

| Approach | Extraction Accuracy | Implicit Skills | Cost/Extract | Monthly (5K/day) |
| -------- | ------------------- | --------------- | ------------ | ---------------- |
| LLM (current) | ~95% | Yes | $0.01 | $1,500 |
| KeyBERT | ~75-80% | No | ~$0 | $0 |
| RAKE | ~50-60% | No | ~$0 | $0 |
| RAKE + Taxonomy | ~80-85% | No | ~$0 | $0 |

**Accuracy Definition:** Percentage of human-labeled keywords correctly extracted (precision + recall combined via F1).

**Analysis:** The accuracy gap between LLM and ML/NLP is significant. The master plan targets "within 5% of current LLM approach" - this may be unrealistic for pure ML/NLP approaches without significant investment in taxonomy and post-processing.

### 3.2 Effectiveness Analysis

**Effectiveness = Does the feature achieve its application purpose?**

For resume tailoring, effectiveness means:

1. Users are told which skills to add (requires low false negatives)
2. Users are not told to add irrelevant skills (requires low false positives)
3. Match scores are accurate (requires correct keyword weighting)

| Approach | False Neg Risk | False Pos Risk | Match Score Impact |
| -------- | -------------- | -------------- | ------------------ |
| LLM | Low | Low | High accuracy |
| KeyBERT | Medium | Medium | Moderate accuracy |
| RAKE | High | Very High | Poor accuracy |
| RAKE + Taxonomy | Medium | Low (taxonomy filtered) | Moderate accuracy |

**Critical Insight:** False negatives are more damaging than false positives for this application. If we miss a required skill, the user fails to add it and may not get the job. If we include a questionable skill, the user can ignore it.

### 3.3 Correctness Analysis

**Correctness = Are outputs reliably valid?**

This goes beyond accuracy to consider edge cases and failure modes.

| Scenario | LLM | KeyBERT | RAKE | RAKE + Taxonomy |
| -------- | --- | ------- | ---- | --------------- |
| Misspelled skill ("Kubernetis") | Corrects & extracts | May miss | Misses | Misses unless fuzzy |
| Abbreviation ("K8s") | Understands | May miss | Misses | Taxonomy dependent |
| Emerging tech ("Bun runtime") | Extracts if trained | May miss | Misses | Misses until added |
| Non-English skill name | Usually handles | Model dependent | Works if in stopwords | Taxonomy dependent |
| Compound skill ("CI/CD") | Handles well | May split | Likely splits | Taxonomy dependent |
| Context-dependent ("Python" animal vs language) | Understands context | May confuse | No context | No context |

**Correctness Risk Areas:**

1. **Emerging Technologies:** The tech landscape changes rapidly. LLMs trained on recent data handle this; taxonomy-based approaches have a permanent lag.

2. **Industry-Specific Terms:** Finance, healthcare, legal - each industry has domain vocabulary. LLMs generalize; taxonomies must be built per domain.

3. **Acronym Resolution:** "ML," "AI," "GCP," "CI/CD" - LLMs understand these; ML/NLP approaches need explicit mapping.

### 3.4 Robustness Analysis

**Robustness = How does the system behave under stress or unusual conditions?**

#### Input Robustness (handling bad input)

| Input Type | LLM | KeyBERT | RAKE | RAKE + Taxonomy |
| ---------- | --- | ------- | ---- | --------------- |
| Grammatically incorrect | Handles | Handles | May fail | May fail |
| Missing punctuation | Handles | Handles | May fail (delimiter dependent) | May fail |
| ALL CAPS | Handles | Handles | Handles | Case normalization needed |
| Mixed languages | Handles some | Model dependent | Works with stopwords | Needs multilingual taxonomy |
| OCR artifacts ("Pyth0n") | May correct | Misses | Misses | Misses unless fuzzy |

#### System Robustness (operational reliability)

| Factor | LLM | KeyBERT | RAKE | RAKE + Taxonomy |
| ------ | --- | ------- | ---- | --------------- |
| External dependency | API required | None | None | None |
| Rate limits | Yes | No | No | No |
| Cold start latency | None (stateless) | High (model load) | None | Low (taxonomy load) |
| Memory footprint | Low | High (~400MB) | Low | Low-Medium |
| Determinism | Non-deterministic | Deterministic | Deterministic | Deterministic |

**Robustness Tradeoff:** LLM is more robust to input variations but less robust operationally. ML/NLP is more operationally robust but fragile to unusual inputs.

---

## 4. The Core Tradeoff: Accuracy vs. Speed/Cost

The fundamental tension in this phase is:

**LLM Approach:**

- 95%+ accuracy
- 2-3 second latency
- $1,500/month at moderate scale
- External dependency

**Best ML/NLP Approach (RAKE + Taxonomy):**

- 80-85% accuracy (estimated)
- <100ms latency
- ~$0/month marginal
- Self-contained

### 4.1 What Does 10-15% Accuracy Loss Mean?

For a job description with 20 relevant keywords:

- **LLM:** Extracts 19 correctly
- **ML/NLP:** Extracts 16-17 correctly, misses 3-4

**Impact on User:**

- 3-4 missing skills in gap analysis
- 3-4 potentially wrong recommendations
- ATS score off by ~15-20%

**Is this acceptable?** It depends on user expectations. If users believe the system is comprehensive, 15% error rate will erode trust. If users understand it as a "starting point," it may be acceptable.

### 4.2 What Does 2900ms Latency Improvement Mean?

- **Before:** User clicks "Analyze" → 3 second spinner → results
- **After:** User clicks "Analyze" → instant results

**UX Impact:**

- Enables real-time analysis as user types
- Removes friction from iterative tailoring
- Feels like a "smart" application vs. a "processing" application

### 4.3 What Does $1,500/month Savings Mean?

- At startup scale: Significant cost reduction
- At enterprise scale: Marginal savings vs. revenue
- **Hidden cost of ML/NLP:** Taxonomy maintenance, model updates, engineering time

---

## 5. Critical Questions

### 5.1 Can We Achieve the 5% Accuracy Target?

The master plan states: "Benchmark accuracy within 5% of current LLM approach."

**Analysis:** This target is likely **unrealistic** for pure ML/NLP approaches without:

1. Extensive taxonomy (10,000+ skills across domains)
2. Fuzzy matching with careful threshold tuning
3. Post-processing rules for compound terms
4. Regular taxonomy updates for emerging tech

A more realistic target: **10-15% accuracy reduction** with compensating UX benefits (speed, cost).

### 5.2 Should We Sacrifice Implicit Skill Extraction?

LLMs can extract skills that aren't literally stated:

- "Built scalable microservices" → extracts "microservices architecture"
- "Led sprint planning" → extracts "Agile", "Scrum"
- "Optimized query performance" → extracts "performance optimization"

ML/NLP approaches cannot do this without explicit rules. **This is a significant capability loss.**

**Mitigation Options:**

1. Accept the loss - users see literal skills only
2. Build inference rules - "if X then also Y" mappings
3. Hybrid approach - ML/NLP for literal, LLM fallback for inference

### 5.3 Are We Solving the Right Problem?

Current assumption: "Keyword extraction is expensive and slow."

Alternative framing: "Keyword extraction is the foundation of matching accuracy."

**If accuracy is the priority:** Keep LLM, optimize prompts, batch requests, cache results.

**If speed/cost is the priority:** Accept accuracy loss, move to ML/NLP.

**If both matter:** Hybrid approach with ML/NLP for common cases, LLM for edge cases.

---

## 6. Recommendations

### 6.1 Recommended Approach: Tiered Hybrid

Rather than binary "LLM vs. ML/NLP," implement a tiered system:

```text
┌─────────────────────────────────────────────────────────────────┐
│                         INPUT TEXT                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 1: Taxonomy Lookup                       │
│                    (~5ms, 100% precision)                        │
│                                                                  │
│  - Direct string matching against skills taxonomy                │
│  - Fuzzy matching for typos (Levenshtein distance ≤ 2)          │
│  - Acronym expansion ("K8s" → "Kubernetes")                      │
│                                                                  │
│  Output: { "Kubernetes": 1.0, "Python": 1.0, "AWS": 1.0 }       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 2: RAKE + Filtering                      │
│                    (~20ms, 70% precision)                        │
│                                                                  │
│  - Extract additional candidates via RAKE                        │
│  - Filter candidates against broader skills list                 │
│  - Confidence scoring based on position and frequency            │
│                                                                  │
│  Output: { "machine learning": 0.8, "REST APIs": 0.7 }          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               TIER 3: LLM Fallback (Optional)                    │
│               (~2500ms, 95% precision)                           │
│                                                                  │
│  Trigger conditions:                                             │
│  - < 5 keywords extracted by Tier 1+2                            │
│  - Text is long (>500 words) suggesting complex content          │
│  - User explicitly requests "deep analysis"                      │
│                                                                  │
│  Output: { "system design": 0.9, "technical leadership": 0.85 } │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MERGED RESULTS                              │
│                                                                  │
│  Deduplicate, normalize, rank by confidence                      │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**

- Fast path for common cases (Tier 1+2 only: <50ms)
- Maintains accuracy for edge cases (Tier 3 fallback)
- Gradual cost reduction as taxonomy improves
- Observable fallback rate guides taxonomy improvements

**Cost Model:**

- If 80% of requests handled by Tier 1+2: 80% cost reduction
- If 95% handled by Tier 1+2: 95% cost reduction
- Fallback rate is tunable based on budget

### 6.2 Taxonomy Investment

The tiered approach's effectiveness depends heavily on taxonomy quality.

**Minimum Viable Taxonomy:**

- 5,000 technical skills (programming languages, frameworks, tools)
- 500 soft skills
- 1,000 role/title keywords
- Acronym mappings (200+ entries)
- Synonym groups (100+ sets)

**Sources:**

- Existing skills databases (ONET, ESCO)
- Tech industry skill lists (LinkedIn, Indeed)
- GitHub topic tags
- Stack Overflow tags

**Maintenance Strategy:**

- Automated detection of LLM-extracted skills not in taxonomy
- Weekly review of new skills for inclusion
- User feedback mechanism for missing skills

### 6.3 Acceptance Criteria (Revised)

Given the analysis above, revise the master plan's acceptance criteria:

| Original Criteria | Revised Criteria | Rationale |
| ----------------- | ---------------- | --------- |
| "Accuracy within 5% of LLM" | "Tier 1+2 accuracy ≥ 80% on common cases; Tier 3 fallback maintains overall ≥ 90%" | 5% was unrealistic for pure ML/NLP |
| "Latency under 100ms (p95)" | "Tier 1+2 latency < 50ms (p95); End-to-end with fallback < 3s" | Separate latency targets for fast/slow paths |
| N/A | "LLM fallback rate < 20% within 30 days of launch" | New metric to track taxonomy effectiveness |
| N/A | "Taxonomy coverage ≥ 90% of extracted skills (measured weekly)" | Ensures taxonomy keeps pace with usage |

---

## 7. Risk Assessment

### 7.1 High Risk: Emerging Technology Gap

**Risk:** New technologies (e.g., a new ML framework released) won't be extracted until manually added to taxonomy.

**Impact:** Users targeting cutting-edge roles see incomplete analysis.

**Mitigation:**

1. Weekly taxonomy review triggered by LLM fallback logs
2. Integration with tech news feeds for proactive additions
3. User submission mechanism for missing skills

### 7.2 Medium Risk: Compound Term Handling

**Risk:** "Machine learning" extracted as "machine" + "learning" by RAKE.

**Impact:** Nonsensical matches; broken ATS scoring.

**Mitigation:**

1. Taxonomy includes compound terms as single entries
2. Post-processing rules to rejoin known compounds
3. N-gram matching before single-word matching

### 7.3 Medium Risk: Domain-Specific Vocabulary

**Risk:** Users in non-tech industries (healthcare, finance, legal) have different skill vocabularies.

**Impact:** Poor extraction for non-tech resumes.

**Mitigation:**

1. Domain-specific taxonomy modules
2. User profile setting for industry
3. LLM fallback more aggressive for unknown domains

### 7.4 Low Risk: Performance Regression

**Risk:** Model loading or taxonomy lookup introduces unexpected latency.

**Impact:** Feature feels slower than LLM (unlikely but possible).

**Mitigation:**

1. Pre-load taxonomy at application startup
2. Lazy-load RAKE dependencies
3. Latency monitoring with automatic alerts

---

## 8. Implementation Phases

### Phase 1A: Taxonomy Foundation (Week 1)

1. Source initial skills taxonomy (5,000+ entries)
2. Build taxonomy service with in-memory lookup
3. Implement fuzzy matching with Levenshtein
4. Create acronym expansion mappings
5. Unit tests for lookup accuracy

### Phase 1B: RAKE Integration (Week 2)

1. Integrate rake-nltk library
2. Build candidate filtering pipeline
3. Implement compound term preservation
4. Add confidence scoring
5. Integration tests with sample job descriptions

### Phase 1C: Hybrid Orchestration (Week 3)

1. Build extraction orchestrator (Tier 1 → 2 → 3)
2. Implement fallback trigger logic
3. Result merging and deduplication
4. Shadow mode deployment (run both, compare)
5. Accuracy benchmarking against LLM baseline

### Phase 1D: Production Rollout (Week 4)

1. Feature flag implementation
2. Gradual rollout (10% → 50% → 100%)
3. Monitoring dashboards (latency, fallback rate, accuracy)
4. Taxonomy gap alerting
5. Documentation and handoff

---

## 9. Success Metrics

| Metric | Target | Measurement Method |
| ------ | ------ | ------------------ |
| Tier 1+2 Latency (p95) | < 50ms | Application metrics |
| End-to-end Latency (p95) | < 200ms (no fallback), < 3s (with fallback) | Application metrics |
| LLM Fallback Rate | < 20% | Request logging |
| Extraction Accuracy (F1) | ≥ 85% overall, ≥ 95% with fallback | Weekly sampling against human labels |
| Taxonomy Coverage | ≥ 90% of unique skills extracted | Log analysis |
| Cost Reduction | ≥ 70% | API billing comparison |
| User-Reported Missing Skills | < 5/week | Feedback mechanism |

---

## 10. Conclusion

### What We're Gaining

1. **70-95% cost reduction** (depending on fallback rate)
2. **50x latency improvement** for common cases
3. **Operational independence** from LLM API availability
4. **Deterministic behavior** for testing and debugging
5. **Real-time UX** enabling instant feedback as users type

### What We're Sacrificing

1. **Implicit skill extraction** - only literal skills captured by ML/NLP
2. **Emerging tech coverage** - new skills require taxonomy updates
3. **Cross-domain flexibility** - taxonomy is tech-focused initially
4. **Zero-maintenance operation** - taxonomy requires ongoing curation
5. **Certainty of accuracy** - LLM is "good enough" across all cases; hybrid requires tuning

### Final Assessment

The migration is **worthwhile** with the tiered hybrid approach, but the master plan's accuracy target of "within 5%" should be revised to "within 10-15% for ML/NLP tiers, with LLM fallback maintaining overall 95%+ accuracy."

The key success factor is **taxonomy quality and maintenance**. Without investment in taxonomy, the ML/NLP approach will produce noticeably worse results than the current LLM approach, and users will lose trust in the system.

**Recommended Next Step:** Build the taxonomy foundation first (Phase 1A), then evaluate accuracy before committing to full implementation. If taxonomy-based extraction achieves <70% accuracy on a representative sample, reconsider the approach.

---

## Appendix A: Taxonomy Schema

```python
class SkillEntry:
    canonical_name: str          # "Kubernetes"
    aliases: list[str]           # ["K8s", "k8s", "kube"]
    category: SkillCategory      # DEVOPS, LANGUAGE, FRAMEWORK, etc.
    related_skills: list[str]    # ["Docker", "container orchestration"]
    importance_weight: float     # 0.0-1.0 for scoring
    domain: list[str]            # ["tech", "devops", "cloud"]
```

## Appendix B: Fallback Trigger Logic

```python
def should_trigger_llm_fallback(
    extracted_keywords: list[str],
    input_text: str,
    user_preferences: dict
) -> bool:
    # Too few keywords suggests taxonomy gaps
    if len(extracted_keywords) < 5 and len(input_text) > 200:
        return True

    # Long text likely has more nuance
    if len(input_text) > 1000:
        return True

    # User explicitly requested deep analysis
    if user_preferences.get("deep_analysis"):
        return True

    # Low average confidence suggests uncertain extraction
    avg_confidence = mean([k.confidence for k in extracted_keywords])
    if avg_confidence < 0.6:
        return True

    return False
```

## Appendix C: Accuracy Benchmarking Protocol

1. **Sample Selection:** 100 job descriptions, 100 resumes (diverse industries, levels)
2. **Ground Truth:** Human labelers tag all relevant keywords
3. **Metrics:**
   - Precision: extracted ∩ ground_truth / extracted
   - Recall: extracted ∩ ground_truth / ground_truth
   - F1: harmonic mean of precision and recall
4. **Acceptance:** F1 ≥ 0.85 for Tier 1+2, F1 ≥ 0.95 with Tier 3 fallback
5. **Cadence:** Run weekly during rollout, monthly post-stabilization
