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
│   ├── /group-name/               # Group directory (no date prefix)
│   │   └── /YYMMDD_feature-name/      # Feature subdirectory with date
│   │       ├── master-plan.md             # Entry point
│   │       └── phase-*.md                 # Phase breakdowns
│   └── YYMMDD_standalone.md       # Single-doc features (rare)
│
├── /architecture              # System design and technical decisions
│   ├── system-architecture.md     # Overall system design
│   ├── backend-architecture.md    # Backend-specific design
│   ├── database-rules.md          # Database conventions
│   └── ai-integration.md          # AI/ML integration design
│
├── /testing                   # E2E and integration test documentation
│   ├── YYMMDD_playwright-infrastructure.md  # Playwright setup and patterns
│   └── YYMMDD_<feature>-tests.md            # Feature-specific test plans
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
| `/testing` | E2E and Playwright test documentation | Test infrastructure, feature test plans, page objects |
| `/api` | API reference for consumers | Endpoint docs, schemas, error codes |

#### Feature Documentation: Group Directory Structure

**All features MUST be organized under group directories in `/docs/features/`.**

Features are organized into logical groups. Group directories do NOT have date prefixes. Individual features within groups use date prefixes.

```text
/docs/features/
├── ai-usage/                              # AI usage tracking & analytics
│   ├── 260312_ai-usage-dashboard/
│   └── 260320_ai-usage-tailor-flow/
│
├── ats/                                   # ATS scoring & keyword analysis
│   ├── 260303_ats-scoring/
│   ├── 260312_ats-router-modularization/
│   ├── 260312_keyword-modularization/
│   ├── 260319_keyword-analysis-improvements/
│   └── 260320_keyword-review-workflow/
│
├── infrastructure/                        # Backend/database maintenance
│   ├── 260309_backend-parser-expansion.md
│   ├── 260309_scraper-requests/
│   └── 260312_database-cleanup/
│
├── resume-editor/                         # Editor page (/library/[id]/edit)
│   ├── ai-suggestions/                        # AI bullet suggestion attempts
│   ├── fit-to-page/                           # Fit-to-one-page features
│   ├── inline-editing/                        # Inline text editing in preview
│   ├── pagination-and-preview/                # Pagination, preview, PDF export
│   ├── save-and-sync/                         # Saving, conflict handling
│   ├── sections-and-layout/                   # Section management, panel layout
│   ├── bug-fixes/                             # Standalone bug fixes
│   ├── workshop/                              # Workshop editor (separate arch)
│   └── ats-integration/                       # ATS panel in editor
│
├── tailor-flow/                           # Tailoring workflow
│   ├── 260305_tailor-flow-redesign/
│   └── 260312_parse-once-tailor-many/
│
├── ui/                                    # Global UI & layout
│   ├── 260310_l-shape-layout/
│   └── 260310_library-redesign/
│
└── upload/                                # Resume upload experience
    ├── 260306_pdf-upload-loading-states/
    └── 260310_resume-upload-modal/
```

#### Group Directory Reference

| Group | Purpose | When to Add Here |
| ----- | ------- | ---------------- |
| `ai-usage/` | AI usage tracking, analytics, dashboards | Cost monitoring, usage metrics, AI call tracking |
| `ats/` | ATS scoring, keyword analysis | ATS compatibility, keyword extraction, scoring algorithms |
| `infrastructure/` | Backend/database maintenance | DB cleanup, parser improvements, scraper management |
| `resume-editor/` | Editor page features | PDF preview, panels, pagination, styling, save/sync |
| `tailor-flow/` | Tailoring workflow | Tailor UX, parse-once patterns, job matching |
| `ui/` | Global UI & layout | App-wide layout, library page, navigation |
| `upload/` | Resume upload experience | Upload modals, loading states, file handling |

#### Rules for Feature Organization

1. **Group directories have NO date prefix** - e.g., `resume-editor/`, not `220326_resume-editor/`
2. **Feature subdirectories MUST have date prefix** - Format: `YYMMDD_feature-name/`
3. **Choose the most specific group** - A feature affecting the editor goes in `resume-editor/`, not `ui/`
4. **Each feature follows standard conventions** - Must contain a `master-plan.md` entry point and phase docs as needed
5. **Chronological ordering** - Date prefix enables natural sorting by implementation date

#### Adding a New Group

Create a new group directory only when:

- **3+ related features** would belong to it
- Features share a **clear functional domain**
- No existing group is appropriate

