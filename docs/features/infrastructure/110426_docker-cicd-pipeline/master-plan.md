# Docker + GitHub Actions CI/CD Pipeline for Backend

## Context

The backend currently deploys via SSH → `git reset --hard` → `poetry install` → `pm2 restart` on a 1 GB DigitalOcean droplet. `poetry install` on a 1 GB box is an OOM risk and has been the cause of production restart failures. Redis runs as a systemd service on the same droplet.

The goal is to move every build step off the droplet: GitHub Actions builds the image, pushes it to GHCR, and the droplet only ever runs `docker compose pull && up -d`. Redis becomes a sibling container. External databases (Supabase Postgres, MongoDB Atlas) stay external. The frontend (Vercel) is entirely out of scope.

A secondary goal is to refactor the test suite so CI exercises real Postgres and MongoDB instead of in-memory SQLite + `mongomock`. This closes the JSONB/ARRAY/pgvector gap that SQLite compilation shims currently hide.

## Existing state (what already exists and interacts with this work)

- `backend/Dockerfile` — single-stage, `python:3.11-slim` + Poetry export + pip install. Works but copies `.env`, has no `.dockerignore`, and isn't pushed to any registry. **Will be replaced.**
- `docker-compose.yml` (repo root) — **local dev only**, defines `postgres` (pgvector), `mongodb`, `redis`, `minio`, `backend`. **Leave untouched.**
- `.github/workflows/deploy-backend.yml` — currently the only workflow; triggers on push to `main` with `backend/**` paths. Runs ruff + a hand-picked pytest subset, then SSH-deploys via `appleboy/ssh-action`. **Will be deleted** and replaced with `ci.yml` + `cd.yml`.
- `backend/tests/conftest.py` — uses `sqlite+aiosqlite:///:memory:` + `@compiles` hacks for JSONB/ARRAY, and `mongomock_motor.AsyncMongoMockClient`. **Will be refactored** to accept a real DB URL from env.
- `backend/alembic/env.py` — reads `DATABASE_URL_SYNC` (or converts async URL to psycopg2) via `get_settings()`. Settings has validators that require `MONGODB_URI` etc. at import time — the migration container will need those env vars passed through or the settings module needs a "migration only" bypass.
- `backend/app/core/config.py` — `pydantic-settings` with custom `.env` loader. `MONGODB_URI` is required by a validator (line ~220). Critical for the migrate step.
- `backend/app/main.py` — FastAPI app at module path `app.main:app`, port 8000.
- Production secrets already set: `DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`.

## Outcome

- Backend image built in CI, tagged `ghcr.io/sungchunn/resume-builder-api:<sha>` + `:latest`, pushed to **private** GHCR.
- PR workflow (`ci.yml`): ruff + pytest against real ephemeral Postgres 16 (pgvector) + MongoDB 7 service containers, with Poetry cache.
- Push-to-main workflow (`cd.yml`): build → migrate → deploy, sequential jobs.
- Migrations run via `docker run --rm ... alembic upgrade head` from the GHA runner against Supabase.
- Droplet runs only `docker compose pull api && up -d api` — no Python toolchain needed on server.
- `.env` never baked into image; passed via `env_file: .env` on the droplet.

---

## Implementation phases

### Phase 1 — Containerization scaffolding

#### 1.1 Rewrite `backend/Dockerfile` as multi-stage

- **Stage `builder`**: `python:3.11-slim`, install Poetry 1.8.2, run `poetry export --only main --without-hashes -f requirements.txt -o requirements.txt`, then `pip wheel --wheel-dir=/wheels -r requirements.txt`. Installs build toolchain (`gcc`, `libpq-dev`, etc.) only in this stage.
- **Stage `runtime`**: fresh `python:3.11-slim`. Install runtime-only system libs: `libpq5` (asyncpg/psycopg2 runtime), WeasyPrint deps (`libpango-1.0-0`, `libpangoft2-1.0-0`, `libcairo2`, fonts), `curl` for healthcheck. Copy wheels from builder, `pip install --no-index --find-links=/wheels -r requirements.txt`, then `rm -rf /wheels`.
- Create non-root user `app`, `USER app`, `WORKDIR /app`.
- `COPY backend/app ./app` + `COPY backend/alembic ./alembic` + `COPY backend/alembic.ini ./` + `COPY backend/pyproject.toml ./` — deliberately **not** `COPY . .` so `.env`, `tests/`, `docs/` can never sneak in.
- `EXPOSE 8000`
- `HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1`
- `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`

#### 1.2 Create `backend/.dockerignore`

```text
.env
.env.*
!.env.example
__pycache__/
*.pyc
*.pyo
.venv/
.pytest_cache/
.ruff_cache/
.mypy_cache/
tests/
docs/
alembic/versions_archived/
.git/
*.md
README.md
Dockerfile
.dockerignore
```

#### 1.3 Create `deploy/docker-compose.prod.yml`

```yaml
services:
  api:
    image: ghcr.io/sungchunn/resume-builder-api:latest
    container_name: resume-api
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:8000:8000"   # nginx reverse-proxies
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    container_name: resume-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  redis_data:
```

