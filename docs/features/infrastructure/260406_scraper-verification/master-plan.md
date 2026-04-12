# Scheduled Scraper Verification Plan

## Overview

Verify that the 3 scheduled jobs work correctly in both local (Docker Compose) and hosted (DigitalOcean) environments.

## The 3 Scheduled Jobs

| Job | Schedule | Purpose |
| --- | -------- | ------- |
| Daily LinkedIn Scraper | 6:00 AM UTC (configurable via DB) | Scrape jobs from active presets |
| Daily Job Cleanup | 3:00 AM UTC (hardcoded) | Delete jobs older than 21 days |
| Schedule Reconfiguration | On startup + via API | Update scheduler from DB settings |

## Key Files

- `backend/app/services/scraping/scheduler.py` - Core scheduler logic
- `backend/app/api/routes/admin.py` - Admin API endpoints
- `backend/app/main.py` - Scheduler startup on app boot

---

## Verification Steps

### Step 1: Verify Scheduler is Running

**Local (Docker Compose):**

```bash
# Start services
docker-compose up -d

# Check backend logs for scheduler startup
docker-compose logs backend | grep -E "(Scheduler started|Scraper job registered|Cleanup job registered)"
```

**Expected log output:**

```text
Scraper job registered at 06:00 UTC
Cleanup job registered at 03:00 UTC (retention: 21 days)
Scheduler started. Next scraper run: <datetime>
```

**Hosted (DigitalOcean):**

```bash
ssh user@your-droplet
pm2 logs backend --lines 100 | grep -E "(Scheduler started|Scraper job registered)"
```

---

### Step 2: Verify Status via API

**Get admin JWT token first:**

```bash
# Login (replace credentials)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}'
```

**Check scheduler status:**

```bash
curl -X GET http://localhost:8000/api/admin/scraper/status \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected response:**

```json
{
  "scheduler_running": true,
  "scraper_enabled": true,
  "next_run_time": "2026-04-07T06:00:00+00:00",
  "last_run_time": null,
  "last_run_result": null
}
```

---

### Step 3: Verify Schedule Settings

**Check current schedule:**

```bash
curl -X GET http://localhost:8000/api/admin/scraper/schedule \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected response:**

```json
{
  "id": 1,
  "is_enabled": true,
  "schedule_type": "daily",
  "schedule_hour": 6,
  "schedule_minute": 0,
  "schedule_timezone": "Asia/Bangkok",
  "next_run_at": "2026-04-07T06:00:00+07:00"
}
```

---

### Step 4: Verify Active Presets Exist

```bash
curl -X GET http://localhost:8000/api/admin/scraper/presets \
  -H "Authorization: Bearer <TOKEN>"
```

**Prerequisite:** At least one active preset must exist for scraper to run.

---

### Step 5: Manually Trigger Scraper

```bash
curl -X POST http://localhost:8000/api/admin/scraper/trigger \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected response (success):**

```json
{
  "status": "success",
  "total_jobs_found": 25,
  "total_jobs_created": 20,
  "total_jobs_updated": 5,
  "total_errors": 0
}
```

**Expected response (already running):**

```text
HTTP 409: "Scraper is already running on another instance"
```

---

### Step 6: Verify Run History Recorded

```bash
curl -X GET "http://localhost:8000/api/admin/scraper/history?limit=5" \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected:** Recent run appears in history with status, duration, and job counts.

---

### Step 7: Manually Trigger Cleanup

```bash
curl -X POST http://localhost:8000/api/admin/jobs/cleanup \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected response:**

```json
{
  "status": "success",
  "deleted_count": 15,
  "duration_seconds": 0.52,
  "error": null
}
```

---

### Step 8: Verify Distributed Locking (Redis)

**Local:**

```bash
# Check for locks during job execution
docker exec -it resume-tailor-redis redis-cli KEYS "*lock*"

# While scraper is running:
docker exec -it resume-tailor-redis redis-cli GET scraper:distributed_lock
```

**Expected:** Returns UUID when job is running, nil otherwise.

---

### Step 9: Test Schedule Reconfiguration

```bash
# Update schedule to different time
curl -X PATCH http://localhost:8000/api/admin/scraper/schedule \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"schedule_hour": 7, "schedule_minute": 30}'

# Verify next_run_at updated
curl -X GET http://localhost:8000/api/admin/scraper/schedule \
  -H "Authorization: Bearer <TOKEN>"
```

---

### Step 10: Test Schedule Toggle

```bash
# Toggle schedule off
curl -X POST http://localhost:8000/api/admin/scraper/schedule/toggle \
  -H "Authorization: Bearer <TOKEN>"

# Verify next_run_at is null when disabled
```

---

## Verification Checklist

### Local Docker Compose

| Check | Command | Expected |
| ----- | ------- | -------- |
| Scheduler started | Check logs | "Scheduler started" message |
| Status API | GET /admin/scraper/status | `scheduler_running: true` |
| Schedule settings | GET /admin/scraper/schedule | Returns config |
| Presets exist | GET /admin/scraper/presets | At least 1 active |
| Scraper trigger | POST /admin/scraper/trigger | Returns batch result |
| History recorded | GET /admin/scraper/history | Shows recent runs |
| Cleanup trigger | POST /admin/jobs/cleanup | Returns deleted count |
| Redis lock | redis-cli GET scraper:distributed_lock | UUID during run |

### Hosted (DigitalOcean)

| Check | Command | Expected |
| ----- | ------- | -------- |
| PM2 running | pm2 status | Backend "online" |
| Logs | pm2 logs backend | "Scheduler started" |
| Status API | GET /admin/scraper/status | `scheduler_running: true` |
| Upstash Redis | Check console | Lock keys visible |
| Supabase DB | Query scraper_runs | Runs persisted |

---

## Common Issues

1. **"No active presets found"** - Create at least one active preset
2. **"Scraper is disabled"** - Check `SCRAPER_ENABLED` env var
3. **409 Conflict** - Another instance is running (distributed lock)
4. **Budget exceeded** - Check APIFY cost limits via `/admin/scraper/costs`

---

## Database Verification Queries

```sql
-- Check schedule settings
SELECT * FROM scraper_schedule_settings WHERE id = 1;

-- Check active presets
SELECT id, name, url, count, is_active FROM scraper_presets WHERE is_active = true;

-- Check recent runs
SELECT id, run_type, status, started_at, total_jobs_found, triggered_by
FROM scraper_runs
ORDER BY started_at DESC LIMIT 10;

-- Check job counts
SELECT COUNT(*) as total_jobs,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_jobs
FROM job_listings;
```
