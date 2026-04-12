# DigitalOcean Hosting Setup

**Last Updated:** 2026-04-12
**Server:** Resume-Tailor (DigitalOcean Droplet)
**IP:** 188.166.180.93

---

## Architecture Overview

```text
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  DigitalOcean Droplet (Ubuntu 24.04, 1GB RAM, Singapore)    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Nginx (reverse proxy + SSL termination)            │    │
│  │  - Listens on :80 (redirects to HTTPS)              │    │
│  │  - Listens on :443 (SSL via Let's Encrypt)          │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │ proxy_pass 127.0.0.1:8000         │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Docker Compose (deploy/docker-compose.prod.yml)    │    │
│  │  ├─ resume-api container                            │    │
│  │  │   - ghcr.io/sungchunn/resume-builder-api:latest  │    │
│  │  │   - FastAPI / Uvicorn on 127.0.0.1:8000          │    │
│  │  │   - env_file: /home/deploy/app/deploy/.env       │    │
│  │  └─ resume-redis container                          │    │
│  │      - redis:7-alpine, 128mb, allkeys-lru           │    │
│  │      - appendonly yes, volume: redis_data           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────┐         ┌──────────┐         ┌──────────┐
    │ Supabase │         │  MongoDB │         │  OpenAI  │
    │ Postgres │         │  Atlas   │         │   API    │
    │ (remote) │         │ (remote) │         │ (remote) │
    └──────────┘         └──────────┘         └──────────┘
```

---

## Component Stack

| Layer | Technology | Managed By | Listens On |
| ----- | ---------- | ---------- | ---------- |
| Reverse Proxy | Nginx 1.x | systemd | 0.0.0.0:80, 0.0.0.0:443 |
| Container Runtime | Docker Engine + Compose v2 | systemd (`docker.service`) | N/A |
| API Container | `resume-api` (FastAPI, Uvicorn) | Docker Compose | 127.0.0.1:8000 |
| Cache Container | `resume-redis` (Redis 7) | Docker Compose | container DNS `redis:6379` |
| SSL Certificates | Let's Encrypt (Certbot) | cron (auto-renew) | N/A |

> **No Python / Poetry / pm2 on the droplet.** All build steps happen in GitHub Actions; the droplet only pulls pre-built images from GHCR.

---

## Directory Structure

```text
/home/deploy/app/                    # Git checkout (source of truth for deploy/.env)
├── .git/
├── backend/                         # Source tree (not executed on droplet)
│   └── Dockerfile                   # Built in CI, not on the droplet
├── frontend/                        # Source tree (deployed to Vercel, not used here)
├── deploy/
│   ├── docker-compose.prod.yml      # Production compose: api + redis
│   └── .env                         # Production secrets (gitignored, hand-seeded)
├── docs/
├── CLAUDE.md
└── README.md
```

**Key differences from local dev:**

- Secrets live at `deploy/.env`, **not** `backend/.env`. The image has no bundled `.env`; `docker-compose.prod.yml` injects it via `env_file:`.
- No `logs/`, `ecosystem.config.js`, Poetry virtualenv, or `.venv` on the droplet.
- `git pull` only updates `deploy/docker-compose.prod.yml`; the API code comes from the GHCR image.

---

## Services & How They Start

### 1. Nginx (Reverse Proxy)

**Managed by:** systemd
**Config location:** `/etc/nginx/sites-available/`

```bash
sudo systemctl status nginx
sudo systemctl reload nginx      # Reload config without downtime
sudo nginx -t                    # Test config before reload

sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

**What it does:**

- Terminates SSL (HTTPS) using Let's Encrypt certificates
- Redirects HTTP → HTTPS
- Proxies requests to the `resume-api` container on `127.0.0.1:8000`
- Adds security headers and 10MB upload limit

### 2. Docker Compose (API + Redis)

**Managed by:** Docker Engine (`docker.service`, systemd-managed)
**Config location:** `/home/deploy/app/deploy/docker-compose.prod.yml`

```bash
cd /home/deploy/app/deploy

