# Phase 1 — Multi-Stage Dockerfile + Production Compose

**Parent:** [master-plan.md](./master-plan.md)
**Status:** Implemented (commit `7ddfbd4`)
**Goal:** Produce a reproducible, slim backend image and a droplet compose file that owns both `api` and `redis` without touching CI.

---

## Objective

Replace the current single-stage `backend/Dockerfile` with a multi-stage build that separates compile-time toolchain from runtime libraries, keeps production secrets out of the image, and exposes a healthcheck-backed process suitable for `docker compose`. Ship a parallel `deploy/docker-compose.prod.yml` that the droplet will run after Phase 5 cutover.

No CI changes, no secrets changes, no droplet changes in this phase — all work is local and reviewable from a laptop.

---

## Why this phase first

Every other phase depends on a working image:

- Phase 2 hardens the tests, but those tests still run on the host — the real gain only materialises when CI points at the image-built artifact.
- Phases 3 and 4 assume the image exists at a predictable tag.
- Phase 5 assumes the compose file is already checked into the repo before the droplet pulls it.

Landing Phase 1 in isolation also lets us catch the two highest-risk gotchas from the master-plan (WeasyPrint runtime libs, `.env` leakage) on a laptop, not on a live droplet.

---

## Prerequisites

- Local Docker Engine ≥ 24 and Compose plugin ≥ 2.20.
- Read/write access to `backend/` and `deploy/` directories.
- A populated `backend/.env` for the local smoke test (never committed).
- `backend/pyproject.toml` + `backend/poetry.lock` in sync — if not, run `poetry lock --no-update` first; otherwise `poetry export` in the builder stage will fail silently and install stale pins.

---

## Implementation

### 1.1 Rewrite `backend/Dockerfile`

**Current state:** single-stage, `python:3.11-slim`, installs `gcc` + `curl` only, `COPY . .` grabs everything including `.env`, no non-root user, no healthcheck. Missing WeasyPrint runtime libs — PDF export is currently only functional because the droplet has system pango/cairo installed outside Docker.

**Target state:**

```dockerfile
# =============================================================================
# Stage 1: builder
# -----------------------------------------------------------------------------
# Compiles wheels in an environment that has gcc, libpq-dev, and the rest of
# the build toolchain. Nothing from this stage ships to production.
# =============================================================================
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.8.2 \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /build

# Build-time system deps. asyncpg/psycopg2 need libpq-dev + gcc to compile.
# WeasyPrint wheels are pre-built, so no pango/cairo needed in this stage.
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        build-essential \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install "poetry==${POETRY_VERSION}"

COPY pyproject.toml poetry.lock ./

# Export a frozen requirements.txt (production deps only), then build wheels
# into /wheels. Using `pip wheel` instead of `pip install` means the runtime
# stage can pip-install from the wheel cache with --no-index, which strips
# the network dependency and keeps the runtime layer deterministic.
RUN poetry export \
        --only main \
        --without-hashes \
        -f requirements.txt \
        -o requirements.txt \
 && pip wheel \
        --wheel-dir=/wheels \
        --no-cache-dir \
        -r requirements.txt


# =============================================================================
# Stage 2: runtime
# -----------------------------------------------------------------------------
# Fresh slim base. No compilers. Only the shared libraries the app actually
# needs at runtime: libpq5 (asyncpg), the pango/cairo stack (WeasyPrint PDF
# export), fonts (WeasyPrint text rendering), and curl (healthcheck).
# =============================================================================
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/home/app/.local/bin:${PATH}"

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        libpq5 \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi8 \
        shared-mime-info \
        fonts-dejavu-core \
        fonts-liberation \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user — the app should never run as root inside the container.
RUN groupadd --system app \
 && useradd --system --gid app --home /home/app --create-home app

WORKDIR /app

# Install wheels built in stage 1. --no-index guarantees no network call.
COPY --from=builder /wheels /wheels
COPY --from=builder /build/requirements.txt /tmp/requirements.txt
RUN pip install --no-index --find-links=/wheels -r /tmp/requirements.txt \
 && rm -rf /wheels /tmp/requirements.txt

# Explicit copies (NOT `COPY . .`) so .env, tests/, docs/, .git/, .venv/
# can never sneak into the image even if .dockerignore is edited.
COPY --chown=app:app app ./app
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app alembic.ini ./
COPY --chown=app:app pyproject.toml ./

USER app

EXPOSE 8000

# Container-local healthcheck. Compose and `docker ps` both surface this.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Rationale notes (do not inline as comments in the file):**

- **`libpq-dev` vs `libpq5`** — `-dev` ships headers + `.a` files needed by `pip wheel` for psycopg2; `libpq5` is just the shared library loaded at runtime. Splitting them saves ~40 MB in the final image.
- **WeasyPrint stack** — `libpango-1.0-0`, `libpangoft2-1.0-0`, `libcairo2`, `libgdk-pixbuf-2.0-0`, and `fonts-dejavu-core` are the minimum set WeasyPrint dlopens at runtime. Leaving any of these out silently breaks `/api/resumes/{id}/export?format=pdf`. Fonts are mandatory — without them WeasyPrint renders empty glyph boxes.
- **`libffi8`** — required by cffi, which WeasyPrint and cryptography both depend on. On Debian bookworm the package is `libffi8`, not `libffi7`.
- **Explicit `COPY` lines** — deliberately refuses to mirror the current `COPY . .`. If `alembic.ini` moves, the build fails loudly rather than silently copying a stale copy from a sibling directory.
- **Non-root `app` user** — Poetry/pip already ran as root in stage 1, so runtime ownership is set at copy time via `--chown`. Running FastAPI as UID 0 is a gratuitous privilege-escalation surface on a shared droplet.
- **`HEALTHCHECK` in the image** — not strictly required (compose defines its own), but makes `docker ps` usable when debugging without compose and lets `docker run` alone surface a degraded process.

### 1.2 Create `backend/.dockerignore`

**Purpose:** prevent secrets (`.env`), local caches, and irrelevant files from entering the build context. Without this, `COPY app ./app` still works but the *build context* ballooning from ~10 MB to >500 MB makes every build slow and pins a cache layer on the contents of `.git/`.

```text
# Secrets — never ship
.env
.env.*
!.env.example

