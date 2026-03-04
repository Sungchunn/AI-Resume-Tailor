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
   - [Vector Search Architecture](#44-vector-search-architecture)
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
        D1["PostgreSQL 16"]
        D2["pgvector Extension"]
        D3["MongoDB 7"]
        D4["Redis 7"]
    end

    subgraph AI["AI/ML Stack"]
        direction TB
        A1["Gemini API (default)<br/>or OpenAI API"]
        A2["Gemini Embeddings<br/>(Google)"]
        A3["768-dim Vectors"]
        A4["HNSW Index"]
    end

    Frontend --> Backend
    Backend --> Database
    Backend --> AI
```

### Dependency Summary

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Frontend | Next.js | 15.1.0 | SSR Framework |
| Frontend | React | 19.0.0 | UI Library |
| Frontend | TanStack Query | 5.90 | Server State |
| Frontend | TipTap | 3.20 | Rich Text Editor |
| Backend | FastAPI | Latest | API Framework |
| Backend | SQLAlchemy | 2.0 | PostgreSQL ORM |
| Backend | Motor | 3.x | MongoDB Async Driver |
| Database | PostgreSQL | 16 | Relational Data |
| Database | MongoDB | 7 | Document Storage |
| Database | pgvector | 0.5+ | Vector Search |
| AI | Gemini (default) | gemini-2.0-flash | Text Generation |
| AI | OpenAI (alt) | gpt-4o-mini | Text Generation |
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
        Blocks["blocks<br/>/api/v1/blocks"]
        Match["match<br/>/api/v1/match"]
        Builds["resume-builds<br/>/api/v1/resume-builds"]
        ATS["ats<br/>/api/v1/ats"]
        AIChat["ai<br/>/api/v1/ai"]
        Listings["job-listings<br/>/api/job-listings"]
        Admin["admin<br/>/api/admin"]
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
    APIRouter --> Blocks
    APIRouter --> Match
    APIRouter --> Builds
    APIRouter --> ATS
    APIRouter --> AIChat
    APIRouter --> Listings
    APIRouter --> Admin
```

### 3.2 Complete API Endpoint Reference

#### Authentication Endpoints (`/api/auth`)

```mermaid
flowchart LR
    subgraph Auth["Authentication API"]
        POST1["POST /register"]
        POST2["POST /login"]
        POST3["POST /refresh"]
        GET1["GET /me"]
    end

    POST1 --> |"Create User"| DB[(PostgreSQL)]
    POST2 --> |"Verify Credentials"| DB
    POST2 --> |"Issue JWT"| Token["Access + Refresh Tokens"]
    POST3 --> |"Refresh"| Token
    GET1 --> |"Get Current User"| DB
```

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login, get tokens | No |
| POST | `/auth/refresh` | Refresh access token | Refresh Token |
| GET | `/auth/me` | Get current user | Yes |

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

    subgraph Export_Ops["Export (see /api/export)"]
        GET4["GET /api/export/templates"]
        POST3["POST /api/export/{id}"]
    end

    CRUD --> CRUD_Ops
    Parse --> Parse_Ops
    Export --> Export_Ops
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/resumes` | Create new resume |
| GET | `/resumes/{id}` | Get resume by ID |
| GET | `/resumes` | List user's resumes (paginated) |
| PUT | `/resumes/{id}` | Update resume content |
| DELETE | `/resumes/{id}` | Delete resume |
| GET | `/export/templates` | Get available export templates (via /api/export) |
| POST | `/export/{id}` | Export to PDF/DOCX (via /api/export) |
| POST | `/resumes/{id}/parse` | Trigger async parsing |
| GET | `/resumes/{id}/parse/status` | Poll parsing status |

#### Job Endpoints (`/api/jobs`)

| Method | Endpoint | Description |
|--------|----------|-------------|
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
|--------|----------|-------------|
| POST | `/tailor` | Create tailored resume (Two Copies Architecture) |
| POST | `/tailor/quick-match` | Quick match score without full tailoring |
| GET | `/tailor/{id}` | Get tailored resume |
| GET | `/tailor/{id}/compare` | Get original + tailored for diffing |
| POST | `/tailor/{id}/finalize` | Finalize user's approved version |
| PATCH | `/tailor/{id}` | Update tailored resume |
| GET | `/tailor` | List tailored resumes |
| DELETE | `/tailor/{id}` | Delete tailored resume |

#### Experience Blocks/Vault Endpoints (`/api/v1/blocks`)

```mermaid
flowchart LR
    subgraph Blocks["Experience Vault API"]
        direction TB
        CRUD["CRUD"]
        Semantic["Semantic"]
        Import["Import"]
    end

    subgraph CRUD_B["Block CRUD"]
        B1["POST /"]
        B2["GET /"]
        B3["GET /{id}"]
        B4["PATCH /{id}"]
        B5["DELETE /{id}"]
        B6["POST /{id}/verify"]
    end

    subgraph Semantic_B["Semantic Operations"]
        B7["POST /embed"]
        B8["POST /{id}/embed"]
    end

    subgraph Import_B["Import"]
        B9["POST /import"]
    end

    CRUD --> CRUD_B
    Semantic --> Semantic_B
    Import --> Import_B

    B7 --> |"Gemini API"| Vectors["768-dim Vectors"]
    Vectors --> pgvector[(pgvector)]
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/blocks` | Create experience block |
| GET | `/blocks` | List blocks (filter by type, tags, verified) |
| GET | `/blocks/{id}` | Get specific block |
| PATCH | `/blocks/{id}` | Update block |
| DELETE | `/blocks/{id}` | Soft delete block |
| POST | `/blocks/{id}/verify` | Mark block as verified |
| POST | `/blocks/import` | Import blocks from resume |
| POST | `/blocks/embed` | Generate embeddings (batch) |
| POST | `/blocks/{id}/embed` | Generate embedding (single) |

#### Semantic Match Endpoints (`/api/v1/match`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/match` | Find matching blocks for job description |
| POST | `/match/analyze` | Analyze skill gaps vs requirements |
| GET | `/match/job/{job_id}` | Get cached match results |

#### Resume Build/Workshop Endpoints (`/api/v1/resume-builds`)

```mermaid
flowchart TB
    subgraph Workshop["Resume Workshop API"]
        direction TB
        Core["Core Operations"]
        Blocks["Block Operations"]
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

    subgraph Blocks_W["Block Pull"]
        W6["POST /{id}/pull"]
        W7["GET /{id}/blocks"]
        W8["DELETE /{id}/blocks/{block_id}"]
    end

    subgraph AI_W["AI Suggestions"]
        W9["POST /{id}/suggest"]
    end

    subgraph Diffs_W["Diff Management"]
        W10["POST /{id}/diffs/accept"]
        W11["POST /{id}/diffs/reject"]
        W12["POST /{id}/diffs/clear"]
    end

    subgraph Export_W["Writeback & Status"]
        W13["POST /{id}/writeback/preview"]
        W14["POST /{id}/writeback"]
        W15["PATCH /{id}/sections"]
        W16["PATCH /{id}/status"]
    end

    Core --> Core_W
    Blocks --> Blocks_W
    AI --> AI_W
    Diffs --> Diffs_W
    Export --> Export_W
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/resume-builds` | Create resume build |
| GET | `/resume-builds` | List builds |
| GET | `/resume-builds/{id}` | Get specific build |
| PATCH | `/resume-builds/{id}` | Update build |
| DELETE | `/resume-builds/{id}` | Delete build |
| POST | `/resume-builds/{id}/pull` | Pull blocks from Vault |
| GET | `/resume-builds/{id}/blocks` | Get pulled blocks |
| DELETE | `/resume-builds/{id}/blocks/{block_id}` | Remove block |
| POST | `/resume-builds/{id}/suggest` | Generate AI suggestions |
| POST | `/resume-builds/{id}/diffs/accept` | Accept diff |
| POST | `/resume-builds/{id}/diffs/reject` | Reject diff |
| POST | `/resume-builds/{id}/diffs/clear` | Clear all diffs |
| PATCH | `/resume-builds/{id}/sections` | Update sections |
| PATCH | `/resume-builds/{id}/status` | Update status |
| POST | `/resume-builds/{id}/writeback/preview` | Preview writeback |
| POST | `/resume-builds/{id}/writeback` | Execute writeback |

#### ATS Analysis Endpoints (`/api/v1/ats`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ats/structure` | Analyze resume structure |
| POST | `/ats/keywords` | Analyze keyword coverage |
| POST | `/ats/keywords/detailed` | Detailed keyword analysis |
| GET | `/ats/tips` | Get ATS optimization tips |

#### AI Chat Endpoints (`/api/v1/ai`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/improve-section` | AI improvement for section |
| POST | `/ai/chat` | Conversational AI |

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
|--------|----------|-------------|
| GET | `/job-listings/filter-options` | Get filter options |
| GET | `/job-listings` | List with filters |
| GET | `/job-listings/search` | Full-text search |
| GET | `/job-listings/{id}` | Get specific listing |
| GET | `/job-listings/saved` | User's saved jobs |
| GET | `/job-listings/applied` | User's applied jobs |
| POST | `/job-listings/{id}/save` | Save/unsave job |
| POST | `/job-listings/{id}/hide` | Hide/unhide job |
| POST | `/job-listings/{id}/applied` | Mark applied |

#### Admin Endpoints (`/api/admin`)

```mermaid
flowchart TB
    subgraph Admin["Admin API (Requires is_admin)"]
        direction TB
        Scraper["Scraper Controls"]
        Presets["Preset Management"]
        Schedule["Schedule Settings"]
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

    Scraper --> Scraper_A
    Presets --> Presets_A
    Schedule --> Schedule_A
```

### 3.3 Service Layer Architecture

```mermaid
flowchart TB
    subgraph API["API Layer"]
        Routes["Route Handlers"]
    end

    subgraph Services["Service Layer"]
        subgraph Core["Core Services"]
            AIClient["AIClient<br/>(OpenAI or Gemini)"]
            Cache["CacheService<br/>(Redis)"]
            Audit["AuditService"]
            PII["PIIStripper"]
        end

        subgraph AI_ML["AI/ML Services"]
            Embedding["EmbeddingService<br/>(Gemini)"]
            SemanticMatcher["SemanticMatcher<br/>(Hybrid Search)"]
            TailorService["TailorService"]
        end

        subgraph Resume["Resume Services"]
            Parser["ResumeParser"]
            BlockSplitter["BlockSplitter"]
            BlockClassifier["BlockClassifier"]
            ParseTask["ParseTaskManager"]
            Writeback["WritebackService"]
        end

        subgraph Job["Job Services"]
            Analyzer["JobAnalyzer"]
            ATSAnalyzer["ATSAnalyzer"]
            DiffEngine["DiffEngine"]
        end

        subgraph Document["Document Services"]
            Converter["DocumentConverter"]
            Extractor["DocumentExtractor"]
            HTMLToDoc["HTMLToDocument"]
            ExportSvc["ExportService"]
        end

        subgraph Scraping["Scraper Services"]
            ApifyClient["ApifyClient"]
            CostTracker["CostTracker"]
            Scheduler["APScheduler"]
            Orchestrator["ScraperOrchestrator"]
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

    Core --> Redis
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
        RateLimit["Rate Limiter<br/>default: 60/min, 1000/hr<br/>ai: 30/min, 300/hr<br/>auth: 10/min, 100/hr"]
        JWTAuth["JWT Authentication<br/>(per-route)"]
        AdminCheck["Admin Check<br/>(per-route)"]
    end

    subgraph Handler["Route Handler"]
        Route["Endpoint Logic"]
    end

    Req --> CORS --> RateLimit --> JWTAuth --> AdminCheck --> Route
```

---

## 4. Database Architecture

### 4.1 PostgreSQL Schema

```mermaid
erDiagram
    users ||--o{ job_descriptions : owns
    users ||--o{ experience_blocks : owns
    users ||--o{ user_job_interactions : has
    users ||--o{ audit_logs : generates

    job_listings ||--o{ user_job_interactions : receives

    users {
        int id PK
        string email UK
        string hashed_password
        string full_name
        boolean is_active
        boolean is_admin
        datetime created_at
        datetime updated_at
    }

    job_descriptions {
        int id PK
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
        string job_title
        string company_name
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
        string source_platform
        string region
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    experience_blocks {
        int id PK
        int user_id FK
        text content
        string block_type
        array tags
        string source_company
        string source_role
        date source_date_start
        date source_date_end
        vector_768 embedding
        string embedding_model
        string content_hash
        boolean verified
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }

    user_job_interactions {
        int id PK
        int user_id FK
        int job_listing_id FK
        boolean is_saved
        boolean is_hidden
        datetime applied_at
        datetime last_viewed_at
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

> **Note:** Resumes, tailored resumes, and resume builds are stored in MongoDB (see Section 4.2).
> The PostgreSQL models for these entities exist in the codebase but are not actively used.

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `users` | User accounts | email (unique) |
| `job_descriptions` | User-created job postings | owner_id |
| `job_listings` | System-wide scraped jobs | external_job_id, company, location, seniority, date_posted |
| `experience_blocks` | Vault - atomic resume blocks | user_id+block_type, HNSW (embedding), GIN (tags) |
| `user_job_interactions` | Save/hide/apply tracking | (user_id, job_listing_id) unique |
| `audit_logs` | Action audit trail | user+resource, action+timestamp |
| `scraper_runs` | Scraper execution history | status, started_at |
| `scraper_presets` | Named search URL presets | - |
| `scraper_schedule_settings` | Singleton scheduler config | - |

### 4.2 MongoDB Collections (Primary Storage)

> **Note:** MongoDB serves as the **primary and sole storage** for resumes, tailored resumes, and resume builds.
> These are not mirrored in PostgreSQL—all content lives exclusively in MongoDB.

```mermaid
flowchart TB
    subgraph MongoDB["MongoDB Collections (Primary Storage)"]
        subgraph resumes_col["resumes Collection"]
            R_ID["_id: ObjectId"]
            R_User["user_id: int (FK)"]
            R_Title["title: string"]
            R_Raw["raw_content: string"]
            R_HTML["html_content: string"]
            R_Parsed["parsed: ParsedContent"]
            R_Style["style: StyleSettings"]
            R_File["original_file: OriginalFile"]
            R_TS["created_at, updated_at"]
        end

        subgraph tailored_col["tailored_resumes Collection"]
            T_ID["_id: ObjectId"]
            T_Resume["resume_id: ObjectId (FK)"]
            T_User["user_id: int (FK)"]
            T_Job["job_source: {type, id}"]
            T_Data["tailored_data: dict"]
            T_Final["finalized_data: dict"]
            T_Status["status: enum"]
            T_Score["match_score: float"]
            T_ATS["ats_keywords: ATSKeywords"]
            T_Meta["job_title, company_name"]
            T_TS["created_at, updated_at, finalized_at"]
        end

        subgraph builds_col["resume_builds Collection"]
            B_ID["_id: ObjectId"]
            B_User["user_id: int (FK)"]
            B_Job["job: JobInfo"]
            B_Status["status: draft|in_progress|exported"]
            B_Sections["sections: ResumeSections"]
            B_Order["section_order: list"]
            B_Blocks["pulled_block_ids: list[int]"]
            B_Diffs["pending_diffs: list[PendingDiff]"]
            B_TS["created_at, updated_at, exported_at"]
        end
    end

    resumes_col --> |"Indexes"| R_IDX["user_id<br/>(user_id, updated_at DESC)"]
    tailored_col --> |"Indexes"| T_IDX["resume_id<br/>user_id<br/>(job_source.type, job_source.id)"]
    builds_col --> |"Indexes"| B_IDX["user_id<br/>(user_id, status)"]
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
  "created_at": "2026-02-20T...",
  "updated_at": "2026-02-20T..."
}
```

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

> **Architecture Note:** This application uses a **split database architecture** where:
> - **PostgreSQL** handles user accounts, job data, experience blocks (with vectors), and system configuration
> - **MongoDB** is the **sole storage** for all resume-related documents (resumes, tailored resumes, resume builds)
>
> There is no dual-storage or mirroring pattern for resumes—MongoDB is the single source of truth for resume content.

```mermaid
flowchart TB
    subgraph PostgreSQL["PostgreSQL (Users, Jobs, Blocks, Config)"]
        PG_Users["users"]
        PG_Jobs["job_descriptions"]
        PG_Listings["job_listings"]
        PG_Blocks["experience_blocks<br/>(vectors)"]
        PG_Interactions["user_job_interactions"]
    end

    subgraph MongoDB["MongoDB (Resume Storage - Primary)"]
        MG_Resumes["resumes<br/>(complete documents)"]
        MG_Tailored["tailored_resumes<br/>(AI versions)"]
        MG_Builds["resume_builds<br/>(workshop documents)"]
    end

    PG_Users --> |"user_id"| MG_Resumes
    PG_Users --> |"user_id"| MG_Tailored
    PG_Users --> |"user_id"| MG_Builds

    MG_Resumes --> |"resume_id"| MG_Tailored
    PG_Jobs --> |"job_source.id"| MG_Tailored
    PG_Listings --> |"job_source.id"| MG_Tailored

    PG_Blocks --> |"pulled_block_ids"| MG_Builds
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