# Status & logs
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs --tail 100 api
docker compose -f docker-compose.prod.yml logs redis

# Lifecycle
docker compose -f docker-compose.prod.yml pull api       # Fetch latest image from GHCR
docker compose -f docker-compose.prod.yml up -d api      # Recreate api container
docker compose -f docker-compose.prod.yml restart api    # Restart in place
docker compose -f docker-compose.prod.yml down           # Stop everything
docker compose -f docker-compose.prod.yml up -d          # Start everything

# Image housekeeping
docker image prune -f                                    # Remove dangling images
docker image ls ghcr.io/sungchunn/resume-builder-api     # List pinned tags
```

**What Compose provides:**

- Restart policy `unless-stopped` on both containers (survives reboot via Docker Engine)
- Healthchecks: API hits `/health`, Redis uses `redis-cli ping`
- `api` depends on `redis` being `service_healthy`
- JSON log rotation: 10MB × 3 files for api, 5MB × 2 for redis
- Redis data persists on a named volume (`redis_data`)

### 3. API Container (`resume-api`)

**Image:** `ghcr.io/sungchunn/resume-builder-api:latest`
**Built in:** `.github/workflows/cd.yml` (job `build-and-push`)
**Port binding:** `127.0.0.1:8000:8000` (only reachable via Nginx)

```bash
# Exec into the running container
docker exec -it resume-api sh

# Inspect environment
docker inspect resume-api --format '{{json .Config.Env}}'

# Container-only health check (same command Compose runs)
docker exec resume-api curl -fsS http://localhost:8000/health
```

Uvicorn is the entrypoint inside the image. Worker count and command-line args are baked into the Dockerfile; override via a compose `command:` block if needed.

### 4. Redis Container (`resume-redis`)

**Image:** `redis:7-alpine`
**Binding:** Container-internal only (`redis:6379` via Compose network). Not published to the host.

```bash
# CLI access
docker exec -it resume-redis redis-cli ping
docker exec -it resume-redis redis-cli DBSIZE
docker exec -it resume-redis redis-cli INFO memory
docker exec -it resume-redis redis-cli MONITOR
```

**Configuration (set via `command:` in compose):**

| Setting | Value | Purpose |
| ------- | ----- | ------- |
| `--appendonly` | `yes` | AOF persistence |
| `--maxmemory` | `128mb` | Fit the 1GB droplet |
| `--maxmemory-policy` | `allkeys-lru` | Evict LRU when full |

---

## Environment Variables

**Location:** `/home/deploy/app/deploy/.env`

This file is referenced by `docker-compose.prod.yml` via `env_file: .env` and injected into the `resume-api` container at start time. The image itself never contains secrets.

| Variable | Purpose | Example Value |
| -------- | ------- | ------------- |
| `DATABASE_URL` | PostgreSQL (Supabase) async connection | `postgresql+asyncpg://...` |
| `DATABASE_URL_SYNC` | Sync URL for Alembic migrations | `postgresql://...` |
| `MONGODB_URI` | MongoDB Atlas connection | `mongodb+srv://...` |
| `MONGODB_DATABASE` | MongoDB database name | `resume_tailor` |
| `REDIS_URL` | **`redis://redis:6379`** (container DNS, not `localhost`) | `redis://redis:6379` |
| `JWT_SECRET_KEY` | JWT signing secret | (keep secret) |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `30` |
| `AI_PROVIDER` | AI provider selection | `openai` or `gemini` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `OPENAI_MODEL` | OpenAI model | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | Embedding model | `text-embedding-3-small` |
| `GEMINI_API_KEY` | Gemini API key (if used) | (optional) |
| `GEMINI_MODEL` | Gemini model | `gemini-2.0-flash` |
| `CORS_ORIGINS` | Allowed origins | `https://re-zoo-me.com,...` |
| `ENVIRONMENT` | Environment name | `production` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `...apps.googleusercontent.com` |
| `GOOGLE_OAUTH_ENABLED` | Enable Google OAuth | `true` |
| `APIFY_API_TOKEN` | Apify scraper token | (keep secret) |
| `SCRAPER_ENABLED` | Enable job scraper | `true` |
| `ADMIN_EMAILS` | Admin user emails | `email@example.com` |