# Python build artifacts
__pycache__/
*.pyc
*.pyo
*.pyd

# Virtualenvs and tool caches
.venv/
venv/
.pytest_cache/
.ruff_cache/
.mypy_cache/
.coverage
htmlcov/

# Tests and docs are not needed in the runtime image
tests/
docs/
*.md
README.md

# Archived migrations (kept on disk for history, not needed in prod)
alembic/versions_archived/

# VCS
.git/
.gitignore

# Docker meta
Dockerfile
.dockerignore
docker-compose*.yml
```

**Why `!.env.example` is re-included:** future refactors may want the example file inside the image for a `make bootstrap` helper; cost is ~1 KB. Drop the line if that turns out to be speculative.

### 1.3 Create `deploy/docker-compose.prod.yml`

**Purpose:** the droplet runs this and only this. Nothing in the root-level `docker-compose.yml` should change — that file is local-dev only and continues to define `postgres`, `mongodb`, `minio` for laptop use.

```yaml
services:
  api:
    image: ghcr.io/sungchunn/resume-builder-api:latest
    container_name: resume-api
    restart: unless-stopped
    env_file: .env
    ports:
      # Bind to loopback only — nginx on the droplet reverse-proxies.
      # Public traffic never touches 8000 directly.
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

**Design decisions:**

- **`127.0.0.1:8000:8000`** — explicit loopback bind. The droplet's existing nginx already proxies `/` → `127.0.0.1:8000`, so this is a drop-in replacement for the current pm2 process. Do NOT use `8000:8000` (public) — Cloudflare would still work but every droplet port scan would discover the direct API.
- **`env_file: .env`** — file lives at `/home/deploy/app/deploy/.env` on the droplet (Phase 5 creates it). The `.env` is never copied into the image; it's mounted at runtime. This is the single biggest safety improvement over the current `git reset --hard` + pm2 flow.
- **`depends_on.redis.condition: service_healthy`** — on cold start, `api` waits until `redis-cli ping` succeeds. Prevents a race where the app tries to connect before Redis is ready and crashes on startup.
- **`start_period: 40s`** — the FastAPI boot sequence on a 1 GB droplet takes ~15–25 s cold (pydantic-settings validation, ORM import, scheduled-job wiring). 40 s absorbs that plus one retry of the healthcheck before the container is marked unhealthy.
- **Redis `--maxmemory 128mb` + `allkeys-lru`** — bounded memory on a 1 GB droplet is non-negotiable. LRU eviction matches how the scraper + cache layer already treat Redis.
- **JSON logging rotation** — 3 × 10 MB for the API, 2 × 5 MB for Redis. Without this, `docker logs` grows unbounded and fills the droplet disk in weeks.

**Critical `.env` gotcha:** the droplet's `.env` **must** set `REDIS_URL=redis://redis:6379`, not `redis://localhost:6379`. Inside the compose network the hostname is the service name, not `localhost`. Phase 5 documents this; repeating it here because the most common failure mode is a compose up that "looks green" until the first cache hit returns a connection error.

### 1.4 Local smoke test

Before committing, verify the image actually boots:

