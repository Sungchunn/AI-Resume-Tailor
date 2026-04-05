# Google OAuth Integration

## Overview

Add "Sign in with Google" to enable one-click authentication. Uses a **frontend-driven OAuth flow** where Google's React library handles the popup, sends an ID token to the backend for verification, and returns JWT tokens.

**Complexity:** Moderate - well-understood pattern, clean integration with existing auth.

## Architecture Decision

**Frontend-driven flow** (recommended over backend-driven):

- Simpler - no backend redirects/callbacks
- Better UX - popup keeps users on same page
- Matches existing JWT pattern - frontend stores tokens
- Google's recommended approach for SPAs

## Implementation Phases

### Phase 1: Database Schema

**Migration:** Add OAuth fields to `users` table

| Column | Type | Notes |
| ------ | ---- | ----- |
| `auth_provider` | `VARCHAR(20)` | "email" or "google", default "email" |
| `google_id` | `VARCHAR(255)` | Unique, nullable, indexed |
| `google_linked_at` | `TIMESTAMP` | Nullable |
| `hashed_password` | - | Change to nullable (for Google-only users) |

**Files:**

- `/backend/app/models/user.py` - Add columns
- `/backend/alembic/versions/XXXXXX_add_google_oauth.py` - New migration

### Phase 2: Backend Service and Endpoint

**Add dependency:**

```bash
poetry add google-auth
```

**New service:** `/backend/app/services/google_oauth.py`

- Verify Google ID tokens using `google.oauth2.id_token`
- Extract user info (email, name, google_id)

**New endpoint:** `POST /api/auth/google`

- Verify ID token from frontend
- Find or create user by google_id or email
- Handle account linking (email user adds Google)
- Return JWT access/refresh tokens

**Account linking logic:**

| Scenario | Action |
| -------- | ------ |
| New Google user | Create user with auth_provider="google" |
| Returning Google user | Return existing user's tokens |
| Email exists, no Google linked | Link Google to existing account |

**Files:**

- `/backend/app/services/google_oauth.py` - New
- `/backend/app/api/routes/auth.py` - Add endpoint
- `/backend/app/schemas/user.py` - Add GoogleAuthRequest/Response
- `/backend/app/core/config.py` - Add google_client_id setting
- `/backend/.env.example` - Add GOOGLE_CLIENT_ID

### Phase 3: Frontend Integration

**Add dependency:**

```bash
bun add @react-oauth/google
```

**Provider setup in layout:**

```tsx
// /frontend/src/app/layout.tsx
import { GoogleOAuthProvider } from '@react-oauth/google';

<GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
  <ThemeProvider>
    ...
  </ThemeProvider>
</GoogleOAuthProvider>
```

**New component:** `/frontend/src/components/auth/GoogleSignInButton.tsx`

- Uses `<GoogleLogin />` from @react-oauth/google
- Calls `loginWithGoogle()` in AuthContext

**Update login/signup pages:**

- Add divider: "Or continue with"
- Add GoogleSignInButton component

**Files:**

- `/frontend/src/app/layout.tsx` - Wrap with GoogleOAuthProvider
- `/frontend/src/components/auth/GoogleSignInButton.tsx` - New
- `/frontend/src/contexts/AuthContext.tsx` - Add `loginWithGoogle` method
- `/frontend/src/lib/api/client.ts` - Add `authApi.googleAuth()`
- `/frontend/src/app/(auth)/login/page.tsx` - Add Google button
- `/frontend/src/app/(auth)/signup/page.tsx` - Add Google button
- `/frontend/.env.example` - Add NEXT_PUBLIC_GOOGLE_CLIENT_ID

## Environment Variables

**Backend `.env`:**

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**Frontend `.env.local`:**

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Google Cloud Console Setup (Manual)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select project
3. APIs & Services > Credentials > Create OAuth client ID
4. Configure consent screen (External, email + profile scopes)
5. Create Web application client:
   - Authorized JS origins: `http://localhost:3000`, `https://your-domain.com`
6. Copy Client ID (no secret needed for frontend-only flow)

## Verification

1. **Manual testing:**
   - New user signs up with Google
   - Existing Google user logs in
   - Email user links Google account
   - Google-only user cannot use password login

2. **Backend tests:**

   ```bash
   cd backend && poetry run pytest tests/test_auth.py -v
   ```

3. **Frontend smoke test:**
   - Login page shows Google button
   - Popup opens and authenticates
   - Redirects to /jobs after success

## Files Summary

**New files (4):**

- `/backend/app/services/google_oauth.py`
- `/backend/alembic/versions/XXXXXX_add_google_oauth.py`
- `/frontend/src/components/auth/GoogleSignInButton.tsx`

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