### 4.4 Vector Search Architecture

```mermaid
flowchart TB
    subgraph Input["Query Input"]
        JobDesc["Job Description Text"]
    end

    subgraph Embedding["Embedding Generation"]
        GeminiAPI["Gemini API<br/>text-embedding-004"]
        QueryVec["Query Vector<br/>(768-dim)"]
    end

    subgraph Search["Hybrid Search"]
        subgraph SQLFilters["SQL Filters (First)"]
            F1["user_id = ?"]
            F2["block_type IN (?)"]
            F3["tags && ?"]
            F4["verified = ?"]
            F5["deleted_at IS NULL"]
        end

        subgraph VectorSearch["Vector Distance (Second)"]
            HNSW["HNSW Index<br/>m=16, ef=64"]
            Cosine["cosine_distance()"]
        end
    end

    subgraph Results["Search Results"]
        Ranked["Top-K Blocks<br/>by Similarity"]
    end

    JobDesc --> GeminiAPI --> QueryVec
    QueryVec --> SQLFilters
    SQLFilters --> |"Filtered Rows"| VectorSearch
    VectorSearch --> Ranked

    style SQLFilters fill:#e1f5fe
    style VectorSearch fill:#fff3e0
```

### Vector Index Configuration

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Dimensions | 768 | Gemini text-embedding-004 native |
| Index Type | HNSW | Hierarchical Navigable Small World |
| m | 16 | Connections per layer |
| ef_construction | 64 | Build quality |
| Distance | cosine_ops | Cosine similarity |

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
        subgraph Jobs["Jobs Section"]
            JobsList["/jobs"]
            JobDetail["/jobs/[id]"]
            SavedJobs["/jobs/saved"]
            AppliedJobs["/jobs/applied"]
        end

        subgraph Library["Library Section"]
            LibDash["/library"]
            ResNew["/library/resumes/new"]
            ResView["/library/resumes/[id]"]
            ResEdit["/library/resumes/[id]/edit"]
            JobNew["/library/jobs/new"]
            JobView["/library/jobs/[id]"]
            JobEdit["/library/jobs/[id]/edit"]
            VaultNew["/library/vault/new"]
            VaultView["/library/vault/[id]"]
            VaultImport["/library/vault/import"]
        end

        subgraph Tailor["Tailoring Section"]
            TailorHub["/tailor"]
            TailorInit["/tailor/[id]"]
            TailorReview["/tailor/review/[id]"]
            TailorEditor["/tailor/editor/[id]"]
        end

        subgraph Workshop["Workshop Section"]
            WorkshopPage["/workshop/[id]"]
        end

        subgraph Admin["Admin Section"]
            AdminScraper["/admin/scraper"]
        end
    end

    Landing --> |"Signup"| Signup
    Landing --> |"Login"| Login
    Login --> |"Success"| JobsList
    Signup --> |"Success"| JobsList

    JobsList --> |"Click Job"| JobDetail
    JobsList --> |"Saved Tab"| SavedJobs
    JobsList --> |"Applied Tab"| AppliedJobs

    LibDash --> |"New Resume"| ResNew
    LibDash --> |"View Resume"| ResView
    ResView --> |"Edit"| ResEdit
    LibDash --> |"New Job"| JobNew
    LibDash --> |"View Job"| JobView
    JobView --> |"Edit"| JobEdit
    LibDash --> |"New Block"| VaultNew
    LibDash --> |"View Block"| VaultView
    LibDash --> |"Import"| VaultImport

    JobDetail --> |"Tailor Resume"| TailorInit
    TailorInit --> |"AI Processing"| TailorReview
    TailorReview --> |"Review Diffs"| TailorEditor
    TailorEditor --> |"Finalize"| LibDash

    JobDetail --> |"Build Workshop"| WorkshopPage