New groups must be added to this reference table and documented with clear purpose.

#### File Naming Convention

All documentation files in `/docs/planning` and `/docs/features` MUST include a **date prefix** for tracking.

**Format:** `YYMMDD_name.md`

```text
260218_api-design.md           # Created Feb 18, 2026
260115_auth-implementation.md  # Created Jan 15, 2026
260301_deployment-guide.md     # Created Mar 1, 2026
```

Rules:

- Use **lowercase with hyphens** for the name portion
- Date represents the **creation date** of the document
- Helps track document age and maintain chronological context

**Exceptions (no date prefix):**

- `/docs/api/*` - Permanent API reference docs
- `/docs/architecture/*` - Permanent living references (updated in place, not point-in-time snapshots)
- `/docs/PROJECT_MASTER_PLAN.md` - Project vision doc
- `/docs/features/<group>/` - Group directories (e.g., `resume-editor/`, `ats/`)
- Proposal/decision docs within feature subdirs (e.g., `ats-scoring-proposal.md`)

#### Markdown Formatting Rules

**Follow `/docs/MARKDOWN_STYLE_GUIDE.md` to avoid linting errors.**

Key rules:

- **Tables:** Use spaces in separators: `| ----- | ----- |` not `|-----|-----|`
- **Bold headers:** End with colon: `**Error Responses:**` not `**Error Responses**`
- **Code blocks:** Always specify language: ` ```json ` or ` ```text `, never bare ` ``` `
- **Headers:** Always include blank line after `#`, `##`, `###` before body text
- **Unique headings (MD024):** Never use duplicate heading text within a single file. Add context to make headings unique:
  - WRONG: Multiple `## Verification` headings in the same file
  - CORRECT: `## Stage 1 Verification`, `## Stage 2 Verification` or split into separate files

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

**Exception:** PostgreSQL's `SET` and `SET LOCAL` commands do not support parameterized queries. F-strings are acceptable ONLY when:

- The command doesn't support parameters (e.g., `SET LOCAL`)
- The value is a validated primitive type (`int`, `bool`) from a trusted source (e.g., JWT-extracted user ID)

```python
# ACCEPTABLE - SET LOCAL doesn't support $1 placeholders
# user_id is validated int from JWT, not user input
await session.execute(text(f"SET LOCAL app.current_user_id = '{user_id}'"))
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
- `editor-guide.md` - Editor routes, entry points, feature gating, and naming conventions for all 3 editor contexts

**Editor changes:** When modifying editor behavior, routes, feature gating, entry points, or adding new editor contexts, you MUST update `editor-guide.md`. The editor is the core of this webapp — this doc is the canonical reference for how the 3 editors differ.

**Note:** Architecture docs in `/docs/architecture/` are permanent living references and do NOT use date prefixes. They are updated in place as the system evolves.

### 13. Frontend Page Layout Standards

**All new pages must be centered with consistent width constraints.**

- Use `max-w-4xl mx-auto` as the root container for page content
- This matches the layout established in `/jobs/[id]` which is the golden standard
- Only deviate from this standard if explicitly instructed otherwise
- **Dark Mode:** Follow the color scheme in `/docs/architecture/frontend-ui-standards.md`
  - Use zinc greys (`zinc-600` to `zinc-800`) for background hierarchy
  - Use `blue-400` for vibrant accent colors
  - The `/library?tab=resumes` page is the golden standard for dark mode

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

### 14. AI Usage Tracking

**ALWAYS log AI usage metrics when making AI API calls.**

- Every AI call (OpenAI, embedding services, etc.) must have its usage tracked
- Use `return_metrics=True` when calling AI services to get metrics back
- Log metrics using `AIUsageTracker.log_generation()` in route handlers
- This enables cost monitoring and usage analytics per user/endpoint

**Services with metrics support:**

- `ResumeParser.parse(raw_content, return_metrics=True)`
- `JobAnalyzer.analyze(raw_content, return_metrics=True)`
- `TailoringService` (returns metrics in `TailoringResult["ai_metrics"]`)
- `SemanticMatcher.extract_keywords()`, `analyze_gaps()`
- `BlockSplitter.split()`, `BlockClassifier.classify()`, `suggest_tags()`
- `KeywordExtractor.extract_keywords()`, `extract_keywords_with_importance()`
- `SuggestionGenerator.generate_suggestions()`, `suggest_single_bullet()`

```python
# CORRECT - Track AI usage in route handlers
from app.services.ai import get_usage_tracker

