# AI Resume Tailor - System Architecture

A comprehensive visualization of the entire web application architecture, covering API endpoints, database relationships, frontend component interactions, and data flows.

---

## Table of Contents

1. [High-Level System Overview](#1-high-level-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Backend Architecture](#3-backend-architecture)
   - [API Router Structure](#31-api-router-structure)
   - [Complete API Endpoint Reference](#32-complete-api-endpoint-reference)
   - [Service Layer Architecture](#33-service-layer-architecture)
   - [Middleware Stack](#34-middleware-stack)
4. [Database Architecture](#4-database-architecture)
   - [PostgreSQL Schema](#41-postgresql-schema)
   - [MongoDB Collections](#42-mongodb-collections)
   - [PostgreSQL-MongoDB Relationship](#43-postgresql-mongodb-relationship)
   - [Embeddings Footnote](#44-embeddings-footnote)
5. [Frontend Architecture](#5-frontend-architecture)
   - [Page Routes & Navigation Flow](#51-page-routes--navigation-flow)
   - [Component Hierarchy](#52-component-hierarchy)
   - [State Management](#53-state-management)
   - [API Client Layer](#54-api-client-layer)
6. [Core Feature Flows](#6-core-feature-flows)
   - [Authentication Flow](#61-authentication-flow)
   - [Resume Tailoring Flow](#62-resume-tailoring-flow)
   - [Workshop/Resume Builder Flow](#63-workshopresume-builder-flow)
   - [Job Scraper Pipeline](#64-job-scraper-pipeline)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Security Architecture](#8-security-architecture)
9. [Caching Strategy](#9-caching-strategy)
10. [Deployment Architecture](#10-deployment-architecture)

---

## 1. High-Level System Overview

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        Browser["Browser<br/>(Next.js 15 SSR/CSR)"]
    end

    subgraph Frontend["Frontend Server"]
        NextJS["Next.js App Router<br/>React 19 + TypeScript"]
        RQ["React Query<br/>Server State Cache"]
        Contexts["Context Providers<br/>Auth | Tailoring | Theme"]
    end

    subgraph Backend["Backend Server"]
        FastAPI["FastAPI<br/>Python 3.11+"]
        subgraph Services["Service Layer"]
            AIServices["AI Services<br/>OpenAI | Gemini"]
            ResumeServices["Resume Services<br/>Parser | Tailor"]
            JobServices["Job Services<br/>Analyzer | ATS"]
            ScraperServices["Scraper Services<br/>Apify | Scheduler"]
        end
        subgraph Middleware["Middleware"]
            RateLimit["Rate Limiter"]
            CORS["CORS"]
            Auth["JWT Auth"]
        end
    end

    subgraph DataLayer["Data Layer"]
        PostgreSQL[(PostgreSQL<br/>+ pgvector)]
        MongoDB[(MongoDB<br/>Motor Async)]
        Redis[(Redis<br/>Cache + Rate Limits)]
        MinIO[(MinIO/S3<br/>File Storage)]
    end

    subgraph External["External Services"]
        AIProvider["OpenAI or Gemini<br/>(Configurable)<br/>Text Generation"]
        GeminiEmbed["Google Gemini<br/>Text Embeddings"]
        Apify["Apify<br/>LinkedIn Scraper"]
        GoogleOAuth["Google OAuth<br/>(Sign-in)"]
    end

    Browser --> NextJS
    NextJS --> RQ
    RQ --> Contexts
    NextJS --> FastAPI

    FastAPI --> Middleware
    Middleware --> Services

    AIServices --> AIProvider
    AIServices --> GeminiEmbed
    ScraperServices --> Apify
    Auth --> GoogleOAuth

    Services --> PostgreSQL
    Services --> MongoDB
    Services --> Redis
    Services --> MinIO
```

---

## 2. Technology Stack

```mermaid
flowchart LR
    subgraph Frontend["Frontend Stack"]
        direction TB
        F1["Next.js 15"]
        F2["React 19"]
        F3["TypeScript 5.7"]
        F4["TanStack Query v5"]
        F5["TipTap Editor"]
        F6["Tailwind CSS 4.1"]
        F7["Framer Motion"]
        F8["@dnd-kit"]
        F9["Zustand"]
        F10["Vercel Analytics"]
    end

    subgraph Backend["Backend Stack"]
        direction TB
        B1["FastAPI"]
        B2["Python 3.11+"]
        B3["SQLAlchemy 2.0"]
        B4["Pydantic v2"]
        B5["Motor (MongoDB)"]
        B6["APScheduler"]
        B7["WeasyPrint"]
    end

    subgraph Database["Database Stack"]
        direction TB
        D1["PostgreSQL 15"]
        D2["pgvector Extension"]
        D3["MongoDB 7"]
        D4["Redis 7"]
    end

    subgraph AI["AI/ML Stack"]
        direction TB
        A1["OpenAI API (default)<br/>or Gemini API"]
        A2["Gemini Embeddings<br/>(Google)"]
        A3["AI Usage Tracking<br/>(ai_usage_logs)"]
        A4["SSE Streaming<br/>(Progressive ATS)"]
    end

    Frontend --> Backend
    Backend --> Database
    Backend --> AI
```

### Dependency Summary

| Layer | Technology | Version | Purpose |
| ------- | ------------ | --------- | --------- |
| Frontend | Next.js | 15.1.0 | SSR Framework |
| Frontend | React | 19.0.0 | UI Library |
| Frontend | TanStack Query | 5.90 | Server State |
| Frontend | Zustand | 5.x | Client State (ATS progress, suggestions, keyword review) |
| Frontend | TipTap | 3.20 | Rich Text Editor |
| Backend | FastAPI | Latest | API Framework |
| Backend | SQLAlchemy | 2.0 | PostgreSQL ORM |
| Backend | Motor | 3.x | MongoDB Async Driver |
| Backend | sse-starlette | Latest | Server-Sent Events |
| Backend | fastapi-cache2 | Latest | Response cache (Redis backend) |
| Database | PostgreSQL | 15 | Relational Data |
| Database | MongoDB | 7 | Document Storage |
| AI | OpenAI (default) | gpt-4o-mini | Text Generation |
| AI | Gemini (alt) | gemini-2.0-flash | Text Generation |
| AI | Gemini | text-embedding-004 | Embeddings (768-dim) |

---

## 3. Backend Architecture

### 3.1 API Router Structure

```mermaid
flowchart TB
    subgraph Main["FastAPI Application"]
        App["app.main:app"]
        Health["GET /health"]
        Root["GET /"]
    end

    subgraph APIRouter["API Router (/api)"]
        Auth["auth<br/>/api/auth"]
        Resumes["resumes<br/>/api/resumes"]
        Jobs["jobs<br/>/api/jobs"]
        Tailor["tailor<br/>/api/tailor"]
        Export["export<br/>/api/export"]
        Upload["upload<br/>/api/upload"]
        Builds["resume-builds<br/>/api/v1/resume-builds"]
        ATS["ats<br/>/api/v1/ats<br/>(modular sub-routers)"]
        AIChat["ai<br/>/api/v1/ai"]
        Profile["profile<br/>/api/v1/profile"]
        Listings["job-listings<br/>/api/job-listings"]
        ScraperReq["scraper-requests<br/>/api/scraper-requests"]
        Admin["admin<br/>/api/admin<br/>(scraper + ai-usage)"]
    end

    App --> Health
    App --> Root
    App --> APIRouter

    APIRouter --> Auth
    APIRouter --> Resumes
    APIRouter --> Jobs
    APIRouter --> Tailor
    APIRouter --> Export
    APIRouter --> Upload
    APIRouter --> Builds
    APIRouter --> ATS
    APIRouter --> AIChat
    APIRouter --> Profile
    APIRouter --> Listings
    APIRouter --> ScraperReq
    APIRouter --> Admin
```

**Note:** The API currently runs at version `2.0.0` (see `app/main.py`), exposed as `re-zoo-me API` in the OpenAPI title. A migration from integer IDs to UUIDs is in progress — some resources (`jobs`, `resume_builds`, `user_job_interactions`) expose both integer and UUID `public_id` forms with a `Deprecation: true` + `Sunset: 2026-07-01` response header when clients use the integer form.

### 3.2 Complete API Endpoint Reference

#### Authentication Endpoints (`/api/auth`)

```mermaid
flowchart LR
    subgraph Auth["Authentication API"]
        POST1["POST /register"]
        POST2["POST /login"]
        POST3["POST /refresh"]
        POST4["POST /google"]
        POST5["POST /sse-ticket"]
        GET1["GET /me"]
    end

    POST1 --> |"Create User"| DB[(PostgreSQL)]
    POST2 --> |"Verify Credentials"| DB
    POST2 --> |"Issue JWT"| Token["Access + Refresh Tokens"]
    POST3 --> |"Refresh"| Token
    POST4 --> |"Verify Google ID Token"| DB
    POST5 --> |"Mint one-time ticket"| Redis[(Redis<br/>30s TTL)]
    GET1 --> |"Get Current User"| DB
```

| Method | Endpoint | Description | Auth |
| -------- | ---------- | ------------- | ------ |
| POST | `/auth/register` | Register new user (email+password, full_name required) | No |
| POST | `/auth/login` | Login, get access + refresh tokens | No |
| POST | `/auth/refresh` | Refresh access token | Refresh Token |
| POST | `/auth/google` | Sign in / register via Google OAuth ID token | No |
| POST | `/auth/sse-ticket` | Mint a one-time Redis ticket for SSE auth (30s TTL) | Yes |
| GET | `/auth/me` | Get current authenticated user | Yes |

#### Resume Endpoints (`/api/resumes`)

```mermaid
flowchart LR
    subgraph Resumes["Resume API (MongoDB-backed)"]
        direction TB
        CRUD["CRUD Operations"]
        Parse["Parsing Operations"]
        Export["Export Operations"]
    end

    subgraph CRUD_Ops["CRUD"]
        POST1["POST /"]
        GET1["GET /{id}"]
        GET2["GET /"]
        PUT1["PUT /{id}"]
        DEL1["DELETE /{id}"]
    end

    subgraph Parse_Ops["Parsing"]
        POST2["POST /{id}/parse"]
        GET3["GET /{id}/parse/status"]
    end

    subgraph Export_Ops["Export"]
        GET4["GET /export/templates"]
        POST3["POST /{id}/export"]
    end

    CRUD --> CRUD_Ops
    Parse --> Parse_Ops
    Export --> Export_Ops
```

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/resumes` | Create new resume |
| GET | `/resumes/{id}` | Get resume by ID |
| GET | `/resumes` | List user's resumes (paginated) |
| PUT | `/resumes/{id}` | Update resume content (optimistic concurrency via `version`) |
| DELETE | `/resumes/{id}` | Delete resume |
| PATCH | `/resumes/{id}/set-master` | Designate resume as the user's master |
| PATCH | `/resumes/{id}/verify-parsed` | Mark AI-parsed output as user-verified |
| GET | `/resumes/export/templates` | Get available export templates |
| POST | `/resumes/{id}/export` | Export to PDF/DOCX |
| POST | `/resumes/{id}/parse` | Trigger async parsing |
| GET | `/resumes/{id}/parse/status` | Poll parsing status |

#### Job Endpoints (`/api/jobs`)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/jobs` | Create user job description |
| GET | `/jobs/{id}` | Get specific job |
| GET | `/jobs` | List user's job descriptions |
| PUT | `/jobs/{id}` | Update job description |
| DELETE | `/jobs/{id}` | Delete job description |

#### Tailor Endpoints (`/api/tailor`)

```mermaid
flowchart TB
    subgraph Tailor["Resume Tailoring API"]
        Create["POST /<br/>Tailor Resume for Job"]
        Quick["POST /quick-match<br/>Get Match Score Only"]
        Get["GET /{id}<br/>Get Tailored Resume"]
        Compare["GET /{id}/compare<br/>Get Original + Tailored"]
        Finalize["POST /{id}/finalize<br/>Save User's Version"]
        Update["PATCH /{id}<br/>Update Tailored"]
        List["GET /<br/>List Tailored Resumes"]
        Delete["DELETE /{id}<br/>Delete Tailored"]
    end

    Create --> |"Two Copies"| MongoDB[(MongoDB)]
    Compare --> |"Frontend Diffing"| Diff["Client-side Diff UI"]
    Finalize --> |"Merge Changes"| MongoDB
```

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/tailor` | Create tailored resume (Two Copies Architecture, accepts `focus_keywords`) |
| POST | `/tailor/quick-match` | Quick match score without full tailoring |
| GET | `/tailor/{id}` | Get tailored resume (includes ATS cache metadata) |
| GET | `/tailor/{id}/compare` | Get original + tailored for diffing |
| POST | `/tailor/{id}/finalize` | Finalize user's approved version |
| POST | `/tailor/{id}/analyze-bullets` | Run AI bullet-level analysis + suggestions |
| PATCH | `/tailor/{id}` | Update tailored resume |
| GET | `/tailor` | List tailored resumes |
| DELETE | `/tailor/{id}` | Delete tailored resume |

#### Export Endpoints (`/api/export`)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/export/{tailored_id}` | Export tailored resume to PDF/DOCX |
| POST | `/export/fit-to-page` | Compress resume to fit a single page (in-process render cache) |

> **Note:** The earlier `/api/v1/blocks` (Vault) and `/api/v1/match` routers were removed when the `experience_blocks` table was dropped in migration `20260405_0001`. Semantic search against user-curated atomic blocks is no longer part of the system — tailoring is driven directly from resume content + job description + user-selected `focus_keywords`.

#### Resume Build/Workshop Endpoints (`/api/v1/resume-builds`)

```mermaid
flowchart TB
    subgraph Workshop["Resume Workshop API"]
        direction TB
        Core["Core Operations"]
        AI["AI Operations"]
        Diffs["Diff Management"]
        Export["Export"]
    end

    subgraph Core_W["Core"]
        W1["POST /"]
        W2["GET /"]
        W3["GET /{id}"]
        W4["PATCH /{id}"]
        W5["DELETE /{id}"]
    end

    subgraph AI_W["AI Suggestions"]
        W9["POST /{id}/suggest"]
        W9b["POST /{id}/suggest-bullet"]
    end

    subgraph Diffs_W["Diff Management"]
        W10["POST /{id}/diffs/accept"]
        W11["POST /{id}/diffs/reject"]
        W12["POST /{id}/diffs/clear"]
    end

    subgraph Export_W["Sections, Status & Export"]
        W15["PATCH /{id}/sections"]
        W16["PATCH /{id}/status"]
        W17["POST /{id}/export"]
    end

    Core --> Core_W
    AI --> AI_W
    Diffs --> Diffs_W
    Export --> Export_W
```

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/resume-builds` | Create resume build |
| GET | `/resume-builds` | List builds |
| GET | `/resume-builds/{id}` | Get specific build |
| PATCH | `/resume-builds/{id}` | Update build |
| DELETE | `/resume-builds/{id}` | Delete build |
| POST | `/resume-builds/{id}/suggest` | Generate AI suggestions |
| POST | `/resume-builds/{id}/suggest-bullet` | Suggest rewrite for a single bullet |
| POST | `/resume-builds/{id}/diffs/accept` | Accept diff |
| POST | `/resume-builds/{id}/diffs/reject` | Reject diff |
| POST | `/resume-builds/{id}/diffs/clear` | Clear all diffs |
| PATCH | `/resume-builds/{id}/sections` | Update sections |
| PATCH | `/resume-builds/{id}/status` | Update status (draft / in_progress / exported) |
| POST | `/resume-builds/{id}/export` | Export the build to PDF/DOCX |

#### ATS Analysis Endpoints (`/api/v1/ats`)

`/api/v1/ats` is a modular router composed of per-stage sub-routers registered in `backend/app/api/routes/ats/__init__.py`. The 5 scoring stages (knockout, structure, keywords, content-quality, role-proximity) each expose their own endpoint and are also orchestrated together as a single SSE stream at `/analyze-progressive`.

```mermaid
flowchart TB
    subgraph ATS["ATS Sub-Routers"]
        direction TB
        Knockout["knockout.py<br/>POST /knockout-check"]
        Structure["structure.py<br/>POST /structure"]
        Keywords["keywords.py<br/>POST /keywords<br/>POST /keywords/detailed<br/>POST /keywords/enhanced<br/>POST /keywords/extract<br/>GET|PUT /keywords/override<br/>GET /tips"]
        ContentQ["content_quality.py<br/>POST /content-quality"]
        RoleProx["role_proximity.py<br/>POST /role-proximity"]
        Content["content.py<br/>POST /analyze-content"]
        Bullets["bullets.py<br/>POST /analyze-bullets"]
        Progressive["progressive.py<br/>GET /analyze-progressive<br/>(SSE, ticket auth)"]
    end

    Progressive -.orchestrates.-> Knockout
    Progressive -.orchestrates.-> Structure
    Progressive -.orchestrates.-> Keywords
    Progressive -.orchestrates.-> ContentQ
    Progressive -.orchestrates.-> RoleProx

    Keywords --> MongoKW[(MongoDB<br/>keyword_overrides)]
    Progressive --> RedisCache[(Redis<br/>ats cache, 24h)]
```

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| POST | `/ats/knockout-check` | Pass/fail knockout criteria (must-have skills, etc.) | JWT |
| POST | `/ats/structure` | Section presence + formatting sanity | JWT |
| POST | `/ats/keywords` | Basic keyword coverage | JWT |
| POST | `/ats/keywords/detailed` | Per-keyword presence, synonyms, context | JWT |
| POST | `/ats/keywords/enhanced` | LLM-augmented keyword analysis | JWT |
| POST | `/ats/keywords/extract` | Extract keywords from a job with importance weights | JWT |
| GET | `/ats/keywords/override` | Get the user's keyword override for a job | JWT |
| PUT | `/ats/keywords/override` | Save/update keyword override | JWT |
| GET | `/ats/tips` | Static ATS optimization tips | Public |
| POST | `/ats/content-quality` | Verb/metric/clarity scoring | JWT |
| POST | `/ats/role-proximity` | Title + seniority semantic match | JWT |
| POST | `/ats/analyze-content` | Legacy consolidated content analysis | JWT |
| POST | `/ats/analyze-bullets` | Bullet-level rewrite suggestions | JWT |
| GET | `/ats/analyze-progressive` | SSE stream of all 5 stages with composite score | SSE Ticket |

**Progressive SSE event types** (from `analyze-progressive`):

| Event | Emitted When |
| ----- | ------------ |
| `cache_hit` | Cached composite score found, fast playback begins |
| `cache_miss` | No cache entry; running full pipeline |
| `stage_start` | Stage N is beginning |
| `stage_complete` | Stage N completed (payload includes the stage result) |
| `stage_error` | Stage N failed (payload includes error; other stages continue) |
| `score_calculation` | All stages done, computing composite |
| `complete` | Final composite score + metrics |
| `error` | Fatal error aborting the stream |

Cache key: `ats:{resume_content_hash[:16]}:{job_id}`, TTL 24h, bypassable via `force_refresh=true`. SSE auth flow: client calls `POST /auth/sse-ticket` to exchange its JWT for a one-time ticket (Redis, 30s TTL), then opens `EventSource(url?ticket=...)`. The backend consumes the ticket on connect via `get_current_user_id_sse`.

#### AI Chat Endpoints (`/api/v1/ai`)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/ai/improve-section` | AI improvement for section |
| POST | `/ai/chat` | Conversational AI |

#### Profile Endpoints (`/api/v1/profile`)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/profile/generate-about-me` | Generate AI "About Me" summary from resumes |
| PATCH | `/profile` | Update profile fields (headline, about_me, timezone, ...) |
| GET | `/profile/ai-preferences` | Get the user's preferred AI provider/model |
| PUT | `/profile/ai-preferences` | Update the user's preferred AI provider/model |

#### Job Listings Endpoints (`/api/job-listings`)

```mermaid
flowchart TB
    subgraph Listings["Job Listings API (System-Wide)"]
        direction TB
        Browse["Browse & Search"]
        Interact["User Interactions"]
    end

    subgraph Browse_L["Browse"]
        L1["GET /filter-options"]
        L2["GET /"]
        L3["GET /search"]
        L4["GET /{id}"]
    end

    subgraph Interact_L["Interactions"]
        L5["GET /saved"]
        L6["GET /applied"]
        L7["POST /{id}/save"]
        L8["POST /{id}/hide"]
        L9["POST /{id}/applied"]
    end

    Browse --> Browse_L
    Interact --> Interact_L

    Browse_L --> PG[(PostgreSQL<br/>job_listings)]
    Interact_L --> Interact_DB[(PostgreSQL<br/>user_job_interactions)]
```

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/job-listings/filter-options` | Get filter options (public) |
| GET | `/job-listings` | List with filters |
| GET | `/job-listings/search` | Full-text search |
| GET | `/job-listings/saved` | User's saved jobs |
| GET | `/job-listings/applied` | User's applied jobs |
| GET | `/job-listings/kanban` | Kanban board view (columns + `KanbanJobItem` cards) |
| PUT | `/job-listings/kanban/reorder` | Reorder a card within / across kanban columns |
| GET | `/job-listings/{id}` | Get specific listing |
| POST | `/job-listings/{id}/save` | Save/unsave job |
| POST | `/job-listings/{id}/hide` | Hide/unhide job |
| POST | `/job-listings/{id}/applied` | Mark applied |
| PATCH | `/job-listings/{id}/status` | Update the user's application status for this listing |

#### User Scraper Requests (`/api/scraper-requests`)

Users can request that a specific LinkedIn search URL be added to the shared scraper schedule. Admin approval is required before the request becomes a preset.

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/scraper-requests` | Submit a new URL for admin review |
| GET | `/scraper-requests` | List the current user's requests and their status |
| DELETE | `/scraper-requests/{request_id}` | Cancel a pending request |

> **Removed:** The previous `/api/webhooks/job-listings` router has been retired. All listings now enter the system through the `ScraperOrchestrator` (scheduled presets, admin manual triggers, admin ad-hoc scrapes, or approved user requests). External ingestion via n8n is no longer part of the architecture.

#### Admin Endpoints (`/api/admin`)

```mermaid
flowchart TB
    subgraph Admin["Admin API (Requires is_admin)"]
        direction TB
        Scraper["Scraper Controls"]
        Presets["Preset Management"]
        Schedule["Schedule Settings"]
        ReqReview["User Request Review"]
        AIUsage["AI Usage Dashboard"]
    end

    subgraph Scraper_A["Scraper"]
        A1["GET /scraper/status"]
        A2["POST /scraper/trigger"]
        A3["POST /jobs/cleanup"]
        A4["GET /scraper/costs"]
        A5["GET /scraper/stats"]
        A6["GET /scraper/history"]
        A7["GET /scraper/health"]
        A8["POST /scraper/adhoc"]
    end

    subgraph Presets_A["Presets"]
        A9["POST /scraper/presets"]
        A10["GET /scraper/presets"]
        A11["GET /scraper/presets/{id}"]
        A12["PATCH /scraper/presets/{id}"]
        A13["DELETE /scraper/presets/{id}"]
        A14["POST /scraper/presets/{id}/toggle"]
    end

    subgraph Schedule_A["Schedule"]
        A15["GET /scraper/schedule"]
        A16["PATCH /scraper/schedule"]
        A17["POST /scraper/schedule/toggle"]
    end

    subgraph Req_A["User Requests"]
        A18["GET /scraper-requests"]
        A19["POST /scraper-requests/{id}/approve"]
        A20["POST /scraper-requests/{id}/reject"]
    end

    subgraph Usage_A["AI Usage"]
        A21["GET /summary"]
        A22["GET /by-endpoint"]
        A23["GET /by-provider"]
        A24["GET /by-user"]
        A25["GET /time-series"]
        A26["GET /pricing"]
        A27["PUT /pricing/{config_id}"]
    end

    Scraper --> Scraper_A
    Presets --> Presets_A
    Schedule --> Schedule_A
    ReqReview --> Req_A
    AIUsage --> Usage_A
```

| Group | Method | Endpoint | Description |
| ----- | ------ | -------- | ----------- |
| Scraper | GET | `/admin/scraper/status` | Orchestrator + scheduler status |
| Scraper | POST | `/admin/scraper/trigger` | Manually run all active presets |
| Scraper | POST | `/admin/jobs/cleanup` | Deactivate stale listings |
| Scraper | GET | `/admin/scraper/costs` | Apify spend summary |
| Scraper | GET | `/admin/scraper/stats` | Aggregate run statistics |
| Scraper | GET | `/admin/scraper/history` | Recent `scraper_runs` |
| Scraper | GET | `/admin/scraper/health` | Orchestrator health |
| Scraper | POST | `/admin/scraper/adhoc` | Run a one-off URL outside of presets |
| Presets | POST\|GET\|GET /{id}\|PATCH\|DELETE\|POST toggle | `/admin/scraper/presets...` | CRUD + enable/disable |
| Schedule | GET\|PATCH\|POST toggle | `/admin/scraper/schedule...` | Cron-style schedule for presets |
| Requests | GET | `/admin/scraper-requests` | Queue of user-submitted scrape requests |
| Requests | POST | `/admin/scraper-requests/{id}/approve` | Approve → create preset |
| Requests | POST | `/admin/scraper-requests/{id}/reject` | Reject with admin notes |
| AI Usage | GET | `/admin/summary` | Rolled-up tokens + `cost_usd` |
| AI Usage | GET | `/admin/by-endpoint` | Usage grouped by route |
| AI Usage | GET | `/admin/by-provider` | Usage grouped by OpenAI/Gemini |
| AI Usage | GET | `/admin/by-user` | Usage grouped by user |
| AI Usage | GET | `/admin/time-series` | Time-bucketed cost/usage |
| AI Usage | GET | `/admin/pricing` | Effective-dated pricing configs |
| AI Usage | PUT | `/admin/pricing/{config_id}` | Update a pricing row |

### 3.3 Service Layer Architecture

```mermaid
flowchart TB
    subgraph API["API Layer"]
        Routes["Route Handlers"]
    end

    subgraph Services["Service Layer"]
        subgraph Core["Core Services"]
            Cache["CacheService<br/>(Redis)"]
            Audit["AuditService"]
            PII["PIIStripper"]
        end

        subgraph AI["AI Services"]
            AIClient["AIClient<br/>(OpenAI or Gemini)"]
            Embedding["EmbeddingService<br/>(Gemini)"]
            UsageTracker["AIUsageTracker<br/>(logs to ai_usage_logs)"]
            GoogleOAuthSvc["GoogleOAuthService"]
        end

        subgraph Resume["Resume Services"]
            Parser["ResumeParser"]
            ParseTask["ParseTaskManager"]
            TailorService["TailoringService"]
        end

        subgraph Job["Job Services"]
            Analyzer["JobAnalyzer"]
            ATSFacade["ATSFacade<br/>+ 5 stage analyzers<br/>(knockout, structure,<br/>keywords, content-quality,<br/>role-proximity)"]
            DiffEngine["DiffEngine + BulletAnalyzer"]
        end

        subgraph Document["Document / Export"]
            Converter["DocumentConverter"]
            Extractor["DocumentExtractor"]
            HTMLToDoc["HTMLToDocument"]
            ExportSvc["ExportService"]
            FitToPage["FitToPageService<br/>(in-process render cache)"]
        end

        subgraph Scraping["Scraper Services"]
            ApifyClient["ApifyClient"]
            CostTracker["CostTracker"]
            Scheduler["APScheduler"]
            Orchestrator["ScraperOrchestrator"]
            CacheWarm["PostScrapeCacheWarm"]
        end

        subgraph Storage["Storage Services"]
            FileStorage["FileStorage<br/>(MinIO/S3)"]
        end
    end

    subgraph Data["Data Layer"]
        PostgreSQL[(PostgreSQL)]
        MongoDB[(MongoDB)]
        Redis[(Redis)]
        MinIO[(MinIO)]
    end

    subgraph External["External APIs"]
        TextGenAPI["OpenAI or Gemini API<br/>(AI_PROVIDER config)"]
        EmbedAPI["Gemini Embedding API"]
        Apify["Apify API"]
    end

    Routes --> Services

    AIClient --> TextGenAPI
    Embedding --> EmbedAPI
    ApifyClient --> Apify
    GoogleOAuthSvc --> GoogleAPI["Google OAuth"]

    Core --> Redis
    UsageTracker --> PostgreSQL
    Resume --> MongoDB
    Job --> PostgreSQL
    Scraping --> PostgreSQL
    Storage --> MinIO
```

### 3.4 Middleware Stack

```mermaid
flowchart LR
    subgraph Request["Incoming Request"]
        Req["HTTP Request"]
    end

    subgraph Middleware["Middleware Pipeline"]
        CORS["CORS Middleware<br/>Allow: GET, POST, PUT,<br/>PATCH, DELETE, OPTIONS"]
        RateLimit["Rate Limiter<br/>default: 60/min, 1000/hr<br/>ai: 10/min, 100/hr<br/>auth: 10/min, 50/hr"]
    end

    subgraph Deps["Per-Route Dependencies"]
        JWTAuth["get_current_user_id<br/>(JWT Bearer)"]
        SSETicket["get_current_user_id_sse<br/>(one-time Redis ticket)"]
        AdminCheck["require_admin<br/>(is_admin flag)"]
    end

    subgraph Handler["Route Handler"]
        Route["Endpoint Logic"]
    end

    Req --> CORS --> RateLimit --> Deps --> Route
```

The two true middlewares (registered in `app/main.py` via `app.add_middleware`) are `RateLimitMiddleware` (optional, gated by `rate_limit_enabled`) and `CORSMiddleware`. Authentication, SSE-ticket validation, and admin checks are route-level FastAPI dependencies, not global middleware.

---

## 4. Database Architecture

### 4.1 PostgreSQL Schema

```mermaid
erDiagram
    users ||--o{ resumes : owns
    users ||--o{ job_descriptions : owns
    users ||--o{ resume_builds : owns
    users ||--o{ user_job_interactions : has
    users ||--o{ audit_logs : generates
    users ||--o{ ai_usage_logs : generates
    users ||--o{ scraper_requests : submits

    resumes ||--o{ tailored_resumes : generates

    job_descriptions ||--o{ tailored_resumes : targets
    job_listings ||--o{ tailored_resumes : targets
    job_listings ||--o{ user_job_interactions : receives

    scraper_presets ||--o{ scraper_requests : approvedAs

    users {
        int id PK
        string email UK
        string hashed_password "nullable (Google-only users)"
        string full_name
        boolean is_active
        boolean is_admin
        string auth_provider "email|google"
        string google_id "nullable"
        datetime google_linked_at "nullable"
        string headline "profile"
        text about_me "AI-generated"
        datetime about_me_generated_at
        string timezone
        string preferred_ai_model
        datetime created_at
        datetime updated_at
    }

    resumes {
        int id PK
        int owner_id FK
        string title
        text raw_content
        text html_content
        json parsed_content
        json style
        string original_file_key
        string original_filename
        string file_type
        int file_size_bytes
        datetime created_at
        datetime updated_at
    }

    job_descriptions {
        int id PK
        uuid public_id UK
        int owner_id FK
        string title
        string company
        text raw_content
        json parsed_content
        string url
        datetime created_at
        datetime updated_at
    }

    job_listings {
        int id PK
        string external_job_id UK
        string dedup_hash UK "content-based dedup"
        string job_title
        string company_name
        string company_logo
        string company_website
        text company_description
        string company_linkedin_url
        string company_address_locality
        string company_address_country
        string location
        string city
        string state
        string country
        boolean is_remote
        string seniority
        string job_function
        string industry
        text job_description
        text job_description_html
        string job_url
        string job_url_direct
        string apply_url
        jsonb job_type
        jsonb emails
        jsonb benefits
        boolean easy_apply
        string applicants_count
        decimal salary_min
        decimal salary_max
        string salary_currency
        string salary_period
        datetime date_posted
        datetime scraped_at
        datetime last_synced_at
        string source_platform
        string region
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    tailored_resumes {
        int id PK
        int resume_id FK
        int job_id FK "nullable"
        int job_listing_id FK "nullable"
        text tailored_content
        json suggestions
        float match_score
        jsonb style_settings
        array section_order
        datetime created_at
        datetime updated_at
    }

    resume_builds {
        int id PK
        uuid public_id UK
        int user_id FK
        string job_title
        string job_company
        text job_description
        vector_768 job_embedding "retained; not used for search"
        string status
        jsonb sections
        array pulled_block_ids "legacy, unused"
        jsonb pending_diffs
        datetime created_at
        datetime updated_at
        datetime exported_at
    }

    user_job_interactions {
        int id PK
        uuid public_id UK
        int user_id FK
        int job_listing_id FK
        boolean is_saved
        boolean is_hidden
        datetime applied_at
        datetime last_viewed_at
        string application_status "kanban column"
        datetime status_changed_at
        int column_position "kanban ordering"
        datetime created_at
        datetime updated_at
    }

    ai_usage_logs {
        int id PK
        int user_id FK "nullable for system ops"
        string endpoint
        string provider "openai | gemini"
        string model
        string operation_type "generation | embedding"
        int input_tokens
        int output_tokens
        int total_tokens
        decimal cost_usd
        int latency_ms
        boolean success
        string error_message
        datetime created_at
    }

    ai_pricing_configs {
        int id PK
        string provider
        string model
        decimal input_cost_per_1k
        decimal output_cost_per_1k
        date effective_date
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    scraper_requests {
        int id PK
        int user_id FK
        text url
        string name
        text reason
        string status "pending | approved | rejected | cancelled"
        text admin_notes
        int reviewed_by FK "nullable"
        datetime reviewed_at
        int preset_id FK "nullable, set on approval"
        datetime created_at
        datetime updated_at
    }

    audit_logs {
        int id PK
        int user_id FK "nullable"
        string ip_address
        string user_agent
        string action
        string resource_type
        string resource_id
        string endpoint
        string http_method
        json details
        json old_value
        json new_value
        string status
        string error_message
        datetime created_at
    }

    scraper_runs {
        int id PK
        string run_type
        string batch_id
        string status
        datetime started_at
        datetime completed_at
        int duration_seconds
        int total_jobs_found
        int total_jobs_created
        int total_jobs_updated
        int total_errors
        jsonb region_results
        jsonb error_details
        string triggered_by
        jsonb config_snapshot
        string notes
        datetime created_at
    }

    scraper_presets {
        int id PK
        string name
        text url
        int count
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    scraper_schedule_settings {
        int id PK "always 1"
        boolean is_enabled
        string schedule_type
        int schedule_hour
        int schedule_minute
        int schedule_day_of_week
        string schedule_timezone
        datetime last_run_at
        datetime next_run_at
        datetime updated_at
    }
```

### PostgreSQL Table Summary

| Table | Purpose | Key Indexes |
| -------- | ---------- | ------------- |
| `users` | User accounts (email + Google OAuth) | email (unique), google_id (unique) |
| `resumes` | Resume metadata & content | owner_id |
| `job_descriptions` | User-created job postings | owner_id, public_id |
| `job_listings` | System-wide scraped jobs | external_job_id, dedup_hash, company, location, seniority, date_posted |
| `tailored_resumes` | AI-tailored versions | resume_id, job_id, job_listing_id |
| `resume_builds` | Workshop workspace | user_id, public_id |
| `user_job_interactions` | Save/hide/apply + kanban state | (user_id, job_listing_id) unique, public_id |
| `ai_usage_logs` | Per-call AI cost/latency tracking | (created_at, endpoint), (created_at, provider), (user_id, created_at) |
| `ai_pricing_configs` | Effective-dated pricing for cost calc | (provider, model, effective_date) |
| `scraper_requests` | User-submitted scrape URLs pending admin review | user_id, status |
| `audit_logs` | Action audit trail | user+resource, action+timestamp |
| `scraper_runs` | Scraper execution history | status, started_at |
| `scraper_presets` | Named search URL presets | — |
| `scraper_schedule_settings` | Singleton scheduler config | — |

> **Removed:** `experience_blocks` (Vault) was dropped by migration `20260405_0001_drop_experience_blocks.py`. The pgvector extension is no longer load-bearing — `resume_builds.job_embedding` is retained but not used for retrieval.

### 4.2 MongoDB Collections

```mermaid
flowchart TB
    subgraph MongoDB["MongoDB Collections"]
        subgraph resumes_col["resumes Collection"]
            R_ID["_id: ObjectId"]
            R_User["user_id: int (FK)"]
            R_Title["title: string"]
            R_Raw["raw_content: string"]
            R_HTML["html_content: string"]
            R_Parsed["parsed: ParsedContent"]
            R_Style["style: StyleSettings"]
            R_File["original_file: OriginalFile"]
            R_Master["is_master: bool"]
            R_Verify["parsed_verified, parsed_verified_at"]
            R_Ver["version: int (OCC)"]
            R_TS["created_at, updated_at"]
        end

        subgraph tailored_col["tailored_resumes Collection"]
            T_ID["_id: ObjectId"]
            T_Resume["resume_id: ObjectId (FK)"]
            T_User["user_id: int (FK)"]
            T_Job["job_source: {type, id}"]
            T_Content["content: dict (tailored)"]
            T_Status["status: enum"]
            T_ATS["ats_keywords: ATSKeywords"]
            T_TS["created_at, updated_at"]
        end

        subgraph builds_col["resume_builds Collection"]
            B_ID["_id: ObjectId"]
            B_User["user_id: int (FK)"]
            B_Job["job_info: JobInfo"]
            B_Sections["sections: ResumeSections"]
            B_Diffs["pending_diffs: list[PendingDiff]"]
            B_TS["created_at, updated_at"]
        end

        subgraph kw_col["keyword_overrides Collection"]
            K_ID["_id: ObjectId"]
            K_User["user_id: int (FK)"]
            K_Hash["job_content_hash: string"]
            K_Keywords["keywords: list[KeywordEntry]"]
            K_TS["last_updated"]
        end
    end

    resumes_col --> |"Indexes"| R_IDX["user_id<br/>(user_id, updated_at DESC)<br/>(user_id, is_master)"]
    tailored_col --> |"Indexes"| T_IDX["resume_id<br/>user_id<br/>(job_source.type, job_source.id)"]
    builds_col --> |"Indexes"| B_IDX["user_id<br/>(user_id, status)"]
    kw_col --> |"Indexes"| K_IDX["(user_id, job_content_hash)"]
```

### MongoDB Document Schemas

#### Resume Document

```json
{
  "_id": "ObjectId",
  "user_id": 123,
  "title": "Software Engineer Resume",
  "raw_content": "Plain text content...",
  "html_content": "<div>TipTap HTML...</div>",
  "parsed": {
    "contact": { "name": "...", "email": "...", "phone": "..." },
    "summary": "Professional summary...",
    "experience": [
      {
        "company": "...",
        "title": "...",
        "start_date": "...",
        "end_date": "...",
        "bullets": ["..."]
      }
    ],
    "education": [...],
    "skills": [...],
    "certifications": [...],
    "projects": [...]
  },
  "style": {
    "font_family": "Inter",
    "font_size": 11,
    "margins": { "top": 1, "right": 1, "bottom": 1, "left": 1 },
    "line_height": 1.5
  },
  "original_file": {
    "storage_key": "uploads/...",
    "filename": "resume.pdf",
    "file_type": "application/pdf",
    "size_bytes": 102400
  },
  "is_master": true,
  "parsed_verified": false,
  "parsed_verified_at": null,
  "version": 3,
  "created_at": "2026-02-20T...",
  "updated_at": "2026-04-17T..."
}
```

`version` is incremented on every write and checked on PUT `/resumes/{id}` for optimistic concurrency; concurrent writes with a stale version are rejected.

#### Tailored Resume Document

```json
{
  "_id": "ObjectId",
  "resume_id": "ObjectId",
  "user_id": 123,
  "job_source": {
    "type": "job_listing",
    "id": 456
  },
  "tailored_data": {
    "summary": "Tailored summary...",
    "experience": [...],
    "skills": [...]
  },
  "finalized_data": null,
  "status": "pending",
  "match_score": 0.85,
  "ats_keywords": {
    "matched": ["Python", "FastAPI"],
    "missing": ["Kubernetes"],
    "score": 0.75
  },
  "job_title": "Senior Backend Engineer",
  "company_name": "Acme Corp",
  "section_order": ["summary", "experience", "skills", "education"],
  "style_settings": {...},
  "created_at": "...",
  "updated_at": "..."
}
```

### 4.3 PostgreSQL-MongoDB Relationship

```mermaid
flowchart TB
    subgraph PostgreSQL["PostgreSQL (Source of Truth)"]
        PG_Users["users"]
        PG_Resumes["resumes<br/>(metadata)"]
        PG_Jobs["job_descriptions"]
        PG_Listings["job_listings"]
        PG_Builds["resume_builds<br/>(metadata)"]
        PG_Interactions["user_job_interactions"]
        PG_Usage["ai_usage_logs"]
    end

    subgraph MongoDB["MongoDB (Document Content)"]
        MG_Resumes["resumes<br/>(full content)"]
        MG_Tailored["tailored_resumes<br/>(AI versions)"]
        MG_Builds["resume_builds<br/>(sections)"]
        MG_Kw["keyword_overrides<br/>(user keyword choices)"]
    end

    PG_Users --> |"user_id"| MG_Resumes
    PG_Users --> |"user_id"| MG_Tailored
    PG_Users --> |"user_id"| MG_Builds
    PG_Users --> |"user_id"| MG_Kw

    MG_Resumes --> |"resume_id"| MG_Tailored
    PG_Jobs --> |"job_source.id"| MG_Tailored
    PG_Listings --> |"job_source.id"| MG_Tailored
```

### Dual-Database Transaction Pattern

```mermaid
sequenceDiagram
    participant API as API Route
    participant PG as PostgreSQL
    participant MG as MongoDB

    API->>PG: 1. Create record
    PG-->>API: Return ID (not committed)
    API->>PG: 2. db.flush()

    API->>MG: 3. Create document

    alt MongoDB Success
        MG-->>API: Success
        API->>PG: 4. db.commit()
        PG-->>API: Committed
    else MongoDB Failure
        MG-->>API: Error
        API->>PG: 4. db.rollback()
        PG-->>API: Rolled back
        API-->>API: Raise error
    end
```

### 4.4 Embeddings Footnote

Gemini's `text-embedding-004` (768-dim) is still called from `EmbeddingService`, and `resume_builds.job_embedding` is still populated on build creation, but the semantic retrieval path that powered the Vault was removed along with the `experience_blocks` table (migration `20260405_0001`). The HNSW/pgvector index is no longer part of any read path. If a future feature re-introduces vector search, the embedding pipeline and the Gemini API surface are still in place — only the blocks schema was dropped.

---

## 5. Frontend Architecture

### 5.1 Page Routes & Navigation Flow

```mermaid
flowchart TB
    subgraph Public["Public Routes"]
        Landing["/"]
        Login["/(auth)/login"]
        Signup["/(auth)/signup"]
    end

    subgraph Protected["Protected Routes (Auth Required)"]
        subgraph Profile["Profile"]
            ProfilePage["/profile"]
            SettingsPage["/settings"]
        end

        subgraph Jobs["Jobs Section"]
            JobsList["/jobs"]
            JobDetail["/jobs/[id]"]
            SavedJobs["/jobs/saved"]
            AppliedJobs["/jobs/applied"]
        end

        subgraph Library["Library Section"]
            LibDash["/library (→ /profile)"]
            ResNew["/library/resumes/new"]
            ResView["/library/resumes/[id]"]
            ResEdit["/library/resumes/[id]/edit"]
            ResVerify["/library/resumes/[id]/verify"]
            JobNew["/library/jobs/new"]
            JobView["/library/jobs/[id]"]
            JobEdit["/library/jobs/[id]/edit"]
        end

        subgraph Tailor["Tailoring Section (3-step wizard)"]
            TailorHub["/tailor (select)"]
            TailorAnalyze["/tailor/analyze (ATS SSE)"]
            TailorKeywords["/tailor/keywords/[id]"]
            TailorReview["/tailor/review/[id]"]
            TailorVerify["/tailor/verify/[id]"]
        end

        subgraph Workshop["Workshop Section"]
            WorkshopPage["/workshop/[id]"]
        end

        subgraph Admin["Admin Section"]
            AdminScraper["/admin/scraper"]
            AdminAIUsage["/admin/ai-usage"]
        end
    end

    Landing --> |"Signup"| Signup
    Landing --> |"Login"| Login
    Login --> |"Success"| JobsList
    Signup --> |"Success"| JobsList

    JobsList --> |"Click Job"| JobDetail
    JobsList --> |"Saved Tab"| SavedJobs
    JobsList --> |"Applied Tab"| AppliedJobs

    ProfilePage --> |"New Resume"| ResNew
    ProfilePage --> |"View Resume"| ResView
    ResView --> |"Edit"| ResEdit
    ResView --> |"Verify Parsed"| ResVerify
    ProfilePage --> |"New Job"| JobNew
    ProfilePage --> |"View Job"| JobView
    JobView --> |"Edit"| JobEdit

    JobDetail --> |"Optimize Resume"| TailorHub
    TailorHub --> TailorAnalyze --> TailorKeywords --> TailorReview --> TailorVerify

    JobDetail --> |"Build Workshop"| WorkshopPage
```

### Page Route Table

| Route | Component | Description |
| -------- | ---------- | ------------- |
| `/` | Landing Page | Hero, tech stack, how it works |
| `/(auth)/login` | Login Page | Email+password or Google OAuth |
| `/(auth)/signup` | Signup Page | Email+password or Google OAuth (full name required) |
| `/profile` | Profile | Identity, master resume, About Me, AI preferences |
| `/settings` | Settings | Account settings, timezone |
| `/jobs` | Jobs Browse | List/filter scraped jobs + kanban view |
| `/jobs/[id]` | Job Detail | Single job view |
| `/jobs/saved` | Saved Jobs | User's saved listings |
| `/jobs/applied` | Applied Jobs | Kanban-style application tracking |
| `/library` | Legacy redirect | Redirects to `/profile` |
| `/library/resumes/new` | New Resume | Create resume |
| `/library/resumes/[id]` | View Resume | Resume detail |
| `/library/resumes/[id]/edit` | Edit Resume | Rich text editor |
| `/library/resumes/[id]/verify` | Verify Parsed | Confirm AI parse output |
| `/library/jobs/new` | New Job | Create job description |
| `/library/jobs/[id]` | View Job | Job detail |
| `/library/jobs/[id]/edit` | Edit Job | Edit job description |
| `/tailor` | Step 1: Select | Choose resume + job |
| `/tailor/analyze` | Step 2a: ATS | Progressive SSE ATS analysis |
| `/tailor/keywords/[id]` | Step 2b: Keywords | User selects focus keywords |
| `/tailor/review/[id]` | Step 3: Review | Side-by-side diff UI |
| `/tailor/verify/[id]` | Step 3: Verify | Final confirmation |
| `/workshop/[id]` | Workshop | Multi-panel resume builder |
| `/admin/scraper` | Admin Scraper | Scraper + preset + request review |
| `/admin/ai-usage` | Admin AI Usage | Cost dashboard with time series |

### 5.2 Component Hierarchy

```mermaid
flowchart TB
    subgraph Root["Root Layout"]
        ThemeProvider["ThemeProvider"]
        QueryProvider["QueryProvider<br/>(React Query)"]
        AuthProvider["AuthProvider"]
    end

    subgraph Protected["Protected Layout"]
        ProtectedRoute["ProtectedRoute"]
        TailoringProvider["TailoringProvider"]
        Sidebar["Sidebar"]
        MainContent["Main Content"]
    end

    subgraph Components["Component Library"]
        subgraph Layout["Layout Components"]
            L1["Sidebar"]
            L2["Header"]
            L3["Footer"]
        end

        subgraph UI["UI Primitives"]
            U1["LoadingSpinner"]
            U2["ErrorMessage"]
            U3["Skeleton"]
            U4["TechStackLogos"]
        end

        subgraph Jobs_C["Jobs Components"]
            J1["JobListingCard"]
            J2["JobListingTable"]
            J3["JobListingFilters"]
        end

        subgraph Tailoring_C["Tailoring Components"]
            T1["PreviewDiffLayout"]
            T2["VersionHistoryPanel"]
        end

        subgraph Editor_C["Editor Components"]
            E1["TipTap Editor"]
            E2["SuggestionPopover"]
        end

        subgraph Export_C["Export Components"]
            X1["ExportDialog"]
        end

        subgraph Workshop_C["Workshop Components"]
            W1["EditorPanel"]
            W2["AIRewritePanel"]
            W3["SectionList"]
            W4["ChangeSummary"]
            W5["StylePanel"]
            W6["ResumePreview"]
            W7["ScoreSummary"]
        end

        subgraph ATS_C["ATS Components"]
            AT1["ATSProgressStepper"]
            AT2["KeywordReviewPanel"]
            AT3["ScoreDashboard"]
        end

        subgraph Admin_C["Admin Components"]
            AD1["AIUsageCharts"]
            AD2["ScraperPresetEditor"]
            AD3["ScraperRequestQueue"]
        end
    end

    Root --> ThemeProvider --> QueryProvider --> AuthProvider
    AuthProvider --> Protected
    Protected --> ProtectedRoute --> TailoringProvider
    TailoringProvider --> Sidebar
    TailoringProvider --> MainContent
    MainContent --> Components
```

### Component Module Organization

```text
/src/components
├── /layout         (Sidebar, Header, Footer)
├── /ui             (LoadingSpinner, ErrorMessage, Skeleton, ...)
├── /auth           (login/signup forms, Google OAuth button)
├── /jobs           (JobListingCard, JobListingTable, JobListingFilters, kanban)
├── /tailor         (step-1/step-2 wizard UI)
├── /tailoring      (PreviewDiffLayout, VersionHistoryPanel, diff review)
├── /ats            (ATSProgressStepper, KeywordReviewPanel, ScoreDashboard)
├── /editor         (TipTapEditor, SuggestionPopover, inline suggestions)
├── /export         (ExportDialog, PDF export wrapper)
├── /workshop       (EditorPanel, AIRewritePanel, SectionList, StylePanel, ResumePreview/, ScoreSummary)
├── /admin          (AIUsageCharts, ScraperPresetEditor, ScraperRequestQueue)
├── /library        (resume/job library cards)
├── /upload         (file upload + extraction)
├── /icons          (SVG icons)
├── /errors         (error boundaries)
├── /demos          (landing-page demo embeds)
└── ProtectedRoute.tsx
```

### 5.3 State Management

```mermaid
flowchart TB
    subgraph Global["Global State (Context)"]
        AuthCtx["AuthContext<br/>user, tokens, Google OAuth"]
        ThemeCtx["ThemeContext<br/>theme"]
        TailorCtx["TailoringContext<br/>session, diffs, history"]
        TzCtx["TimezoneContext<br/>user timezone"]
    end

    subgraph Zstd["Client Domain State (Zustand)"]
        Z1["atsProgressStore<br/>SSE events, stage results"]
        Z2["bulletSuggestionsStore"]
        Z3["inlineSuggestionQueueStore"]
        Z4["keywordReviewStore"]
    end

    subgraph Server["Server State (React Query)"]
        Cache["Query Cache"]

        subgraph Queries["Query Hooks"]
            Q1["useResumes()"]
            Q2["useJobs()"]
            Q3["useJobListings(filters)"]
            Q5["useTailoredResumes()"]
            Q6["useWorkshops()"]
            Q7["useKanbanBoard()"]
            Q8["useAIUsageSummary()"]
        end

        subgraph Mutations["Mutation Hooks"]
            M1["useCreateResume()"]
            M2["useUpdateResume()"]
            M3["useTailorResume()"]
            M4["useFinalizeTailoredResume()"]
            M5["useSaveJobListing()"]
            M6["useUpdateApplicationStatus()"]
        end
    end

    subgraph Local["Local State"]
        useState["useState / useReducer"]
        SessionStorage["sessionStorage<br/>(TailoringSession)"]
    end

    AuthCtx --> |"Provides"| ProtectedRoute["Protected Routes"]
    TailorCtx --> |"Provides"| TailorPages["Tailor Pages"]
    TailorCtx --> |"Persists"| SessionStorage

    Cache --> Queries
    Mutations --> |"Invalidates"| Cache
```

### State Layer Details

| Layer | Technology | Purpose | Persistence |
| -------- | ---------- | ------------- | ------------- |
| Auth | AuthContext | User session, access+refresh tokens, Google OAuth | localStorage |
| Theme | ThemeContext | Dark/light mode | localStorage |
| Timezone | TimezoneContext | User timezone for date rendering | localStorage |
| Tailoring | TailoringContext | Edit session state | sessionStorage (~30min) |
| ATS | `atsProgressStore` (Zustand) | Active SSE connection + stage results | localStorage (persist middleware) |
| Bullet suggestions | `bulletSuggestionsStore`, `inlineSuggestionQueueStore` (Zustand) | AI bullet rewrite queue/state | Memory |
| Keyword review | `keywordReviewStore` (Zustand) | User keyword selections in Step 2 | Memory |
| Server | React Query | API data cache | Memory (staleTime: 60s) |
| Local | useState / useReducer | Component state | None |

### TailoringContext State Structure

```typescript
interface TailoringSessionData {
  session: {
    original: ResumeBlocks;      // Original resume
    aiProposed: ResumeBlocks;    // AI-generated version
    activeDraft: ResumeBlocks;   // User's working copy
    acceptedChanges: Set<string>; // Accepted diff IDs
  };
  diffs: BlockDiff[];            // Computed differences
  diffSummary: {
    totalChanges: number;
    modifiedBlocks: number;
    addedBlocks: number;
    removedBlocks: number;
  };
  history: SessionSnapshot[];    // Undo stack
  jobTitle: string;
  companyName: string;
  matchScore: number;
  createdAt: number;
}
```

### 5.4 API Client Layer

```mermaid
flowchart TB
    subgraph Hooks["React Query Hooks"]
        useResumes["useResumes()"]
        useJobs["useJobs()"]
        useJobListings["useJobListings()"]
        useBlocks["useBlocks()"]
        useTailored["useTailoredResumes()"]
        useWorkshops["useWorkshops()"]
    end

    subgraph Client["API Client (client.ts)"]
        TokenMgr["tokenManager<br/>get/set/clear tokens"]
        FetchAPI["fetchApi<T>()<br/>Base fetch wrapper"]

        subgraph Modules["API Modules"]
            AuthAPI["authApi (incl. googleAuth, sseTicket)"]
            ProfileAPI["profileApi"]
            ResumeAPI["resumeApi (incl. setMaster, verifyParsed)"]
            JobAPI["jobApi"]
            TailorAPI["tailorApi (incl. analyzeBullets)"]
            BuildAPI["resumeBuildApi (aliased as workshopApi)"]
            UploadAPI["uploadApi"]
            ListingsAPI["jobListingApi (incl. kanban)"]
            ScraperReqAPI["scraperRequestApi"]
            AdminAPI["adminApi (scraper + AI usage dashboard)"]
            ATSAPI["atsApi (+ SSE hook)"]
            AIChatAPI["aiApi"]
            ExportAPI["exportApi (incl. fitToPage)"]
        end
    end

    subgraph Backend["Backend API"]
        FastAPI["FastAPI Server"]
    end

    Hooks --> |"queryFn"| Modules
    Modules --> FetchAPI
    FetchAPI --> |"Authorization: Bearer"| TokenMgr
    FetchAPI --> |"HTTP Request"| FastAPI

    FastAPI --> |"401 Unauthorized"| FetchAPI
    FetchAPI --> |"Auto Refresh"| TokenMgr
```

### SSE Client Pattern

```typescript
// 1. Exchange JWT for one-time ticket (fetched via authApi.sseTicket)
const { ticket } = await authApi.sseTicket();

// 2. Open EventSource — ticket travels as a query param, not the Authorization header
const url = `/api/v1/ats/analyze-progressive?resume_id=${resumeId}&job_id=${jobId}&ticket=${ticket}`;
const es = new EventSource(url);

es.addEventListener("stage_complete", (e) => {
  const payload = JSON.parse((e as MessageEvent).data);
  atsProgressStore.setState({ stage: payload.stage, result: payload.result });
});
es.addEventListener("complete", () => es.close());
```

The frontend never puts the JWT in the URL. Each SSE connection consumes a fresh 30-second ticket, which is why `POST /auth/sse-ticket` is called immediately before opening the EventSource.

### Query Key Hierarchy

```typescript
const queryKeys = {
  resumes: {
    all: ['resumes'],
    list: () => ['resumes', 'list'],
    detail: (id: string) => ['resumes', id],
    parseStatus: (resumeId: string, taskId: string) =>
      ['resumes', resumeId, 'parse', taskId],
  },
  jobs: {
    all: ['jobs'],
    list: () => ['jobs', 'list'],
    detail: (id: number) => ['jobs', id],
  },
  tailored: {
    all: ['tailored'],
    list: () => ['tailored', 'list'],
    detail: (id: string) => ['tailored', id],
    compare: (id: string) => ['tailored', id, 'compare'],
  },
  blocks: {
    all: ['blocks'],
    list: (filters?: BlockFilters) => ['blocks', 'list', filters],
    detail: (id: number) => ['blocks', id],
  },
  jobListings: {
    all: ['jobListings'],
    list: (filters: JobListingFilters) => ['jobListings', 'list', filters],
    detail: (id: number) => ['jobListings', id],
    saved: () => ['jobListings', 'saved'],
    applied: () => ['jobListings', 'applied'],
    filterOptions: () => ['jobListings', 'filterOptions'],
  },
  // ... more keys
};
```

---

## 6. Core Feature Flows

### 6.1 Authentication Flow

The authentication surface supports three entry modes (email+password, Google OAuth, refresh) and an SSE-specific ticket exchange that is not itself authentication but is how authenticated users open EventSource connections.

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant AuthCtx as AuthContext
    participant API as FastAPI
    participant DB as PostgreSQL
    participant Google
    participant Redis

    alt Email + Password
        User->>Browser: Submit login form
        Browser->>API: POST /api/auth/login
        API->>DB: Verify credentials
        DB-->>API: User record
        API-->>Browser: {access_token, refresh_token}
    else Google OAuth
        User->>Browser: Click "Continue with Google"
        Browser->>Google: Get Google ID token
        Google-->>Browser: id_token
        Browser->>API: POST /api/auth/google {id_token}
        API->>Google: Verify id_token
        API->>DB: Upsert user (auth_provider=google)
        API-->>Browser: {access_token, refresh_token}
    end

    Browser->>AuthCtx: setTokens(), setUser()
    AuthCtx->>Browser: localStorage.setItem()

    Note over Browser,API: On subsequent requests...

    Browser->>API: GET /api/resumes (Bearer token)

    alt Token Valid
        API-->>Browser: 200 OK + data
    else Token Expired
        API-->>Browser: 401 Unauthorized
        Browser->>API: POST /api/auth/refresh
        API-->>Browser: New access_token
        Browser->>API: Retry original request
        API-->>Browser: 200 OK + data
    end

    Note over Browser,API: When opening an SSE (e.g. /ats/analyze-progressive)...

    Browser->>API: POST /api/auth/sse-ticket (Bearer token)
    API->>Redis: SETEX sse_ticket:{rand} user_id TTL=30s
    API-->>Browser: {ticket}
    Browser->>API: EventSource(url?ticket=...)
    API->>Redis: GETDEL sse_ticket:{ticket}
    Redis-->>API: user_id (or nil → 401)
    API-->>Browser: SSE stream
```

### 6.2 Resume Tailoring Flow

The tailor flow was redesigned into a linear 3-step wizard experience:

```mermaid
sequenceDiagram
    participant User
    participant Step1 as Step 1: Select
    participant Step2 as Step 2: Analyze
    participant Step3 as Step 3: Detail
    participant API as FastAPI
    participant ATS as ATS SSE Stream
    participant AI as OpenAI/Gemini API
    participant MG as MongoDB
    participant Redis as Redis Cache

    %% Step 1: Resume Selection
    User->>Step1: Click "Optimize Resume" from Job Detail
    Note over Step1: /tailor?job_listing_id=X<br/>Master resume pre-selected
    User->>Step1: Confirm resume selection
    Step1->>Step2: Navigate to /tailor/analyze

    %% Step 2: ATS Analysis + Keyword Selection
    Step2->>ATS: POST /v1/ats/analyze-progressive

    loop 5 ATS Stages (SSE)
        ATS-->>Step2: stage_start / stage_complete events
        Note over Step2: ATSProgressStepper updates
    end
    ATS-->>Step2: complete event with composite_score
    ATS->>Redis: Cache ATS results (24h TTL)

    Note over Step2: Show keyword selection UI<br/>Keywords present in resume: checkboxes<br/>Missing-from-resume: grayed out
    User->>Step2: Select focus keywords
    User->>Step2: Click "Generate Tailored Resume"

    %% AI Tailoring with focus_keywords
    Step2->>API: POST /api/tailor with focus_keywords
    API->>AI: Generate tailored resume
    AI-->>API: Tailored content
    API->>MG: Store tailored_resume
    API-->>Step2: {tailored_id, match_score}
    Step2->>Step3: Redirect to /tailor/{id}

    %% Step 3: Detail Page
    Step3->>API: GET /api/tailor/{id}
    API->>Redis: Check ATS cache
    Redis-->>API: ATS metadata (ats_score, cached_at, is_outdated)
    API->>MG: Fetch tailored resume
    MG-->>API: Tailored document
    API-->>Step3: Full response with ATS cache info

    Note over Step3: Display formatted_name<br/>"Software Engineer @ Acme — Mar 5"
    Note over Step3: Score dashboard with cache info<br/>Version history sidebar

    %% Optional: Edit flow
    User->>Step3: Click "Edit"
    Step3->>API: GET /api/tailor/{id}/compare
    API-->>Step3: {original, tailored}
    Note over Step3: Client-side diffing in TailoringContext
    User->>Step3: Accept/reject changes in editor
    User->>Step3: Click "Finalize"
    Step3->>API: POST /api/tailor/{id}/finalize
    API->>MG: Update finalized_data
```

**Key Flow Changes (v2):**

| Aspect | Before | After |
| ------ | ------ | ----- |
| Navigation | Single page with steps | 3 distinct routes |
| History Display | On selection page | Version history sidebar on detail page |
| ATS Analysis | None | 5-stage progressive with SSE |
| Keyword Control | AI decides | User selects from resume-backed skills; missing-from-resume keywords are disabled |
| Score Display | Instant, potentially inconsistent | Gated until analysis complete |
| Naming | UUID-based | Human-readable: "{job} @ {company} — {date}" |

**Focus Keywords (Resume Integrity):**

The `focus_keywords` parameter ensures users only claim skills they actually have:

```typescript
// Step 2: User selects which skills to emphasize
const selectedKeywords = ["Python", "FastAPI", "AWS"];

// AI only optimizes for these verified skills
POST /api/tailor {
  resume_id: "...",
  job_listing_id: 123,
  focus_keywords: selectedKeywords  // User's selection
}
```

Skills that don't appear in the user's resume content are grayed out and cannot be selected, preventing AI from adding unverified skills to the resume.

### Two Copies Architecture

```mermaid
flowchart TB
    subgraph Storage["MongoDB tailored_resumes"]
        Original["original resume<br/>(from resumes collection)"]
        AIProposed["tailored_data<br/>(AI-generated, immutable)"]
        UserFinal["finalized_data<br/>(user's merged version)"]
    end

    subgraph Frontend["Frontend Session"]
        ActiveDraft["activeDraft<br/>(working copy)"]
        AcceptedSet["acceptedChanges<br/>(Set of diff IDs)"]
        DiffEngine["Client-side Diff<br/>Computation"]
    end

    Original --> |"Compare"| DiffEngine
    AIProposed --> |"Compare"| DiffEngine
    DiffEngine --> |"BlockDiff[]"| UI["Diff Review UI"]

    UI --> |"Accept/Reject"| AcceptedSet
    AcceptedSet --> |"Merge"| ActiveDraft
    ActiveDraft --> |"Finalize"| UserFinal
```

### 6.3 Workshop/Resume Builder Flow

```mermaid
sequenceDiagram
    participant User
    participant Workshop as Workshop UI
    participant API as FastAPI
    participant AI as OpenAI/Gemini API
    participant MG as MongoDB

    User->>Workshop: Create build for job
    Workshop->>API: POST /api/v1/resume-builds
    API->>MG: Create resume_build doc
    API-->>Workshop: {build_id}

    User->>Workshop: Edit sections directly in the multi-panel UI
    Workshop->>API: PATCH /api/v1/resume-builds/{id}/sections
    API->>MG: Update sections

    User->>Workshop: Request AI suggestions (full or single bullet)
    Workshop->>API: POST /api/v1/resume-builds/{id}/suggest[-bullet]
    API->>AI: Generate improvements
    AI-->>API: Diff suggestions
    API->>MG: Store pending_diffs
    API-->>Workshop: Suggestions

    loop For each suggestion
        User->>Workshop: Accept/Reject
        Workshop->>API: POST /diffs/accept or /diffs/reject
        API->>MG: Update pending_diffs
    end

    User->>Workshop: Export
    Workshop->>API: POST /api/v1/resume-builds/{id}/export
    API-->>Workshop: PDF/DOCX file
```

The Workshop no longer pulls blocks from the Vault (which was removed in `20260405_0001`). Content originates from one of: a starting resume template, pulled content from one of the user's existing resumes, or manual entry — then is refined with per-section / per-bullet AI suggestions exposed as accept/reject diffs.

### Workshop Multi-Panel Layout

```mermaid
flowchart LR
    subgraph Workshop["Workshop Page"]
        subgraph LeftPanel["Left Panel"]
            SectionList["Section List<br/>(Drag & Drop)"]
            EditorPanel["Section Editor<br/>(per section)"]
        end

        subgraph CenterPanel["Center Panel"]
            ResumePreview["Live Preview<br/>(Real-time)"]
        end

        subgraph RightPanel["Right Panel"]
            StylePanel["Style Settings<br/>(Font, Margins)"]
            AIPanel["AI Suggestions<br/>(Diffs)"]
            ScorePanel["Match Score<br/>(ATS Keywords)"]
        end
    end

    SectionList --> |"Select"| EditorPanel
    EditorPanel --> |"Updates"| ResumePreview
    StylePanel --> |"Styling"| ResumePreview
    AIPanel --> |"Accept"| EditorPanel
```

### 6.4 Job Scraper Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Admin
    participant Scheduler as APScheduler
    participant Orchestrator as ScraperOrchestrator
    participant Apify as Apify API
    participant API as FastAPI
    participant DB as PostgreSQL

    alt Scheduled Run
        Scheduler->>Orchestrator: trigger_scrape()
        Orchestrator->>DB: Get active presets
        DB-->>Orchestrator: Preset URLs

        loop For each preset
            Orchestrator->>Apify: Run LinkedIn scraper
            Apify-->>Orchestrator: Job listings batch
        end

        Orchestrator->>DB: Upsert job_listings (dedup_hash)
        Orchestrator->>DB: Log scraper_run
    end

    alt Admin Manual / Ad-hoc
        Admin->>API: POST /admin/scraper/trigger (all presets)
        Admin->>API: POST /admin/scraper/adhoc (one URL)
        API->>Orchestrator: trigger_*()
        Orchestrator->>Apify: Run
        Apify-->>Orchestrator: Results
        Orchestrator-->>API: Stats
    end

    alt User-Submitted Request
        User->>API: POST /api/scraper-requests (URL + reason)
        API->>DB: scraper_requests INSERT (status=pending)
        Admin->>API: POST /admin/scraper-requests/{id}/approve
        API->>DB: Create scraper_preset, link to request
        Note over API,DB: Next scheduled run will include it
    end
```

### Scraper Architecture

```mermaid
flowchart TB
    subgraph Triggers["Scrape Triggers"]
        Scheduled["APScheduler<br/>(Daily/Weekly)"]
        Manual["Admin Manual<br/>POST /admin/scraper/trigger"]
        AdHoc["Ad-hoc URL<br/>POST /admin/scraper/adhoc"]
        UserReq["User-submitted request<br/>approved by admin → preset"]
    end

    subgraph Processing["Processing"]
        Orchestrator["ScraperOrchestrator"]
        ApifyClient["ApifyClient"]
        CostTracker["CostTracker"]
        CacheWarm["Post-scrape cache warm"]
    end

    subgraph Storage["Storage"]
        JobListings[(job_listings)]
        ScraperRuns[(scraper_runs)]
        Presets[(scraper_presets)]
        Requests[(scraper_requests)]
        Schedule[(scraper_schedule_settings)]
    end

    Scheduled --> Orchestrator
    Manual --> Orchestrator
    AdHoc --> Orchestrator
    UserReq --> Requests
    Requests --> Presets

    Orchestrator --> ApifyClient
    ApifyClient --> |"Results"| Orchestrator
    Orchestrator --> JobListings
    Orchestrator --> ScraperRuns
    Orchestrator --> CacheWarm
    ApifyClient --> CostTracker

    Presets --> Orchestrator
    Schedule --> Scheduled
```

---

## 7. Data Flow Diagrams

### Overall Request-Response Flow

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        Browser["Browser"]
        ReactQuery["React Query<br/>Cache"]
        Hooks["Custom Hooks"]
        APIClient["API Client"]
    end

    subgraph Server["Server Layer"]
        FastAPI["FastAPI"]
        Middleware["Middleware<br/>(CORS, Rate Limit, Auth)"]
        Router["Route Handler"]
        Service["Service Layer"]
        CRUD["CRUD Layer"]
    end

    subgraph Data["Data Layer"]
        PostgreSQL[(PostgreSQL)]
        MongoDB[(MongoDB)]
        Redis[(Redis)]
    end

    Browser --> |"User Action"| Hooks
    Hooks --> |"useQuery/Mutation"| ReactQuery
    ReactQuery --> |"Cache Miss"| APIClient
    APIClient --> |"HTTP Request"| FastAPI

    FastAPI --> Middleware --> Router --> Service --> CRUD

    CRUD --> PostgreSQL
    CRUD --> MongoDB
    Service --> Redis

    CRUD --> |"Response"| Service --> Router --> Middleware --> FastAPI
    FastAPI --> |"JSON"| APIClient
    APIClient --> |"Update Cache"| ReactQuery
    ReactQuery --> |"Re-render"| Browser
```

### Resume Parsing Data Flow

```mermaid
flowchart TB
    subgraph Upload["Upload Phase"]
        File["PDF/DOCX File"]
        Extractor["DocumentExtractor"]
        Text["Raw Text"]
        HTML["HTML Content"]
    end

    subgraph Parse["Parse Phase (Background)"]
        ParseTask["ParseTaskManager"]
        AIProvider["OpenAI/Gemini API"]
        Structured["Structured JSON"]
    end

    subgraph Store["Storage Phase"]
        MongoDB[(MongoDB<br/>resumes)]
        MinIO[(MinIO<br/>Original File)]
    end

    subgraph Verify["Verification Phase (User)"]
        VerifyUI["/library/resumes/[id]/verify"]
        Confirmed["parsed_verified=true"]
    end

    File --> Extractor --> Text
    Extractor --> HTML
    File --> MinIO

    Text --> ParseTask --> AIProvider --> Structured
    HTML --> MongoDB
    Structured --> MongoDB

    MongoDB --> VerifyUI --> Confirmed --> MongoDB
```

The atomic-block splitter + embedder that previously fed the Vault was removed along with the `experience_blocks` table. After parsing, the user now reviews the AI output directly in the verify page and marks it as trusted (`parsed_verified`), which downstream tailoring and ATS flows use as a signal of fidelity.

---

## 8. Security Architecture

```mermaid
flowchart TB
    subgraph Auth["Authentication"]
        JWT["JWT Tokens<br/>(Access + Refresh)"]
        BCrypt["BCrypt<br/>Password Hashing"]
    end

    subgraph Authorization["Authorization"]
        UserAuth["User Auth<br/>(JWT Required)"]
        GoogleAuth["Google OAuth<br/>(ID Token)"]
        SSETicket["SSE Ticket<br/>(one-time, Redis, 30s TTL)"]
        AdminAuth["Admin Auth<br/>(is_admin Check)"]
    end

    subgraph Protection["Protection Layers"]
        CORS["CORS<br/>(Allowed Origins)"]
        RateLimit["Rate Limiting<br/>(Redis-backed)"]
        PII["PII Stripper<br/>(Pre-AI Processing)"]
        Param["Parameterized Queries<br/>(SQL Injection Prevention)"]
    end

    subgraph Secrets["Secrets Management"]
        Env[".env Files<br/>(Not Committed)"]
        Example[".env.example<br/>(Templates Only)"]
    end

    JWT --> UserAuth
    JWT --> AdminAuth
    JWT --> SSETicket
    BCrypt --> Auth
    GoogleAuth --> UserAuth

    UserAuth --> |"Protected Routes"| API["API Endpoints"]
    AdminAuth --> |"/api/admin/*"| AdminAPI["Admin Endpoints"]
    SSETicket --> |"/api/v1/ats/analyze-progressive"| SSEAPI["SSE Endpoints"]

    CORS --> API
    RateLimit --> API
    PII --> |"Before AI"| AIProvider["OpenAI/Gemini API"]
    Param --> |"All Queries"| DB[(Database)]
```

### Security Measures

| Layer | Protection | Implementation |
| ------- | ------------ | ---------------- |
| Authentication | JWT Tokens | Access (short-lived) + Refresh (long-lived) |
| Federated Auth | Google OAuth | ID-token verification; `users.auth_provider` records origin |
| Password | BCrypt | Salted hashing; nullable for Google-only users |
| SSE Auth | One-time Redis ticket | `POST /auth/sse-ticket` (requires JWT) → ticket consumed on EventSource connect, 30s TTL |
| API Rate Limits | Redis | `default: 60/min, 1000/hr`; `ai: 10/min, 100/hr`; `auth: 10/min, 50/hr` |
| CORS | FastAPI Middleware | Configured allowed origins |
| SQL Injection | SQLAlchemy | Parameterized queries only |
| PII Protection | PII Stripper | Removes sensitive data before AI |
| Secrets | Environment Variables | `.env` files (gitignored); never baked into images |

---

## 9. Caching Strategy

```mermaid
flowchart TB
    subgraph Frontend["Frontend Caching"]
        RQCache["React Query Cache<br/>staleTime: 60s"]
        SessionStorage["sessionStorage<br/>Tailoring Session (30min)"]
        LocalStorage["localStorage<br/>Auth Tokens, Theme"]
    end

    subgraph Backend["Backend Caching"]
        Redis[(Redis)]
        InProc["In-process<br/>(FitToPage render cache)"]

        subgraph RedisKeys["Redis Keys"]
            RateLimit["rate_limit:{user}:{endpoint}"]
            ParseStatus["parse_status:{task_id}"]
            Embedding["embedding:{content_hash}"]
            ATSCache["ats:{resume_hash}:{job_id} (24h)"]
            SSETicket["sse_ticket:{rand} (30s)"]
            FastAPICache["rb-cache:* (fastapi-cache2 prefix)"]
        end
    end

    RQCache --> |"API Responses"| Components["React Components"]
    SessionStorage --> |"Edit State"| TailorPages["Tailor Pages"]
    LocalStorage --> |"Persistent"| AuthCtx["Auth Context"]

    Redis --> RedisKeys
```

### Cache TTL Configuration

| Cache | TTL | Purpose |
| ------- | ----- | --------- |
| React Query | 60s staleTime | API response freshness |
| Tailoring Session | ~30 minutes | Cross-page state handoff |
| Rate Limit Counters | 1 minute / 1 hour | Request throttling |
| Parse Status | Until complete | Background task tracking |
| Embedding Cache | 24 hours | Avoid redundant Gemini calls |
| ATS Progressive | 24 hours | Cached composite score per (resume, job) |
| SSE Ticket | 30 seconds | One-time SSE auth |
| FastAPICache | Per-endpoint | Response cache, Redis-backed (falls back to in-memory if Redis is unreachable at startup) |
| FitToPage render | In-process LRU | Skip re-rendering identical layouts |

---

## 10. Deployment Architecture

The deployment model splits cleanly into two environments:

- **10.1 Local Development Stack** — single-machine Docker Compose with every dependency (Postgres, MongoDB, Redis, MinIO) running as a sibling container. Defined in the repo-root `docker-compose.yml`.
- **10.2 Production Deployment** — GitHub Actions builds a single backend image and pushes it to GHCR; the DigitalOcean droplet runs only `api` + `redis` containers via `deploy/docker-compose.prod.yml`. Postgres and MongoDB are external managed services (Supabase, MongoDB Atlas). The frontend is hosted on Vercel and is out of scope here.

### 10.1 Local Development Stack

```mermaid
flowchart TB
    subgraph External["External Traffic"]
        Users["Users"]
    end

    subgraph Docker["Docker Compose Stack (local dev)"]
        subgraph Frontend_C["Frontend Container"]
            NextJS["Next.js<br/>Port 3000"]
        end

        subgraph Backend_C["Backend Container"]
            FastAPI["FastAPI<br/>Port 8000"]
            APScheduler["APScheduler<br/>(Background Jobs)"]
        end

        subgraph Data_C["Data Containers"]
            PostgreSQL["PostgreSQL<br/>Port 5432"]
            MongoDB["MongoDB<br/>Port 27017"]
            Redis["Redis<br/>Port 6379"]
            MinIO["MinIO<br/>Port 9000"]
        end
    end

    subgraph External_Services["External Services"]
        AIProvider["OpenAI or Gemini API<br/>(Text Generation)"]
        GeminiEmbed["Gemini API<br/>(Embeddings)"]
        Apify["Apify API"]
    end

    Users --> NextJS
    NextJS --> FastAPI

    FastAPI --> PostgreSQL
    FastAPI --> MongoDB
    FastAPI --> Redis
    FastAPI --> MinIO

    FastAPI --> AIProvider
    FastAPI --> GeminiEmbed
    APScheduler --> Apify
```

#### Local Container Configuration

| Service | Image | Port | Volume |
| ------- | ----- | ------ | ------ |
| frontend | node:20-alpine | 3000 | - |
| backend | python:3.11-slim | 8000 | - |
| postgres | postgres:15-alpine | 5432 | pgdata |
| mongodb | mongo:7 | 27017 | mongodata |
| redis | redis:7-alpine | 6379 | redisdata |
| minio | minio/minio | 9000, 9001 | miniodata |

#### Local Environment Variables (Required)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/resume_tailor
MONGODB_URI=mongodb://mongo:27017
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET_KEY=<generated-secret>
JWT_ALGORITHM=HS256

# AI Services - Provider Selection
AI_PROVIDER=openai  # Options: "openai" (default) or "gemini"

# OpenAI Configuration (if AI_PROVIDER=openai)
OPENAI_API_KEY=<openai-api-key>
OPENAI_MODEL=gpt-4o-mini  # Default model

# Gemini Configuration (for embeddings, and text gen if AI_PROVIDER=gemini)
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.0-flash  # Text generation model

# Google OAuth (optional — enables "Continue with Google")
GOOGLE_OAUTH_CLIENT_ID=<google-client-id>

# Scraper
APIFY_API_TOKEN=<apify-token>

# Storage
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>
```

### 10.2 Production Deployment

Production uses a pre-built container image flow: no Python toolchain, Poetry, or source build runs on the droplet. The pipeline was cut over on 2026-04-11 (see `/docs/features/infrastructure/260411_docker-cicd-pipeline/`).

```mermaid
flowchart TB
    subgraph GHA["GitHub Actions"]
        CI["ci.yml<br/>(PR: ruff + pytest<br/>vs real Postgres 16 + Mongo 7)"]
        CD["cd.yml<br/>(push to main)"]
        Build["build-and-push<br/>(Buildx → GHCR)"]
        Migrate["migrate<br/>(docker run alembic upgrade head<br/>→ Supabase)"]
        Deploy["deploy<br/>(SSH → docker compose pull && up -d)"]
    end

    subgraph GHCR["ghcr.io/sungchunn/resume-builder-api"]
        Image["image :latest<br/>image :sha-&lt;commit&gt;"]
    end

    subgraph Droplet["DigitalOcean Droplet (1 GB)"]
        Nginx["Nginx<br/>(SSL, 443 → 127.0.0.1:8000)"]
        subgraph Compose["deploy/docker-compose.prod.yml"]
            API["resume-api<br/>(FastAPI + Uvicorn)"]
            RedisC["resume-redis<br/>(redis:7-alpine,<br/>128mb, allkeys-lru)"]
        end
    end

    subgraph Managed["Managed Services"]
        Supabase["Supabase Postgres<br/>(pgvector)"]
        Atlas["MongoDB Atlas"]
        OpenAI["OpenAI API"]
    end

    CD --> Build --> Image
    Build --> Migrate --> Supabase
    Migrate --> Deploy
    Deploy -. pulls .-> Image
    Deploy --> API

    Nginx --> API
    API --> RedisC
    API --> Supabase
    API --> Atlas
    API --> OpenAI
```

**Pipeline (runs on push to `main` touching `backend/**`, `deploy/docker-compose.prod.yml`, or `cd.yml`):**

1. **`build-and-push`** — Buildx builds `backend/Dockerfile` with GHA layer cache, pushes `:latest` and `:sha-<commit>` tags to GHCR (private).
2. **`migrate`** — `docker run --rm` the new image from the runner with production env vars injected, executing `alembic upgrade head` directly against Supabase. The droplet is never involved in migrations.
3. **`deploy`** — SSHes to the droplet, `git pull` (to refresh `deploy/docker-compose.prod.yml`), `docker login ghcr.io`, `docker compose pull api && up -d api`, `docker image prune -f`, then a 5-attempt `/health` check.

**Production container configuration (droplet only):**

| Service | Image | Port | Volume |
| ------- | ----- | ---- | ------ |
| resume-api | `ghcr.io/sungchunn/resume-builder-api:latest` | `127.0.0.1:8000` | — |
| resume-redis | `redis:7-alpine` (128mb, `allkeys-lru`) | (container-only) | `redis_data` |

**Key invariants:**

- `.env` is never baked into the image. `deploy/docker-compose.prod.yml` injects it via `env_file:` from `/home/deploy/app/deploy/.env`.
- Inside the `resume-api` container, `REDIS_URL` **must** be `redis://redis:6379` (Compose DNS), not `localhost`. A wrong value starts cleanly but every cache operation fails at runtime.
- The migrate job passes `REDIS_URL=redis://localhost:6379` as a placeholder only to satisfy the settings import; migrations never touch Redis.
- `MONGODB_URI`, `JWT_SECRET_KEY`, and `OPENAI_API_KEY` are required at import time (via `pydantic-settings` validators in `app/core/config.py`), so the migrate job must pass them even though alembic itself doesn't use them.
- Rollback: edit `deploy/docker-compose.prod.yml` on the droplet to pin `image:` to a previous `sha-<commit>` tag, then `docker compose pull api && up -d api`.

See `/docs/architecture/digitalocean-hosting-setup.md` for the droplet-side operational details (Nginx config, logs, troubleshooting).

---

## Appendix: API Endpoint Count Summary

| Category | Endpoint Count |
| ---------- | ---------------- |
| Auth | 6 |
| Resumes | 11 |
| Jobs | 5 |
| Tailor | 9 |
| Export | 2 |
| Upload | 1 |
| Resume Builds | 13 |
| ATS | 14 |
| AI Chat | 2 |
| Profile | 4 |
| Job Listings | 12 |
| Scraper Requests (user) | 3 |
| Admin (scraper + presets + schedule + request review + AI usage) | 27 |
| **Total** | **109** |

---

## Appendix: Database Table Count Summary

| Database | Collection/Table | Purpose |
| ---------- | ------------------ | --------- |
| PostgreSQL | users | User accounts (email + Google OAuth) |
| PostgreSQL | resumes | Resume metadata |
| PostgreSQL | job_descriptions | User job postings |
| PostgreSQL | job_listings | System-wide scraped jobs (dedup_hash) |
| PostgreSQL | tailored_resumes | AI-tailored metadata |
| PostgreSQL | resume_builds | Workshop metadata |
| PostgreSQL | user_job_interactions | Save/hide/apply + kanban state |
| PostgreSQL | ai_usage_logs | Per-call AI cost + latency tracking |
| PostgreSQL | ai_pricing_configs | Effective-dated provider/model pricing |
| PostgreSQL | scraper_requests | User-submitted scrape URLs awaiting admin review |
| PostgreSQL | audit_logs | Action audit trail |
| PostgreSQL | scraper_runs | Scraper history |
| PostgreSQL | scraper_presets | URL presets |
| PostgreSQL | scraper_schedule_settings | Schedule config |
| MongoDB | resumes | Full resume content (+ version for OCC) |
| MongoDB | tailored_resumes | Full tailored content |
| MongoDB | resume_builds | Workshop sections |
| MongoDB | keyword_overrides | Per-user keyword selections by job content hash |
| **PostgreSQL Total** | **14 tables** | |
| **MongoDB Total** | **4 collections** | |