```

### Page Route Table

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing Page | Hero, tech stack, how it works |
| `/(auth)/login` | Login Page | User authentication |
| `/(auth)/signup` | Signup Page | User registration |
| `/jobs` | Jobs Browse | List/filter LinkedIn jobs |
| `/jobs/[id]` | Job Detail | Single job view |
| `/jobs/saved` | Saved Jobs | User's saved listings |
| `/jobs/applied` | Applied Jobs | Applied tracking |
| `/library` | Library Dashboard | Resumes, jobs, vault overview |
| `/library/resumes/new` | New Resume | Create resume |
| `/library/resumes/[id]` | View Resume | Resume detail |
| `/library/resumes/[id]/edit` | Edit Resume | Rich text editor |
| `/library/jobs/new` | New Job | Create job description |
| `/library/jobs/[id]` | View Job | Job detail |
| `/library/jobs/[id]/edit` | Edit Job | Edit job description |
| `/library/vault/new` | New Block | Create vault block |
| `/library/vault/[id]` | View Block | Block detail |
| `/library/vault/import` | Import Blocks | Bulk import from resume |
| `/tailor` | Tailor Hub | Start tailoring flow |
| `/tailor/[id]` | Tailor Init | Initialize session |
| `/tailor/review/[id]` | Tailor Review | Side-by-side diff UI |
| `/tailor/editor/[id]` | Tailor Editor | Final refinements |
| `/workshop/[id]` | Workshop | Multi-panel resume builder |
| `/admin/scraper` | Admin Scraper | Scraper management |

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

        subgraph Vault_C["Vault Components"]
            V1["BlockList"]
            V2["BlockEditor"]
            V3["ImportWizard"]
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

```
/src/components
├── /layout
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── Footer.tsx
├── /ui
│   ├── LoadingSpinner.tsx
│   ├── ErrorMessage.tsx
│   ├── Skeleton.tsx
│   └── TechStackLogos.tsx
├── /jobs
│   ├── JobListingCard.tsx
│   ├── JobListingTable.tsx
│   └── JobListingFilters.tsx
├── /editor
│   ├── TipTapEditor.tsx
│   └── SuggestionPopover.tsx
├── /export
│   └── ExportDialog.tsx
├── /workshop
│   ├── EditorPanel.tsx
│   ├── AIRewritePanel.tsx
│   ├── SectionList.tsx
│   ├── ChangeSummary.tsx
│   ├── StylePanel.tsx
│   ├── ResumePreview/
│   └── ScoreSummary.tsx
├── /vault
│   ├── BlockList.tsx
│   └── BlockEditor.tsx
├── /library            # Tailoring functionality integrated here
│   └── editor/         # Contains diff preview and editing components
└── ProtectedRoute.tsx
```

> **Note:** Tailoring components (PreviewDiffLayout, VersionHistoryPanel) are integrated within
> the library/editor sections rather than in a standalone `/tailoring` folder.

### 5.3 State Management

```mermaid
flowchart TB
    subgraph Global["Global State (Context)"]
        AuthCtx["AuthContext<br/>user, isAuthenticated, login/logout"]
        ThemeCtx["ThemeContext<br/>theme, toggleTheme"]
        TailorCtx["TailoringContext<br/>session, diffs, history"]
    end

    subgraph Server["Server State (React Query)"]
        Cache["Query Cache"]

        subgraph Queries["Query Hooks"]
            Q1["useResumes()"]
            Q2["useJobs()"]
            Q3["useJobListings(filters)"]
            Q4["useBlocks()"]
            Q5["useTailoredResumes()"]
            Q6["useWorkshops()"]
        end

        subgraph Mutations["Mutation Hooks"]
            M1["useCreateResume()"]
            M2["useUpdateResume()"]
            M3["useTailorResume()"]
            M4["useFinalizeTailored()"]
            M5["useSaveJob()"]
        end
    end

    subgraph Local["Local State"]
        useState["useState"]
        useReducer["useReducer"]
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
|-------|------------|---------|-------------|
| Auth | AuthContext | User session, tokens | localStorage |
| Theme | ThemeContext | Dark/light mode | localStorage |
| Tailoring | TailoringContext | Edit session state | sessionStorage (30min) |
| Server | React Query | API data cache | Memory (staleTime: 60s) |
| Local | useState/useReducer | Component state | None |

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
            AuthAPI["authApi"]
            ResumeAPI["resumeApi"]
            JobAPI["jobApi"]
            TailorAPI["tailorApi"]
            BlockAPI["blockApi"]
            MatchAPI["matchApi"]
            BuildAPI["resumeBuildApi"]
            UploadAPI["uploadApi"]
            ListingsAPI["jobListingsApi"]
            AdminAPI["adminApi"]
            ATSAPI["atsApi"]
            AIChatAPI["aiChatApi"]
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

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant AuthCtx as AuthContext
    participant API as FastAPI
    participant DB as PostgreSQL

    User->>Browser: Click Login
    Browser->>API: POST /api/auth/login
    API->>DB: Verify credentials
    DB-->>API: User record
    API-->>Browser: {access_token, refresh_token}
    Browser->>AuthCtx: setTokens(), setUser()
    AuthCtx->>Browser: localStorage.setItem()
    Browser->>User: Redirect to /jobs

    Note over Browser,API: On subsequent requests...

    Browser->>API: GET /api/resumes (with Bearer token)

    alt Token Valid
        API-->>Browser: 200 OK + data
    else Token Expired
        API-->>Browser: 401 Unauthorized
        Browser->>API: POST /api/auth/refresh
        API-->>Browser: New access_token
        Browser->>AuthCtx: Update token
        Browser->>API: Retry original request
        API-->>Browser: 200 OK + data
    end
