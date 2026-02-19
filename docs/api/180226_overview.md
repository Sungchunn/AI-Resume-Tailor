# API Overview

## Introduction

The AI Resume Tailor API is a RESTful API built with FastAPI that provides AI-powered resume customization services. This documentation covers all available endpoints, authentication, and usage guidelines.

## Base URL

```
http://localhost:8000
```

All API endpoints (except health and root) are prefixed with `/api`.

## API Versions

| Version | Prefix | Status |
|---------|--------|--------|
| v1 | `/api` (legacy routes) | Active |
| v1 | `/v1` (new routes) | Active |

**Note:** Routes under `/v1` represent newer API additions (blocks, match, workshops, ats).

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
| [Authentication](180226_authentication.md) | `/api/auth` | User registration, login, token refresh |
| [Resumes](180226_resumes.md) | `/api/resumes` | Resume CRUD operations |
| [Jobs](180226_jobs.md) | `/api/jobs` | Job posting CRUD operations |
| [Upload](180226_upload-export.md) | `/api/upload` | Document upload and text extraction |
| [Tailor](180226_tailor-match.md) | `/api/tailor` | AI-powered resume tailoring |
| [Export](180226_upload-export.md) | `/api/export` | Export tailored resumes |
| [Blocks/Vault](180226_blocks.md) | `/v1/blocks` | Content block management |
| [Semantic Match](180226_tailor-match.md) | `/v1/match` | Semantic search and gap analysis |
| [Workshops](180226_workshops.md) | `/v1/workshops` | Resume editing workshops |
| [ATS Analysis](180226_ats.md) | `/v1/ats` | ATS compatibility checks |

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
| `skip` | integer | 0 | Number of records to skip |
| `limit` | integer | 10-100 | Maximum records to return |

**Example:**
```bash
curl "http://localhost:8000/api/resumes?skip=0&limit=20" \
  -H "Authorization: Bearer <token>"
```

## Technology Stack

- **Framework:** FastAPI 0.1.0
- **Database:** PostgreSQL with SQLAlchemy ORM (async)
- **Cache:** Redis
- **Authentication:** JWT (JSON Web Tokens)
- **AI Integration:** Google Gemini API

## Related Documentation

- [Authentication](180226_authentication.md) - Auth flow and security
- [Errors & Rate Limits](180226_errors-rate-limits.md) - Error handling and rate limiting