@router.post("/my-ai-endpoint")
async def my_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    ai_client = get_ai_client()
    usage_tracker = get_usage_tracker()

    # Use _with_metrics variant for direct AI client calls
    ai_response = await ai_client.generate_json_with_metrics(
        system_prompt="...",
        user_prompt="...",
    )

    # Log the usage
    await usage_tracker.log_generation(
        db=db,
        user_id=current_user_id,
        endpoint="/my-ai-endpoint",
        response=ai_response,
    )
    await db.commit()

    return process_response(ai_response.content)


# CORRECT - Track usage from services that support return_metrics
parser = ResumeParser(ai_client, cache)
result, metrics = await parser.parse(raw_content, return_metrics=True)

if metrics:  # None if result was cached
    await usage_tracker.log_generation(
        db=db, user_id=user_id, endpoint="/parse", response=metrics
    )
    await db.commit()


# WRONG - AI call without tracking
response = await ai_client.generate_json(...)  # No metrics captured!
```

### 15. Tailwind CSS Canonical Classes

**Always use the canonical (shorter) Tailwind class names.**

Tailwind v3+ provides shorter aliases for many utility classes. Always use the canonical form to maintain consistency and avoid linter warnings.

| Legacy Class | Canonical Class |
| ------------ | --------------- |
| `flex-shrink-0` | `shrink-0` |
| `flex-shrink` | `shrink` |
| `flex-grow-0` | `grow-0` |
| `flex-grow` | `grow` |
| `overflow-ellipsis` | `text-ellipsis` |
| `decoration-slice` | `box-decoration-slice` |
| `decoration-clone` | `box-decoration-clone` |

```tsx
// WRONG - Legacy class names
<div className="shrink-0 grow">

// CORRECT - Canonical class names
<div className="shrink-0 grow">
```

### 16. Playwright E2E Testing

**Use Playwright for features requiring real browser behavior (DOM measurements, font rendering, visual regression).**

#### When to Use Playwright vs Jest/JSDOM

| Capability | JSDOM | Playwright |
| ---------- | ----- | ---------- |
| CSS layout engine (`scrollHeight`, `offsetHeight`) | No | Yes |
| Font rendering and line wrapping | No | Yes |
| Real browser interactions | No | Yes |
| Visual regression testing | No | Yes |

#### Documentation Requirements

When implementing Playwright tests for a feature:

1. **Create test plan doc:** `/docs/testing/YYMMDD_<feature>-tests.md`
2. **Reference infrastructure:** Link to `playwright-infrastructure.md` for patterns
3. **Include prerequisites:** List required `data-testid` attributes to add
4. **Define test scope:** Tables of pages and behaviors to validate

#### Implementation Procedure

1. **Add `data-testid` attributes** to components under test (use pattern: `<component>-<element>[-<modifier>]`)
2. **Create page object** in `frontend/e2e/fixtures/page-objects/<PageName>Page.ts`
3. **Create test data factory** in `frontend/e2e/fixtures/test-data/<entity>.fixture.ts` (if needed)
4. **Add project to `playwright.config.ts`** (if feature needs specific viewport/settings)
5. **Write test files** in `frontend/e2e/<feature-name>/`
6. **Update infrastructure doc** if new patterns are established

#### File Structure

```text
frontend/e2e/
├── <feature-name>/           # Feature-specific tests
│   └── *.spec.ts
├── fixtures/
│   ├── page-objects/         # Encapsulate page interactions
│   │   └── <PageName>Page.ts
│   └── test-data/            # Test data factories
│       └── <entity>.fixture.ts
└── helpers/                  # Shared utilities
    └── <utility>.ts