```

### 6.2 Resume Tailoring Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend
    participant TailorCtx as TailoringContext
    participant API as FastAPI
    participant AI as OpenAI/Gemini API
    participant MG as MongoDB

    User->>UI: Select Resume + Job
    UI->>API: POST /api/tailor
    API->>AI: Parse & Tailor
    AI-->>API: Tailored content
    API->>MG: Store tailored_resume
    API-->>UI: {tailored_id, match_score}

    UI->>API: GET /api/tailor/{id}/compare
    API->>MG: Fetch original + tailored
    MG-->>API: Both documents
    API-->>UI: {original, tailored}

    UI->>TailorCtx: initializeSession(original, tailored)
    Note over TailorCtx: Compute diffs client-side
    TailorCtx-->>UI: Session with diffs

    User->>UI: Review diff UI (PreviewDiffLayout)

    loop For each change
        User->>UI: Accept/Reject change
        UI->>TailorCtx: updateSession(acceptedChanges)
    end

    User->>UI: Navigate to Editor
    UI->>TailorCtx: getActiveDraft()
    TailorCtx-->>UI: Merged draft

    User->>UI: Final edits in TipTap
    User->>UI: Click Finalize
    UI->>API: POST /api/tailor/{id}/finalize
    API->>MG: Update finalized_data
    MG-->>API: Success
    API-->>UI: Complete
    UI->>User: Redirect to library
```

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
    participant Vault as Experience Blocks
    participant AI as OpenAI/Gemini API
    participant MG as MongoDB

    User->>Workshop: Create build for job
    Workshop->>API: POST /api/v1/resume-builds
    API->>MG: Create resume_build doc
    API-->>Workshop: {build_id}

    User->>Workshop: Pull relevant blocks
    Workshop->>API: POST /api/v1/resume-builds/{id}/pull
    API->>Vault: Semantic search (pgvector)
    Vault-->>API: Matching blocks
    API->>MG: Update pulled_block_ids
    API-->>Workshop: Pulled blocks

    User->>Workshop: Request AI suggestions
    Workshop->>API: POST /api/v1/resume-builds/{id}/suggest
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
    Workshop->>API: POST /api/export/{id}
    API-->>Workshop: PDF/DOCX file