> **Critical:** `REDIS_URL` **must** use the container DNS name `redis`, not `localhost` or `127.0.0.1`. Inside the `resume-api` container, `localhost` resolves to the container itself, not the Redis service. A misconfigured `REDIS_URL` starts cleanly but every cache operation will fail at runtime.

---

## Production Docker Compose

**Location:** `/home/deploy/app/deploy/docker-compose.prod.yml`

```yaml
services:
  api:
    image: ghcr.io/sungchunn/resume-builder-api:latest
    container_name: resume-api
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:8000:8000"
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: resume-redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "128mb", "--maxmemory-policy", "allkeys-lru"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "2"

volumes:
  redis_data:
```

The file in the repo (`deploy/docker-compose.prod.yml`) is the source of truth — the droplet's copy is updated via `git pull` on every deploy.

---

## Nginx Configuration

**Location:** `/etc/nginx/sites-available/`

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name re-zoo-me.com;
    return 301 https://$host$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl;
    server_name re-zoo-me.com;

    ssl_certificate /etc/letsencrypt/live/re-zoo-me.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/re-zoo-me.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Fallback server (direct IP access)
server {
    listen 80;
    server_name _;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

The API port `127.0.0.1:8000` is the same regardless of whether the API is containerized or not, so Nginx config did not change during the Docker cutover.

---

## SSL Certificates (Let's Encrypt)

**Certificate location:** `/etc/letsencrypt/live/re-zoo-me.com/`
**Managed by:** Certbot with auto-renewal

```bash
sudo certbot certificates          # Check status
sudo certbot renew --dry-run       # Test renewal
sudo certbot renew --force-renewal # Force renewal
systemctl list-timers | grep certbot
```

---

## Deployment Process

Deployments are automated via GitHub Actions. Two workflows cover the backend:

- **`.github/workflows/ci.yml`** — runs on every PR touching `backend/**`. Lint (`ruff`) + full `pytest` suite against real Postgres 16 (pgvector) and MongoDB 7 service containers.
- **`.github/workflows/cd.yml`** — runs on push to `main` touching `backend/**`, `deploy/docker-compose.prod.yml`, or the workflow itself. Three sequential jobs:

### Trigger Scope

**Triggers a workflow run:**

| Path | Triggers | Why |
| ---- | -------- | --- |
| `backend/**` | `ci.yml` + `cd.yml` | App code, Dockerfile, Alembic migrations, tests, `pyproject.toml` — all live here |
| `deploy/docker-compose.prod.yml` | `cd.yml` only | Production compose changes (image tag, Redis flags, healthcheck tuning) |
| `.github/workflows/ci.yml` | `ci.yml` only | Workflow self-change |
| `.github/workflows/cd.yml` | `cd.yml` only | Workflow self-change |

Database migrations are not a separate trigger — they live at `backend/alembic/versions/`, which is already inside `backend/**`. Any migration change fires the normal `cd.yml` pipeline (build → migrate → deploy).

**Does NOT trigger either workflow:**

- `frontend/**` — handled entirely by Vercel's own GitHub integration, which watches `frontend/**` and redeploys independently on push/PR. Nothing in `.github/workflows/` touches the frontend.
- `docs/**`, `README.md`, `CLAUDE.md`, `scripts/**`
- Root `docker-compose.yml` (local-dev only)
- Any `.github/workflows/` file other than `ci.yml` / `cd.yml`

**Gotcha:** editing `deploy/docker-compose.prod.yml` alone (e.g., just bumping a Redis flag) triggers a full `cd.yml` run — image rebuild, migration, and redeploy. The rebuild uses whatever `backend/` currently is, so it's safe but potentially surprising if you only intended a compose-level tweak.

### Pipeline Jobs

**Job 1: `build-and-push`**

- Checks out the repo on a GHA runner
- Sets up Buildx, logs in to GHCR
- Builds `backend/Dockerfile` with GHA layer cache (`cache-from: type=gha, cache-to: type=gha,mode=max`)
- Pushes to `ghcr.io/sungchunn/resume-builder-api` tagged `:latest` and `:sha-<commit-sha>`

**Job 2: `migrate`** (depends on build-and-push)

- Logs in to GHCR from the runner
- `docker run --rm` the just-built image with production env vars injected (`PROD_DATABASE_URL`, `PROD_DATABASE_URL_SYNC`, `PROD_MONGODB_URI`, `PROD_JWT_SECRET_KEY`, `PROD_OPENAI_API_KEY`, `ENVIRONMENT=production`, `REDIS_URL=redis://localhost:6379` placeholder to satisfy settings import)
- Runs `alembic upgrade head` against Supabase directly from the runner. No droplet involvement.

**Job 3: `deploy`** (depends on migrate)

- SSHes to the droplet (`DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`)
- `cd /home/deploy/app && git fetch origin && git reset --hard origin/main` to pick up any `deploy/docker-compose.prod.yml` changes
- `docker login ghcr.io` with `GHCR_USERNAME` + `GHCR_PAT`
- `docker compose -f docker-compose.prod.yml pull api` → `up -d api`
- `docker image prune -f`
- 5-attempt `/health` check against `http://localhost:8000/health` with 3s backoff; fails loudly (with `docker compose logs --tail 50 api` and `ps` output) if any attempt returns non-200

**Required GitHub secrets:** `PROD_DATABASE_URL`, `PROD_DATABASE_URL_SYNC`, `PROD_MONGODB_URI`, `PROD_JWT_SECRET_KEY`, `PROD_OPENAI_API_KEY`, `GHCR_USERNAME`, `GHCR_PAT`, `DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`.

```bash
# Manual deployment on the droplet (rarely needed)
cd /home/deploy/app
git fetch origin && git reset --hard origin/main
cd deploy
echo "$GHCR_PAT" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
docker compose -f docker-compose.prod.yml pull api
docker compose -f docker-compose.prod.yml up -d api
docker image prune -f
curl -fsS http://localhost:8000/health
```

**Rollback:** edit `deploy/docker-compose.prod.yml` on the droplet to pin `image:` to a previous `sha-<commit>` tag, then `docker compose pull api && up -d api`. A `workflow_dispatch` one-click rollback is tracked as a follow-up in the feature master plan.

See `/docs/features/infrastructure/110426_docker-cicd-pipeline/` for phase-by-phase rationale and verification steps.

---

## Health Check

**Endpoint:** `GET /health`

```bash
# From inside the container
docker exec resume-api curl -fsS http://localhost:8000/health

# From the droplet host (via the published port)
curl http://localhost:8000/health

# External check
curl https://re-zoo-me.com/health
```

**Expected response:**

```json
{"status":"healthy","checks":{"postgres":"ok","mongodb":"ok"}}
```

---

## Log Locations

| Log | Location / Command |
| --- | ------------------ |
| FastAPI stdout + stderr | `docker compose -f /home/deploy/app/deploy/docker-compose.prod.yml logs -f api` |
| FastAPI rotated JSON logs | `/var/lib/docker/containers/<container-id>/*-json.log` (Docker-managed, rotated) |
| Redis | `docker compose -f /home/deploy/app/deploy/docker-compose.prod.yml logs -f redis` |
| Nginx access | `/var/log/nginx/access.log` — `sudo tail -f /var/log/nginx/access.log` |
| Nginx error | `/var/log/nginx/error.log` — `sudo tail -f /var/log/nginx/error.log` |
| System | `/var/log/syslog` — `sudo tail -f /var/log/syslog` |
| Docker daemon | `sudo journalctl -u docker.service -f` |

---

## Quick Reference Commands

```bash
# Application (run from /home/deploy/app/deploy)
docker compose -f docker-compose.prod.yml ps             # Status
docker compose -f docker-compose.prod.yml logs -f api    # Stream logs
docker compose -f docker-compose.prod.yml restart api    # Restart container
docker compose -f docker-compose.prod.yml pull api && \
  docker compose -f docker-compose.prod.yml up -d api    # Pull latest image and recreate
curl http://localhost:8000/health                        # Health check

# Nginx
sudo systemctl status nginx
sudo nginx -t && sudo systemctl reload nginx

# Redis (inside the container)
docker exec -it resume-redis redis-cli ping
docker exec -it resume-redis redis-cli INFO memory

# SSL
sudo certbot certificates
sudo certbot renew --dry-run

# Migrations (normally run automatically in cd.yml; manual run from laptop)
docker run --rm \
  -e DATABASE_URL="$PROD_DATABASE_URL" \
  -e DATABASE_URL_SYNC="$PROD_DATABASE_URL_SYNC" \
  -e MONGODB_URI="$PROD_MONGODB_URI" \
  -e JWT_SECRET_KEY="$PROD_JWT_SECRET_KEY" \
  -e OPENAI_API_KEY="$PROD_OPENAI_API_KEY" \
  -e REDIS_URL='redis://localhost:6379' \
  -e ENVIRONMENT='production' \
  ghcr.io/sungchunn/resume-builder-api:latest \
  alembic upgrade head

# System
htop
df -h
free -m
docker system df                                         # Docker disk usage
```

---

## External Services

| Service | Purpose | Dashboard |
| ------- | ------- | --------- |
| Supabase | PostgreSQL database | <https://supabase.com/dashboard> |
| MongoDB Atlas | Document database | <https://cloud.mongodb.com> |
| Vercel | Frontend hosting | <https://vercel.com/dashboard> |
| DigitalOcean | Droplet hosting | <https://cloud.digitalocean.com> |
| GHCR | Container registry for `resume-builder-api` | <https://github.com/Sungchunn?tab=packages> |
| OpenAI | AI API | <https://platform.openai.com> |
| Apify | Job scraping | <https://console.apify.com> |
| Let's Encrypt | SSL certificates | (auto-managed) |

---

## Troubleshooting

### Backend not responding

```bash
cd /home/deploy/app/deploy
docker compose -f docker-compose.prod.yml ps                    # Is api (healthy)?
docker compose -f docker-compose.prod.yml logs --tail 100 api   # Recent errors
docker compose -f docker-compose.prod.yml restart api
```

### 502 Bad Gateway

```bash
docker compose -f /home/deploy/app/deploy/docker-compose.prod.yml ps
curl http://localhost:8000/health   # Direct check, bypassing Nginx

sudo nginx -t
sudo systemctl reload nginx
```

### Cache errors / Redis connection refused from the API

Almost always a `REDIS_URL` misconfiguration. Inside the `resume-api` container, Redis is reachable at `redis://redis:6379`, **not** `localhost`.

```bash
# Verify what the container sees
docker exec resume-api printenv REDIS_URL

# Verify the redis container is up and healthy
docker compose -f /home/deploy/app/deploy/docker-compose.prod.yml ps redis
docker exec resume-redis redis-cli ping
```

Fix by editing `/home/deploy/app/deploy/.env`, then `docker compose up -d api` to recreate with the new env.

### SSL certificate expired

```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Image won't pull (GHCR auth)

```bash
# Re-login with the PAT stored in the GHA secret GHCR_PAT
echo "$GHCR_PAT" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
docker compose -f /home/deploy/app/deploy/docker-compose.prod.yml pull api
```

### Out of memory

```bash
free -m
docker stats --no-stream           # Per-container memory
# Consider upgrading droplet, reducing Uvicorn workers, or lowering redis maxmemory
```

### Rollback to a previous image

```bash
cd /home/deploy/app/deploy
# Edit docker-compose.prod.yml: change image tag from :latest to :sha-<previous-commit>
docker compose -f docker-compose.prod.yml pull api
docker compose -f docker-compose.prod.yml up -d api
curl -fsS http://localhost:8000/health
```
