# AI Resume Tailor

An AI-powered application that tailors resumes to specific job descriptions.

## Tech Stack

- **Frontend:** Next.js 15 + Bun + TypeScript
- **Backend:** FastAPI + Python
- **Database:** PostgreSQL
- **Cache:** Redis
- **AI:** TBD (OpenAI/Anthropic)

## Project Structure

```
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

1. Clone the repository
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
3. Start services:
   ```bash
   docker-compose up -d
   ```
4. Access:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Documentation

- [Implementation Plan](./docs/planning/implementation-plan.md)
- [Claude AI Guidelines](./CLAUDE.md)

## License

MIT