```

#### Running Tests

```bash
cd frontend
bun run test:e2e e2e/<feature>       # Run feature tests
bun run test:e2e:ui                  # Interactive UI mode
bun run test:e2e:report              # View test report
```

#### Lean Artifact Management

**Keep test artifacts minimal to prevent repository bloat.**

| Setting | Value | Rationale |
| ------- | ----- | --------- |
| `trace` | `"on-first-retry"` | Only capture traces for flaky/failing tests |
| `screenshot` | `"only-on-failure"` | Avoid generating data for passing tests |
| `video` | `"retain-on-failure"` | Keep videos only for debugging failures |
| `workers` | `"50%"` (local) | Keep machine responsive during test runs |

**Gitignored artifacts (NEVER commit):**

- `playwright-report/` - HTML report output
- `test-results/` - Test artifacts and traces
- `blob-report/` - CI sharded run merge artifacts
- `**/pw-results.json` - JSON reporter output

**Cleanup protocol:** Before major test suite runs or if `test-results/` exceeds 500MB:

```bash
cd frontend
rm -rf test-results/ playwright-report/ blob-report/
```

#### CI Configuration (GitHub Actions)

Playwright config is designed for GitHub Actions compatibility:

- Single worker on CI (`workers: 1`) for deterministic results
- Blob reports for sharded runs via `["blob", { outputDir: "blob-report" }]`
- Use `actions/upload-artifact` to persist reports between jobs

```yaml
# Example: Upload blob report for merge
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: blob-report-${{ matrix.shard }}
    path: frontend/blob-report/
    retention-days: 1
```

### 17. Feature Plan Subdirectory Organization

**Organize feature plan directories by feature area, not flat.**

When a group directory under `docs/features/` accumulates 5+ plan folders, group related plans into subdirectories by feature area. Subdirectory names have NO date prefix (like group directories).

```text
docs/features/resume-editor/
├── ai-suggestions/              # Grouped by feature area
│   ├── AI_SUGGESTION_ATTEMPTS.md    # Attempt history (if multiple attempts)
│   ├── 260307_inline-suggestions/
│   └── 260412_inline-bullet-suggestions/
├── fit-to-page/
│   ├── 260307_fit-to-page/
│   └── 260331_fit-to-page-optimization/
├── 260316_standalone-plan/      # Small standalone plans stay at top level
└── 260227_one-off-doc.md
```

| Rule | Description |
| ----- | ----- |
| Subdirectory threshold | Group when 5+ plans target the same feature area |
| Naming | No date prefix on subdirectory names (e.g., `ai-suggestions/`, not `260412_ai-suggestions/`) |
| Standalone plans | Plans that don't fit any group stay at the top level |
| Uncategorized | Don't force a plan into a category -- leave at top level if unclear |

### 18. Feature Plan Hygiene

**Check for prior attempts before creating a new plan.**

When creating a new implementation plan for a feature that has prior attempts:

1. Check `docs/features/{group}/` for existing plans targeting the same feature
2. If prior attempts exist, read their `master-plan.md` to understand what was tried
3. Reference prior attempts in the new plan (what was tried, why it didn't work)
4. After implementation, audit for dead code left by superseded plans
5. Update or create `{feature-area}/ATTEMPT_HISTORY.md` tracking the evolution

Do NOT create a new plan in isolation when prior attempts exist.

### 19. Dead Code Audit After Feature Supersession

**Audit for orphaned code when a feature supersedes prior implementations.**

After completing a feature that replaces or supersedes prior implementations:

1. Grep for imports of files created by prior attempts
2. Remove orphaned files with zero imports (outside their own tests/barrels)
3. For mixed files (some exports used, some not): remove dead exports, add `// DEPRECATED` comments with attempt reference
4. Do NOT delete stores or shared modules -- only deprecate unused fields
5. Document removals in the retrospective (`ATTEMPT_HISTORY.md`)
6. Verify the build passes after removal (`bun run build`)

---

## AI Behavioral Principles

These principles govern how Claude approaches all work in this project. They address the known failure modes of AI coding agents: wrong assumptions, overcomplicated code, orthogonal edits, and unverifiable work.

### Think Before Coding

**Never start implementing until the approach is clear and agreed upon.**

- Before writing any code, state your understanding of the task and the approach you plan to take
- Surface any confusion, ambiguities, or missing context — ask rather than assume
- When multiple approaches exist, present the tradeoffs and let the human decide
- Push back when a request seems wrong, unclear, or likely to cause problems
- If something contradicts existing patterns in the codebase, flag it explicitly

**Red flags that require stopping and asking:**

- The task description is ambiguous about scope or behavior
- You need to guess at a data shape, API contract, or user-facing behavior
- The requested change conflicts with an existing pattern or rule in this file
- You're unsure whether a dependency, function, or file still exists

```text
# WRONG - Assuming and running with it
"I'll add a new Redux store for this feature..."
(Project doesn't use Redux)

# CORRECT - Surfacing confusion
"The task says 'persist this state' but I'm not sure where —
the app uses Zustand for client state and PostgreSQL for server state.
Which is appropriate here?"
```

