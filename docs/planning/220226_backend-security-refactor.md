# Backend Security & Quality Refactor Plan

**Created:** 2026-02-22
**Status:** Ready for Implementation
**Priority:** High

---

## Overview

This plan addresses security vulnerabilities, bugs, and performance issues identified during the backend code review. Tasks are organized by priority and can be executed in parallel where noted.

---

## Task Breakdown

### Phase 1: Critical Security Fixes (Blockers)

These must be completed first before any deployment.

#### Task 1.1: Implement Webhook Authentication

**Files:**

- `backend/app/api/routes/webhooks.py`
- `backend/app/api/deps.py` (add new dependency)

**Changes:**

1. Create `verify_webhook_key` dependency that validates `X-API-Key` header against `settings.n8n_webhook_api_key`
2. Apply dependency to all webhook endpoints (`/job-listings`, `/job-listings/batch`)
3. Return 401 for invalid keys, 503 if webhook not configured

**Implementation:**

```python
# In deps.py
from fastapi import Header, HTTPException, status
from app.core.config import get_settings

async def verify_webhook_key(
    x_api_key: str = Header(..., alias="X-API-Key")
) -> None:
    settings = get_settings()
    if not settings.n8n_webhook_api_key:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    if x_api_key != settings.n8n_webhook_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

# In webhooks.py - add to each endpoint
@router.post("/job-listings", dependencies=[Depends(verify_webhook_key)])
```

---

#### Task 1.2: Implement Admin Authentication

**Files:**

- `backend/app/api/routes/admin.py`
- `backend/app/api/deps.py` (add new dependency)
- `backend/app/core/config.py` (add admin emails config)

**Changes:**

1. Add `admin_emails: list[str]` to settings (comma-separated env var)
2. Create `require_admin` dependency that checks if current user's email is in admin list
3. Apply dependency to all `/admin/*` endpoints

**Implementation:**

```python
# In config.py
admin_emails: list[str] = []  # ADMIN_EMAILS env var, comma-separated

# In deps.py
async def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    settings = get_settings()
    if current_user.email not in settings.admin_emails:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# In admin.py - add to router or each endpoint
router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])
```

---

### Phase 2: Security Hardening (Can Run in Parallel)

#### Task 2.1: JWT Secret Validation

**Files:**

- `backend/app/core/config.py`

**Changes:**

1. Add Pydantic validator to reject default JWT secret in non-development environments

**Implementation:**

```python
from pydantic import field_validator

@field_validator('jwt_secret_key')
@classmethod
def validate_jwt_secret(cls, v: str, info) -> str:
    env = info.data.get('environment', 'development')
    if env != 'development' and v == 'your-super-secret-key-change-in-production':
        raise ValueError('JWT secret must be changed in production')
    return v
```

---

#### Task 2.2: Password Complexity Validation

**Files:**

- `backend/app/schemas/user.py`

**Changes:**

1. Add `field_validator` to `UserCreate.password` requiring uppercase, lowercase, and digit

**Implementation:**

```python
import re
from pydantic import field_validator

@field_validator('password')
@classmethod
def validate_password_strength(cls, v: str) -> str:
    if not re.search(r'[A-Z]', v):
        raise ValueError('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', v):
        raise ValueError('Password must contain at least one lowercase letter')
    if not re.search(r'\d', v):
        raise ValueError('Password must contain at least one digit')
    return v
```

---

#### Task 2.3: Configurable CORS Origins

**Files:**

- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/.env.example`

**Changes:**

1. Add `cors_origins: list[str]` to settings with default `["http://localhost:3000"]`
2. Update CORS middleware to use `settings.cors_origins`
3. Use explicit methods/headers instead of wildcards
4. Add `CORS_ORIGINS` to `.env.example`

**Implementation:**

```python
# In config.py
cors_origins: list[str] = ["http://localhost:3000"]

# In main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

#### Task 2.4: Rate Limit IP Spoofing Protection

**Files:**

- `backend/app/middleware/rate_limiter.py`
- `backend/app/core/config.py`

**Changes:**

1. Add `trust_proxy: bool = False` to settings
2. Update `_get_identifier` to only trust X-Forwarded-For when `trust_proxy=True`
3. When trusting proxy, take the rightmost (closest) IP from the chain

**Implementation:**