```

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

        Orchestrator->>DB: Upsert job_listings
        Orchestrator->>DB: Log scraper_run
    end

    alt Ad-hoc Scrape
        Admin->>API: POST /api/admin/scraper/adhoc
        API->>Orchestrator: trigger_adhoc()
        Orchestrator->>Apify: Run custom URL
        Apify-->>Orchestrator: Results
        Orchestrator-->>API: Stats
    end
```

### Scraper Architecture

```mermaid
flowchart TB
    subgraph Triggers["Scrape Triggers"]
        Scheduled["APScheduler<br/>(Daily/Weekly)"]
        Manual["Admin Manual<br/>POST /trigger"]
        AdHoc["Ad-hoc URL<br/>POST /adhoc"]
    end

    subgraph Processing["Processing"]
        Orchestrator["ScraperOrchestrator"]
        ApifyClient["ApifyClient"]
        CostTracker["CostTracker"]
    end

    subgraph Storage["Storage"]
        JobListings[(job_listings)]
        ScraperRuns[(scraper_runs)]
        Presets[(scraper_presets)]
        Schedule[(scraper_schedule_settings)]
    end

    Scheduled --> Orchestrator
    Manual --> Orchestrator
    AdHoc --> Orchestrator

    Orchestrator --> ApifyClient
    ApifyClient --> |"Results"| Orchestrator
    Orchestrator --> JobListings
    Orchestrator --> ScraperRuns
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

    subgraph Split["Block Split Phase"]
        BlockSplitter["BlockSplitter"]
        BlockClassifier["BlockClassifier"]
        Blocks["Atomic Blocks"]
        Embedding["EmbeddingService"]
        Vectors["768-dim Vectors"]
    end

    subgraph VaultStore["Vault Storage"]
        PostgreSQL[(PostgreSQL<br/>experience_blocks)]
    end

    File --> Extractor --> Text
    Extractor --> HTML
    File --> MinIO

    Text --> ParseTask --> AIProvider --> Structured
    HTML --> MongoDB
    Structured --> MongoDB

    Structured --> BlockSplitter --> Blocks
    Blocks --> BlockClassifier
    BlockClassifier --> Embedding --> Vectors
    Vectors --> PostgreSQL
```

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
    BCrypt --> Auth

    UserAuth --> |"Protected Routes"| API["API Endpoints"]
    AdminAuth --> |"/api/admin/*"| AdminAPI["Admin Endpoints"]

    CORS --> API
    RateLimit --> API
    PII --> |"Before AI"| AIProvider["OpenAI/Gemini API"]
    Param --> |"All Queries"| DB[(Database)]