### Simplicity First

**Write the least code that solves the actual problem. Nothing more.**

- Prefer 100 clear lines over 1000 "well-architected" lines
- Do not introduce abstractions, helpers, or utilities unless they are used in 3+ places today (not hypothetically)
- Do not add configuration, feature flags, or extension points that weren't requested
- Do not refactor surrounding code while working on a task — stay focused
- If a solution feels complex, step back and ask whether the problem is being overcomplicated

**Complexity budget checklist:**

- Can this be done with a simple function instead of a class? Use the function.
- Can this be done inline instead of a helper? Do it inline.
- Does this abstraction serve the current task, or a hypothetical future one? If hypothetical, skip it.
- Are you adding types, interfaces, or wrappers that only have one implementation? Probably unnecessary.

```python
# WRONG - Premature abstraction
class ResumeFormatterFactory:
    _formatters: dict[str, Type[BaseFormatter]] = {}

    @classmethod
    def register(cls, format_type: str):
        def decorator(formatter_cls):
            cls._formatters[format_type] = formatter_cls
            return formatter_cls
        return decorator

    @classmethod
    def create(cls, format_type: str) -> BaseFormatter:
        return cls._formatters[format_type]()

# CORRECT - Direct solution (only one format exists today)
def format_resume_as_pdf(resume_data: dict) -> bytes:
    ...
```

### Surgical Changes

**Touch only what the task requires. Leave everything else exactly as-is.**

- Do not modify comments, formatting, or code style in lines you aren't changing for the task
- Do not add docstrings, type annotations, or comments to unchanged code
- Do not rename variables, reorder imports, or "clean up" adjacent code
- Do not remove code you don't fully understand, even if it looks unused
- If you notice something broken or wrong outside the task scope, mention it to the user — don't fix it silently

**The diff test:** Before finishing, every line in your diff should directly serve the task. If a line is there "while I'm here" or "for consistency," remove it.

```text
# WRONG - Task was "fix the date format bug"
- Changed the date parsing logic (the actual fix)
- Also reformatted 3 adjacent functions
- Added type hints to 5 unrelated parameters
- Removed a comment that "seemed outdated"

# CORRECT - Task was "fix the date format bug"
- Changed the date parsing logic (the actual fix)
- Nothing else
```

### Goal-Driven Execution

**Define what "done" looks like before starting, and verify it when finished.**

- Before coding, state the success criteria: what should work when the task is complete
- After coding, verify against those criteria — run the relevant tests, check the UI, confirm the behavior
- If the task involves UI, start the dev server and visually verify (don't just trust the type checker)
- If the task involves an API, test the endpoint (don't just trust that the code "looks right")
- Prefer writing or running a test over manually asserting "this should work"

**Verification hierarchy (most to least trustworthy):**

1. Automated test passes (write one if it doesn't exist and the behavior is testable)
2. Manual verification in browser/API client
3. Type checker + linter pass
4. "The code looks correct" (this alone is NOT sufficient for UI/API work)

```text
# WRONG
"I've updated the component to fix the layout. The code looks correct."

# CORRECT
"I've updated the component. Started the dev server and verified:
- The card renders at the correct width on desktop (1024px)
- The card stacks vertically on mobile (375px)
- No visual regressions on the /library page"
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
   - **E2E test changes:** Update `/docs/testing/` for new Playwright tests or infrastructure changes
4. Use clear, descriptive commit messages with scope prefix

### Commit Message Format

**All commits must specify the scope of changes using a prefix.**

Format: `<scope>: <description>`

Valid scopes:

- `frontend:` - Changes to `/frontend` (Next.js, React, UI)
- `backend:` - Changes to `/backend` (FastAPI, Python, API)
- `database:` - Database schema, migrations, Redis config
- `infra:` - Docker, CI/CD, deployment configs
- `test:` - E2E/Playwright tests (use `frontend:` if tests are part of feature work)
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

# Playwright test artifacts (regenerated on each test run)
playwright-report/
test-results/
```

---

## Project Phases

See `/docs/planning/260217_implementation-plan.md` for the full breakdown.

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

# Playwright E2E tests (from /frontend)
bun run test:e2e                 # Run all E2E tests
bun run test:e2e e2e/<feature>   # Run specific feature tests
bun run test:e2e:ui              # Interactive UI mode
bun run test:e2e:report          # View HTML report
bun run test:e2e:update          # Update visual baselines
```
