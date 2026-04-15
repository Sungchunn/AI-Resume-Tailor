# SSE Ticket-Based Authentication

## Problem

The ATS progressive analysis feature uses Server-Sent Events (SSE) via the native `EventSource` API. Because `EventSource` does not support custom HTTP headers, the JWT access token (30-minute TTL) is passed as a query parameter `?token=<JWT>`.

**Risk:** Tokens in URLs are logged by web servers, proxies, browser history, and can leak via referrer headers. A captured token grants full user access for up to 30 minutes.

**Affected code:**

| Location | File | Lines |
| ----- | ----- | ----- |
| Frontend (workshop hook) | `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts` | 223-226 |
| Frontend (shared hook) | `frontend/src/lib/api/hooks.ts` | 1169-1172 |
| Backend (SSE auth dep) | `backend/app/api/deps.py` | 96-107 |
| Backend (SSE endpoint) | `backend/app/api/routes/ats/progressive.py` | 36-45 |

## Solution

Replace the raw JWT with a short-lived, one-time-use Redis ticket:

1. Frontend POSTs to `/auth/sse-ticket` with Bearer token in the Authorization header
2. Backend creates a UUID ticket, stores it in Redis with 30-second TTL mapped to the user ID
3. Frontend passes only the opaque UUID in the SSE URL: `?ticket=<uuid>`
4. Backend SSE dependency validates the ticket via `getdel()` (atomic read-and-delete)

No new dependencies required -- Redis is already in the stack (`backend/app/db/redis.py`).

## Implementation Steps

### Step 1: Backend Schema

**File:** `backend/app/schemas/user.py`

Add response model for the ticket endpoint:

```python
class SSETicketResponse(BaseModel):
    ticket: str
```

**File:** `backend/app/schemas/__init__.py`

Add `SSETicketResponse` to the user import block and `__all__` list.

### Step 2: Backend Ticket Endpoint

**File:** `backend/app/api/routes/auth.py`

Add `POST /sse-ticket` endpoint:

- Authenticated via `Depends(get_current_user_id)` (standard Bearer header auth)
- Generates `uuid.uuid4()`
- Stores in Redis: key `sse-ticket:{uuid}` with value `str(user_id)`, TTL 30 seconds
- Returns `SSETicketResponse(ticket=str(ticket_id))`
- Module-level constants: `SSE_TICKET_TTL_SECONDS = 30`, `SSE_TICKET_PREFIX = "sse-ticket"`

### Step 3: Rewrite SSE Auth Dependency

**File:** `backend/app/api/deps.py` (lines 96-107)

Rewrite `get_current_user_id_sse`:

- Remove `oauth2_scheme` from its parameter list
- Change query param from `token` (alias) to `ticket`
- Replace JWT decode with Redis `getdel()` on key `sse-ticket:{ticket}`
- Return `int(user_id_str)` on success
- Raise 401 for missing, expired, or already-consumed tickets
- Lazy-import `get_redis` inside function body (matches pattern in `cache.py:205`)

The `oauth2_scheme`, `_validate_token`, and other existing dependencies remain unchanged.

### Step 4: Update SSE Endpoint Docstring

**File:** `backend/app/api/routes/ats/progressive.py` (line 69)

Update the JavaScript example in the docstring to show ticket-based flow.

### Step 5: Frontend API Method

**File:** `frontend/src/lib/api/client.ts` (after `googleAuth`, ~line 341)

Add to `authApi`:

```typescript
sseTicket: (): Promise<{ ticket: string }> =>
  fetchApi("/api/auth/sse-ticket", { method: "POST" }),
```

Auth header is attached automatically by `fetchApi`.

### Step 6: Update Frontend SSE Hooks

**File:** `frontend/src/components/workshop/hooks/useATSProgressiveAnalysis.ts`

- Change import from `{ tokenManager }` to `{ authApi }` (line 4)
- Replace lines 223-227 with ticket exchange: `await authApi.sseTicket()` then `url.searchParams.set("ticket", ticket)`
- Wrap in try/catch dispatching `ATS_ANALYSIS_ERROR` on failure

**File:** `frontend/src/lib/api/hooks.ts`

- Change import from `tokenManager` to `authApi` (line 14)
- Replace lines 1169-1173 with ticket exchange
- Wrap in try/catch calling `store.setError()` on failure

## Security Properties

| Property | Mechanism |
| ----- | ----- |
| Token never in URL | JWT stays in Authorization header; only opaque UUID in query string |
| One-time use | `getdel()` atomically deletes on first read |
| Short-lived | 30-second Redis TTL; useless if logged |
| Replay-proof | Consumed ticket returns `None` from Redis |
| No new attack surface | Ticket endpoint requires valid JWT; no unauthenticated access |

## Edge Cases

- **Expired JWT when requesting ticket:** `fetchApi` auto-refreshes via refresh token. If both expired, user is redirected to login.
- **Ticket expires before EventSource connects:** 30-second TTL is generous; the gap between ticket request and EventSource creation is typically under 100ms.
- **Redis unavailability:** `get_redis()` raises `RuntimeError` surfacing as 500. Acceptable since Redis being down breaks caching and other features too.
- **Concurrent SSE connections:** Each gets its own ticket via separate POST calls. No shared-ticket issue.

## Verification

1. Start backend and frontend dev servers
2. Navigate to workshop, trigger ATS progressive analysis
3. Confirm SSE streams stages correctly (functional regression check)
4. Check browser Network tab: SSE URL shows `?ticket=<uuid>` not `?token=<jwt>`
5. Check backend logs: no JWT tokens in request URLs
6. Manually replay a ticket UUID: should get 401
