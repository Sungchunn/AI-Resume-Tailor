# CLAUDE.md - AI Assistant Guidelines

## Project Overview

**AI Resume Tailor** - A monorepo application for AI-powered resume customization.

- **Frontend:** Next.js 15 + Bun (located in `/frontend`)
- **Backend:** FastAPI + Python (located in `/backend`)
- **Database:** PostgreSQL + MongoDB + Redis
- **Local Dev:** Docker Compose orchestration

---

## Critical Rules

### 1. Security - Credentials Management

**NEVER commit sensitive credentials to this repository.**

- All secrets, API keys, and credentials must use `.example` files as templates
- Copy `.env.example` to `.env` locally (`.env` is gitignored)
- Database passwords, API keys, JWT secrets, etc. go ONLY in `.env` files
- Review all commits before pushing to ensure no secrets are included

```bash
# Correct pattern
.env.example    # Committed - contains placeholder values
.env            # NOT committed - contains real values
```

### 2. Git Collaboration

**NEVER add Claude as a collaborator or co-author on commits.**

- All commits should be authored by the human developer
- Do not use `Co-Authored-By: Claude` in commit messages
- This is a human-owned project with AI assistance

### 3. Documentation Structure

**All `.md` documentation files must be placed under `/docs`.**

Keep the root directory clean - only `README.md` and `CLAUDE.md` at project root.

#### Directory Purposes

```text
/docs
├── PROJECT_MASTER_PLAN.md     # High-level project vision (entry point)
│
├── /planning                  # Project-level plans and milestones
│   ├── implementation-plan.md     # Development phases and roadmap
│   ├── project-assessment.md      # Status reviews and retrospectives
│   └── security-refactor.md       # Cross-cutting technical initiatives
│
├── /features                  # Feature-specific documentation
│   ├── /feature-name/             # Subdirectory for multi-doc features
│   │   ├── master-plan.md             # Entry point for the feature
│   │   ├── phase-1-*.md               # Phase breakdowns
│   │   └── proposal.md                # Architectural proposals
│   └── single-feature.md          # Single-doc features (no subdir)
│
├── /architecture              # System design and technical decisions
│   ├── system-architecture.md     # Overall system design
│   ├── backend-architecture.md    # Backend-specific design
│   ├── database-rules.md          # Database conventions
│   └── ai-integration.md          # AI/ML integration design
│
└── /api                       # API reference documentation
    ├── overview.md                # API introduction
    └── [endpoint].md              # Per-endpoint documentation
```

| Directory | Purpose | When to Add Here |
| ----------- | --------- | ------------------ |
| `/planning` | Project-level roadmaps, milestones, assessments | Implementation plans, phase breakdowns, project reviews |
| `/features` | Feature-specific implementation docs | New feature plans, proposals, phase docs |
| `/architecture` | System design, technical decisions | Tech stack choices, design patterns, cross-cutting concerns |
| `/api` | API reference for consumers | Endpoint docs, schemas, error codes |

#### Feature Documentation: Subdirectory Convention

**Multi-document features MUST have their own subdirectory under `/docs/features/`.**

Create a subdirectory when:

- Feature has **3+ related documentation files**
- Feature has **distinct phases** or implementation stages
- Feature has **separate proposal/analysis documents**

```text
/docs/features
├── /ats-scoring/                             # Multi-doc feature
│   ├── 030326_master-plan.md                     # Entry point
│   ├── 030326_phase1-keyword-extraction.md
│   ├── 030326_phase2-ats-structure-analysis.md
│   └── ats-scoring-proposal.md
│
├── /resume-workshop/                         # Multi-doc feature
│   ├── 250226_resume-workshop-master-plan.md     # Entry point
│   ├── 250226_phase-a-pdf-preview.md
│   ├── 250226_phase-b-workshop-layout.md
│   └── ...
│
└── 190226_n8n-linkedin-scraper-integration.md  # Single-doc (no subdir)
```

**Single-document features** remain directly in `/docs/features/` with proper date prefix.

#### File Naming Convention

All documentation files in `/docs/planning`, `/docs/features`, and `/docs/architecture` MUST include a **date prefix** for tracking.

**Format:** `DDMMYY_name.md`

```text
180226_api-design.md           # Created Feb 18, 2026
150126_auth-implementation.md  # Created Jan 15, 2026
010326_deployment-guide.md     # Created Mar 1, 2026
```

Rules:

- Use **lowercase with hyphens** for the name portion
- Date represents the **creation date** of the document
- Helps track document age and maintain chronological context

**Exceptions (no date prefix):**

- `/docs/api/*` - Permanent API reference docs
- `/docs/PROJECT_MASTER_PLAN.md` - Project vision doc
- Proposal/decision docs within feature subdirs (e.g., `ats-scoring-proposal.md`)

#### Markdown Formatting Rules

**Follow `/docs/MARKDOWN_STYLE_GUIDE.md` to avoid linting errors.**

Key rules:

- **Tables:** Use spaces in separators: `| ----- | ----- |` not `|-----|-----|`
- **Bold headers:** End with colon: `**Error Responses:**` not `**Error Responses**`
- **Code blocks:** Always specify language: ` ```json ` or ` ```text `, never bare ` ``` `
- **Headers:** Always include blank line after `#`, `##`, `###` before body text

### 4. Context Management

**Clear session context between phases to avoid context rot.**

- This project is developed in phases with cleared contexts between sessions
- Each session should start by reading relevant phase documentation
- Reference `/docs/planning/` for current phase objectives
- Do not assume context from previous sessions - verify by reading docs

### 5. Database Queries

**NEVER use `SELECT *` in database queries.**

- Always explicitly specify the columns being selected
- This prevents API breaking changes when new columns are added to tables
- Explicit column selection improves query performance and clarity
- Makes code more maintainable and self-documenting

```python
# WRONG - Do not do this
SELECT * FROM users WHERE id = :id

# CORRECT - Always specify columns
SELECT id, email, name, created_at FROM users WHERE id = :id
```

### 6. Query Parameterization & Security

**NEVER use string formatting (f-strings) or concatenation for SQL variables.**

- Always use SQLAlchemy's built-in parameter binding or ORM constructs
- This strictly prevents SQL injection vulnerabilities
- Ensures the database driver handles type casting safely

```python
# WRONG - SQL injection vulnerability
query = f"SELECT id, email FROM users WHERE email = '{email}'"
query = "SELECT id, email FROM users WHERE email = '" + email + "'"

# CORRECT - Use parameter binding
query = select(User.id, User.email).where(User.email == email)
stmt = text("SELECT id, email FROM users WHERE email = :email")
result = await session.execute(stmt, {"email": email})
```

### 7. Dual-Database Transaction Safety

**ALWAYS handle PostgreSQL rollbacks if the subsequent MongoDB operation fails.**

- Because we lack native cross-database transactions, PostgreSQL must act as the source of truth
- Always execute and flush the Postgres operation first, then attempt the MongoDB operation
- If MongoDB raises an exception, explicitly call `await db.rollback()` on the Postgres session before raising the error

```python
# CORRECT - Handle rollback on MongoDB failure
async def create_resume(db: AsyncSession, mongo: AsyncIOMotorDatabase, data: ResumeCreate):
    # 1. Create Postgres record first (source of truth)
    resume = Resume(**data.model_dump())
    db.add(resume)
    await db.flush()  # Get the ID without committing

    try:
        # 2. Create MongoDB document
        await mongo.resumes.insert_one({"postgres_id": resume.id, "content": data.content})
    except Exception as e:
        # 3. Rollback Postgres if MongoDB fails
        await db.rollback()
        raise e

    # 4. Commit Postgres only after MongoDB succeeds
    await db.commit()
    return resume
```

### 8. MongoDB Explicit Projections

**NEVER fetch entire MongoDB documents if only specific fields are needed.**

- This is the NoSQL equivalent of avoiding `SELECT *`
- MongoDB documents (especially resumes with large arrays of parsed sections or AI suggestions) can be massive
- Always use projection dictionaries to limit data transferred over the network and reduce memory overhead

```python
# WRONG - Fetches entire document including large nested arrays
document = await mongo.resumes.find_one({"_id": resume_id})

# CORRECT - Only fetch the fields you need
document = await mongo.resumes.find_one(
    {"_id": resume_id},
    {"title": 1, "updated_at": 1, "status": 1}  # Explicit projection
)

# CORRECT - Exclude specific large fields
document = await mongo.resumes.find_one(
    {"_id": resume_id},
    {"parsed_sections": 0, "ai_suggestions": 0}  # Exclude large fields
)
```

### 9. Preventing N+1 Queries in SQLAlchemy

**NEVER loop through ORM objects to access relationships without eager loading.**

- Lazy loading in async SQLAlchemy will raise `MissingGreenlet` errors or cause severe performance bottlenecks (N+1 problem)
- Always explicitly load relationships using `selectinload` (for collections) or `joinedload` (for many-to-one) in the initial query

```python
# WRONG - Will cause N+1 queries or MissingGreenlet errors
users = await session.execute(select(User))
for user in users.scalars():
    print(user.resumes)  # Each access triggers a new query!

# CORRECT - Eager load collections with selectinload
from sqlalchemy.orm import selectinload, joinedload

query = select(User).options(selectinload(User.resumes))
users = await session.execute(query)

# CORRECT - Eager load many-to-one with joinedload
query = select(Resume).options(joinedload(Resume.owner))
resumes = await session.execute(query)
```

### 10. Database Session Management in FastAPI

**NEVER instantiate database sessions manually inside route functions.**

- Always use FastAPI's `Depends` with a generator (`yield`) for database sessions
- This ensures connections are cleanly returned to the pool even if the endpoint throws an unhandled exception

```python
# WRONG - Manual session management
@router.get("/users/{user_id}")
async def get_user(user_id: int):
    session = AsyncSession(engine)  # Don't do this!
    try:
        user = await session.get(User, user_id)
        return user
    finally:
        await session.close()

# CORRECT - Use dependency injection
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

@router.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    return user
```

