# CI/CD Guardrails for Backend Deployment

## Overview

This feature adds protection layers to the backend deployment pipeline to prevent production issues like the CORS misconfiguration and MinIO connection errors that previously reached production undetected.

## Background

### The Problem

On April 5, 2026, two production issues caused service disruption:

1. **CORS Misconfiguration**: The `CORS_ORIGINS` environment variable wasn't set for production, causing all cross-origin requests to fail with "No 'Access-Control-Allow-Origin' header" errors.

2. **MinIO Connection Refused**: The storage service attempted to connect to MinIO on `localhost:9000`, which wasn't running in production. This caused 500 errors on the `/api/upload/extract` endpoint.

Both issues shared a common root cause: **no validation** before or after deployment.

### Current State

**Workflow:** `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to DigitalOcean
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DO_HOST }}
          username: ${{ secrets.DO_USERNAME }}
          key: ${{ secrets.DO_SSH_KEY }}
          script: |
            cd /home/deploy/app
            git pull origin main
            cd backend
            poetry install --no-interaction
            poetry run alembic upgrade head
            cd ..
            pm2 restart fastapi
            pm2 save
```

**Gaps:**

| Gap | Risk | Example |
| --- | ---- | ------- |
| No pre-deployment tests | Bad code reaches production | Syntax errors, broken imports |
| No linting | Code quality issues | Unused imports, style violations |
| No health check after deploy | App may crash silently | MinIO connection refused (500 errors) |
| No dependency validation | Missing services not detected | Database connection failures |

## Solution Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                                                   │
│  │  CODE PUSH       │                                                   │
│  │  (main branch)   │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐     FAIL                                          │
│  │  LAYER 1: TEST   │────────────► Pipeline stops, no deployment        │
│  │  - Ruff lint     │                                                   │
│  │  - Unit tests    │                                                   │
│  └────────┬─────────┘                                                   │
│           │ PASS                                                         │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │  LAYER 2: DEPLOY │                                                   │
│  │  - git pull      │                                                   │
│  │  - poetry install│                                                   │
│  │  - alembic       │                                                   │
│  │  - pm2 restart   │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐     FAIL                                          │
│  │  LAYER 3: VERIFY │────────────► Logs dumped, deployment marked failed│
│  │  - Health check  │                                                   │
│  │  - DB validation │                                                   │
│  └────────┬─────────┘                                                   │
│           │ PASS                                                         │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │  SUCCESS         │                                                   │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

| Phase | Document | Scope |
| ----- | -------- | ----- |
| 1 | [phase-1-pre-deployment-tests.md](./phase-1-pre-deployment-tests.md) | Add test job to GitHub Actions |
| 2 | [phase-2-health-endpoint.md](./phase-2-health-endpoint.md) | Enhance `/health` with DB checks |
| 3 | [phase-3-post-deployment-verification.md](./phase-3-post-deployment-verification.md) | Add health check script to deploy |

## Files to Modify

| File | Changes |
| ---- | ------- |
| `.github/workflows/deploy-backend.yml` | Add test job, health check script |
| `backend/app/main.py` | Enhanced health endpoint |
| `backend/tests/api/test_health.py` | Update tests for new health response |

## Success Criteria

1. **Lint errors block deployment**: Push code with Ruff violations → deploy job never runs
2. **Test failures block deployment**: Push code with failing tests → deploy job never runs
3. **Health check catches startup errors**: If app crashes on startup → deployment marked failed
4. **Database issues detected**: If PostgreSQL/MongoDB unreachable → health returns 503

## Verification

After implementation, verify each layer works:

```bash
# Test 1: Lint failure blocks deploy
# Add unused import to any file, push, verify test job fails

# Test 2: Test failure blocks deploy
# Break a unit test, push, verify test job fails

# Test 3: Health check works locally
curl http://localhost:8000/health | jq .
# Expected: {"status": "healthy", "checks": {"postgres": "ok", "mongodb": "ok"}}

# Test 4: Health check detects issues
# Stop MongoDB locally, check health returns 503
```

## Future Enhancements

These are out of scope for the current implementation but worth considering:

- **Automatic rollback**: On health check failure, revert to previous commit
- **Staging environment**: Deploy to staging first, promote to production after validation
- **Notifications**: Slack/Discord alerts on deploy success/failure
- **Dependency scanning**: Check for vulnerable packages before deploy
