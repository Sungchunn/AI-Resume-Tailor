# API Overview

## Introduction

The AI Resume Tailor API is a RESTful API built with FastAPI that provides AI-powered resume customization services. This documentation covers all available endpoints, authentication, and usage guidelines.

## Base URL

```
http://localhost:8000
```

All API endpoints (except health and root) are prefixed with `/api` or `/v1`.

## API Versions

| Version | Prefix | Status |
|---------|--------|--------|
| v1 | `/api` (legacy routes) | Active |
| v1 | `/v1` (new routes) | Active |

**Note:** Routes under `/v1` represent newer API additions (blocks, match, resume-builds, ats).

## Interactive Documentation

| Format | URL |
|--------|-----|
| Swagger UI | `/docs` |
| ReDoc | `/redoc` |
| OpenAPI Spec | `/openapi.json` |

## Quick Start

### 1. Health Check

```bash
curl http://localhost:8000/health
```

**Response:**
```json
{"status": "healthy"}
```

### 2. Register a User

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "full_name": "John Doe", "password": "securepassword123"}'
```

### 3. Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepassword123"}'
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### 4. Make Authenticated Requests

```bash
curl http://localhost:8000/api/resumes \
  -H "Authorization: Bearer <access_token>"
```

## API Routes Summary

| Category | Base Path | Description |
|----------|-----------|-------------|
| [Authentication](authentication.md) | `/api/auth` | User registration, login, token refresh |
| [Resumes](resumes.md) | `/api/resumes` | Resume CRUD operations |
| [Jobs](jobs.md) | `/api/jobs` | User's job posting CRUD operations |
| [Job Listings](job-listings.md) | `/api/job-listings` | Browse scraped job listings |
| [Upload](upload-export.md) | `/api/upload` | Document upload and text extraction |
| [Tailor](tailor-match.md) | `/api/tailor` | AI-powered resume tailoring |
| [Export](upload-export.md) | `/api/export` | Export tailored resumes |
| [Blocks/Vault](blocks.md) | `/v1/blocks` | Content block management |
| [Semantic Match](tailor-match.md) | `/v1/match` | Semantic search and gap analysis |
| [Resume Builds](resume-builds.md) | `/v1/resume-builds` | Resume building workshops |
| [ATS Analysis](ats.md) | `/v1/ats` | ATS compatibility checks |
| [AI Chat](ai-chat.md) | `/v1/ai` | AI-powered section improvements and chat |
| [Admin](admin.md) | `/api/admin` | Scraper and system administration |

## Request/Response Format

### Content Type

All requests and responses use JSON format:

```
Content-Type: application/json
```

**Exception:** File uploads use `multipart/form-data`.

### Date Format

All timestamps are returned in ISO 8601 format:

```
2026-02-18T14:30:00.000000
```

### Pagination

List endpoints support pagination with query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` / `offset` | integer | 0 | Number of records to skip |
| `limit` | integer | 10-100 | Maximum records to return |

**Example:**
```bash
curl "http://localhost:8000/api/resumes?skip=0&limit=20" \
  -H "Authorization: Bearer <token>"
```

## Technology Stack

- **Framework:** FastAPI
- **Database:** PostgreSQL with SQLAlchemy ORM (async)
- **Cache:** Redis
- **Authentication:** JWT (JSON Web Tokens)
- **AI Integration:** Google Gemini API
- **Job Scraping:** Apify (LinkedIn)

## Related Documentation

- [Authentication](authentication.md) - Auth flow and security
- [Errors & Rate Limits](errors-rate-limits.md) - Error handling and rate limiting