```

### Security Measures

| Layer | Protection | Implementation |
|-------|------------|----------------|
| Authentication | JWT Tokens | Access (short-lived) + Refresh (long-lived) |
| Password | BCrypt | Salted hashing |
| API Rate Limits | Redis | 60/min default, 30/min AI, 10/min auth |
| CORS | FastAPI Middleware | Configured allowed origins |
| SQL Injection | SQLAlchemy | Parameterized queries only |
| PII Protection | PII Stripper | Removes sensitive data before AI |
| Secrets | Environment Variables | .env files (gitignored) |

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

        subgraph RedisKeys["Cache Keys"]
            RateLimit["rate_limit:{user}:{endpoint}"]
            ParseStatus["parse_status:{task_id}"]
            Embedding["embedding:{content_hash}"]
            Match["match:{job_id}"]
        end
    end

    RQCache --> |"API Responses"| Components["React Components"]
    SessionStorage --> |"Edit State"| TailorPages["Tailor Pages"]
    LocalStorage --> |"Persistent"| AuthCtx["Auth Context"]

    Redis --> RedisKeys
```

### Cache TTL Configuration

| Cache | TTL | Purpose |
|-------|-----|---------|
| React Query | 60s staleTime | API response freshness |
| Tailoring Session | 30 minutes | Cross-page state handoff |
| Rate Limit Counters | 1 minute / 1 hour | Request throttling |
| Parse Status | Until complete | Background task tracking |
| Embedding Cache | 24 hours | Avoid redundant API calls |
| Match Results | 1 hour | Semantic search results |

