# Phase 4 — CD Workflow (`cd.yml`)

**Parent:** [master-plan.md](./master-plan.md)
**Status:** Implemented (commit `d359339`)
**Goal:** On push to `main` with `backend/**` changes, build the backend image, push it to private GHCR, run `alembic upgrade head` against Supabase, then SSH into the droplet to `docker compose pull && up -d`.

---

## Objective

Create `.github/workflows/cd.yml` with three sequential jobs:

1. `build-and-push` — build the Dockerfile from Phase 1, push to `ghcr.io/sungchunn/resume-builder-api` with `:latest` and `:${{ github.sha }}` tags.
2. `migrate` — run `alembic upgrade head` inside the pushed image against production Supabase, gated on `build-and-push` succeeding.
3. `deploy` — SSH into the droplet, `docker compose pull api && up -d api`, run the 5-attempt health-check retry loop inherited from the current `deploy-backend.yml`.

The old `deploy-backend.yml` still runs in parallel after this phase ships (it'll deploy via pm2) until Phase 5 deletes it. Running two deploy workflows on the same merge is intentional during the cutover window — the droplet runs whichever one wins the race (pm2 first, then docker compose overlays it). Phase 5 resolves the duplication.

---

## Why the three-job split

- **Build in its own job** so the artifact is fixed before migrations run. If the migrate step fails, we already have a reusable image at `:${{ github.sha }}`.
- **Migrate before deploy** because rolling a new container with an old schema causes 500s on any route that touches new columns. Running migrations first and only proceeding to deploy on success is the industry-standard safe ordering.
- **Deploy as the last job** so a migrate failure never ships a broken image. Retrying the workflow re-runs build (cheap due to layer cache), re-runs migrate (idempotent), and only then reaches the SSH step.

---

## Prerequisites

- Phase 1 merged — Dockerfile exists and produces a working image.
- Phase 3 merged — PRs are already running `ci.yml` so we have confidence the code is green before it hits `main`.
- GHCR repository `ghcr.io/sungchunn/resume-builder-api` reachable (created automatically on first push).
- All secrets listed in [4.6](#46-required-github-secrets) are configured at the repository level.
- Supabase project accepts connections from GitHub Actions runner IPs (see [4.4](#44-supabase-ip-allow-list-pre-flight)).

---

## Implementation

### 4.1 Trigger, permissions, concurrency

```yaml
name: CD

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'deploy/docker-compose.prod.yml'
      - '.github/workflows/cd.yml'

concurrency:
  group: cd-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read
  packages: write
```

**`cancel-in-progress: false`** is deliberate. Cancelling a deploy mid-flight can leave the droplet in an inconsistent state (image pulled but compose up not issued). Serial execution is safer than parallel — two merges land, the second one queues behind the first.

**`packages: write`** is required for `docker/login-action` to push to GHCR using `GITHUB_TOKEN`. `contents: read` is the default and is sufficient for checkout.

### 4.2 Job 1 — `build-and-push`

```yaml
jobs:
  build-and-push:
    name: Build & Push Image
    runs-on: ubuntu-latest
    timeout-minutes: 25

    outputs:
      image_tag: ${{ steps.meta.outputs.version }}
      image_digest: ${{ steps.build.outputs.digest }}

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Compute image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/sungchunn/resume-builder-api
          tags: |
            type=raw,value=latest
            type=sha,format=long

      - name: Build & push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: backend
          file: backend/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Notes:**

- **`context: backend`** scopes the build context to the backend directory so the root `docker-compose.yml` and `frontend/` are not uploaded. Combined with `.dockerignore` from Phase 1, this keeps the upload under 10 MB.
- **`type=sha,format=long`** emits `sha-<40-char-sha>` rather than the short 7-char form. Long SHAs are unambiguous across forks and rebases, which matters for rollback.
- **`cache-from: type=gha` + `cache-to: type=gha,mode=max`** uses the GitHub Actions cache backend for Buildx. `mode=max` caches intermediate layers too, which drops rebuild time from ~5 min to ~1 min when only `app/` changes.
- **Output `image_digest`** is passed to downstream jobs so they pin to a specific digest rather than a mutable tag. This guarantees the `migrate` job uses the exact same image that `deploy` will ship.

### 4.3 Job 2 — `migrate`

```yaml
  migrate:
    name: Run Alembic Migrations
    runs-on: ubuntu-latest
    needs: build-and-push
    timeout-minutes: 10

    steps:
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Run alembic upgrade head
        env:
          IMAGE: ghcr.io/sungchunn/resume-builder-api:sha-${{ github.sha }}
        run: |
          docker run --rm \
            -e DATABASE_URL='${{ secrets.PROD_DATABASE_URL }}' \
            -e DATABASE_URL_SYNC='${{ secrets.PROD_DATABASE_URL_SYNC }}' \
            -e MONGODB_URI='${{ secrets.PROD_MONGODB_URI }}' \
            -e JWT_SECRET_KEY='${{ secrets.PROD_JWT_SECRET_KEY }}' \
            -e OPENAI_API_KEY='${{ secrets.PROD_OPENAI_API_KEY }}' \
            -e REDIS_URL='redis://localhost:6379' \
            -e ENVIRONMENT='production' \
            "$IMAGE" \
            alembic upgrade head
```

**Env-var gotcha (the one most likely to bite you):**

`app/core/config.py` has a `@field_validator("mongodb_uri")` at line 220 that raises `ValueError("MONGODB_URI environment variable must be set")` if the field is empty. It also has a `@field_validator("jwt_secret_key")` at line 212. Both fire when `Settings()` is instantiated, which happens at *module import time* — before alembic even reads its config. If any required env is missing, the container exits with a validation error and alembic never runs.

This means the migrate container MUST be passed every env var that `app/core/config.py` demands, not just the ones alembic actually uses. In particular:

- `MONGODB_URI` — required by validator even though alembic only touches Postgres.
- `JWT_SECRET_KEY` — required by validator.
- `OPENAI_API_KEY` — may or may not have a validator; pass it defensively. A placeholder is fine.
- `REDIS_URL` — no validator, but settings access may default-construct a Redis URL. `redis://localhost:6379` is a safe no-op because alembic never opens a Redis connection.
- `DATABASE_URL_SYNC` — used by `alembic/env.py` directly for the synchronous psycopg2 connection.

**Why not use `docker run --env-file`:** env files on ephemeral runners leave a readable file on disk for the lifetime of the step. Passing via `-e` with secret interpolation keeps everything in env memory and GHA's secret masker can redact the values from logs.

**Why `sha-${{ github.sha }}` not `${{ needs.build-and-push.outputs.image_digest }}`:** the digest-pinned form is strictly better (rollback-safe, cache-bust-safe), but the tag form is easier to debug because the SHA appears in GHCR's UI. Pick one — for the first rollout use the tag form, switch to digest once the pipeline is proven.

### 4.4 Supabase IP allow-list pre-flight

**This is the single most likely failure mode on first deploy.** Supabase projects created after 2024 default to IP-allowlisting. If the project has any IP restrictions enabled, the migrate job will connect and then hang until the 10-minute job timeout, giving no useful error.

**Manual pre-flight (do this BEFORE merging):**

1. Open the Supabase dashboard for the resume-builder project.
2. Navigate to Project Settings → Database → Network Restrictions.
3. If restrictions are OFF, nothing to do.
4. If restrictions are ON, either:
   - Switch them off for the duration of the migration (simplest, least secure).
   - Add the GitHub Actions egress IP range (GHA does not publish a fixed CIDR — you'd need to pipe through a static egress proxy).
   - Switch to the Supabase **connection pooler** endpoint (`aws-0-*.pooler.supabase.com:6543`), which uses a different IP from the direct endpoint and may be allow-listed separately.
   - Use a self-hosted GHA runner on the droplet itself, since the droplet's IP is already allow-listed.

**Quick test from a local terminal:**

```bash
psql "$PROD_DATABASE_URL_SYNC" -c 'SELECT 1'
```

If that returns `1`, Supabase accepts connections from your IP. Whether GHA runners are also allowed is not guaranteed, but this at least confirms the credentials are correct.

### 4.5 Job 3 — `deploy`

```yaml
  deploy:
    name: Deploy to Droplet
    runs-on: ubuntu-latest
    needs: migrate
    timeout-minutes: 10

    steps:
      - name: SSH deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DO_HOST }}
          username: ${{ secrets.DO_USERNAME }}
          key: ${{ secrets.DO_SSH_KEY }}
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
            docker image prune -f

            echo "=========================================="
            echo "POST-DEPLOYMENT HEALTH CHECK"
            echo "=========================================="
            echo "Waiting 20 seconds for app to start..."
            sleep 20

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
            echo "Recent container logs (last 50 lines):"
            echo "------------------------------------------"
            docker compose -f docker-compose.prod.yml logs --tail 50 api
            echo ""
            echo "Container status:"
            echo "------------------------------------------"
            docker compose -f docker-compose.prod.yml ps
            exit 1
```

**Differences from the current `deploy-backend.yml` SSH script:**

| Before (pm2) | After (docker compose) |
| ------------ | ---------------------- |
| `cd backend && poetry install` | Removed — no Python on droplet |
| `poetry run alembic upgrade head` | Removed — migrate ran as Job 2 |
| `pm2 restart fastapi` | `docker compose pull api && up -d api` |
| `pm2 logs fastapi --lines 50` | `docker compose logs --tail 50 api` |
| `pm2 show fastapi` | `docker compose ps` |

The 5-attempt health-check loop is copied verbatim from `deploy-backend.yml:93-145` because it's known-good and the retry logic is not worth reinventing.

**Why `git fetch && reset --hard origin/main`:** the droplet still needs the updated `deploy/docker-compose.prod.yml` from the repo. Pulling only that file is possible but fragile; a full reset is idempotent and matches the existing deploy pattern.

### 4.6 Required GitHub secrets

Configure these at the repository level (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value source | Used in | Required? |
| ------ | ------------ | ------- | --------- |
| `PROD_DATABASE_URL` | Supabase async URL (`postgresql+asyncpg://...`) | migrate | Yes |
| `PROD_DATABASE_URL_SYNC` | Supabase sync URL (`postgresql+psycopg2://...`) | migrate | Yes |
| `PROD_MONGODB_URI` | MongoDB Atlas URL | migrate | Yes (settings validator) |
| `PROD_JWT_SECRET_KEY` | Current prod secret (lift from droplet `.env`) | migrate | Yes (settings validator) |
| `PROD_OPENAI_API_KEY` | Current prod key | migrate | Yes (settings may validate) |
| `GHCR_USERNAME` | GitHub username (e.g. `sungchunn`) | deploy | Yes |
| `GHCR_PAT` | Personal Access Token with `read:packages` scope | deploy | Yes |
| `DO_HOST` | DigitalOcean droplet IP | deploy | Already set |
| `DO_USERNAME` | SSH user (e.g. `deploy`) | deploy | Already set |
| `DO_SSH_KEY` | SSH private key | deploy | Already set |

**GHCR_PAT scope note:** A fine-grained token scoped to `read:packages` on this specific repository is enough. Do NOT reuse a classic token with `repo` + `write:packages` — the droplet only needs to pull, not push.

**GITHUB_TOKEN** is automatically provided to the workflow and has `packages: write` because we declared it in the top-level `permissions:` block. No need to create it.

---

## Verification

### 4.7 First merge smoke test

After all 5 secrets are configured and Supabase IP allow-list is verified:

1. **Open a trivial PR** — edit a comment in `backend/app/main.py` (e.g. add a `# ci-smoke: <date>` line). Do NOT change any migrations in this test merge.
2. **Merge to `main`** after `ci.yml` passes on the PR.
3. **Watch `cd.yml` execute:**
   - `build-and-push` — ~3 min cold, ~1 min warm. GHCR UI shows the new tag.
   - `migrate` — ~30 s for a no-op `alembic upgrade head`.
   - `deploy` — ~1 min. Health check attempts should succeed on the first try.
4. **SSH into the droplet** and verify:

   ```bash
   ssh deploy@$DO_HOST
   cd /home/deploy/app/deploy
   docker compose ps
   # Expect: resume-api and resume-redis both "healthy"

   docker inspect --format '{{.Config.Image}}' resume-api
   # Expect: ghcr.io/sungchunn/resume-builder-api:latest

   docker inspect --format '{{.Image}}' resume-api
   # Expect: sha256 digest matching GHCR

   curl -fsS http://localhost:8000/health | jq .
   # Expect: status=ok (whatever the current health schema is)
   ```

5. **Check GHCR** at `https://github.com/sungchunn/Resume-Builder/pkgs/container/resume-builder-api` — the new `sha-<commit>` tag should be visible with the expected digest.

### 4.8 Migration rollback drill

On a separate PR, create an intentionally-bad migration (e.g. `ALTER TABLE users ADD COLUMN invalid TYPE_THAT_DOES_NOT_EXIST`) and confirm:

- `build-and-push` succeeds (migration is just a file in the image).
- `migrate` fails with alembic's type-cast error.
- `deploy` does NOT run (`needs: migrate` gate).
- Production droplet still serves the old container.
- Reverting the bad migration commit and re-merging recovers cleanly.

---

## Edge cases and gotchas

1. **Settings validator import crash in migrate container.** If you add a new required env var in `app/core/config.py`, this workflow breaks silently the next time it runs. Add a test that imports `Settings` with a minimal env set and assert it doesn't raise.
2. **`alembic upgrade head` idempotency.** Running it twice is safe (second run is a no-op). This is critical because workflow retries will re-invoke it.
3. **GHCR image not public by default.** The first push creates a private package. You can leave it private; the droplet authenticates via `GHCR_PAT`. If you later decide to make it public, do it via GHCR UI, not via the workflow.
4. **`docker login` password-stdin quoting.** Use `echo '${{ secrets.GHCR_PAT }}' | docker login ... --password-stdin`. Do NOT use `-p` on the command line — the PAT ends up in shell history on the droplet.
5. **`appleboy/ssh-action` script heredoc quoting.** The `${{ secrets.X }}` interpolation happens in GHA before the script reaches the droplet. That means the secret value ends up inlined in the script sent over SSH. Acceptable because the channel is encrypted, but do not log the script contents.
6. **Supabase connection pooler vs direct.** Alembic uses a single long-lived connection and migrations can run DDL. Some connection poolers (PgBouncer in transaction mode) disallow prepared statements, which asyncpg uses by default. If migrations fail with "prepared statement does not exist", switch the migrate job to the direct Supabase endpoint or disable asyncpg prepared statements.
7. **Concurrent deploys + `cancel-in-progress: false`.** Two quick merges will run `cd.yml` twice in sequence. Total deploy time doubles. Acceptable for this repo; revisit only if merge frequency grows.
8. **Retrying a failed deploy.** `docker compose pull` is idempotent but `docker image prune -f` on retry may delete an image that's still in use by a half-stopped container — the retry handles it, but watch the logs on first use.
9. **`git reset --hard` wipes droplet-local edits.** If someone SSHs in and edits `/home/deploy/app/deploy/docker-compose.prod.yml` manually, the next deploy overwrites it. This is correct and intentional, but document it in Phase 5.
10. **`docker image prune -f` may delete the previous tag.** Good for disk hygiene, bad for quick rollback. If you need offline rollback to the N-1 image, replace with `docker image prune -f --filter "until=168h"` to keep the last week of images.

---

## Rollback

### Rolling back the workflow file

```bash
rm .github/workflows/cd.yml
```

`deploy-backend.yml` still handles deploys until Phase 5, so removing `cd.yml` is non-breaking.

### Rolling back a bad production deploy (mid-deploy failure)

On the droplet:

```bash
cd /home/deploy/app/deploy
# Find the previous tag from GHCR UI or local image list
docker image ls ghcr.io/sungchunn/resume-builder-api

# Edit compose file to pin the previous SHA
sed -i 's|:latest|:sha-<PREVIOUS_SHA>|' docker-compose.prod.yml

docker compose pull api
docker compose up -d api
curl -fsS http://localhost:8000/health
```

Then revert the offending commit on `main` to get the compose file back in sync with what's running. Future improvement: accept an `IMAGE_TAG` input via `workflow_dispatch` so rollback is one manual workflow-run instead of SSH.

---

## Files modified

| Path | Action |
| ---- | ------ |
| `.github/workflows/cd.yml` | Create |

No code changes. Secrets are configured via the GitHub UI, not committed.

---

## Completion checklist

- [ ] All 7 new secrets configured at repository level
- [ ] Supabase IP allow-list pre-flight verified (connection pooler URL identified if restrictions are on)
- [ ] `cd.yml` committed with the three jobs: build-and-push, migrate, deploy
- [ ] Concurrency group set to `cd-${{ github.ref }}` with `cancel-in-progress: false`
- [ ] Top-level permissions include `packages: write`
- [ ] Build job uses GHA layer cache (`type=gha` / `mode=max`)
- [ ] Migrate job passes every env var the settings validator requires
- [ ] Deploy job reuses the 5-attempt health-check retry from the old workflow
- [ ] First trivial merge shows all three jobs green end-to-end
- [ ] Droplet `docker compose ps` reports `resume-api` with the expected digest
- [ ] GHCR shows `:latest` and `sha-<commit>` tags pointing at the same digest
- [ ] Rollback drill tested with an intentionally-bad migration on a throwaway PR

---

## Next phase

Proceed to [phase-5-cutover-and-cleanup.md](./phase-5-cutover-and-cleanup.md) to run the one-time droplet prep (install Docker, stop pm2 and systemd redis, populate `.env`) and delete the old `deploy-backend.yml`.