```bash
cd backend

# Build
docker build -t resume-api:phase1-local .

# Image size budget — should be < 500 MB
docker image ls resume-api:phase1-local

# Non-root user check — should print "app"
docker run --rm resume-api:phase1-local whoami

# Run with the real local .env on port 8001 (avoid clashing with dev server)
docker run --rm \
  --env-file .env \
  -p 8001:8000 \
  resume-api:phase1-local &
CONTAINER_PID=$!

# Give uvicorn 20 s to import everything
sleep 20

curl -fsS http://localhost:8001/health | jq .

# WeasyPrint smoke — generate a trivial PDF from inside the container
docker exec "$(docker ps -qf ancestor=resume-api:phase1-local)" \
  python -c "
from weasyprint import HTML
HTML(string='<h1>smoke</h1>').write_pdf('/tmp/smoke.pdf')
print('OK')
"

kill $CONTAINER_PID
```

If `weasyprint` raises `OSError: cannot load library 'libpango-1.0'`, a runtime library is missing — audit `apt-get install` list in stage 2.

---

## Verification

| Check | Command | Expected |
| ----- | ------- | -------- |
| Image builds cleanly | `docker build -t resume-api:phase1-local backend/` | Exit 0, layers cached on rebuild |
| Final size reasonable | `docker image ls resume-api:phase1-local` | < 500 MB |
| Non-root user | `docker run --rm resume-api:phase1-local whoami` | `app` |
| `.env` not baked in | `docker run --rm resume-api:phase1-local ls -la /app \| grep -i env \|\| echo clean` | `clean` |
| `alembic.ini` + `alembic/` present | `docker run --rm resume-api:phase1-local ls /app` | shows `alembic`, `alembic.ini` |
| `/health` responds | `docker run --env-file backend/.env -p 8001:8000 ...` then `curl /health` | HTTP 200 |
| WeasyPrint works | `docker exec ... python -c "from weasyprint import HTML; ..."` | `OK` |
| Compose file parses | `docker compose -f deploy/docker-compose.prod.yml config` | YAML echoed, exit 0 |

---

## Edge cases and gotchas

1. **`alembic.ini` must be copied explicitly.** The old `COPY . .` grabbed it by accident. Explicit copy means any rename will fail the build loudly — which is better than silently shipping an image without migration config.
2. **`.env` re-introduction.** If someone later adds `COPY . .` back "for convenience", the `.dockerignore` blocks `.env` but not `.env.override` or `.env.prod`. The ignore list intentionally uses `.env.*` wildcard to close that hole.
3. **`poetry.lock` drift.** If `pyproject.toml` changes without `poetry.lock` being re-generated, `poetry export` inside stage 1 still succeeds but pins old versions. Always run `poetry lock --no-update` locally before a Dockerfile change.
4. **Layer-cache thrash.** Every edit to `app/` busts the wheel-install layer under the current `COPY --from=builder /wheels ...` order. That's fine for CI (GHA layer cache reuses identical digests), but locally it feels slow; run `docker build --cache-from resume-api:phase1-local` to reuse the previous build.
5. **`libffi` version skew.** Debian bookworm ships `libffi8`; bullseye ships `libffi7`. The base image `python:3.11-slim` is bookworm as of 2026, so `libffi8` is correct. If you bump to `python:3.12-slim`, re-verify.
6. **Redis persistence volume path.** `volumes: redis_data:/data` creates a named Docker volume, not a bind mount. On rebuild, data survives. On `docker compose down -v`, it's wiped — warn anyone running compose on the droplet never to pass `-v`.

---

## Rollback

Phase 1 touches only three files, all additive or replacing a file whose old contents are in git:

```bash
# Revert Dockerfile to the single-stage version
git checkout HEAD~1 -- backend/Dockerfile

# Remove the new artifacts
rm backend/.dockerignore
rm deploy/docker-compose.prod.yml
```

Because Phases 2–5 have not shipped yet, the old deploy path (`deploy-backend.yml` → pm2 → poetry install on droplet) is still active and unaffected.

---

## Files modified

| Path | Action | Why |
| ---- | ------ | --- |
| `backend/Dockerfile` | Replace | Multi-stage, non-root, WeasyPrint-ready, explicit copies |
| `backend/.dockerignore` | Create | Prevent `.env` + dev caches from entering build context |
| `deploy/docker-compose.prod.yml` | Create | Droplet-facing compose owning `api` + `redis` |

No changes outside these three paths.

---

## Completion checklist

- [ ] Multi-stage Dockerfile committed and builds locally with exit 0
- [ ] Final image size measured and under 500 MB
- [ ] `.dockerignore` committed with `.env` wildcard
- [ ] `deploy/docker-compose.prod.yml` committed and parses with `docker compose config`
- [ ] Local `docker run` with `--env-file backend/.env` boots and `/health` returns 200
- [ ] WeasyPrint smoke test generates a PDF inside the container
- [ ] Non-root `app` user verified via `whoami`
- [ ] No regression in the existing `docker-compose.yml` at repo root (unchanged)
- [ ] PR reviewer confirms no secrets appear in the diff

---

## Next phase

Proceed to [phase-2-test-refactor.md](./phase-2-test-refactor.md) to swap the SQLite-backed test fixtures for real Postgres + Mongo so CI in Phase 3 has something meaningful to run.
