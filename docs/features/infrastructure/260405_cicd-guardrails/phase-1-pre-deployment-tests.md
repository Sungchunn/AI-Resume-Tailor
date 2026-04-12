# Phase 1: Pre-Deployment Tests

## Objective

Add a `test` job to the GitHub Actions workflow that runs linting and unit tests before deployment. The deploy job will only run if tests pass.

## Current Test Infrastructure

### Test Directory Structure

```text
backend/tests/
├── conftest.py              # Pytest configuration and fixtures
├── __init__.py
├── api/                     # API endpoint tests
│   ├── test_health.py
│   ├── test_resumes.py
│   ├── test_jobs.py
│   ├── test_upload.py
│   └── ...
├── services/                # Service layer tests
│   ├── test_file_storage.py
│   ├── test_document_converter.py
│   ├── test_audit_service.py
│   ├── ats/                 # ATS-specific tests
│   │   ├── test_analyzer_core.py
│   │   ├── test_keywords.py
│   │   └── ...
│   └── ...
└── crud/                    # Database CRUD tests
    └── ...
```

### Existing Linting Configuration

**File:** `backend/pyproject.toml`

```toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "W"]
ignore = ["E501"]
```

Ruff is already configured but not enforced in CI.

## Implementation

### Updated Workflow

**File:** `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  test:
    name: Lint & Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Poetry
        run: |
          pip install poetry
          poetry config virtualenvs.create true
          poetry config virtualenvs.in-project true

      - name: Cache Poetry dependencies
        uses: actions/cache@v4
        with:
          path: backend/.venv
          key: venv-${{ runner.os }}-${{ hashFiles('backend/poetry.lock') }}
          restore-keys: |
            venv-${{ runner.os }}-

      - name: Install dependencies
        run: poetry install --no-interaction --no-ansi

      - name: Run Ruff linter
        run: poetry run ruff check . --output-format=github

      - name: Run unit tests
        run: |
          poetry run pytest tests/services tests/api/test_health.py -v \
            --tb=short \
            --no-header \
            -q
        env:
          # Minimal env vars for tests that don't need real connections
          MONGODB_URI: "mongodb://localhost:27017/test"
          DATABASE_URL: "postgresql+asyncpg://test:test@localhost:5432/test"
          JWT_SECRET_KEY: "test-secret-key"
          ENVIRONMENT: "test"

  deploy:
    name: Deploy to Production
    needs: test
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to DigitalOcean
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DO_HOST }}
          username: ${{ secrets.DO_USERNAME }}
          key: ${{ secrets.DO_SSH_KEY }}
          script: |
            set -e
            cd /home/deploy/app
            git pull origin main
            cd backend
            poetry install --no-interaction
            poetry run alembic upgrade head
            pm2 restart fastapi
            pm2 save

            # Health check (implemented in Phase 3)
            echo "Waiting for app to start..."
            sleep 5
            for i in 1 2 3 4 5; do
              response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "000")
              if [ "$response" = "200" ]; then
                echo "✓ Health check passed"
                curl -s http://localhost:8000/health | jq .
                exit 0
              fi
              echo "Attempt $i: HTTP $response, retrying in 3s..."
              sleep 3
            done
            echo "✗ Health check failed after 5 attempts"
            pm2 logs fastapi --lines 30 --nostream
            exit 1
```

## Key Design Decisions

### Why Cache Poetry Dependencies

Poetry install can take 60-90 seconds. Caching the `.venv` directory reduces this to ~5 seconds on cache hit.

```yaml
- name: Cache Poetry dependencies
  uses: actions/cache@v4
  with:
    path: backend/.venv
    key: venv-${{ runner.os }}-${{ hashFiles('backend/poetry.lock') }}
```

The cache key includes `poetry.lock` hash, so cache invalidates when dependencies change.

### Why Run Specific Test Directories

```yaml
poetry run pytest tests/services tests/api/test_health.py -v
```

We exclude tests that require real database connections (most of `tests/api/`). The service tests use mocks and can run without infrastructure.

### Why `--output-format=github` for Ruff

```yaml
poetry run ruff check . --output-format=github
```

This format creates GitHub annotations that appear inline in the PR diff:

```text
Error: backend/app/services/example.py:15:1: F401 `os` imported but unused
```

### Environment Variables for Tests

```yaml
env:
  MONGODB_URI: "mongodb://localhost:27017/test"
  DATABASE_URL: "postgresql+asyncpg://test:test@localhost:5432/test"
  JWT_SECRET_KEY: "test-secret-key"
  ENVIRONMENT: "test"
```

These are fake values that allow the app to load configuration without validation errors. Tests that actually need database connections are skipped in CI.

## Test Categories

### Tests That Run in CI

| Category | Path | Description |
| -------- | ---- | ----------- |
| Service tests | `tests/services/` | Unit tests with mocked dependencies |
| Health test | `tests/api/test_health.py` | Basic endpoint test |

### Tests Skipped in CI

| Category | Path | Reason |
| -------- | ---- | ------ |
| API tests | `tests/api/*.py` | Most require real database |
| CRUD tests | `tests/crud/` | Require real database |
| Integration | `tests/integration/` | Require full infrastructure |

## Troubleshooting

### Common Failures

**Ruff lint errors:**

```text
backend/app/example.py:10:1: F401 `unused_import` imported but unused
```

Fix: Remove the unused import or add `# noqa: F401` if intentional.

**Poetry install fails:**

```text
Package not found: some-package==1.0.0
```

Fix: Run `poetry lock --no-update` locally and commit the updated lock file.

**Test import errors:**

```text
ModuleNotFoundError: No module named 'app'
```

Fix: Ensure `working-directory: backend` is set for all steps.

### Verifying Locally

Before pushing, run the same commands locally:

```bash
cd backend

# Lint check
poetry run ruff check .

# Run tests
MONGODB_URI="mongodb://localhost:27017/test" \
DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test" \
JWT_SECRET_KEY="test-secret-key" \
ENVIRONMENT="test" \
poetry run pytest tests/services tests/api/test_health.py -v
```

## Expected Behavior

### On Lint Failure

```text
Run poetry run ruff check . --output-format=github
backend/app/example.py:10:1: F401 `unused_import` imported but unused
Error: Process completed with exit code 1.
```

The `deploy` job is skipped because `test` failed.

### On Test Failure

```text
Run poetry run pytest tests/services -v
FAILED tests/services/test_example.py::test_something - AssertionError
Error: Process completed with exit code 1.
```

The `deploy` job is skipped because `test` failed.

### On Success

```text
Run poetry run ruff check . --output-format=github
All checks passed!

Run poetry run pytest tests/services -v
================ 42 passed in 5.23s ================
```

The `deploy` job runs.
