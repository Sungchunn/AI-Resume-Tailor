# Fix Production Database Connection Config

## Context

Supabase dashboard shows a slow internal role-settings query accumulating ~41.9s across thousands of calls. The backend's connection pooling setup is already well-configured (NullPool + port 6543 + disabled prepared statements), but two `.env` config issues were found during audit.

Additionally, env vars are currently managed manually in three independent locations (local `.env`, GitHub Secrets, droplet `.env`). This plan consolidates the droplet `.env` to be auto-generated from GitHub Secrets during deployment.

## Changes

### 1. Add `prepared_statement_cache_size=0` to `DATABASE_URL`

- **What:** Append `?prepared_statement_cache_size=0` to the async DATABASE_URL
- **Why:** Belt-and-suspenders with the `connect_args` in `session.py` — ensures asyncpg doesn't cache prepared statements even if connect_args are bypassed

### 2. Switch `DATABASE_URL_SYNC` to direct connection (port 5432)

- **What:** Change from pooler host (`pooler.supabase.com:6543`) to direct host (`db.supabase.co:5432`)
- **Why:** DDL operations in Alembic migrations can interact poorly with PgBouncer's transaction pooling mode

### 3. Consolidate env var management — pipeline-managed `.env`

- **What:** Modify the deploy job in `.github/workflows/cd.yml` to write `/home/deploy/app/deploy/.env` from GitHub Secrets before restarting the container
- **Why:** Eliminates manual SSH for secret rotation. GitHub Secrets becomes the single source of truth for production env vars. Local `.env` remains separate (expected — different values for dev).

## Where to Apply

After this change, env vars are managed in **two** locations instead of three:

| Location | Path | Used By |
| -------- | ---- | ------- |
| Local dev | `backend/.env` | Local development (manual, different values) |
| GitHub Actions Secrets | Repo Settings > Secrets > Actions | Both migration job AND droplet `.env` (auto-generated) |

## Steps

### Step 1: Update local `backend/.env`

Update both `DATABASE_URL` and `DATABASE_URL_SYNC` directly in the file.

### Step 2: Update GitHub Actions Secrets

Go to **GitHub > Repo Settings > Secrets and variables > Actions** and update:

- `PROD_DATABASE_URL` — add `?prepared_statement_cache_size=0`
- `PROD_DATABASE_URL_SYNC` — switch host to `db.<project-ref>.supabase.co:5432`

### Step 3: Add new GitHub Secrets for all production env vars

The deploy job needs every env var that `deploy/.env` currently contains. Add these secrets if they don't already exist:

| Secret Name | Value | Notes |
| ----------- | ----- | ----- |
| `PROD_DATABASE_URL` | `postgresql+asyncpg://...?prepared_statement_cache_size=0` | Already exists, update value |
| `PROD_DATABASE_URL_SYNC` | `postgresql://...@db.<ref>.supabase.co:5432/postgres` | Already exists, update value |
| `PROD_MONGODB_URI` | `mongodb+srv://...` | Already exists |
| `PROD_MONGODB_DATABASE` | `resume_tailor` | New |
| `PROD_JWT_SECRET_KEY` | (secret) | Already exists |
| `PROD_OPENAI_API_KEY` | (secret) | Already exists |
| `PROD_AI_PROVIDER` | `openai` | New |
| `PROD_CORS_ORIGINS` | `https://re-zoo-me.com` | New |
| `PROD_ADMIN_EMAILS` | `sungchun.hua@gmail.com` | New |
| `PROD_APIFY_API_TOKEN` | (secret) | New |
| `PROD_GOOGLE_CLIENT_ID` | (client id) | New |
| `PROD_GOOGLE_OAUTH_ENABLED` | `true` or `false` | New |

### Step 4: Modify `.github/workflows/cd.yml` deploy job

In the deploy job's SSH script (`cd.yml` lines 106-173), add a step **before** `docker compose up` that writes the `.env` file from GitHub Secrets.

**Current flow (lines 106-118):**

```yaml
script: |
  set -euo pipefail
  cd /home/deploy/app
  git fetch origin
  git reset --hard origin/main

  cd deploy
  echo '${{ secrets.GHCR_PAT }}' | docker login ghcr.io \
    -u '${{ secrets.GHCR_USERNAME }}' --password-stdin

  docker compose -f docker-compose.prod.yml pull api
  docker compose -f docker-compose.prod.yml up -d api
```

