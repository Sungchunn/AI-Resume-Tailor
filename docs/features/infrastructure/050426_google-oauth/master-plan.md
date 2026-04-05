# Google OAuth Integration

## Overview

Add "Sign in with Google" to enable one-click authentication. Uses a **frontend-driven OAuth flow** where Google's React library handles the popup, sends an ID token to the backend for verification, and returns JWT tokens.

**Complexity:** Moderate - well-understood pattern, clean integration with existing auth.

## Architecture Decision

**Frontend-driven flow** (recommended over backend-driven):

| Aspect | Frontend-Driven | Backend-Driven |
| ------ | --------------- | -------------- |
| UX | Popup stays on page | Redirect away and back |
| Complexity | Simpler | Requires callback routes |
| Token handling | Matches existing JWT pattern | Same |
| Google recommendation | Preferred for SPAs | Legacy approach |

## Implementation Phases

| Phase | Description | Doc |
| ----- | ----------- | --- |
| 1 | Database schema changes | [phase-1-database.md](phase-1-database.md) |
| 2 | Backend service and endpoint | [phase-2-backend.md](phase-2-backend.md) |
| 3 | Frontend integration | [phase-3-frontend.md](phase-3-frontend.md) |

## Prerequisites

Before implementation, configure Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services > Credentials**
4. Configure OAuth consent screen:
   - User type: External
   - App name: "AI Resume Tailor"
   - Scopes: `email`, `profile`, `openid`
5. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:3000` (dev)
     - `https://your-domain.com` (prod)
6. Copy the **Client ID** (no secret needed for frontend-only flow)

## Environment Variables

**Backend `.env`:**

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**Frontend `.env.local`:**

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Files Summary

**New files (4):**

- `/backend/app/services/google_oauth.py` - Token verification service
- `/backend/alembic/versions/XXXXXX_add_google_oauth.py` - Database migration
- `/frontend/src/components/auth/GoogleSignInButton.tsx` - Google button component

**Modified files (10):**

- `/backend/app/models/user.py`
- `/backend/app/schemas/user.py`
- `/backend/app/api/routes/auth.py`
- `/backend/app/core/config.py`
- `/backend/.env.example`
- `/frontend/src/app/layout.tsx`
- `/frontend/src/contexts/AuthContext.tsx`
- `/frontend/src/lib/api/client.ts`
- `/frontend/src/app/(auth)/login/page.tsx`
- `/frontend/src/app/(auth)/signup/page.tsx`

## Verification

**Manual test cases:**

1. New user signs up with Google -> creates account, redirects to /jobs
2. Existing Google user logs in -> authenticates, redirects to /jobs
3. Email user clicks Google with same email -> links accounts
4. Google-only user tries password login -> error message
5. Invalid/expired Google token -> 401 error

**Automated tests:**

```bash
# Backend unit tests
cd backend && poetry run pytest tests/test_auth.py -v

# Frontend E2E (if mocking Google)
cd frontend && bun run test:e2e e2e/auth/
```
