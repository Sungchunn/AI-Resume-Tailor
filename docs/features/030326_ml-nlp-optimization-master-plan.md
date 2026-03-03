# ML/NLP Optimization Master Plan

**Purpose:** Migrate appropriate AI features from LLM-based to traditional ML/NLP approaches for improved performance, reduced costs, and better scalability.

**Document Type:** Master plan - each section will have a dedicated sub-document for detailed implementation.

---

## Executive Summary

Several features currently using LLM calls (GPT-4/Gemini) would perform equally well or better with traditional ML/NLP techniques. This migration will:

- Reduce API costs by ~70-90% for affected features
- Decrease latency from seconds to milliseconds
- Eliminate external API dependencies for basic operations
- Improve reliability (no rate limits, no API outages)

---

## Implementation Phases

| Phase | Focus Area | Priority | Complexity |
| ----- | ---------- | -------- | ---------- |
| 1 | Keyword Extraction | High | Low |
| 2 | ATS Structure Analysis | High | Low |
| 3 | Block Classification | Medium | Medium |
| 4 | Resume Parser (Hybrid) | Medium | High |
| 5 | Job Analyzer (Hybrid) | Low | High |
| 6 | Keyword Matching | Medium | Low |

---

## Phase 1: Keyword Extraction

**Sub-document:** `030326_phase1-keyword-extraction.md`

**The Problem:** Keyword extraction currently uses expensive LLM calls (~$0.01 per extraction, 2-3 second latency) for what is fundamentally a solved NLP problem. Every tailoring, ATS analysis, and semantic matching operation triggers this extraction, making it a high-frequency cost center.

**Current Stack:**
- **Location:** `/backend/app/services/ai/semantic_matcher.py`, `/backend/app/services/job/ats_analyzer.py`
- **Method:** LLM prompt asking to extract keywords
- **Cost:** ~$0.01 per extraction
- **Latency:** 2-3 seconds

**Architecture Trade-offs:**
- RAKE is fast and unsupervised but produces noisy results for domain-specific content
- KeyBERT uses embeddings for better semantic relevance but requires model loading overhead
- Hybrid approach (RAKE + domain taxonomy filtering) balances speed and accuracy
- Skills taxonomy adds maintenance burden but dramatically improves precision for resume domain

**Impact Analysis:**
- High-frequency operation affects every job-resume matching flow
- Cost reduction compounds significantly at scale (thousands of daily extractions)
- Latency improvement enables real-time feedback in UI
- Removing LLM dependency eliminates rate limit concerns for this operation

**Definition of Completion:**
- [ ] Replace `extract_keywords()` in semantic_matcher.py with ML-based extraction
- [ ] Replace keyword extraction in ats_analyzer.py
- [ ] Create unified `KeywordExtractor` service with consistent interface
- [ ] Integrate skills taxonomy for domain-specific extraction
- [ ] Benchmark accuracy within 5% of current LLM approach
- [ ] Latency under 100ms (p95)

**Blindspots:**
- Handling of emerging tech terms not in taxonomy
- Multi-language keyword extraction requirements
- Compound skill terms (e.g., "machine learning" as single keyword vs two)
- Keyword extraction from poorly formatted or grammatically incorrect text

---

## Phase 2: ATS Structure Analysis

**Sub-document:** `030326_phase2-ats-structure.md`

**The Problem:** ATS structure analysis uses LLM for deterministic rule-based checks (section detection, contact info validation, date formatting). These are pattern-matching problems that don't require natural language understanding.

**Current Stack:**
- **Location:** `/backend/app/services/job/ats_analyzer.py`
- **Method:** LLM-based section detection and validation
- **Cost:** ~$0.01 per analysis
- **Latency:** 2-3 seconds

**Architecture Trade-offs:**
- Pure regex is fast but brittle with format variations
- Fuzzy string matching handles variations but may false-positive on similar headers
- Lightweight classifier adds accuracy but requires training data
- Rule-based scoring is deterministic and debuggable vs LLM black-box scoring

**Impact Analysis:**
- ATS analysis runs on every resume edit and job targeting action
- Deterministic rules enable consistent, explainable feedback to users
- Removing LLM dependency makes this feature work offline/locally
- Scoring algorithm transparency helps users understand exactly what to fix

