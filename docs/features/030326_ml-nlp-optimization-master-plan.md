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

### Current State

- **Location:** `/backend/app/services/ai/semantic_matcher.py`, `/backend/app/services/job/ats_analyzer.py`
- **Method:** LLM prompt asking to extract keywords
- **Cost:** ~$0.01 per extraction
- **Latency:** 2-3 seconds

### Target State

- **Method:** RAKE, KeyBERT, or spaCy-based extraction
- **Cost:** $0 per extraction
- **Latency:** <100ms

### Scope

- [ ] Replace `extract_keywords()` in semantic_matcher.py
- [ ] Replace keyword extraction in ats_analyzer.py
- [ ] Create unified keyword extraction service
- [ ] Add skills taxonomy for domain-specific extraction
- [ ] Benchmark accuracy against current LLM approach

### Key Decisions Needed

1. Primary algorithm: RAKE vs KeyBERT vs hybrid
2. Skills taxonomy source: O*NET, custom, or combination
3. Caching strategy for extracted keywords

---

## Phase 2: ATS Structure Analysis

**Sub-document:** `030326_phase2-ats-structure.md`

### ATS Current State

- **Location:** `/backend/app/services/job/ats_analyzer.py`
- **Method:** LLM-based section detection and validation
- **Cost:** ~$0.01 per analysis
- **Latency:** 2-3 seconds

### ATS Target State

- **Method:** Rule-based + regex + lightweight classifier
- **Cost:** $0 per analysis
- **Latency:** <50ms

### ATS Scope

- [ ] Section header detection via regex + fuzzy matching
- [ ] Contact info extraction via regex patterns
- [ ] Date format validation via regex + dateutil
- [ ] Section completeness checklist
- [ ] Format scoring algorithm (deterministic)

### ATS Key Decisions Needed

1. Section header variations to support
2. Scoring weights for different criteria
3. Handling of non-standard resume formats

---

## Phase 3: Block Classification

**Sub-document:** `030326_phase3-block-classification.md`

### Block Current State

- **Location:** `/backend/app/services/resume/block_classifier.py`
- **Method:** LLM classification with prompt
- **Cost:** ~$0.005 per classification
- **Latency:** 1-2 seconds

### Block Target State

- **Method:** Fine-tuned DistilBERT or TF-IDF + LogisticRegression
- **Cost:** $0 per classification
- **Latency:** <10ms

### Block Scope

- [ ] Create labeled training dataset from existing classifications
- [ ] Train classification model (achievement, responsibility, skill, project, etc.)
- [ ] Implement tag suggestion model
- [ ] Add confidence scores for uncertain classifications
- [ ] Fallback to LLM for low-confidence cases (optional)

### Block Key Decisions Needed

1. Model choice: DistilBERT vs simpler TF-IDF approach
2. Training data requirements and labeling strategy
3. Confidence threshold for LLM fallback

---

## Phase 4: Resume Parser (Hybrid)

**Sub-document:** `030326_phase4-resume-parser-hybrid.md`

### Parser Current State

- **Location:** `/backend/app/services/resume/parser.py`
- **Method:** Full LLM parsing
- **Cost:** ~$0.02 per parse
- **Latency:** 3-5 seconds

### Parser Target State

- **Method:** Hybrid - NLP for extraction, LLM for understanding
- **Cost:** ~$0.005 per parse
- **Latency:** <1 second

### Parser Scope

- [ ] Section segmentation via ML classifier
- [ ] Contact extraction via regex + spaCy NER
- [ ] Date extraction via regex + dateutil
- [ ] Skills extraction via NER + taxonomy lookup
- [ ] LLM for complex/ambiguous content only
- [ ] Orchestration layer to combine results

### Parser Key Decisions Needed

1. NER model: spaCy vs custom trained
2. Section boundary detection approach
3. When to trigger LLM fallback
4. Output format compatibility with existing schema

---

## Phase 5: Job Analyzer (Hybrid)

**Sub-document:** `030326_phase5-job-analyzer-hybrid.md`

### Job Analyzer Current State

- **Location:** `/backend/app/services/job/analyzer.py`
- **Method:** Full LLM analysis
- **Cost:** ~$0.02 per analysis
- **Latency:** 3-5 seconds

### Job Analyzer Target State

- **Method:** Hybrid - NLP for extraction, LLM for categorization
- **Cost:** ~$0.005 per analysis
- **Latency:** <1 second

### Job Analyzer Scope

- [ ] Skill extraction via spaCy NER + skills taxonomy
- [ ] Salary extraction via regex patterns
- [ ] Location/remote detection via keyword matching
- [ ] Requirements parsing via keyword triggers
- [ ] LLM for nuanced importance categorization
- [ ] Structured output assembly

### Job Analyzer Key Decisions Needed

1. Skills taxonomy source and maintenance
2. Salary pattern coverage (US, EU, ranges, etc.)
3. Required vs preferred detection heuristics

---

## Phase 6: Keyword Matching

**Sub-document:** `030326_phase6-keyword-matching.md`

### Matching Current State

- **Location:** `/backend/app/services/job/ats_analyzer.py`
- **Method:** Possibly LLM-based comparison
- **Cost:** Variable
- **Latency:** 1-2 seconds

### Matching Target State

- **Method:** Traditional text matching + embeddings
- **Cost:** $0 per match
- **Latency:** <50ms

### Matching Scope

- [ ] Exact match with lemmatization
- [ ] Fuzzy matching (Levenshtein distance)
- [ ] Synonym expansion via WordNet or skills taxonomy
- [ ] Lightweight embedding similarity (sentence-transformers)
- [ ] Match scoring algorithm

### Matching Key Decisions Needed

1. Fuzzy match threshold
2. Synonym source and coverage
3. Embedding model for similarity (if used)

---

## Shared Infrastructure

**Sub-document:** `030326_shared-ml-infrastructure.md`

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
