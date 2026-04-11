# Phase 3 — CI Workflow (`ci.yml`)

**Parent:** [master-plan.md](./master-plan.md)
**Status:** Planning
**Goal:** Run ruff + the full pytest suite against real ephemeral Postgres 16 (pgvector) and MongoDB 7 on every pull request touching `backend/**`.

---

## Objective

Create `.github/workflows/ci.yml` that triggers on pull-request events targeting `main` with changes under `backend/**`, spins up database service containers, caches Poetry deps, and runs lint + the full `tests/` tree. The old `deploy-backend.yml` continues to run in parallel until Phase 5 cutover — this workflow does NOT replace it yet, it runs alongside it.

This is the first phase that depends on earlier work: the test refactor from Phase 2 must be merged before this workflow is useful (without it, the Postgres service container boots but tests still use SQLite).

---

## Why this phase exists

- The current `deploy-backend.yml` only runs 11 hand-picked test files (`deploy-backend.yml:49-61`). Everything outside that list is effectively untested in CI.
- Those tests run against no real database — they use whichever fallbacks the old `conftest.py` provided. Schema drift cannot be caught.
- PRs do not currently have a gate separate from the deploy workflow, so a red test bar and a deploy failure look the same.

Splitting CI from CD gives faster PR feedback, lets us delete the hand-picked list, and exercises pgvector + JSONB + ARRAY in a shape that matches production.

---

## Prerequisites

- Phase 2 merged — `conftest.py` respects `TEST_DATABASE_URL` and `TEST_MONGODB_URI`.
- Repository has `actions/checkout@v5`, `actions/setup-python@v6`, and `actions/cache@v5` available (all GA as of 2026-04).
- No Postgres port conflict on the runner — GHA runners are clean VMs, this is only a concern for self-hosted runners.

---

## Implementation

### 3.1 Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/ci.yml'
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  lint-and-test:
    name: Lint & Test (real DBs)
    runs-on: ubuntu-latest
    timeout-minutes: 20

    defaults:
      run:
        working-directory: backend

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd="pg_isready -U test -d test"
          --health-interval=5s
          --health-timeout=5s
          --health-retries=10

      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        options: >-
          --health-cmd="mongosh --quiet --eval 'db.runCommand({ping:1}).ok' | grep 1"
          --health-interval=5s
          --health-timeout=5s
          --health-retries=10

    env:
      # pytest targets — read by the refactored conftest.py
      TEST_DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test
      TEST_MONGODB_URI: mongodb://localhost:27017/test

      # app settings validators still load at import time, so these must
      # be present even though tests will override the sessions.
      DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test
      DATABASE_URL_SYNC: postgresql+psycopg2://test:test@localhost:5432/test
      MONGODB_URI: mongodb://localhost:27017/test
      JWT_SECRET_KEY: test-secret-key
      OPENAI_API_KEY: test-openai-key
      REDIS_URL: redis://localhost:6379
      ENVIRONMENT: test
      RATE_LIMIT_ENABLED: "false"

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Set up Python 3.11
        uses: actions/setup-python@v6
        with:
          python-version: '3.11'

      - name: Install Poetry
        run: pipx install poetry==1.8.2

      - name: Configure Poetry
        run: |
          poetry config virtualenvs.create true
          poetry config virtualenvs.in-project true

      - name: Cache Poetry virtualenv
        uses: actions/cache@v5
        with:
          path: backend/.venv
          key: venv-${{ runner.os }}-py311-${{ hashFiles('backend/poetry.lock') }}
          restore-keys: |
            venv-${{ runner.os }}-py311-

      - name: Install dependencies
        run: poetry install --no-interaction --no-ansi

      - name: Ruff format check
        run: poetry run ruff format --check .

      - name: Ruff lint
        run: poetry run ruff check . --output-format=github

      - name: Wait for pgvector extension availability
        run: |
          until docker exec "$(docker ps --filter ancestor=pgvector/pgvector:pg16 -q)" \
            psql -U test -d test -c 'SELECT 1' > /dev/null 2>&1; do
            echo "Waiting for Postgres..."
            sleep 2
          done
          echo "Postgres ready."

      - name: Run pytest
        run: poetry run pytest -v --tb=short --maxfail=20
