# AI Resume Tailor

An AI-powered application that tailors resumes to specific job descriptions.

## Tech Stack

- **Frontend:** Next.js 15 + Bun + TypeScript
- **Backend:** FastAPI + Python
- **Database:** PostgreSQL + MongoDB
- **Cache:** Redis
- **AI:** TBD (OpenAI/Anthropic)

## Project Structure

```text
├── /frontend          # Next.js application
├── /backend           # FastAPI application
├── /scripts           # Automation scripts
├── /docs              # Documentation
│   ├── /planning      # Project plans
│   ├── /features      # Feature docs
│   └── /architecture  # System design
└── docker-compose.yml # Local development
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

### Type Sync

```bash
./scripts/generate-client.sh  # Generate TS types from OpenAPI
```

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
