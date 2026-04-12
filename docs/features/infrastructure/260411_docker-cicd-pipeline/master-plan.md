# Docker + GitHub Actions CI/CD Pipeline for Backend — Master Plan

**Date:** 2026-04-11
**Status:** Planning
**Owner:** Sungchunn

---

## Context

The backend currently deploys via SSH → `git reset --hard` → `poetry install` → `pm2 restart` on a 1 GB DigitalOcean droplet. `poetry install` on a 1 GB box is an OOM risk and has been the cause of production restart failures. Redis runs as a systemd service on the same droplet.

The goal is to move every build step off the droplet: GitHub Actions builds the image, pushes it to GHCR, and the droplet only ever runs `docker compose pull && up -d`. Redis becomes a sibling container. External databases (Supabase Postgres, MongoDB Atlas) stay external. The frontend (Vercel) is entirely out of scope.

A secondary goal is to refactor the test suite so CI exercises real Postgres and MongoDB instead of in-memory SQLite + `mongomock`. This closes the JSONB / ARRAY / pgvector gap that SQLite compilation shims currently hide.

---

## Related documents

- [Phase 1 — Multi-Stage Dockerfile + Production Compose](./phase-1-dockerfile-and-compose.md)
- [Phase 2 — Test Refactor for Real Databases](./phase-2-test-refactor.md)
- [Phase 3 — CI Workflow (`ci.yml`)](./phase-3-ci-workflow.md)
- [Phase 4 — CD Workflow (`cd.yml`)](./phase-4-cd-workflow.md)
- [Phase 5 — Cutover: Droplet Prep + Remove Old Workflow](./phase-5-cutover-and-cleanup.md)

---

## Existing state (what already exists and interacts with this work)

- `backend/Dockerfile` — single-stage, `python:3.11-slim` + Poetry export + pip install. Works but copies `.env`, has no `.dockerignore`, and isn't pushed to any registry. **Replaced in Phase 1.**
- `docker-compose.yml` (repo root) — **local dev only**, defines `postgres` (pgvector), `mongodb`, `redis`, `minio`, `backend`. **Left untouched.**
- `.github/workflows/deploy-backend.yml` — currently the only workflow. Triggers on push to `main` with `backend/**` paths. Runs ruff + a hand-picked pytest subset, then SSH-deploys via `appleboy/ssh-action`. **Deleted in Phase 5**, replaced by `ci.yml` + `cd.yml`.
- `backend/tests/conftest.py` — uses `sqlite+aiosqlite:///:memory:` + `@compiles` hacks for JSONB / ARRAY, and `mongomock_motor.AsyncMongoMockClient`. **Refactored in Phase 2** to accept a real DB URL from env.
- `backend/alembic/env.py` — reads `DATABASE_URL_SYNC` (or converts async URL to psycopg2) via `get_settings()`. Settings has validators that require `MONGODB_URI` at import time — the migration container must pass those env vars through. Phase 4 handles this.
- `backend/app/core/config.py` — `pydantic-settings` with a `@field_validator("mongodb_uri")` at line 220 and `@field_validator("jwt_secret_key")` at line 212. Critical for the migrate step in Phase 4.
- `backend/app/main.py` — FastAPI app at module path `app.main:app`, port 8000.
- Production secrets already set at the repo level: `DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`.

---

## Outcome

- Backend image built in CI, tagged `ghcr.io/sungchunn/resume-builder-api:<sha>` + `:latest`, pushed to **private** GHCR.
- PR workflow (`ci.yml`): ruff + pytest against real ephemeral Postgres 16 (pgvector) + MongoDB 7 service containers, with Poetry cache.
- Push-to-main workflow (`cd.yml`): build → migrate → deploy, three sequential jobs.
- Migrations run via `docker run --rm ... alembic upgrade head` from the GHA runner against Supabase.
- Droplet runs only `docker compose pull api && up -d api` — no Python toolchain needed on the server.
- `.env` never baked into the image; passed via `env_file: .env` in `deploy/docker-compose.prod.yml`.
- Redis becomes a sibling container with a bounded `--maxmemory 128mb` and `allkeys-lru` eviction.

---

## Phase summary

| Phase | Scope | Deliverable | Doc |
| ----- | ----- | ----------- | --- |
| 1 | Multi-stage Dockerfile, `.dockerignore`, production compose | Image builds locally; compose file parses | [phase-1](./phase-1-dockerfile-and-compose.md) |
| 2 | Refactor `conftest.py` to accept real DB URLs; gate SQLite shims | Tests green against real Postgres + Mongo locally | [phase-2](./phase-2-test-refactor.md) |
| 3 | Create `ci.yml` with pgvector + mongo service containers | PRs run full test suite on real DBs | [phase-3](./phase-3-ci-workflow.md) |
| 4 | Create `cd.yml` — build, migrate, deploy jobs | Merge to `main` builds, pushes to GHCR, migrates Supabase, SSH-deploys to droplet | [phase-4](./phase-4-cd-workflow.md) |
| 5 | Droplet prep (Docker install, pm2 stop, systemd Redis stop) + delete `deploy-backend.yml` | Single-source deploy pipeline; legacy workflow removed | [phase-5](./phase-5-cutover-and-cleanup.md) |