**Definition of Completion:**
- [ ] Section header detection via regex + fuzzy matching (Levenshtein)
- [ ] Contact info extraction via regex patterns (email, phone, LinkedIn)
- [ ] Date format validation via regex + dateutil parsing
- [ ] Section completeness checklist (required vs optional sections)
- [ ] Deterministic format scoring algorithm with documented weights
- [ ] Latency under 50ms (p95)
- [ ] Accuracy within 5% of LLM baseline

**Blindspots:**
- Non-English resume section headers
- Creative/design resume formats that break pattern assumptions
- Multi-column layouts affecting section detection
- Regional variations in contact info formats (international phone numbers)

---

## Phase 3: Block Classification

**Sub-document:** `030326_phase3-block-classification.md`

**The Problem:** Block classification (achievement, responsibility, skill, project, etc.) is a text classification problem currently solved with LLM prompts. This is an ideal candidate for a fine-tuned lightweight classifier given the bounded category set.

**Current Stack:**
- **Location:** `/backend/app/services/resume/block_classifier.py`
- **Method:** LLM classification with prompt
- **Cost:** ~$0.005 per classification
- **Latency:** 1-2 seconds

**Architecture Trade-offs:**
- TF-IDF + LogisticRegression is simple, fast, and interpretable but may miss semantic nuance
- DistilBERT captures semantics better but requires GPU/significant CPU for inference
- Confidence thresholds enable LLM fallback for edge cases (hybrid approach)
- Training data quality directly bounds model accuracy

**Impact Analysis:**
- Classification happens during vault block creation and resume parsing
- Affects tag suggestions and block organization features
- Model size impacts deployment (DistilBERT ~250MB vs TF-IDF ~10MB)
- Confidence scores enable graceful degradation to LLM for uncertain cases

**Definition of Completion:**
- [ ] Create labeled training dataset from existing LLM classifications
- [ ] Train classification model (minimum 6 categories)
- [ ] Implement tag suggestion based on classification
- [ ] Add confidence scores to classification output
- [ ] Configure LLM fallback threshold for low-confidence cases
- [ ] Latency under 10ms for TF-IDF path, under 50ms for DistilBERT
- [ ] Accuracy >= 90% on held-out test set

