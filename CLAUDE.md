# CLAUDE.md - AI Assistant Guidelines

## Project Overview

**AI Resume Tailor** - A monorepo application for AI-powered resume customization.

- **Frontend:** Next.js 15 + Bun (located in `/frontend`)
- **Backend:** FastAPI + Python (located in `/backend`)
- **Database:** PostgreSQL + Redis
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

```
/docs
├── /planning          # Project plans and phases
├── /features          # Feature-specific documentation
│   └── /feature-name  # Subdirectory per feature
├── /architecture      # System design docs
└── /api               # API documentation
```

- Create a new subdirectory for each new feature or project implementation
- Keep the root directory clean - only `README.md` and `CLAUDE.md` at root

### 4. Context Management

**Clear session context between phases to avoid context rot.**

- This project is developed in phases with cleared contexts between sessions
- Each session should start by reading relevant phase documentation
- Reference `/docs/planning/` for current phase objectives
- Do not assume context from previous sessions - verify by reading docs

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
3. Ensure documentation is updated in `/docs/` if needed
4. Use clear, descriptive commit messages

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

See `/docs/planning/implementation-plan.md` for the full breakdown.

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
pip install -r requirements.txt
uvicorn app.main:app --reload

# Type sync
./scripts/generate-client.sh  # Generate TS types from OpenAPI
```