Each phase is described in its own document with extensive implementation detail, concrete file paths, verification commands, edge cases, rollback procedure, and a completion checklist.

---

## Files changed (cross-phase rollup)

| Path | Action | Phase |
| ---- | ------ | ----- |
| `backend/Dockerfile` | Replace with multi-stage | 1 |
| `backend/.dockerignore` | Create | 1 |
| `deploy/docker-compose.prod.yml` | Create | 1 |
| `backend/tests/conftest.py` | Refactor to accept real DB URLs | 2 |
| `.github/workflows/ci.yml` | Create | 3 |
| `.github/workflows/cd.yml` | Create | 4 |
| `.github/workflows/deploy-backend.yml` | Delete | 5 |

---

## GitHub secrets to add

All secrets below are configured at the repository level (Settings → Secrets and variables → Actions). Never committed.

| Secret | Purpose | Used in phase |
| ------ | ------- | ------------- |
| `PROD_DATABASE_URL` | Supabase async URL, passed into migrate container | 4 |
| `PROD_DATABASE_URL_SYNC` | Supabase psycopg2 URL, used by alembic | 4 |
| `PROD_MONGODB_URI` | Atlas URL, required by settings validator even for migrations | 4 |
| `PROD_JWT_SECRET_KEY` | Required by settings validator at import time | 4 |
| `PROD_OPENAI_API_KEY` | Required by settings at import time | 4 |
| `GHCR_USERNAME` | GitHub username for droplet `docker login` | 4, 5 |
| `GHCR_PAT` | Fine-grained PAT with `read:packages` scope | 4, 5 |

Already present: `DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`, `GITHUB_TOKEN` (auto-provided).

---

## End-to-end verification

Each phase has its own detailed verification section in its own doc. The cross-cutting smoke tests for the overall pipeline are:

**Local Dockerfile smoke (Phase 1):**

```bash
cd backend
docker build -t resume-api:test .
docker run --rm --env-file .env -p 8000:8000 resume-api:test &
sleep 20
curl -fsS http://localhost:8000/health
docker images resume-api:test  # confirm size < 500 MB
```

**CI dry run (Phase 3):** open a draft PR touching `backend/` — confirm `ci.yml` runs, Postgres + Mongo services come up healthy, ruff passes, pytest passes against real databases. Screenshot the green run.

**CD dry run (Phase 4):** merge a trivial no-op to `main` (e.g. a comment change in `backend/app/main.py`) — confirm all three jobs (`build-and-push`, `migrate`, `deploy`) are green, GHCR shows the new `sha-<commit>` tag, droplet `docker compose ps` shows `resume-api (healthy)` on the new image digest, `/health` returns 200.

**Cutover verification (Phase 5):** after droplet prep, confirm `pm2 list` has no `fastapi` process, `systemctl is-active redis` returns `inactive`, both containers are `(healthy)`, public nginx endpoint returns 200, PDF export works end-to-end.

**Rollback path:** on the droplet, edit `deploy/docker-compose.prod.yml` to pin `image:` to the previous `sha-*` tag, then `docker compose pull api && up -d api`. Document in a future improvement: parametrise rollback via an `IMAGE_TAG` input on a `workflow_dispatch` trigger so rollback becomes a one-click workflow run instead of SSH.

---

## Risks / open items

Each risk is owned by a specific phase. See that phase's doc for the mitigation and verification.

1. **pgvector test failures after refactor** — SQLite silently compiled vector columns to JSON. CI will surface real test failures. **Owner:** [Phase 2](./phase-2-test-refactor.md), section 2.6 (audit tests at risk).
2. **Supabase IP allow-list blocks migrate job** — the migrate job will hang indefinitely if Supabase restricts network access. **Owner:** [Phase 4](./phase-4-cd-workflow.md), section 4.4 (pre-flight).
3. **Settings validator crash at import time** — all env vars listed in the migrate step must be present or alembic crashes before running any migration. **Owner:** [Phase 4](./phase-4-cd-workflow.md), section 4.3 (env-var gotcha).
4. **WeasyPrint runtime deps missing** — the multi-stage split must install the full pango / cairo / fonts stack, or PDF generation breaks. **Owner:** [Phase 1](./phase-1-dockerfile-and-compose.md), sections 1.1 and 1.4 (WeasyPrint smoke test).
5. **`alembic.ini` + `alembic/` must be copied into the image** — the old `COPY . .` grabbed them incidentally. New explicit COPY lines list them, but this is the most likely "I forgot a file" bug. **Owner:** [Phase 1](./phase-1-dockerfile-and-compose.md), section 1.1 (explicit COPY rationale).

---

## Follow-ups out of scope for this feature

- Parametrised rollback via `workflow_dispatch` with an `IMAGE_TAG` input.
- Staging environment on a second droplet with a `staging` branch trigger.
- Uninstalling pm2 and system Python packages from the droplet after a week of stable container operation.
- Monthly cron for `docker image prune -a --filter "until=720h" -f` to bound disk usage.
- Full-text search migration for `/jobs` (tracked separately in [260411_jobs-page-caching](../260411_jobs-page-caching/master-plan.md)).
