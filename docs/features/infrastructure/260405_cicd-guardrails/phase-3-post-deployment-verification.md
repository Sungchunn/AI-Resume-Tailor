# Phase 3: Post-Deployment Verification

## Objective

Add a health check script to the deployment workflow that verifies the application started correctly after `pm2 restart`. If the health check fails, the deployment is marked as failed and recent logs are displayed for debugging.

## Current Deploy Script

```bash
cd /home/deploy/app
git pull origin main
cd backend
poetry install --no-interaction
poetry run alembic upgrade head
cd ..
pm2 restart fastapi
pm2 save
```

The script runs to completion even if the app crashes immediately after restart.

## New Deploy Script

```bash
set -e  # Exit on any error
cd /home/deploy/app
git pull origin main
cd backend
poetry install --no-interaction
poetry run alembic upgrade head
pm2 restart fastapi
pm2 save

# Post-deployment health check
echo "=========================================="
echo "POST-DEPLOYMENT HEALTH CHECK"
echo "=========================================="
echo "Waiting 5 seconds for app to start..."
sleep 5

HEALTH_URL="http://localhost:8000/health"
MAX_ATTEMPTS=5
RETRY_DELAY=3

for i in $(seq 1 $MAX_ATTEMPTS); do
  echo ""
  echo "Attempt $i/$MAX_ATTEMPTS: Checking $HEALTH_URL"

  # Get HTTP status code
  HTTP_STATUS=$(curl -s -o /tmp/health_response.json -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

  if [ "$HTTP_STATUS" = "200" ]; then
    echo "✓ Health check PASSED (HTTP $HTTP_STATUS)"
    echo ""
    echo "Response:"
    cat /tmp/health_response.json | jq . 2>/dev/null || cat /tmp/health_response.json
    echo ""
    echo "=========================================="
    echo "DEPLOYMENT SUCCESSFUL"
    echo "=========================================="
    exit 0
  fi

  echo "✗ Health check returned HTTP $HTTP_STATUS"

  if [ -f /tmp/health_response.json ]; then
    echo "Response body:"
    cat /tmp/health_response.json | jq . 2>/dev/null || cat /tmp/health_response.json
  fi

  if [ $i -lt $MAX_ATTEMPTS ]; then
    echo "Retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  fi
done

echo ""
echo "=========================================="
echo "DEPLOYMENT FAILED"
echo "=========================================="
echo "Health check failed after $MAX_ATTEMPTS attempts"
echo ""
echo "Recent application logs (last 50 lines):"
echo "------------------------------------------"
pm2 logs fastapi --lines 50 --nostream
echo ""
echo "PM2 process status:"
echo "------------------------------------------"
pm2 show fastapi
exit 1
```

## Script Breakdown

### Error Handling

```bash
set -e  # Exit on any error
```

This ensures the script stops if any command fails (e.g., `git pull` fails due to conflicts).

### Wait for Startup

```bash
sleep 5
```

FastAPI with uvicorn typically takes 2-3 seconds to start. We wait 5 seconds to be safe, accounting for:

- Python interpreter startup
- Module imports
- Database connection pool initialization
- MongoDB connection
- Scheduler startup

### Retry Logic

```bash
MAX_ATTEMPTS=5
RETRY_DELAY=3
```

The app might take longer to start under load or with slow database connections. We retry 5 times with 3-second delays, giving a total window of ~20 seconds.

### Response Capture

```bash
HTTP_STATUS=$(curl -s -o /tmp/health_response.json -w "%{http_code}" "$HEALTH_URL")
```

- `-s`: Silent mode (no progress bar)
- `-o /tmp/health_response.json`: Save response body to file
- `-w "%{http_code}"`: Output only the HTTP status code

This captures both the status code and the response body for debugging.

### Success Path

```bash
if [ "$HTTP_STATUS" = "200" ]; then
  cat /tmp/health_response.json | jq .
  exit 0
fi
```

On success, we display the health response (showing database status) and exit with code 0.

### Failure Path

```bash
pm2 logs fastapi --lines 50 --nostream
pm2 show fastapi
exit 1
```

On failure, we show:

1. Recent application logs (for error messages)
2. PM2 process status (memory usage, restarts, uptime)

Then exit with code 1, which marks the GitHub Actions job as failed.

