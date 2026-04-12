# Fix Production Database Connection Config

## Context

Supabase dashboard shows a slow internal role-settings query accumulating ~41.9s across thousands of calls. The backend's connection pooling setup is already well-configured (NullPool + port 6543 + disabled prepared statements), but two `.env` config issues were found during audit.

## Changes

### 1. Add `prepared_statement_cache_size=0` to `DATABASE_URL`

- **What:** Append `?prepared_statement_cache_size=0` to the async DATABASE_URL
- **Why:** Belt-and-suspenders with the `connect_args` in `session.py` — ensures asyncpg doesn't cache prepared statements even if connect_args are bypassed

### 2. Switch `DATABASE_URL_SYNC` to direct connection (port 5432)

- **What:** Change from pooler host (`pooler.supabase.com:6543`) to direct host (`db.supabase.co:5432`)
- **Why:** DDL operations in Alembic migrations can interact poorly with PgBouncer's transaction pooling mode

## Where to Apply

Env vars are managed manually in three independent locations. CI/CD does **not** sync them — each must be updated separately.

| Location | Path | Used By |
| -------- | ---- | ------- |
| Local dev | `backend/.env` | Local development |
| GitHub Actions Secrets | Repo Settings > Secrets > Actions | Migration job (`PROD_DATABASE_URL`, `PROD_DATABASE_URL_SYNC`) |
| Droplet | `/home/deploy/app/deploy/.env` | Production container (loaded via `env_file` in `docker-compose.prod.yml`) |

## Steps

### Local (`backend/.env`)

Update both `DATABASE_URL` and `DATABASE_URL_SYNC` directly in the file.

### GitHub Actions Secrets

Go to **GitHub > Repo Settings > Secrets and variables > Actions** and update:

- `PROD_DATABASE_URL` — add `?prepared_statement_cache_size=0`
- `PROD_DATABASE_URL_SYNC` — switch host to `db.<project-ref>.supabase.co:5432`

### Droplet

```bash
ssh deploy@<droplet-ip>
nano /home/deploy/app/deploy/.env
# Apply the same two changes
cd /home/deploy/app/deploy
docker compose -f docker-compose.prod.yml up -d api
```

## Verification

- **Local:** Run `poetry run alembic current` to verify sync URL connects
- **GitHub Secrets:** Trigger a deploy (push to `main`) and confirm the migration job succeeds
- **Droplet:** After restarting the container, run `docker logs resume-api --tail 20` to confirm healthy startup
- **Supabase:** Monitor query performance dashboard for changes in role-settings query frequency/timing