---

## 10. Deployment Architecture

```mermaid
flowchart TB
    subgraph External["External Traffic"]
        Users["Users"]
    end

    subgraph Docker["Docker Compose Stack"]
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

### Container Configuration

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| frontend | node:20-alpine | 3000 | - |
| backend | python:3.11-slim | 8000 | - |
| postgres | pgvector/pgvector:pg16 | 5432 | pgdata |
| mongodb | mongo:7 | 27017 | mongodata |
| redis | redis:7-alpine | 6379 | redisdata |
| minio | minio/minio | 9000, 9001 | miniodata |

### Environment Variables (Required)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/resume_tailor
MONGODB_URI=mongodb://mongo:27017
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET_KEY=<generated-secret>
JWT_ALGORITHM=HS256

# AI Services - Provider Selection
AI_PROVIDER=gemini  # Options: "gemini" (default) or "openai"

# Gemini Configuration (default provider, also used for embeddings)
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.0-flash  # Text generation model

# OpenAI Configuration (if AI_PROVIDER=openai)
OPENAI_API_KEY=<openai-api-key>
OPENAI_MODEL=gpt-4o-mini  # Alternative model

# Scraper
APIFY_API_TOKEN=<apify-token>

# Storage
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>
```

---

## Appendix: API Endpoint Count Summary