```

### 3.2 Notes on service container configuration

**pgvector image:** `pgvector/pgvector:pg16` is the official pgvector-maintained image and bundles the extension binary. Using `postgres:16` and `CREATE EXTENSION vector` would fail because the base image does not have the shared library installed.

**Mongo health check:** `mongo:7` images do include `mongosh`. The `db.runCommand({ping:1}).ok` form returns `1` on success; grepping for `1` makes the health check binary rather than relying on exit codes. Avoid `db.adminCommand('ping')` — it also works but is noisier in the health-check logs.

**Port mapping on service containers:** GHA exposes service ports on `localhost` of the runner. The `ports:` block is what makes `postgres://localhost:5432` resolvable from the runner host. Without it, the service is only reachable by name from other service containers, not from the main job.

### 3.3 Poetry + virtualenv caching

Cache key `venv-${{ runner.os }}-py311-${{ hashFiles('backend/poetry.lock') }}` invalidates only when the lock file changes, which is the correct granularity — changes to `app/` source never invalidate the venv. The `restore-keys:` fallback lets a new lock hash reuse the last venv and let `poetry install` do a minimal delta install instead of a cold rebuild.

**Why cache `backend/.venv` rather than Poetry's global cache:** in-project venvs ensure a clean cache scope. Poetry's global cache mixes multiple projects and is harder to invalidate cleanly.

### 3.4 Full-suite pytest (no hand-picked list)

Delete the hand-picked file list from `deploy-backend.yml:49-61`. Run everything in `tests/`. If a test fails against real databases after the Phase 2 audit, the correct action is either:

- Fix the test assertion (preferred — SQLite was hiding a real bug).
- Mark it with `@pytest.mark.skip(reason="tracked in #<issue>")` so the skip is visible in the PR diff rather than hidden in a YAML file list.

`--maxfail=20` prevents a single broken fixture from flooding the log with 200 cascade failures while still catching multi-test regressions.

### 3.5 Env-var rationale

Three groups of env vars are passed into the test step:

1. **`TEST_*`** — read by the refactored `conftest.py`. These drive the real-DB branch of the fixture selection.
2. **`DATABASE_URL`, `MONGODB_URI`, `JWT_SECRET_KEY`, `OPENAI_API_KEY`, `REDIS_URL`, `ENVIRONMENT`** — read by `app/core/config.py` at module import time. `JWT_SECRET_KEY` and `MONGODB_URI` are enforced by `@field_validator` hooks (`app/core/config.py:212,220`), which raise on import if missing. `OPENAI_API_KEY` may or may not be validated — pass it defensively; a fake value is fine for tests that don't call OpenAI.
3. **`DATABASE_URL_SYNC`** — used by `alembic/env.py:13` when a test imports migration utilities. Harmless if unused.
4. **`RATE_LIMIT_ENABLED=false`** — matches the existing `conftest.py:4` override. Redundant because conftest also sets it, but setting it at the job level means tests that import from a module which reads it before conftest runs still see `false`.

---

## Verification

### 3.6 Opening the trial PR

Open a draft PR that touches any file under `backend/` (a comment change is enough) and confirm:

| Check | Where | Expected |
| ----- | ----- | -------- |
| Workflow triggered | GHA UI "Checks" tab | `CI / Lint & Test (real DBs)` appears |
| Service containers came up | Job logs, "Initialize containers" step | postgres + mongodb started, both marked healthy |
| Ruff format check passed | `Ruff format check` step | Exit 0 |
| Ruff lint passed | `Ruff lint` step | Exit 0 |
| Postgres reachable | `Wait for pgvector extension availability` step | `Postgres ready.` printed |
| pytest ran full tree | `Run pytest` step | `collected <N> items` matches `pytest --collect-only` count locally |
| pytest green | Exit code | 0 |
| Total runtime | Job summary | < 10 minutes on warm cache |

