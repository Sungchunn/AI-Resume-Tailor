# Redis Self-Hosted Migration

## Overview

Migrate from Upstash (managed Redis) to self-hosted Redis on the existing DigitalOcean droplet. **No code changes required** - only infrastructure setup and environment variable update.

## Why This is Simple

- Codebase uses standard `redis.asyncio` library with no Upstash-specific features
- All Redis data is ephemeral cache with TTLs (no migration needed)
- FastAPI backend already runs on the droplet, so Redis can bind to localhost

---

## Current Deployment Setup

Based on `.github/workflows/deploy-backend.yml`:

| Component | Setup |
| --------- | ----- |
| **Process Manager** | PM2 (process name: `fastapi`) |
| **App Location** | `/home/deploy/app` |
| **Backend Path** | `/home/deploy/app/backend` |
| **Python** | Poetry-managed virtualenv |
| **Restart Command** | `pm2 restart fastapi` |

---

## Changes Required

| Type | Change |
| ---- | ------ |
| **Infrastructure** | Install and configure Redis on DigitalOcean droplet |
| **Environment** | Update `REDIS_URL` in `.env` on droplet |
| **Code** | None |

---

## Step-by-Step Implementation

### Phase 1: Install Redis on Droplet

SSH into the DigitalOcean droplet:

```bash
ssh root@your-droplet-ip
# or: ssh deploy@your-droplet-ip (depending on your user)

# Install Redis
sudo apt update
sudo apt install redis-server -y

# Verify installation
redis-server --version
```

### Phase 2: Configure Redis

Edit `/etc/redis/redis.conf`:

```bash
sudo nano /etc/redis/redis.conf
```

**Key settings to change:**

```text
# Security - bind to localhost only (no external access)
# Find and update these lines:
bind 127.0.0.1 -::1
protected-mode yes

# Memory limit - for 1GB droplet
# Find maxmemory and set it:
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence - keep defaults (RDB snapshots)
save 900 1
save 300 10
save 60 10000
```

### Phase 3: Start Redis Service

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server

# Test connection
redis-cli ping
# Expected: PONG
```

### Phase 4: Update Environment Variable

Edit the backend `.env` file on the droplet:

```bash
nano /home/deploy/app/backend/.env
```

**Before:**

```text
REDIS_URL=rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379
```

**After:**

```text
REDIS_URL=redis://localhost:6379
```

### Phase 5: Restart Backend with PM2

```bash
pm2 restart fastapi
pm2 save

# Verify it's running
pm2 status
pm2 logs fastapi --lines 20
```

---

## Verification

1. **Check Redis is running:**

   ```bash
   redis-cli ping
   redis-cli DBSIZE
   ```

2. **Check PM2 status:**

   ```bash
   pm2 status
   pm2 logs fastapi --lines 50
   ```

3. **Monitor Redis activity (optional):**

   ```bash
   redis-cli MONITOR
   # Press Ctrl+C to stop
   ```

4. **Test the API:**

   ```bash
   curl http://localhost:8000/health
   ```

---

## Rollback Plan

If anything goes wrong, revert in 2 steps:

```bash
# 1. Edit .env back to Upstash
nano /home/deploy/app/backend/.env
# Change to: REDIS_URL=rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379

# 2. Restart backend
pm2 restart fastapi
```

---

## Security Notes

- Redis binds to `127.0.0.1` only - no external access possible
- Ensure port 6379 is NOT open in DigitalOcean firewall (check via DO dashboard)
- Cached data includes AI responses and rate limit counters; parsed resume content may contain PII but is protected by localhost-only binding
- Optional: Add password authentication for defense in depth (see `implementation-record.md`)

---

## Post-Migration

After verifying everything works for a few days:

1. Cancel/delete the Upstash Redis database to stop billing
2. Optionally remove unused env vars from `.env`: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

## Quick Reference Commands

```bash
# Redis status
sudo systemctl status redis-server
redis-cli ping
redis-cli INFO memory

# Backend status
pm2 status
pm2 logs fastapi --lines 50
pm2 restart fastapi

# Check connections
redis-cli CLIENT LIST
```

---

## Memory Sizing Guide

| Droplet RAM | Recommended maxmemory | Notes |
| ----------- | --------------------- | ----- |
| 1GB | 128-256mb | Leave headroom for OS and FastAPI |
| 2GB | 256-512mb | Good balance |
| 4GB | 512mb-1gb | Generous caching |
| 8GB+ | 1-2gb | Maximum cache benefit |

The `allkeys-lru` eviction policy automatically removes least-recently-used keys when memory limit is reached, which is ideal for caching workloads.