## Complete Workflow File

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

            echo "=========================================="
            echo "POST-DEPLOYMENT HEALTH CHECK"
            echo "=========================================="
            echo "Waiting 5 seconds for app to start..."
            sleep 5

            HEALTH_URL="http://localhost:8000/health"
            MAX_ATTEMPTS=5
            RETRY_DELAY=3

            for i in $(seq 1 $MAX_ATTEMPTS); do
              echo ""
              echo "Attempt $i/$MAX_ATTEMPTS: Checking $HEALTH_URL"
              HTTP_STATUS=$(curl -s -o /tmp/health_response.json -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

              if [ "$HTTP_STATUS" = "200" ]; then
                echo "✓ Health check PASSED (HTTP $HTTP_STATUS)"
                echo ""
                echo "Response:"
                cat /tmp/health_response.json | jq . 2>/dev/null || cat /tmp/health_response.json
                echo ""
                echo "=========================================="
                echo "DEPLOYMENT SUCCESSFUL"
                echo "=========================================="
                exit 0
              fi

              echo "✗ Health check returned HTTP $HTTP_STATUS"
              if [ -f /tmp/health_response.json ]; then
                echo "Response body:"
                cat /tmp/health_response.json | jq . 2>/dev/null || cat /tmp/health_response.json
              fi

              if [ $i -lt $MAX_ATTEMPTS ]; then
                echo "Retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
              fi
            done

            echo ""
            echo "=========================================="
            echo "DEPLOYMENT FAILED"
            echo "=========================================="
            echo "Health check failed after $MAX_ATTEMPTS attempts"
            echo ""
            echo "Recent application logs (last 50 lines):"
            echo "------------------------------------------"
            pm2 logs fastapi --lines 50 --nostream
            echo ""
            echo "PM2 process status:"
            echo "------------------------------------------"
            pm2 show fastapi
            exit 1
```

## Example Output

### Successful Deployment

```text
==========================================
POST-DEPLOYMENT HEALTH CHECK
==========================================
Waiting 5 seconds for app to start...

Attempt 1/5: Checking http://localhost:8000/health
✓ Health check PASSED (HTTP 200)

Response:
{
  "status": "healthy",
  "checks": {
    "postgres": "ok",
    "mongodb": "ok"
  }
}

==========================================
DEPLOYMENT SUCCESSFUL
==========================================
```

### Failed Deployment (Database Unreachable)

```text
==========================================
POST-DEPLOYMENT HEALTH CHECK
==========================================
Waiting 5 seconds for app to start...

Attempt 1/5: Checking http://localhost:8000/health
✗ Health check returned HTTP 503
Response body:
{
  "status": "unhealthy",
  "checks": {
    "postgres": "error: connection refused",
    "mongodb": "ok"
  }
}
Retrying in 3s...

Attempt 2/5: Checking http://localhost:8000/health
✗ Health check returned HTTP 503
...

==========================================
DEPLOYMENT FAILED
==========================================
Health check failed after 5 attempts

Recent application logs (last 50 lines):
------------------------------------------
0|fastapi  | ERROR: connection refused to postgres:5432
0|fastapi  | ERROR: Database temporarily unavailable
...

PM2 process status:
------------------------------------------
│ name      │ status  │ ↺ │ cpu │ memory │
│ fastapi   │ online  │ 3 │ 0%  │ 45.2mb │
```

### Failed Deployment (App Crash)

```text
==========================================
POST-DEPLOYMENT HEALTH CHECK
==========================================
Waiting 5 seconds for app to start...

Attempt 1/5: Checking http://localhost:8000/health
✗ Health check returned HTTP 000
Retrying in 3s...

Attempt 2/5: Checking http://localhost:8000/health
✗ Health check returned HTTP 000
...

==========================================
DEPLOYMENT FAILED
==========================================
Health check failed after 5 attempts

Recent application logs (last 50 lines):
------------------------------------------
0|fastapi  | Traceback (most recent call last):
0|fastapi  |   File "app/main.py", line 25
0|fastapi  | ImportError: No module named 'missing_package'
...

PM2 process status:
------------------------------------------
│ name      │ status   │ ↺ │ cpu │ memory │
│ fastapi   │ errored  │ 5 │ 0%  │ 0b     │
```

## Verification

### Test Successful Deployment

1. Push a valid commit to `main`
2. Watch GitHub Actions workflow
3. Verify:
   - Test job passes
   - Deploy job runs
   - Health check shows "DEPLOYMENT SUCCESSFUL"

### Test Failed Health Check

1. SSH into production server
2. Stop PostgreSQL: `sudo systemctl stop postgresql`
3. Push a dummy commit (e.g., add a comment)
4. Watch GitHub Actions workflow
5. Verify:
   - Deploy job shows health check failures
   - Logs are displayed
   - Job is marked as failed
6. Restart PostgreSQL: `sudo systemctl start postgresql`

### Test App Crash Detection

1. Temporarily add syntax error to `backend/app/main.py`
2. Push commit (bypassing tests for this test)
3. Watch GitHub Actions workflow
4. Verify:
   - Health check returns HTTP 000
   - PM2 logs show the crash
   - Job is marked as failed
5. Revert the syntax error

## Troubleshooting

### Health Check Returns 000

HTTP status 000 means curl couldn't connect at all. Possible causes:

- App crashed during startup (check PM2 logs)
- App is listening on wrong port (check uvicorn config)
- Firewall blocking localhost connections (unlikely on same machine)

### Health Check Returns 503

The app is running but databases are unhealthy. Check:

- PostgreSQL connection string in `.env`
- MongoDB connection string in `.env`
- Database services are running

### Health Check Timeout

If all 5 attempts fail with timeout:

- App might be slow to start (increase `MAX_ATTEMPTS` or `RETRY_DELAY`)
- Memory exhaustion (check `pm2 monit`)
- Deadlock in startup code (check logs)