### 3.7 Cache effectiveness

Re-run the same PR (no changes). The `Cache Poetry virtualenv` step should print "Cache restored from key: venv-..." and `Install dependencies` should take <15 s instead of ~90 s. If not, the cache key is too volatile — inspect `hashFiles('backend/poetry.lock')`.

### 3.8 Regression check on the old workflow

Confirm the pre-existing `deploy-backend.yml` still runs and passes on the same PR. It will fail on merge to `main` until Phase 5 (expected), but on PR it only runs the test subset, which should stay green.

---

## Edge cases and gotchas

1. **`pgvector` extension creation race.** The `CREATE EXTENSION vector` statement now lives in the session-scoped pytest fixture (Phase 2), not in the workflow. If a future PR moves it back into the workflow, it MUST run after Postgres reports healthy or it will fail with `could not connect`.
2. **Mongo health-cmd shell quoting.** The grep approach works because `mongosh --quiet` only prints the command result. Some earlier images print a banner even with `--quiet` — if the health check starts failing, replace with `mongosh --quiet --norc --eval ...`.
3. **Poetry pipx install on GHA.** `pipx install poetry==1.8.2` is preferred over `pip install poetry` because pipx isolates Poetry from the test venv. GHA ubuntu-latest has pipx pre-installed as of 2026.
4. **`actions/cache@v5` v `@v4`.** Both work; v5 has better cross-platform support. If CI cost becomes a concern, switch to `cache: 'poetry'` on `actions/setup-python` — it's slightly less flexible (key is fixed) but requires no separate cache step.
5. **`DATABASE_URL_SYNC` psycopg2 import.** Alembic env imports settings, which may fail if `psycopg2` isn't installed in the runtime deps. Confirm `pyproject.toml` has psycopg2-binary in `[tool.poetry.dependencies]`, not just `[tool.poetry.group.dev.dependencies]`.
6. **Long `start_period` on Postgres.** If you see "psycopg2: server not ready" at test start, the health-cmd retry count is too low. Bump `--health-retries=20` or add an explicit `pg_isready` poll step.
7. **`services:` containers share `localhost` with the job.** Useful for the main steps but also means any local process on port 5432 conflicts. Not a concern on GHA runners, which start clean.
8. **GHA cost.** Full CI run on a 2-core ubuntu-latest runner: ~6–8 min. That's free for public repos and billable for private. If cost matters later, the first optimisation is path filtering (already in place) and the second is splitting lint from test into parallel jobs.

---

## Rollback

```bash
rm .github/workflows/ci.yml
```

The old `deploy-backend.yml` is still active, so PRs fall back to its test subset. No other code changes in this phase.

---

## Files modified

| Path | Action |
| ---- | ------ |
| `.github/workflows/ci.yml` | Create |

No code changes outside `.github/workflows/`.

---

## Completion checklist

- [ ] `ci.yml` committed with the contents above
- [ ] Workflow path filter narrowed to `backend/**` + the workflow file itself
- [ ] Postgres service container uses `pgvector/pgvector:pg16`, not base `postgres:16`
- [ ] Mongo health check returns green on cold start
- [ ] Trial PR shows green `CI / Lint & Test (real DBs)` check
- [ ] Full test collection count matches local `pytest --collect-only`
- [ ] Second run on the same PR hits the Poetry venv cache (<15 s install)
- [ ] `deploy-backend.yml` still runs on the same PR (both workflows coexist)
- [ ] Total CI runtime under 10 min on warm cache
- [ ] PR reviewer confirms no secrets or prod URLs committed to the workflow

---

## Next phase

Proceed to [phase-4-cd-workflow.md](./phase-4-cd-workflow.md) to build and push the image to GHCR and deploy it to the droplet via a separate workflow triggered on merge to `main`.
