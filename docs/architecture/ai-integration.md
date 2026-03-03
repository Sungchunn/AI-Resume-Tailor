# AI Integration Architecture

This document provides a comprehensive overview of all AI-integrated features and services in the Resume Builder application.

---

## Table of Contents

1. [Overview](#overview)
2. [AI Infrastructure](#ai-infrastructure)
3. [Core AI Features](#core-ai-features)
4. [Supporting AI Services](#supporting-ai-services)
5. [Frontend AI Components](#frontend-ai-components)
6. [API Endpoints](#api-endpoints)
7. [Configuration](#configuration)
8. [Security Considerations](#security-considerations)

---

## Overview

The Resume Builder uses AI throughout the application to help users create optimized, job-targeted resumes. AI powers everything from parsing uploaded resumes to generating tailored versions for specific job applications.

**Supported AI Providers:**

- Google Gemini (default) - `gemini-2.0-flash`
- OpenAI - `gpt-4o`

Provider selection is configurable via the `AI_PROVIDER` environment variable.

---

## AI Infrastructure

### AI Client Service

**Location:** `/backend/app/services/ai/client.py`

Provider-agnostic wrapper for LLM text generation.

| Method | Purpose |
| ------ | ------- |
| `generate()` | Basic text generation with temperature control |
| `generate_json()` | Structured JSON output for deterministic responses |

Features:

- Automatic error handling for rate limits and connection failures
- Configurable model selection per provider

### Embedding Service

**Location:** `/backend/app/services/ai/embedding.py`

Converts text to vector embeddings for semantic search operations.

| Method | Purpose |
| -------- | --------- |
| `embed_document()` | Embeds content for storage (RETRIEVAL_DOCUMENT task) |
| `embed_query()` | Embeds search queries (RETRIEVAL_QUERY task) |
| `embed_for_similarity()` | Embeds for similarity comparison |
| `embed_batch_documents()` | Batch embedding for efficiency |

**Embedding Dimensions:**

- Google Gemini: 768 dimensions (`text-embedding-004`)
- OpenAI: 1536 dimensions (`text-embedding-3-small`)

**Security:** Automatic PII stripping before embedding to protect user privacy.

---

## Core AI Features

### 1. Resume Tailoring

**Location:** `/backend/app/services/resume/tailor.py`

The primary AI feature - generates a fully customized resume for a specific job description.

**Architecture:** "Two Copies" pattern

- Input: Original resume (parsed) + job description
- Output: Complete tailored resume with preserved IDs for frontend diffing

**Capabilities:**

- `tailor()` - Generate complete tailored resume
- `get_quick_match_score()` - Fast compatibility check without full tailoring

**Output includes:**

- Match score (0-100)
- Skill matches (skills you have that match the job)
- Skill gaps (required skills you're missing)
- Keyword coverage percentage

**Caching:** Results cached by `resume_hash + job_hash` to avoid redundant AI calls.

---

### 2. ATS (Applicant Tracking System) Analysis

**Location:** `/backend/app/services/job/ats_analyzer.py`

Analyzes resumes for ATS compatibility and keyword optimization.

**Capabilities:**

| Method | Purpose |
| ------ | ------- |
| `analyze_structure()` | Check for standard sections, contact info, formatting issues |
| `analyze_keywords()` | Compare resume keywords vs job description |
| `analyze_keywords_detailed()` | Importance-based keyword analysis (required/preferred/nice-to-have) |

**Output includes:**

- Format score
- Sections found/missing
- Keyword coverage by importance level
- Vault availability for missing keywords
- Actionable suggestions

---

### 3. Semantic Matching

**Location:** `/backend/app/services/ai/semantic_matcher.py`

Uses vector similarity to find relevant experience blocks from the user's vault.

**Capabilities:**

| Method | Purpose |
| ------ | ------- |
| `match()` | Find relevant experience blocks using vector similarity |
| `extract_keywords()` | AI-powered keyword extraction from job descriptions |
| `analyze_gaps()` | Identify skill gaps between job requirements and user experience |
| `find_best_blocks_for_keywords()` | Find blocks matching specific keywords |

---

### 4. AI Section Improvement & Chat

**Location:** `/backend/app/api/routes/ai.py`

Interactive AI assistance for improving resume content.

**Endpoints:**

- `POST /api/v1/ai/improve-section` - Improve a specific section with instructions
- `POST /api/v1/ai/chat` - Multi-turn conversational assistance

**Chat Response Types:**

- `advice` - General guidance without content changes
- `improvement` - Suggested content modification
- `question` - Clarifying question to the user

---

## Supporting AI Services

### Resume Parser

**Location:** `/backend/app/services/resume/parser.py`

Extracts structured data from uploaded resume text.

**Extracted Fields:**

- Contact information
- Professional summary
- Work experience (with achievements)
- Education
- Skills
- Certifications
- Projects

**Caching:** Content hash-based caching prevents re-parsing unchanged content.

---

### Job Description Analyzer

**Location:** `/backend/app/services/job/analyzer.py`

Parses job postings into structured, actionable data.

**Extracted Fields:**

- Title, company, location, remote type
- Responsibilities and requirements
- Skills (categorized by importance and type)
- Benefits and salary information
- Keywords for matching

**Skill Categorization:**

- **Importance:** Required, Preferred, Nice-to-have
- **Type:** Technical, Soft skill, Domain knowledge

---

### Block Classifier

**Location:** `/backend/app/services/resume/block_classifier.py`

Classifies and tags experience content for organization.

**Capabilities:**

- `classify()` - Determine block type (achievement, responsibility, skill, project, etc.)
- `suggest_tags()` - Generate taxonomy tags from content
- `batch_classify()` - Efficient batch classification

---

## Frontend AI Components

### AI Rewrite Panel

**Location:** `/frontend/src/components/workshop/panels/AIRewritePanel.tsx`

Main UI for displaying and managing AI-generated suggestions.

**Features:**

- Suggestions grouped by section (summary, experience, skills, education)
- Filter by impact level (high/medium/low) or section
- "See What's Changed" summary with impact breakdown
- Accept/Reject individual suggestions
- Bulk Accept All / Reject All actions

### AI Prompt Input

**Location:** `/frontend/src/components/workshop/panels/AIPromptInput.tsx`

Free-form input for custom AI instructions.

**Quick Actions:**

- "More concise"
- "Add metrics"
- "Stronger verbs"
- "Match keywords"

### Suggestion Card

**Location:** `/frontend/src/components/workshop/panels/SuggestionCard.tsx`

Individual suggestion display with before/after content and accept/reject controls.

---

## API Endpoints

### Tailoring Endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/api/tailor` | Create AI-tailored resume |
| POST | `/api/tailor/quick-match` | Quick match scoring |
| GET | `/api/tailor/{id}` | Retrieve tailored resume |
| GET | `/api/tailor/{id}/compare` | Get original + tailored for diffing |
| POST | `/api/tailor/{id}/finalize` | Finalize user-approved version |
| PATCH | `/api/tailor/{id}` | Update tailored content/styling |

### Semantic Matching Endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/v1/match` | Semantic search for matching blocks |
| POST | `/v1/match/analyze` | Gap analysis |
| GET | `/v1/match/job/{job_id}` | Cached match results |

### ATS Analysis Endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/v1/ats/structure` | Analyze resume structure |
| POST | `/v1/ats/keywords` | Analyze keyword coverage |
| POST | `/v1/ats/keywords/detailed` | Detailed keyword analysis |
| GET | `/v1/ats/tips` | General ATS optimization tips |

### AI Chat Endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/api/v1/ai/improve-section` | Improve resume section |
| POST | `/api/v1/ai/chat` | Conversational AI assistance |

---

## Configuration

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

## Security Considerations

1. **PII Protection:** Embeddings automatically strip personally identifiable information before storage in the vector database.

2. **Rate Limiting:** AI endpoints have stricter rate limits than standard endpoints to prevent abuse and control costs.

3. **Two Copies Architecture:** Tailoring generates a complete document copy rather than modifying the original, preserving user data integrity.

4. **ID Preservation:** Original IDs are maintained in tailored content to enable accurate section-by-section diffing without data loss.

5. **Content Hashing:** Hash-based caching prevents unnecessary AI calls while ensuring changes are detected.

6. **Provider Flexibility:** Easy switching between AI providers allows responding to service outages or cost changes without code modifications.

---

## Related Documentation

- `/docs/api/tailor-match.md` - Tailoring and semantic matching API details
- `/docs/api/ats.md` - ATS analysis API documentation
- `/docs/api/ai-chat.md` - AI chat API documentation
- `/docs/planning/250226_phase-e-ai-rewrite-summary.md` - Phase E implementation details
