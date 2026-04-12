# Phase 5 — Cutover: Droplet Prep + Remove Old Workflow

**Parent:** [master-plan.md](./master-plan.md)
**Status:** Planning
**Goal:** Convert the live droplet from the pm2 + systemd-redis + host-Python stack to the docker-compose stack, then delete `.github/workflows/deploy-backend.yml` so the pipeline is single-source.

---

## Objective

Phase 5 is the only phase that touches the live droplet. It runs the one-time Docker install, stops the existing pm2 fastapi process and systemd Redis service, seeds `.env` and `deploy/docker-compose.prod.yml`, brings up the new containerised stack, verifies it serves traffic, then deletes the legacy `deploy-backend.yml` workflow so future merges only run `cd.yml`.

This is the only phase with production downtime risk. Plan it for a low-traffic window.

---

## Why droplet prep and workflow deletion must happen together

If `deploy-backend.yml` is deleted first, merges to `main` stop deploying and the droplet drifts from `main`. If droplet prep happens first without deleting the old workflow, the next merge runs both `deploy-backend.yml` (pm2 path) and `cd.yml` (docker compose path) — the pm2 path starts a second copy of FastAPI on port 8000, collides with the container, and one of them crashes. Both problems are avoidable if the entire cutover is a single PR + SSH session.

**Cutover order (authoritative):**

1. Phases 1–4 already merged to `main`.
2. SSH into droplet, do the prep work, bring up the container stack manually.
3. Verify nginx → container → `/health` is green.
4. Open the PR that deletes `deploy-backend.yml`.
5. Merge. `cd.yml` runs once to deploy the same commit that contains the deletion — harmless re-deploy.
6. Confirm the droplet is still green on the same image tag.

---

## Prerequisites

- Phases 1–4 merged and all green on a recent merge.
- GHCR has at least one successful image tag (verify from GHA UI).
- `GHCR_USERNAME` / `GHCR_PAT` secrets configured (Phase 4).
- Current production `.env` contents available — you'll copy them into the new location with one change (`REDIS_URL`).
- Maintenance window communicated (even if short). Expected downtime: 30–60 s during the pm2 → container handoff, assuming no migration failures.
- Database backup taken within the last hour (`pg_dump` against Supabase) in case a rollback is needed.

---

## Implementation

### 5.1 Pre-cutover snapshot

Before touching anything, capture the current state so rollback is a known destination:

```bash
ssh deploy@$DO_HOST

# System snapshot
uname -a
cat /etc/os-release

# What's running
pm2 list > /tmp/pm2-before.txt
systemctl status redis > /tmp/redis-before.txt || true
ss -tlnp | grep -E '(8000|6379)' > /tmp/ports-before.txt

# Current .env hash (redacted — just so you know if it changes)
sha256sum /home/deploy/app/backend/.env

# Nginx upstream config
sudo nginx -T 2>/dev/null | grep -A3 'upstream\|proxy_pass'

# Current git state
cd /home/deploy/app && git log -1 --oneline
```

Keep `/tmp/pm2-before.txt`, `/tmp/redis-before.txt`, `/tmp/ports-before.txt` for the duration of the cutover.

### 5.2 Install Docker Engine + Compose plugin

Docker is not currently installed on the droplet. Install it via the official convenience script:

```bash
# On the droplet
curl -fsSL https://get.docker.com | sudo sh

# Add the deploy user to the docker group so it can run docker without sudo
sudo usermod -aG docker deploy

# Reload group membership (or SSH out and back in)
exec sudo -iu deploy

# Verify
docker --version
docker compose version
```

**Version expectations:** Docker Engine ≥ 24, Compose plugin ≥ 2.20. If the droplet is Ubuntu 22.04 LTS, the convenience script installs the current stable (≥25 as of 2026-04).

### 5.3 Authenticate to GHCR

```bash
# On the droplet
echo '<GHCR_PAT_VALUE>' | docker login ghcr.io -u '<GHCR_USERNAME>' --password-stdin
```

The credentials persist in `~/.docker/config.json` (base64-encoded, not encrypted — do not share the droplet with untrusted users). `cd.yml` re-runs `docker login` on every deploy, but doing it manually here lets the first manual `docker compose pull` succeed.

### 5.4 Stop pm2 and systemd Redis