**Blindspots:**
- Class imbalance in training data (achievements likely overrepresented)
- Handling multi-label cases (block that's both achievement and skill)
- Training data drift as writing styles evolve
- Cold start for new users before sufficient training data exists

---

## Phase 4: Resume Parser (Hybrid)

**Sub-document:** `030326_phase4-resume-parser-hybrid.md`

**The Problem:** Full LLM parsing is expensive and slow for extracting structured fields (contact info, dates, skills) that have well-defined patterns. However, understanding nuanced content (achievement descriptions, role responsibilities) still benefits from LLM comprehension.

**Current Stack:**
- **Location:** `/backend/app/services/resume/parser.py`
- **Method:** Full LLM parsing
- **Cost:** ~$0.02 per parse
- **Latency:** 3-5 seconds

**Architecture Trade-offs:**
- Hybrid approach requires orchestration complexity (deciding what goes to ML vs LLM)
- Section segmentation via ML reduces LLM token usage but may mis-segment unusual formats
- SpaCy NER is fast but trained on general text (names/orgs), not resume-specific entities
- Custom NER requires training data and maintenance burden

**Impact Analysis:**
- Parsing is the entry point for all resume content - errors cascade everywhere
- Partial extraction reduces LLM tokens by ~60-70% per parse
- Orchestration adds code complexity but enables targeted LLM usage
- Schema compatibility critical - downstream services expect specific structure

**Definition of Completion:**
- [ ] Section segmentation via ML classifier (contact, summary, experience, education, skills)
- [ ] Contact extraction via regex + spaCy NER
- [ ] Date extraction via regex + dateutil
- [ ] Skills extraction via NER + taxonomy lookup
- [ ] LLM for complex/ambiguous content only (achievements, responsibilities)
- [ ] Orchestration layer combining ML and LLM results
- [ ] Output schema compatibility with existing `ResumeContent` model
- [ ] Total latency under 1 second (p95)
- [ ] Cost reduction >= 50%

**Blindspots:**
- Handling PDFs with unusual encoding or embedded fonts
- Multi-language resumes (mixed English + other language)
- When to trigger LLM fallback for ambiguous section boundaries
- Resume formats that don't follow conventional structure
- Testing against diverse real-world resume corpus

---

## Phase 5: Job Analyzer (Hybrid)

**Sub-document:** `030326_phase5-job-analyzer-hybrid.md`

**The Problem:** Job description analysis extracts structured data (skills, requirements, salary) from unstructured text. Many fields follow patterns (salary formats, location strings) while others require understanding (importance categorization, soft skill detection).

**Current Stack:**
- **Location:** `/backend/app/services/job/analyzer.py`
- **Method:** Full LLM analysis
- **Cost:** ~$0.02 per analysis
- **Latency:** 3-5 seconds

**Architecture Trade-offs:**
- Skill extraction via NER + taxonomy handles known skills but misses novel technologies
- Salary regex works for standard formats but job postings vary wildly
- Required vs preferred classification is subjective - LLM may be necessary
- Structured extraction enables caching (same patterns yield same results)

**Impact Analysis:**
- Job analysis feeds tailoring and ATS matching - accuracy is critical
- Missed skills lead to poor match recommendations
- Importance categorization directly affects tailoring priorities
- Lower priority than resume parsing (jobs analyzed less frequently than resumes parsed)

**Definition of Completion:**
- [ ] Skill extraction via spaCy NER + skills taxonomy
- [ ] Salary extraction via comprehensive regex patterns
- [ ] Location/remote detection via keyword matching
- [ ] Requirements parsing via keyword triggers
- [ ] LLM for importance categorization (required/preferred/nice-to-have)
- [ ] Structured output assembly matching existing `JobAnalysis` schema
- [ ] Total latency under 1 second (p95)
- [ ] Cost reduction >= 50%

**Blindspots:**
- Poorly written or vague job descriptions with minimal structure
- Salary formats across currencies and regions (USD, EUR, yearly vs hourly)
- Job postings that mix requirements and responsibilities
- Emerging skills not in taxonomy (new frameworks, tools)
- Handling of "purple squirrel" postings with unrealistic requirements

---

## Phase 6: Keyword Matching

**Sub-document:** `030326_phase6-keyword-matching.md`

**The Problem:** Keyword matching between resume and job description may use LLM for semantic similarity when traditional text matching techniques (fuzzy matching, synonym expansion, lightweight embeddings) can achieve comparable results at zero cost.

**Current Stack:**
- **Location:** `/backend/app/services/job/ats_analyzer.py`
- **Method:** Possibly LLM-based comparison
- **Cost:** Variable
- **Latency:** 1-2 seconds

**Architecture Trade-offs:**
- Exact matching with lemmatization catches inflections but misses synonyms
- Fuzzy matching handles typos but may false-match unrelated terms
- WordNet synonyms are comprehensive but may be too broad for technical terms
- Sentence-transformers embeddings balance semantic understanding and speed

**Impact Analysis:**
- Match scoring directly affects user-facing ATS scores
- False positives (claiming matches that aren't) erode user trust
- False negatives (missing valid matches) cause unnecessary "gaps" warnings
- Matching quality affects tailoring recommendations

**Definition of Completion:**
- [ ] Exact match with lemmatization (spaCy)
- [ ] Fuzzy matching with configurable threshold (Levenshtein/RapidFuzz)
- [ ] Synonym expansion via WordNet or skills taxonomy
- [ ] Lightweight embedding similarity (sentence-transformers) for semantic fallback
- [ ] Match scoring algorithm with documented weights
- [ ] Latency under 50ms (p95)
- [ ] Precision/recall within 5% of LLM baseline

**Blindspots:**
- Fuzzy match threshold tuning (too low = false positives, too high = misses)
- Synonym expansion scope (should "Python" match "programming language"?)
- Embedding model selection and size tradeoffs
- Handling acronyms and abbreviations (AWS vs Amazon Web Services)

---

## Shared Infrastructure

**Sub-document:** `030326_shared-ml-infrastructure.md`

**The Problem:** Multiple phases require common ML/NLP capabilities (NER, text matching, embeddings, classification). Without shared infrastructure, each phase will duplicate code and models.

**Current Stack:** No shared ML infrastructure exists - each AI feature calls LLM directly.

**Architecture Trade-offs:**
- Shared services reduce duplication but create coupling between features
- Model loading at startup adds memory overhead but avoids per-request latency
- Lazy model loading saves memory but first-request latency spike
- Centralized taxonomy requires maintenance but ensures consistency

**Impact Analysis:**
- Infrastructure decisions affect all downstream phases
- Model loading strategy impacts cold start and memory usage
- Taxonomy quality bounds extraction accuracy across features
- Service interfaces must be stable before phases depend on them

**Definition of Completion:**

### New Services to Create

| Service | Purpose |
| ------- | ------- |
| `KeywordExtractor` | Unified keyword extraction (RAKE/KeyBERT) |
| `NERService` | Named entity recognition wrapper (spaCy) |
| `TextMatcher` | Fuzzy matching + synonym expansion |
| `MLClassifier` | Generic classification service |
| `SkillsTaxonomy` | Skills database + lookup |

### Dependencies to Add

```toml
# pyproject.toml additions
spacy = "^3.7"
rake-nltk = "^1.0"
keybert = "^0.8"
scikit-learn = "^1.4"
python-Levenshtein = "^0.25"
sentence-transformers = "^2.5"  # lightweight embeddings
```

### Model Storage

- Location: `/backend/models/` (gitignored)
- Download script: `/backend/scripts/download_models.py`
- Models: spaCy en_core_web_md, DistilBERT (if used)

**Blindspots:**
- Model versioning and updates without breaking existing behavior
- Memory footprint of loading multiple models concurrently
- CI/CD pipeline for model download and caching
- Graceful degradation when models fail to load

---

## Success Metrics

| Metric | Current | Target |
| ------ | ------- | ------ |
| Keyword extraction latency | 2-3s | <100ms |
| ATS structure analysis latency | 2-3s | <50ms |
| Block classification latency | 1-2s | <10ms |
| Resume parsing latency | 3-5s | <1s |
| Monthly AI API cost (est.) | $X | 30% of $X |
| Accuracy degradation | - | <5% |

---

## Testing Strategy

Each phase must include:

1. **Accuracy benchmarks** against current LLM implementation
2. **Latency benchmarks** (p50, p95, p99)
3. **Unit tests** for new services
4. **Integration tests** ensuring API compatibility
5. **A/B testing** in production (optional)

---

## Rollout Strategy

1. Implement behind feature flag
2. Run shadow mode (both old and new, compare results)
3. Gradual rollout with monitoring
4. Full cutover after validation

---

## Sub-Document Template

Each phase sub-document should follow this structure:

```markdown
# Phase X: [Feature Name]

## Overview
Brief description of what this phase accomplishes.

## Current Implementation
- File locations
- How it works now
- Current performance metrics

## New Implementation
- Architecture design
- Algorithm details
- Code structure

## Implementation Steps
Detailed numbered steps with code snippets.

## Testing
- Test cases
- Benchmark methodology
- Acceptance criteria

## Migration
- Feature flag setup
- Shadow mode configuration
- Rollout plan

## Rollback Plan
How to revert if issues arise.
```

---

## Document Index

Once created, sub-documents will be listed here:

| Document | Status | Phase |
| -------- | ------ | ----- |
| `030326_phase1-keyword-extraction.md` | Pending | 1 |
| `030326_phase2-ats-structure.md` | Pending | 2 |
| `030326_phase3-block-classification.md` | Pending | 3 |
| `030326_phase4-resume-parser-hybrid.md` | Pending | 4 |
| `030326_phase5-job-analyzer-hybrid.md` | Pending | 5 |
| `030326_phase6-keyword-matching.md` | Pending | 6 |
| `030326_shared-ml-infrastructure.md` | Pending | - |

---

## Session Management Notes

**For AI assistants:** When working on this optimization:

1. Start each session by reading this master plan
2. Work on ONE phase per session to avoid context rot
3. Read the relevant phase sub-document before implementing
4. Update the Document Index status after completing each phase
5. Do not assume context from previous sessions