| Category | Endpoint Count |
|----------|----------------|
| Auth | 4 |
| Resumes | 9 |
| Jobs | 5 |
| Tailor | 8 |
| Export | 1 |
| Upload | 1 |
| Blocks (Vault) | 9 |
| Match | 3 |
| Resume Builds | 17 |
| ATS | 4 |
| AI Chat | 2 |
| Job Listings | 10 |
| Admin | 17 |
| **Total** | **90** |

---

## Appendix: Database Table Count Summary

| Database | Collection/Table | Purpose |
|----------|------------------|---------|
| PostgreSQL | users | User accounts |
| PostgreSQL | job_descriptions | User job postings |
| PostgreSQL | job_listings | System-wide scraped jobs |
| PostgreSQL | experience_blocks | Vault with vectors |
| PostgreSQL | user_job_interactions | Save/hide/apply tracking |
| PostgreSQL | audit_logs | Action audit trail |
| PostgreSQL | scraper_runs | Scraper history |
| PostgreSQL | scraper_presets | URL presets |
| PostgreSQL | scraper_schedule_settings | Schedule config |
| MongoDB | resumes | Complete resume documents (primary storage) |
| MongoDB | tailored_resumes | AI-tailored versions (primary storage) |
| MongoDB | resume_builds | Workshop documents (primary storage) |
| **PostgreSQL Total** | **9 tables** | |
| **MongoDB Total** | **3 collections** | |

> **Note:** PostgreSQL models for resumes, tailored_resumes, and resume_builds exist in the codebase
> but are not actively used. MongoDB is the sole storage for resume-related data.
