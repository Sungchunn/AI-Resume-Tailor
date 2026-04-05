# Fix CORS Error for Production Upload Endpoint

## Problem

Resume upload at `/profile` fails with:

```text
Access to XMLHttpRequest at 'https://api.re-zoo-me.com/api/upload/extract'
from origin 'https://www.re-zoo-me.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause

The backend's CORS configuration in production does not include the production frontend origin `https://www.re-zoo-me.com`.

**CORS middleware** (`backend/app/main.py:148-154`):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # ← Reads from CORS_ORIGINS env var
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
```

**Configuration** (`backend/app/core/config.py:147`):

```python
cors_origins: list[str] = ["http://localhost:3000"]  # Default only
```

The `CORS_ORIGINS` environment variable in the **production deployment** is either:

1. Not set (falling back to localhost only)
2. Missing `https://www.re-zoo-me.com`

## Solution

Update the `CORS_ORIGINS` environment variable in your **production backend deployment** to include the production frontend origins.

### Required Value

```text
CORS_ORIGINS=https://www.re-zoo-me.com,https://re-zoo-me.com
```

This supports both `www` and non-`www` versions of your domain.

## Implementation Steps

### Step 1: Update Environment Variable

Add/update the `CORS_ORIGINS` environment variable in your deployment platform:

| Variable | Value |
| -------- | ----- |
| `CORS_ORIGINS` | `https://www.re-zoo-me.com,https://re-zoo-me.com` |

**Platform-specific instructions:**

**AWS ECS / Fargate:**

- Update task definition → Container definitions → Environment variables
- Add `CORS_ORIGINS` with value `https://www.re-zoo-me.com,https://re-zoo-me.com`
- Create new revision and update service

**AWS EC2 / Docker:**

- Update your `.env` file or docker-compose environment section
- Restart the container/service

**DigitalOcean App Platform:**

- Go to App → Settings → App-Level Environment Variables
- Add `CORS_ORIGINS` = `https://www.re-zoo-me.com,https://re-zoo-me.com`
- Deploy the change

**Docker Compose (any host):**

```yaml
services:
  backend:
    environment:
      - CORS_ORIGINS=https://www.re-zoo-me.com,https://re-zoo-me.com
```

### Step 2: Redeploy Backend

Trigger a redeploy of the backend service so it picks up the new environment variable.

### Step 3: Verify Fix

1. Visit `https://www.re-zoo-me.com/profile`
2. Attempt to upload a resume
3. Verify the upload succeeds without CORS errors

## No Code Changes Required

This is purely a **deployment configuration** issue. The backend code already supports comma-separated origins in the `CORS_ORIGINS` environment variable (`backend/app/core/config.py:9-24`).

## Verification

After updating the environment variable and redeploying:

1. **Browser Test:** Upload a resume at `/profile` - should work without CORS errors
2. **cURL Test (optional):**

   ```bash
   curl -I -X OPTIONS https://api.re-zoo-me.com/api/upload/extract \
     -H "Origin: https://www.re-zoo-me.com" \
     -H "Access-Control-Request-Method: POST"
   ```

   Should return:

   ```text
   Access-Control-Allow-Origin: https://www.re-zoo-me.com
   Access-Control-Allow-Credentials: true
   ```