**Updated flow — insert `.env` generation between `docker login` and `docker compose pull`:**

```yaml
script: |
  set -euo pipefail
  cd /home/deploy/app
  git fetch origin
  git reset --hard origin/main

  cd deploy
  echo '${{ secrets.GHCR_PAT }}' | docker login ghcr.io \
    -u '${{ secrets.GHCR_USERNAME }}' --password-stdin

  # Generate .env from GitHub Secrets (single source of truth)
  cat > .env << 'ENVEOF'
  DATABASE_URL=${{ secrets.PROD_DATABASE_URL }}
  DATABASE_URL_SYNC=${{ secrets.PROD_DATABASE_URL_SYNC }}
  MONGODB_URI=${{ secrets.PROD_MONGODB_URI }}
  MONGODB_DATABASE=${{ secrets.PROD_MONGODB_DATABASE }}
  REDIS_URL=redis://redis:6379
  JWT_SECRET_KEY=${{ secrets.PROD_JWT_SECRET_KEY }}
  JWT_ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=30
  AI_PROVIDER=${{ secrets.PROD_AI_PROVIDER }}
  OPENAI_API_KEY=${{ secrets.PROD_OPENAI_API_KEY }}
  ENVIRONMENT=production
  CORS_ORIGINS=${{ secrets.PROD_CORS_ORIGINS }}
  TRUST_PROXY=true
  ADMIN_EMAILS=${{ secrets.PROD_ADMIN_EMAILS }}
  APIFY_API_TOKEN=${{ secrets.PROD_APIFY_API_TOKEN }}
  APIFY_ACTOR_ID=hKByXkMQaC5Qt9UMN
  APIFY_TIMEOUT_SECONDS=300
  APIFY_MAX_RETRIES=3
  APIFY_MEMORY_MBYTES=1024
  SCRAPER_SCHEDULE_HOUR=6
  SCRAPER_SCHEDULE_MINUTE=0
  SCRAPER_ENABLED=true
  JOB_RETENTION_DAYS=21
  JOB_CLEANUP_ENABLED=true
  GOOGLE_CLIENT_ID=${{ secrets.PROD_GOOGLE_CLIENT_ID }}
  GOOGLE_OAUTH_ENABLED=${{ secrets.PROD_GOOGLE_OAUTH_ENABLED }}
  STORAGE_ENABLED=false
  ENVEOF
  chmod 600 .env

  docker compose -f docker-compose.prod.yml pull api
  docker compose -f docker-compose.prod.yml up -d api
  docker image prune -f

  # ... health check continues unchanged ...
```

**Key details:**

- `REDIS_URL=redis://redis:6379` — hardcoded to container DNS name (never changes)
- `chmod 600 .env` — restricts file to owner-only read/write
- Non-sensitive values (`JWT_ALGORITHM`, `APIFY_ACTOR_ID`, etc.) are hardcoded inline since they don't vary
- Secrets are injected via `${{ secrets.* }}` which GitHub masks in logs

### Step 5: Trigger path update

The CD workflow only triggers on changes to `backend/**`, `deploy/docker-compose.prod.yml`, or `.github/workflows/cd.yml` (line 6-9). Since we're modifying `cd.yml`, the next push to `main` with this change will trigger the pipeline automatically.

## Files Modified

| File | Change |
| ---- | ------ |
| `backend/.env` | Add query param to `DATABASE_URL`, switch `DATABASE_URL_SYNC` to port 5432 |
| `.github/workflows/cd.yml` | Add `.env` generation step in deploy job (lines ~115, before `docker compose pull`) |

## Verification

- **Local:** Run `poetry run alembic current` to verify sync URL connects
- **CI/CD:** Push to `main`, confirm all three jobs pass (build, migrate, deploy)
- **Droplet:** After deploy completes, SSH in and verify:
  - `cat /home/deploy/app/deploy/.env` shows correct values
  - `docker logs resume-api --tail 20` shows healthy startup
- **Supabase:** Monitor query performance dashboard for changes in role-settings query frequency/timing
- **Future secret rotation:** Update GitHub Secret, push any backend change (or re-run workflow manually) — no SSH needed