### 11. API Documentation Synchronization

**Always update `/docs/api/` when backend API schemas change.**

When modifying the backend API (adding endpoints, changing request/response schemas, updating error codes, etc.), you MUST update the corresponding documentation in `/docs/api/`:

- `overview.md` - API introduction and routes summary
- `authentication.md` - Auth endpoints and security
- `resumes.md` - Resume CRUD operations
- `jobs.md` - User-created job postings
- `job-listings.md` - Scraped job listings from LinkedIn
- `blocks.md` - Content blocks/vault management
- `tailor-match.md` - AI tailoring and semantic matching
- `resume-builds.md` - Resume building workshops
- `upload-export.md` - Document upload and export
- `ats.md` - ATS analysis endpoints
- `admin.md` - Admin/scraper management
- `errors-rate-limits.md` - Error handling and rate limits

**Note:** API docs in `/docs/api/` are permanent documentation and do NOT use date prefixes.

### 12. Architecture Documentation Synchronization

**Always update `/docs/architecture/` when system design or technical decisions change.**

When making architectural changes (modifying system design, changing design patterns, updating data flow, modifying service interactions, etc.), you MUST update the corresponding documentation in `/docs/architecture/`:

- `system-architecture.md` - Overall system design, component interactions, deployment architecture
- `backend-architecture.md` - Backend service structure, API design patterns, request/response flows
- `database-rules.md` - Database conventions, schema design patterns, relationship patterns
- `ai-integration.md` - AI/ML integration design, model usage patterns, prompt strategies

**Note:** Architecture docs in `/docs/architecture/` use date prefixes to track when design decisions were made and help maintain chronological context of architectural evolution.

### 13. Frontend Page Layout Standards

**All new pages must be centered with consistent width constraints.**

- Use `max-w-4xl mx-auto` as the root container for page content
- This matches the layout established in `/jobs/[id]` which is the golden standard
- Only deviate from this standard if explicitly instructed otherwise

```tsx
// CORRECT - Standard page layout
export default function MyNewPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Page content */}
    </div>
  );
}

// WRONG - Missing centering
export default function MyNewPage() {
  return (
    <div className="max-w-4xl">
      {/* Content will not be centered */}
    </div>
  );
}
```

---

## Development Workflow

### Starting a New Session

1. Read `CLAUDE.md` (this file)
2. Read current phase doc in `/docs/planning/`
3. Check `/docs/features/` for any in-progress feature docs
4. Verify current git branch and status

### Before Committing

1. Run `git diff` to review changes
2. Verify NO secrets or credentials in diff
3. Ensure documentation is updated in `/docs/` if needed:
   - **API changes:** Update `/docs/api/` for any endpoint, schema, or error code changes
   - **Architecture changes:** Update `/docs/architecture/` for any system design, pattern, or data flow changes
4. Use clear, descriptive commit messages with scope prefix

### Commit Message Format

**All commits must specify the scope of changes using a prefix.**

Format: `<scope>: <description>`

Valid scopes:

- `frontend:` - Changes to `/frontend` (Next.js, React, UI)
- `backend:` - Changes to `/backend` (FastAPI, Python, API)
- `database:` - Database schema, migrations, Redis config
- `infra:` - Docker, CI/CD, deployment configs
- `docs:` - Documentation only changes

For changes spanning multiple areas, use the primary scope or combine:

- `frontend/backend:` - Full-stack changes
- `backend/database:` - API + schema changes

Examples:

```text
frontend: add resume preview component
backend: implement PDF export endpoint
database: add user preferences table migration
infra: update docker-compose for redis cluster
docs: update API documentation for v2 endpoints
frontend/backend: implement real-time save feature
```

### File Patterns to Never Commit

```gitignore
# Environment files with real values
.env
.env.local
.env.*.local

# Credentials
*.pem
*.key
credentials.json
secrets.yaml

# IDE/Editor
.idea/
.vscode/settings.json
*.code-workspace
```

---

## Project Phases

See `/docs/planning/170226_implementation-plan.md` for the full breakdown.

Development is split into phases:

- **Phase 0:** Project Setup & Infrastructure
- **Phase 1:** Core Backend API
- **Phase 2:** Frontend Foundation
- **Phase 3:** AI Integration
- **Phase 4:** Polish & Deployment

---

## Commands Reference

```bash
# Local development
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f        # View logs

# Frontend (from /frontend)
bun install                   # Install dependencies
bun dev                       # Start dev server

# Backend (from /backend)
poetry install                # Install all dependencies
poetry install --only main    # Install production deps only
poetry add <package>          # Add a new dependency
poetry add -G dev <package>   # Add a dev dependency
poetry run uvicorn app.main:app --reload  # Run with Poetry
poetry shell                  # Activate virtual environment
poetry run pytest             # Run tests

# Type sync
./scripts/generate-client.sh  # Generate TS types from OpenAPI
```
