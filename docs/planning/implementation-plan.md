# AI Resume Tailor - Implementation Plan

## Project Vision

An AI-powered application that tailors resumes to specific job descriptions, helping users optimize their applications for ATS systems and human reviewers.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 + Bun |
| Backend | FastAPI + Python 3.11 |
| Backend Package Manager | **Poetry** |
| Database | PostgreSQL + Redis |
| Local Dev | Docker Compose |

---

## Phase 0: Project Setup & Infrastructure

**Goal:** Establish the monorepo structure, Docker environment, and basic configuration.

### Tasks

- [x] Create folder structure (`/frontend`, `/backend`, `/scripts`, `/docs`)
- [x] Set up `.gitignore` with comprehensive patterns
- [x] Create `docker-compose.yml` for local development
  - PostgreSQL database
  - Redis cache
  - Backend service
- [x] Initialize FastAPI backend with basic health endpoint
- [x] Initialize Next.js 15 frontend with Bun
- [x] Create `.env.example` files for both frontend and backend
- [x] Set up Poetry for backend dependency management
- [x] Set up the type-sync script (`/scripts/generate-client.sh`)
- [ ] Write initial `README.md`

### Deliverables

- Working `docker-compose up` that starts all services
- Frontend accessible at `localhost:3000`
- Backend accessible at `localhost:8000`
- OpenAPI docs at `localhost:8000/docs`

---

## Phase 1: Core Backend API

**Goal:** Build the essential API endpoints for resume and job management.

### Tasks

- [x] Set up database models with SQLAlchemy/SQLModel
  - User model
  - Resume model
  - JobDescription model
  - TailoredResume model
- [x] Implement Alembic migrations
- [x] Create CRUD endpoints:
  - `POST /api/resumes` - Upload/create resume
  - `GET /api/resumes/{id}` - Retrieve resume
  - `POST /api/jobs` - Add job description
  - `GET /api/jobs/{id}` - Retrieve job
- [x] Add input validation with Pydantic models
- [x] Set up basic error handling
- [x] Add API tests with pytest

### Deliverables

- Functional REST API for resume/job CRUD
- Database migrations working
- API documentation auto-generated

---

## Phase 2: Frontend Foundation

**Goal:** Build the core UI components and pages.

### Tasks

- [x] Set up project structure (app router)
- [x] Configure Tailwind CSS v4 with @tailwindcss/postcss
- [x] Create layout components
  - Header/Navigation
  - Footer
  - Sidebar (dashboard)
- [x] Build core pages:
  - Landing page
  - Dashboard
  - Resume upload/editor page
  - Job description input page
  - Resume detail/edit pages
  - Job detail/edit pages
- [x] Integrate generated API client from type-sync
- [x] Add form handling (React Hook Form + Zod validation)
- [x] Set up state management (TanStack Query)

### Deliverables

- Navigable UI with all core pages
- Forms connected to backend API
- Type-safe API calls

---

## Phase 3: AI Integration

**Goal:** Implement the AI-powered resume tailoring feature.

### Tasks

- [ ] Research and select AI provider (OpenAI, Anthropic, etc.)
- [ ] Create AI service layer in backend
- [ ] Implement resume parsing:
  - Extract sections (experience, skills, education)
  - Normalize data structure
- [ ] Implement job description analysis:
  - Extract key requirements
  - Identify keywords and skills
- [ ] Build tailoring algorithm:
  - Match resume content to job requirements
  - Generate tailored suggestions
  - Rewrite bullet points for relevance
- [ ] Create tailoring endpoint:
  - `POST /api/tailor` - Generate tailored resume
- [ ] Add AI response caching with Redis
- [ ] Build frontend UI for:
  - Viewing AI suggestions
  - Accepting/rejecting changes
  - Downloading tailored resume

### Deliverables

- Working AI tailoring pipeline
- User can upload resume, paste job, get tailored output
- Caching reduces redundant API calls

---

## Phase 4: Polish & Deployment

**Goal:** Production-ready application with authentication and deployment.

### Tasks

- [ ] Add authentication:
  - JWT-based auth
  - Sign up / Login pages
  - Protected routes
- [ ] Implement user dashboard:
  - Saved resumes
  - Job history
  - Tailored resume history
- [ ] Add export options:
  - PDF download
  - Word document
  - Plain text
- [ ] Error handling and loading states
- [ ] Responsive design polish
- [ ] Set up deployment:
  - Frontend to Vercel
  - Backend to Render/Railway
  - Database to managed PostgreSQL
- [ ] Environment variable management for production
- [ ] Basic analytics/monitoring

### Deliverables

- Deployed, production-ready application
- Users can sign up, save work, and export resumes

---

## Future Enhancements (Post-MVP)

- Resume templates and themes
- LinkedIn import
- Multiple resume versions per job
- Interview preparation suggestions
- Cover letter generation
- Chrome extension for quick job capture
- Team/organization features

---

## Session Context Protocol

When starting a new session after context clear:

1. **Read first:** `CLAUDE.md` and this plan
2. **Check phase:** Identify current phase from task completion
3. **Read feature docs:** Check `/docs/features/` for active work
4. **Verify state:** Run `git status` and `docker-compose ps`
5. **Continue:** Pick up from documented progress

This prevents context rot and ensures continuity across sessions.