```python
# In config.py
trust_proxy: bool = False  # Set True when behind reverse proxy

# In rate_limiter.py
def _get_identifier(self, request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"

    settings = get_settings()
    if settings.trust_proxy:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip = forwarded_for.split(",")[-1].strip()
            return f"ip:{ip}"

    ip = request.client.host if request.client else "unknown"
    return f"ip:{ip}"
```

---

#### Task 2.5: Add Rate Limiting to Upload Endpoint

**Files:**

- `backend/app/middleware/rate_limiter.py`

**Changes:**

1. Add `/api/upload` to `ENDPOINT_CATEGORIES` with restrictive category

**Implementation:**

```python
ENDPOINT_CATEGORIES = {
    # ... existing entries
    "/api/upload": "export",  # Use restricted category for uploads
}
```

---

### Phase 3: Bug Fixes (Can Run in Parallel)

#### Task 3.1: Fix Deprecated datetime.utcnow()

**Files:**

- `backend/app/crud/block.py` (lines 227, 258)
- Any other files using `datetime.utcnow()`

**Changes:**

1. Replace all `datetime.utcnow()` with `datetime.now(timezone.utc)`
2. Add `timezone` import from datetime module

**Search Pattern:**

```bash
grep -r "datetime.utcnow" backend/
```

---

#### Task 3.2: Add AI Client Error Handling

**Files:**

- `backend/app/services/ai/client.py`

**Changes:**

1. Create custom `AIServiceError` exception
2. Wrap Gemini API calls in try/except
3. Log errors and raise structured exceptions

**Implementation:**

```python
# In exceptions.py or client.py
class AIServiceError(Exception):
    """Raised when AI service operations fail."""
    pass

# In client.py
from google.api_core.exceptions import GoogleAPIError

async def generate(self, ...):
    try:
        response = self.client.models.generate_content(...)
        return response.text
    except GoogleAPIError as e:
        logger.error(f"Gemini API error: {e}")
        raise AIServiceError(f"AI generation failed: {e}") from e
    except Exception as e:
        logger.error(f"Unexpected AI error: {e}")
        raise AIServiceError(f"AI service unavailable") from e
```

---

### Phase 4: Performance Improvements

#### Task 4.1: Make Gemini API Calls Non-Blocking

**Files:**

- `backend/app/services/ai/client.py`
- `backend/app/services/ai/embedding.py`

**Changes:**

1. Wrap synchronous Gemini SDK calls with `asyncio.to_thread()`
2. Update all methods that call Gemini API

**Implementation:**

```python
import asyncio

async def generate(self, ...):
    response = await asyncio.to_thread(
        self.client.models.generate_content,
        model=self.model,
        contents=full_prompt,
        config=config,
    )
    return response.text

# Similarly for embedding.py embed_content calls
```

---

#### Task 4.2: Add Audit Logging for Failures

**Files:**

- `backend/app/services/core/audit.py`

**Changes:**

1. Add logging when audit operations fail instead of silently swallowing exceptions

**Implementation:**

```python
except Exception as e:
    logger.warning(f"Audit logging failed: {e}", exc_info=True)
    await db.rollback()
    return None
```

---

## Execution Order

```text
Phase 1 (Sequential - Critical)
├── Task 1.1: Webhook Auth
└── Task 1.2: Admin Auth

Phase 2 (Parallel - Security)
├── Task 2.1: JWT Validation
├── Task 2.2: Password Complexity
├── Task 2.3: CORS Config
├── Task 2.4: Rate Limit IP Fix
└── Task 2.5: Upload Rate Limit

Phase 3 (Parallel - Bugs)
├── Task 3.1: datetime.utcnow Fix
└── Task 3.2: AI Error Handling

Phase 4 (Parallel - Performance)
├── Task 4.1: Async Gemini Calls
└── Task 4.2: Audit Logging
```

---

## Testing Requirements

After each task:

1. Run `poetry run pytest` to verify no regressions
2. Test affected endpoints manually or via API client
3. Verify error responses are appropriate (401, 403, 503)

---

## Environment Variables to Add

```bash
# .env.example additions
ADMIN_EMAILS=admin@example.com,admin2@example.com
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
TRUST_PROXY=false
```

---

## Notes

- Phase 1 tasks are blockers and should not be deployed without completion
- Phase 2-4 tasks can be distributed across multiple agents
- Each task is self-contained with specific file targets
- Implementation snippets are provided as guidance, not copy-paste solutions
