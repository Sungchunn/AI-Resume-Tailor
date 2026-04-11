# AI Resume Tailor

An AI-powered application that tailors resumes to specific job descriptions.

## Tech Stack

- **Frontend:** Next.js 15 + Bun + TypeScript
- **Backend:** FastAPI + Python
- **Database:** PostgreSQL + MongoDB
- **Cache:** Redis
- **AI:** TBD (OpenAI/Gemini)

## Project Structure

```text
├── /frontend                      # Next.js application
├── /backend                       # FastAPI application (built as a container in CI)
├── /deploy
│   └── docker-compose.prod.yml    # Production compose (api + redis, GHCR image)
├── /scripts                       # Automation scripts
├── /docs                          # Documentation
│   ├── /planning                  # Project plans
│   ├── /features                  # Feature docs
│   └── /architecture              # System design
├── docker-compose.yml             # Local development (full stack)
└── .github/workflows
    ├── ci.yml                     # PR: ruff + pytest vs real Postgres + Mongo
    └── cd.yml                     # Push to main: build → migrate → deploy
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Bun (for frontend)
- Python 3.11+ (for backend development)

### Local Development

#### Option 1: Docker Compose (Recommended)

1. Clone the repository
2. Copy environment files:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Start all services:

   ```bash
   docker-compose up -d
   ```

4. Access:
   - Frontend: <http://localhost:3000>
   - Backend: <http://localhost:8000>
   - API Docs: <http://localhost:8000/docs>

#### Option 2: Manual Setup (Frontend & Backend Separately)

**Frontend:**

```bash
cd frontend
bun install
bun dev
```

**Backend:**

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```

## Commands Reference

### Docker Compose

```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f        # View logs
```

### Frontend (from /frontend)

```bash
bun install                   # Install dependencies
bun dev                       # Start dev server
```

### Backend (from /backend)

```bash
poetry install                # Install all dependencies
poetry install --only main    # Install production deps only
poetry add <package>          # Add a new dependency
poetry add -G dev <package>   # Add a dev dependency
poetry run uvicorn app.main:app --reload  # Run with reload
poetry shell                  # Activate virtual environment
poetry run pytest             # Run tests
```

### Database Migrations (from /backend)

```bash
poetry run alembic upgrade head           # Apply all pending migrations
poetry run alembic downgrade -1           # Rollback last migration
poetry run alembic revision -m "message"  # Create new migration
poetry run alembic history                # View migration history
poetry run alembic current                # Show current revision
```

> Production migrations run automatically in the `migrate` job of `.github/workflows/cd.yml` — `docker run --rm ... alembic upgrade head` executes from the GitHub Actions runner directly against Supabase. The droplet has no Python or Poetry installed.

### Type Sync

```bash
./scripts/generate-client.sh  # Generate TS types from OpenAPI
```

## Deployment Pipeline

Backend deployment is fully automated via GitHub Actions. See `/docs/features/infrastructure/110426_docker-cicd-pipeline/` for the full cutover rationale, and `/docs/architecture/080426_digitalocean-hosting-setup.md` for droplet operations.

**`ci.yml`** — runs on every PR touching `backend/**`. Lint (`ruff`) plus the full `pytest` suite against ephemeral Postgres 16 (with `pgvector`) and MongoDB 7 service containers.

**`cd.yml`** — runs on push to `main` touching `backend/**`, `deploy/docker-compose.prod.yml`, or the workflow itself. Three sequential jobs:

1. **`build-and-push`** — Buildx builds `backend/Dockerfile` with GHA layer cache and pushes `:latest` + `:sha-<commit>` tags to `ghcr.io/sungchunn/resume-builder-api` (private).
2. **`migrate`** — `docker run --rm` the fresh image from the runner with production env vars injected, executing `alembic upgrade head` against Supabase.
3. **`deploy`** — SSHes to the DigitalOcean droplet, `git pull`s the repo (to refresh `deploy/docker-compose.prod.yml`), `docker compose pull api && up -d api`, then runs a 5-attempt `/health` check.

### Local Dev vs Production Compose

| File | Purpose | Services |
| ---- | ------- | -------- |
| `docker-compose.yml` (repo root) | Local development, full stack on one machine | `frontend`, `backend`, `postgres` (pgvector), `mongodb`, `redis`, `minio` |
| `deploy/docker-compose.prod.yml` | Production droplet | `resume-api` (GHCR image) + `resume-redis` — Postgres/MongoDB are **external** managed services (Supabase, Atlas) |

Production secrets live in `/home/deploy/app/deploy/.env` on the droplet; the image itself never contains secrets.

## Documentation

### Project Documentation

- **[Implementation Plan](./docs/planning/implementation-plan.md)** - Development phases and roadmap
- **[API Documentation](./docs/api/overview.md)** - API endpoints, schemas, and error handling
- **[System Architecture](./docs/architecture/system-architecture.md)** - Overall system design and component interactions
- **[Backend Architecture](./docs/architecture/backend-architecture.md)** - API design patterns and request/response flows
- **[Database Rules](./docs/architecture/database-rules.md)** - Database conventions and schema patterns

### Development Guidelines

- **[Claude AI Guidelines](./CLAUDE.md)** - Rules, best practices, and workflows for development
  - Security, credentials management, and git collaboration rules
  - Documentation requirements (always update `/docs/api/` for API changes and `/docs/architecture/` for design changes)
  - Database query patterns and transaction safety
  - Code quality standards

## License

MIT