- API port bound to `127.0.0.1` so only nginx (already on the droplet) can reach it.
- Redis stays internal to the compose network; the `api` service reaches it at `redis://redis:6379`. **The droplet's `.env` must set `REDIS_URL=redis://redis:6379`** to override the existing systemd-redis URL.

### Phase 2 — Test refactor (real DBs in CI)

#### 2.1 Refactor `backend/tests/conftest.py`

- Read a new `TEST_DATABASE_URL` env var; fall back to current in-memory SQLite if unset (keeps local `pytest` fast).
- Read `TEST_MONGODB_URI`; fall back to `mongomock` if unset.
- Drop the `@compiles(JSONB, "sqlite")` and `@compiles(ARRAY, "sqlite")` hacks when using Postgres (gate them on the SQLite branch).
- Use `Base.metadata.create_all` against the real Postgres schema (migrations are validated separately in CD, so `create_all` is fine for test speed).
- Add a session-scoped fixture that creates and drops the test database schema once per run; function-scoped fixtures use transactions/savepoints for isolation.

#### 2.2 Verify schema compatibility

- Some models use `pgvector.Vector` columns — SQLite currently skips them. After the refactor, CI will exercise them against real Postgres. **Risk:** test assertions may fail on code paths that SQLite silently tolerated. Budget time for fixing these.

### Phase 3 — CI workflow (`.github/workflows/ci.yml`)

- **Trigger:** `pull_request` targeting `main`, paths `backend/**`.
- **Permissions:** `contents: read`.
- **Jobs → `lint-and-test`:**
  - `actions/checkout@v5`
  - `actions/setup-python@v6` with `python-version: '3.11'` and `cache: 'poetry'` (needs `cache-dependency-path: backend/poetry.lock`)
  - `pip install poetry==1.8.2`
  - `services:` block:
    - `postgres`: `pgvector/pgvector:pg16`, env `POSTGRES_USER=test POSTGRES_PASSWORD=test POSTGRES_DB=test`, ports `5432:5432`, `--health-cmd pg_isready`
    - `mongodb`: `mongo:7`, ports `27017:27017`, `--health-cmd "mongosh --eval db.adminCommand('ping')"`
  - `poetry install --no-interaction --no-ansi` (working directory: `backend`)
  - `poetry run ruff format --check .`
  - `poetry run ruff check . --output-format=github`
  - `poetry run pytest -v --tb=short` with env:
    - `TEST_DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test`
    - `TEST_MONGODB_URI=mongodb://localhost:27017/test`
    - `DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test`
    - `MONGODB_URI=mongodb://localhost:27017/test`
    - `JWT_SECRET_KEY=test-secret-key`
    - `ENVIRONMENT=test`
  - Run the full `tests/` tree; drop the hand-picked file list from the old workflow. If specific tests break against real DBs, fix them or skip-mark individually rather than hiding the file list.

### Phase 4 — CD workflow (`.github/workflows/cd.yml`)