The new Redis container will bind to port 6379, which the systemd Redis currently owns. FastAPI on port 8000 will similarly collide.

```bash
# Stop and disable pm2 fastapi
pm2 stop fastapi
pm2 delete fastapi
pm2 save

# Optional: uninstall pm2 entirely after cutover is verified
# (keep it for now in case rollback is needed)

# Stop and disable systemd Redis
sudo systemctl stop redis
sudo systemctl disable redis

# Confirm ports are free
ss -tlnp | grep -E '(8000|6379)' || echo "ports free"
```

**Do not uninstall** pm2 or the system Redis package yet — Phase 5 rollback depends on them being reinstallable quickly. Delete them in a follow-up PR after a week of stable operation.

### 5.5 Seed `/home/deploy/app/deploy/.env`

`deploy/docker-compose.prod.yml` reads `env_file: .env` from its own directory (`/home/deploy/app/deploy/.env`), not from the repo root and not from `backend/.env`.

```bash
mkdir -p /home/deploy/app/deploy

# Copy the current backend/.env to the new location
cp /home/deploy/app/backend/.env /home/deploy/app/deploy/.env

# CRITICAL: Override REDIS_URL to use the container DNS name.
# Inside the compose network, Redis is reachable as "redis", not "localhost".
sed -i 's|^REDIS_URL=.*$|REDIS_URL=redis://redis:6379|' /home/deploy/app/deploy/.env

# Permission lockdown — secrets should not be world-readable
chmod 600 /home/deploy/app/deploy/.env
chown deploy:deploy /home/deploy/app/deploy/.env

# Sanity check
grep -E '^(REDIS_URL|DATABASE_URL|MONGODB_URI|JWT_SECRET_KEY)=' /home/deploy/app/deploy/.env | \
  sed 's|=.*|=<set>|'
```

Expected output:

```text
DATABASE_URL=<set>
MONGODB_URI=<set>
REDIS_URL=<set>
JWT_SECRET_KEY=<set>
```

