# AI Integration Architecture

This document provides a phase-by-phase overview of AI-integrated features in the Resume Builder application.

Supported AI Providers: Google Gemini (default, `gemini-2.0-flash`) and OpenAI (`gpt-4o`)

---

## Table of Contents

- [Phase 1: AI Infrastructure](#phase-1-ai-infrastructure)
- [Phase 2: Resume Parsing](#phase-2-resume-parsing)
- [Phase 3: Job Description Analysis](#phase-3-job-description-analysis)
- [Phase 4: Semantic Matching and Embeddings](#phase-4-semantic-matching-and-embeddings)
- [Phase 5: Resume Tailoring](#phase-5-resume-tailoring)
- [Phase 6: ATS Analysis](#phase-6-ats-analysis)
- [Phase 7: AI Chat and Section Improvement](#phase-7-ai-chat-and-section-improvement)
- [Phase 8: Frontend AI Components](#phase-8-frontend-ai-components)
- [Configuration Reference](#configuration-reference)

---

## Phase 1: AI Infrastructure

**Phase/Feature:** Foundation layer providing provider-agnostic AI access

**The Problem:** The application needs to call multiple AI providers (Gemini, OpenAI) for text generation without coupling business logic to a specific vendor. Must handle rate limits, errors, and structured output parsing consistently.

**Current Stack:** Location at `/backend/app/services/ai/client.py` with methods `generate()` and `generate_json()`. Providers are Google Gemini and OpenAI, switchable via `AI_PROVIDER` env var.

**Architecture Trade-offs:** Provider abstraction adds indirection but enables easy switching during outages or cost changes. The `generate_json()` method relies on provider-specific JSON mode capabilities (not all models support it equally).

**Impact Analysis:** Every AI feature depends on this layer - a bug here cascades everywhere. Rate limit handling here protects downstream services from retry storms.

**Definition of Completion:** Both providers work interchangeably for all AI features. Automatic error handling for rate limits and connection failures. Temperature and token limits configurable per-call.

**Blindspots:** No retry logic with exponential backoff currently documented. Token usage tracking for cost monitoring not specified. Streaming responses not addressed (needed for chat UX).

---

## Phase 2: Resume Parsing

**Phase/Feature:** Extract structured data from uploaded resume text/PDFs

**The Problem:** Users upload resumes in various formats with inconsistent layouts. The system needs to extract contact info, work history, skills, education, etc. into a consistent schema for downstream processing.

**Current Stack:** Location at `/backend/app/services/resume/parser.py` with content hash-based caching to prevent re-parsing unchanged content.

**Architecture Trade-offs:** AI parsing is flexible but non-deterministic - same resume may parse slightly differently. Content hashing trades storage for compute savings.

**Impact Analysis:** Parsing quality directly affects tailoring and matching accuracy. Poor extraction equals poor tailored output (garbage in, garbage out).

**Definition of Completion:** Reliable extraction of contact info, summary, work experience (with achievements), education, skills, certifications, and projects. Hash-based caching prevents redundant AI calls. Structured output matches expected schema for all downstream consumers.

**Blindspots:** Multi-language resume support not addressed. Handling of non-standard resume formats (creative/design resumes). Confidence scores for parsed fields not specified.

---

## Phase 3: Job Description Analysis

**Phase/Feature:** Parse job postings into structured, actionable data

**The Problem:** Job descriptions vary wildly in structure. Need to extract requirements, responsibilities, and skills while categorizing by importance level for accurate matching.

**Current Stack:** Location at `/backend/app/services/job/analyzer.py`. Output includes title, company, location, remote type, responsibilities, requirements, categorized skills, benefits, salary, and keywords.

**Architecture Trade-offs:** AI extraction handles unstructured input but may hallucinate missing fields. Skill categorization (required/preferred/nice-to-have) is subjective and model-dependent.

**Impact Analysis:** Incorrect skill importance ranking leads to misleading match scores. Missing keyword extraction leads to poor tailoring recommendations.

**Definition of Completion:** Consistent extraction of core fields across varied job posting formats. Skills categorized by importance (Required, Preferred, Nice-to-have) and type (Technical, Soft skill, Domain knowledge). Keyword extraction feeds semantic matching and ATS analysis.

**Blindspots:** Handling of poorly written or vague job descriptions. Salary parsing across different formats/currencies. Detection of unrealistic or "purple squirrel" job requirements.

---

## Phase 4: Semantic Matching and Embeddings

**Phase/Feature:** Vector-based similarity search to find relevant experience blocks

**The Problem:** Users have a vault of experience blocks. When targeting a job, the system needs to find which blocks best match the job requirements using semantic understanding, not just keyword overlap.

**Current Stack:** Locations at `/backend/app/services/ai/embedding.py` and `/backend/app/services/ai/semantic_matcher.py`. Embedding dimensions are Gemini (768) and OpenAI (1536). Embedding methods include `embed_document()`, `embed_query()`, `embed_for_similarity()`, and `embed_batch_documents()`. Matcher methods include `match()`, `extract_keywords()`, `analyze_gaps()`, and `find_best_blocks_for_keywords()`.

**Architecture Trade-offs:** Different embedding dimensions between providers complicates switching (re-embedding required). Task-specific embedding types (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY) improve accuracy but add complexity.

**Impact Analysis:** Embedding quality determines match relevance. PII stripping before embedding protects privacy but may lose context.

**Definition of Completion:** Relevant blocks surfaced for job requirements using vector similarity. Gap analysis identifies skills user lacks vs job requirements. Automatic PII stripping before embedding storage.

**Blindspots:** Re-embedding cost when switching providers not planned. Embedding drift over time as models update. Performance at scale (thousands of vault blocks).

---

## Phase 5: Resume Tailoring

**Phase/Feature:** Generate a fully customized resume for a specific job description

**The Problem:** Users need job-specific resumes but manually rewriting is tedious. The AI should rewrite/reorganize content to match job requirements while preserving the user's authentic experience.

**Current Stack:** Location at `/backend/app/services/resume/tailor.py` using the "Two Copies" architecture pattern (original preserved, tailored version created). Methods include `tailor()` and `get_quick_match_score()`. Caching is based on `resume_hash + job_hash`.

**Architecture Trade-offs:** Two Copies pattern preserves originals but doubles storage. ID preservation enables frontend diffing but constrains AI output structure. Full regeneration vs incremental updates (current: full regeneration).

**Impact Analysis:** This is the core AI feature - user-perceived value depends heavily on output quality. Caching prevents redundant AI calls but means users don't see improvements without content changes.

**Definition of Completion:** Complete tailored resume generated with preserved section IDs. Match score (0-100) reflects job fit accuracy. Skill matches and gaps identified. Keyword coverage percentage calculated. Results cached to avoid redundant AI calls.

**Blindspots:** User feedback loop for tailoring quality not specified. Handling when AI over-embellishes or fabricates experience. Partial re-tailoring (only changed sections) for efficiency.

---

## Phase 6: ATS Analysis

**Phase/Feature:** Analyze resumes for Applicant Tracking System compatibility

**The Problem:** Many resumes get filtered by ATS before humans see them. Users need feedback on formatting issues and keyword coverage to pass automated screening.

**Current Stack:** Location at `/backend/app/services/job/ats_analyzer.py` with methods `analyze_structure()`, `analyze_keywords()`, and `analyze_keywords_detailed()`.

**Architecture Trade-offs:** Keyword matching can be exact or semantic (semantic catches synonyms but may over-match). Structure analysis is rule-based while keyword analysis is AI-powered (hybrid approach).

**Impact Analysis:** ATS feedback influences user editing decisions. False positives (saying something's wrong when it isn't) erode trust.

**Definition of Completion:** Format score reflects ATS-friendliness. Sections found/missing clearly identified. Keyword coverage broken down by importance level. Vault availability shown for missing keywords. Actionable suggestions provided.

**Blindspots:** Different ATS systems have different requirements (no universal standard). Parsing accuracy of user's resume affects analysis accuracy. Testing against actual ATS systems for validation.

---

## Phase 7: AI Chat and Section Improvement

**Phase/Feature:** Interactive AI assistance for improving resume content

**The Problem:** Users want to iterate on specific sections with AI guidance. Need conversational interface for back-and-forth refinement rather than one-shot generation.

**Current Stack:** Location at `/backend/app/api/routes/ai.py` with endpoints `POST /api/v1/ai/improve-section` and `POST /api/v1/ai/chat`. Response types are `advice`, `improvement`, and `question`.

**Architecture Trade-offs:** Multi-turn conversation requires context management (token costs scale with history). Typed responses (advice/improvement/question) structure output but may feel rigid.

**Impact Analysis:** Chat quality affects user perception of AI helpfulness. Context window limits constrain conversation length.

**Definition of Completion:** Section improvement with custom instructions works reliably. Multi-turn chat maintains context appropriately. Response types correctly categorize AI output. Suggested improvements are actionable and specific.

**Blindspots:** Conversation history storage and retrieval. Maximum context length handling (truncation strategy). Streaming responses for better UX (typing indicator).

---

## Phase 8: Frontend AI Components

**Phase/Feature:** UI components for displaying and managing AI suggestions

**The Problem:** AI generates suggestions, but users need intuitive interfaces to review, accept, reject, and understand changes. Must make AI output transparent and controllable.

**Current Stack:** Components include `AIRewritePanel.tsx` for main suggestion display/management, `AIPromptInput.tsx` for free-form AI instructions with quick actions, and `SuggestionCard.tsx` for individual suggestion with before/after and accept/reject.

**Architecture Trade-offs:** Grouped suggestions by section vs flat list (grouped chosen for clarity). Bulk actions (Accept All) vs individual review (both supported). Quick actions vs free-form input (both provided).

**Impact Analysis:** UI clarity determines whether users trust and use AI features. Poor diffing display makes it hard to understand what changed.

**Definition of Completion:** Suggestions grouped by section with clear visual hierarchy. Filter by impact level and section type. "See What's Changed" summary with impact breakdown. Accept/Reject individual and bulk actions. Quick action presets (concise, metrics, verbs, keywords).

**Blindspots:** Undo/redo after accepting suggestions. Mobile responsiveness of suggestion cards. Loading states and error handling during AI calls. Accessibility (screen reader support for diff display).

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `AI_PROVIDER` | AI provider selection | `gemini` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_MODEL` | OpenAI model name | `gpt-4o` |
| `OPENAI_EMBEDDING_MODEL` | OpenAI embedding model | `text-embedding-3-small` |
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash` |
| `AI_MAX_TOKENS` | Max tokens for responses | - |
| `RATE_LIMIT_AI_PER_MINUTE` | Per-minute rate limit | - |
| `RATE_LIMIT_AI_PER_HOUR` | Per-hour rate limit | - |

### Caching Strategy

| Feature | Cache Key | TTL |
| ------- | --------- | --- |
| Tailoring | `resume_id + job_id + content_hashes` | Permanent |
| Parsed resume | Content hash | Permanent |
| Parsed job | Content hash | Permanent |
| Match results | Query + filters | 15 minutes |

---

## Related Documentation

- `/docs/api/tailor-match.md` - Tailoring and semantic matching API details
- `/docs/api/ats.md` - ATS analysis API documentation
- `/docs/planning/250226_phase-e-ai-rewrite-summary.md` - Phase E implementation details