- **Trigger:** `push` to `main`, paths `backend/**`.
- **Concurrency:** `group: cd-${{ github.ref }}`, `cancel-in-progress: false` (don't interrupt a deploy mid-flight).
- **Top-level permissions:** `contents: read`, `packages: write`.

#### Job 1 — `build-and-push`

- `actions/checkout@v5`
- `docker/setup-buildx-action@v3`
- `docker/login-action@v3` with `registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}`
- `docker/metadata-action@v5` to compute tags (`latest` + `sha-<short>`)
- `docker/build-push-action@v5`:
  - `context: backend`
  - `file: backend/Dockerfile`
  - `push: true`
  - `tags:` — `ghcr.io/sungchunn/resume-builder-api:latest` and `ghcr.io/sungchunn/resume-builder-api:${{ github.sha }}`
  - `cache-from: type=gha`
  - `cache-to: type=gha,mode=max`
- Downstream jobs reference `ghcr.io/.../api:${{ github.sha }}` for determinism, not `:latest`.

#### Job 2 — `migrate` (`needs: build-and-push`)

- `docker/login-action@v3` (same GHCR creds — private image)
- Run:

  ```bash
  docker run --rm \
    -e DATABASE_URL=${{ secrets.PROD_DATABASE_URL }} \
    -e DATABASE_URL_SYNC=${{ secrets.PROD_DATABASE_URL_SYNC }} \
    -e MONGODB_URI=${{ secrets.PROD_MONGODB_URI }} \
    -e JWT_SECRET_KEY=${{ secrets.PROD_JWT_SECRET_KEY }} \
    -e OPENAI_API_KEY=${{ secrets.PROD_OPENAI_API_KEY }} \
    -e REDIS_URL=redis://localhost:6379 \
    -e ENVIRONMENT=production \
    ghcr.io/sungchunn/resume-builder-api:${{ github.sha }} \
    alembic upgrade head
  ```

- All env vars that `app/core/config.py` validators require at import time must be present — `MONGODB_URI` and `JWT_SECRET_KEY` are the two gotchas. Redis URL is fake; alembic never opens a Redis connection, but settings load succeeds.
- **Pre-flight check:** Supabase allows connections from GitHub Actions IPs by default; if the project has IP allow-listing enabled, the migrate job will hang. Verify before running.

#### Job 3 — `deploy` (`needs: migrate`)

- `appleboy/ssh-action@v1` using existing `DO_HOST` / `DO_USERNAME` / `DO_SSH_KEY`:

  ```bash
  set -e
  cd /home/deploy/app
  git fetch origin && git reset --hard origin/main   # update deploy/docker-compose.prod.yml
  cd deploy
  echo ${{ secrets.GHCR_PAT }} | docker login ghcr.io -u ${{ secrets.GHCR_USERNAME }} --password-stdin
  docker compose -f docker-compose.prod.yml pull api
  docker compose -f docker-compose.prod.yml up -d api
  docker image prune -f
  ```

- Reuse the existing 5-attempt curl retry against `http://localhost:8000/health` from `deploy-backend.yml` (lines 93–145) — copy that block verbatim into the new `cd.yml` script.
- On failure, dump `docker compose logs --tail 50 api` instead of `pm2 logs`.

### Phase 5 — Remove old workflow

- Delete `.github/workflows/deploy-backend.yml` in the same PR that introduces `ci.yml` + `cd.yml`. Leaving it active would double-run the deploy path on push to main.

---

## Files changed

| Path | Action |
| ---- | ------ |
| `backend/Dockerfile` | Replace with multi-stage |
| `backend/.dockerignore` | Create |
| `backend/tests/conftest.py` | Refactor to accept real DB URLs from env |
| `deploy/docker-compose.prod.yml` | Create |
| `.github/workflows/ci.yml` | Create |
| `.github/workflows/cd.yml` | Create |
| `.github/workflows/deploy-backend.yml` | Delete |

## GitHub secrets to add

| Secret | Purpose |
| ------ | ------- |
| `PROD_DATABASE_URL` | Supabase async URL (passed into migrate container) |
| `PROD_DATABASE_URL_SYNC` | Supabase psycopg2 URL (alembic) |
| `PROD_MONGODB_URI` | Atlas URL (required by settings validator, even for migrations) |
| `PROD_JWT_SECRET_KEY` | Required by settings at import time |
| `PROD_OPENAI_API_KEY` | Required by settings at import time |
| `GHCR_USERNAME` | GitHub username for droplet `docker login` |
| `GHCR_PAT` | PAT with `read:packages` scope for droplet pull |

Already present: `DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`, `GITHUB_TOKEN` (auto).

## One-time droplet prep (manual, out of CI scope)

1. Install Docker Engine + Compose plugin (`curl -fsSL https://get.docker.com | sh`).
2. Stop + disable existing `pm2` fastapi process and `systemd` redis service.
3. `docker login ghcr.io` with the GHCR PAT (persisted in `~/.docker/config.json`).
4. Ensure `/home/deploy/app/.env` exists with production values **and** `REDIS_URL=redis://redis:6379` (container DNS, not `localhost`).
5. First deploy: `git pull` the repo so `deploy/docker-compose.prod.yml` is present, then `docker compose -f deploy/docker-compose.prod.yml up -d`.
6. Confirm nginx upstream still points at `127.0.0.1:8000` (no change expected).

## Verification

**Local Dockerfile smoke test:**

```bash
cd backend
docker build -t resume-api:test .
docker run --rm --env-file .env -p 8000:8000 resume-api:test
curl -f http://localhost:8000/health
docker images resume-api:test  # confirm size is reasonable (<500 MB expected)
```

**CI dry run:** open a draft PR touching `backend/` — confirm `ci.yml` runs, services come up, ruff passes, pytest passes against real Postgres/Mongo.

**CD dry run:** merge a trivial no-op to `main` (e.g. a comment change in `backend/app/main.py`) — confirm all three jobs green, GHCR shows the new tag, droplet `docker compose ps` shows `resume-api` with the new image digest, `/health` returns 200.

**Rollback path:** on the droplet, edit `deploy/docker-compose.prod.yml` to pin `image:` to a previous SHA tag, then `docker compose pull api && up -d api`. (Can later be parametrised with an `IMAGE_TAG` env var.)

## Risks / open items

1. **pgvector test failures after refactor** — SQLite silently compiled vector columns to JSON. CI may surface real test failures; budget a debug pass.
2. **Supabase IP allow-list** — migrate job will hang if enabled; verify in Supabase dashboard before first merge.
3. **Settings validator at import time** — all env vars listed in the migrate step must be present, or alembic crashes before running any migration. Double-check `app/core/config.py` validators when writing `cd.yml`.
4. **WeasyPrint runtime deps** — the multi-stage split must install the full pango/cairo stack in the runtime image, or PDF generation breaks. Current single-stage Dockerfile skips some of this; test explicitly.
5. **`alembic.ini` + `alembic/` must be copied into the image** — the old `COPY . .` grabbed them incidentally. The new explicit COPYs list them, but this is the most likely "I forgot a file" bug.