**Why the REDIS_URL override matters:** the old systemd Redis was reachable at `redis://localhost:6379`. The new compose network gives Redis the DNS name `redis`. If you forget this override, the API container starts, passes the health check (which doesn't hit Redis), then fails on the first cache read with `ConnectionRefusedError`. That failure mode is easy to misdiagnose as a container-networking issue.

### 5.6 Pull the latest repo state

The droplet already has a git clone at `/home/deploy/app`. Pull to get `deploy/docker-compose.prod.yml`:

```bash
cd /home/deploy/app
git fetch origin
git reset --hard origin/main

# Confirm the compose file exists
ls -la deploy/docker-compose.prod.yml
```

### 5.7 First manual deploy

```bash
cd /home/deploy/app/deploy

# Pull the image
docker compose -f docker-compose.prod.yml pull

# Bring up the stack detached
docker compose -f docker-compose.prod.yml up -d

# Tail logs for 30 s to watch startup
timeout 30 docker compose -f docker-compose.prod.yml logs -f || true

# Health check
curl -fsS http://localhost:8000/health | jq .

# Container status
docker compose -f docker-compose.prod.yml ps
```

Expected `docker compose ps` output:

```text
NAME            STATUS                   PORTS
resume-api      Up 25s (healthy)         127.0.0.1:8000->8000/tcp
resume-redis    Up 30s (healthy)         6379/tcp
```

If `resume-api` is `Up` but `(unhealthy)`, the healthcheck is failing. `docker compose logs api --tail 100` will show why — the most common cause is a missing env var that triggers a pydantic-settings validation error on boot.

### 5.8 Nginx validation

Nginx is already configured to proxy to `127.0.0.1:8000`, and the compose file binds the API to the same loopback port, so nginx should work unchanged. Verify:

```bash
# Public hostname check
curl -fsS https://<prod-hostname>/health | jq .

# Check nginx error log for any recent connection refusals
sudo tail -n 50 /var/log/nginx/error.log
```

If nginx is caching a DNS resolution or has a stale keepalive connection to the old pm2 process, reload it:

```bash
sudo systemctl reload nginx
```

### 5.9 Delete the legacy workflow

Back on your laptop (or in the GitHub web UI), open a PR:

```bash
git checkout -b chore/remove-legacy-deploy-workflow
git rm .github/workflows/deploy-backend.yml
git commit -m "infra: remove legacy pm2 deploy workflow after docker cutover"
git push origin chore/remove-legacy-deploy-workflow
```

Open the PR, confirm `ci.yml` passes, merge to `main`. On merge, `cd.yml` runs and:

1. Builds the same image (layer cache makes this fast).
2. Runs `alembic upgrade head` — no new migrations, a no-op.
3. SSHs in and re-pulls the same image tag, re-runs compose up.

The droplet should end in the same state it's already in. If it doesn't, something is wrong with `cd.yml` and the SSH script — do not proceed until the re-deploy is also green.

### 5.10 Post-cutover verification (the full smoke test)

1. **Container health:**

   ```bash
   ssh deploy@$DO_HOST 'cd /home/deploy/app/deploy && docker compose ps'
   ```

   Expect: `resume-api` and `resume-redis` both `(healthy)`.

2. **Image tag matches latest successful merge:**

   ```bash
   ssh deploy@$DO_HOST 'docker inspect --format "{{.Config.Image}}" resume-api'
   ```

   Expect: `ghcr.io/sungchunn/resume-builder-api:latest`.

3. **Public health endpoint:**

   ```bash
   curl -fsS https://<prod-hostname>/health | jq .
   ```

   Expect: HTTP 200, JSON body with `status=ok` (or current schema).

4. **pm2 is stopped:**

   ```bash
   ssh deploy@$DO_HOST 'pm2 list'
   ```

   Expect: no `fastapi` process.

5. **systemd Redis is stopped:**

   ```bash
   ssh deploy@$DO_HOST 'systemctl is-active redis'
   ```

   Expect: `inactive`.

6. **Container Redis is reachable from the API container:**

   ```bash
   ssh deploy@$DO_HOST 'docker compose -f /home/deploy/app/deploy/docker-compose.prod.yml exec api python -c "import redis; r = redis.from_url(\"redis://redis:6379\"); print(r.ping())"'
   ```

   Expect: `True`.

7. **PDF export works:**

   Hit a resume export endpoint from a logged-in session and confirm the PDF downloads. This is the WeasyPrint runtime-libs sanity check — if this fails, Phase 1 missed a pango/cairo dependency.

8. **`docker image prune` hasn't evicted the previous image:**

   ```bash
   ssh deploy@$DO_HOST 'docker image ls ghcr.io/sungchunn/resume-builder-api'
   ```

   Expect: at least two tags (`:latest` and a `sha-*`). Useful for quick rollback.

---

## Edge cases and gotchas

1. **systemd Redis auto-restart.** If `systemd` is configured with `Restart=always` on the Redis unit, stopping it isn't enough — disable it too (`systemctl disable redis`). Otherwise the next reboot races the container Redis for port 6379.
2. **pm2 startup script.** pm2 installs a systemd unit (`pm2-deploy.service`) that auto-starts saved processes on boot. After deleting the `fastapi` process and running `pm2 save`, the unit is safe. To be extra cautious: `sudo systemctl disable pm2-deploy`.
3. **Nginx cached upstream.** Nginx sometimes caches DNS responses and stale keepalive connections. If the public endpoint is slow or returning 502 immediately after cutover, `sudo nginx -s reload` flushes it.
4. **`.env` drift.** The old workflow's `git reset --hard` on the droplet wiped any local `backend/.env` edits. If a past SSH session hand-edited that file, those edits are already gone — make sure the new `/home/deploy/app/deploy/.env` has every value the old pm2 path was using.
5. **`/home/deploy/app/deploy/` vs `/home/deploy/app/backend/`.** They are different directories and they hold different `.env` files. The container reads `deploy/.env`; nothing reads `backend/.env` any more. Delete `backend/.env` after the first successful day of container operation to avoid drift.
6. **Image pull requires authentication on every deploy.** `docker login` is persistent across container restarts but not across Docker Engine reinstall or `config.json` wipes. `cd.yml` re-authenticates on every run, so this is only a concern for manual SSH-driven deploys.
7. **Disk pressure from old images.** `docker image prune -f` in `cd.yml` cleans dangling images but not old tagged versions. On a 25 GB droplet with a 250 MB image, 100 deploys = 25 GB. Schedule a monthly `docker image prune -a --filter "until=720h" -f` cron to evict images older than 30 days.
8. **Log rotation.** The compose file sets JSON log rotation (10 MB × 3 files for API, 5 MB × 2 for Redis). Without those settings the droplet disk fills in weeks. Verify the settings are active via `docker inspect resume-api | grep -A5 LogConfig`.
9. **Clock skew.** TLS to Supabase fails if the droplet clock drifts. `timedatectl status` — expect "System clock synchronized: yes". Not caused by the cutover, but easy to notice while you're already logged in.

---

## Rollback

### Immediate rollback (< 5 min): restore pm2 path

If the container stack fails to serve traffic after 5.7, roll back to pm2:

```bash
ssh deploy@$DO_HOST

# Stop the containers
cd /home/deploy/app/deploy
docker compose -f docker-compose.prod.yml down

# Restart systemd Redis
sudo systemctl enable redis
sudo systemctl start redis

# Restart pm2 fastapi
cd /home/deploy/app/backend
poetry install --no-interaction
pm2 start 'poetry run uvicorn app.main:app --host 127.0.0.1 --port 8000' --name fastapi
pm2 save

# Verify
curl -fsS http://localhost:8000/health
```

This works because Phase 5.4 only stopped pm2 and Redis — it didn't uninstall them.

If this path is still working a week later, schedule a follow-up PR to uninstall pm2, Poetry, and system Python packages from the droplet.

### Workflow-level rollback

If `deploy-backend.yml` was already deleted and `cd.yml` is broken in a way that needs fixing before the next deploy:

```bash
git revert <sha-of-workflow-deletion>
git push
```

Recovers the old workflow. The next merge runs both workflows again temporarily. Fix `cd.yml`, re-delete `deploy-backend.yml` in a follow-up PR.

### Image-level rollback

If the current image is broken and a previous one works, pin the compose file:

```bash
ssh deploy@$DO_HOST
cd /home/deploy/app/deploy
sed -i 's|:latest|:sha-<PREVIOUS_SHA>|' docker-compose.prod.yml
docker compose pull api
docker compose up -d api
curl -fsS http://localhost:8000/health
```

Revert the bad commit on `main` afterwards so the compose file in git matches what's running.

---

## Files modified

| Path | Action |
| ---- | ------ |
| `.github/workflows/deploy-backend.yml` | Delete |
| Droplet `/home/deploy/app/deploy/.env` | Create (manual, not in repo) |
| Droplet Docker installation | Manual install |
| Droplet `~/.docker/config.json` | Credentials persist from `docker login` |
| pm2 `fastapi` process | Stop + delete |
| systemd `redis.service` | Stop + disable |

No code changes in the repo other than the workflow deletion.

---

## Completion checklist

- [ ] Pre-cutover snapshot captured (`pm2 list`, `systemctl status redis`, port listeners)
- [ ] Database backup taken within the last hour
- [ ] Docker Engine and Compose plugin installed on droplet
- [ ] `deploy` user added to `docker` group
- [ ] GHCR authentication succeeded via `docker login`
- [ ] pm2 `fastapi` process stopped and deleted, `pm2 save` run
- [ ] systemd Redis stopped and disabled
- [ ] `/home/deploy/app/deploy/.env` created with correct `REDIS_URL=redis://redis:6379` override
- [ ] `.env` permissions are `600` owned by `deploy:deploy`
- [ ] `deploy/docker-compose.prod.yml` present in droplet clone (git pulled)
- [ ] `docker compose up -d` brings both services to `(healthy)`
- [ ] Local `/health` responds 200
- [ ] Public `/health` via nginx responds 200
- [ ] PDF export sanity test passed (WeasyPrint works in the container)
- [ ] Redis connectivity verified from inside the `api` container
- [ ] PR deleting `deploy-backend.yml` merged cleanly
- [ ] `cd.yml` runs green on the deletion merge
- [ ] Droplet still healthy after the automated re-deploy
- [ ] One-week follow-up PR scheduled to uninstall pm2 / systemd-redis packages

---

## Next phase

None — Phase 5 closes the feature. Follow-up items (pm2 uninstall, image-tag rollback via `workflow_dispatch` input, separate staging environment) belong in new feature directories. Consider documenting them in `docs/planning/` as an "infra debt" backlog entry.
