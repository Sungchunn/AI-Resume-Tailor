# Redis Self-Hosted Migration - Implementation Record

**Completed:** 2026-04-08
**Server:** DigitalOcean Droplet (Resume-Tailor)
**Redis Version:** 7.0.15

---

## Pre-Migration State

- **Previous Provider:** Upstash (managed Redis with TLS)
- **Connection String:** `rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379`
- **Backend:** FastAPI running via PM2

---

## Implementation Steps

### Step 1: Install Redis

```bash
ssh root@your-droplet-ip

sudo apt update
sudo apt install redis-server -y

# Verify installation
redis-server --version
# Output: Redis server v=7.0.15 sha=00000000:0 malloc=jemalloc-5.3.0 bits=64 build=b30e82fcf6da7c56
```

### Step 2: Configure Redis

```bash
sudo nano /etc/redis/redis.conf
```

**Settings configured:**

| Setting | Value | Purpose |
| ------- | ----- | ------- |
| `bind` | `127.0.0.1 -::1` | Localhost only (security) |
| `protected-mode` | `yes` | Default, prevents external access |
| `maxmemory` | `256mb` | Memory limit for 1GB droplet |
| `maxmemory-policy` | `allkeys-lru` | Evict least-recently-used keys when full |

**How to add maxmemory settings:**

1. Press `Ctrl+W` and search for `maxmemory`
2. Find the line `# maxmemory <bytes>`
3. Add these two lines directly below it (no `#` prefix):

   ```text
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   ```

4. Save with `Ctrl+O`, Enter, then exit with `Ctrl+X`

### Step 3: Start Redis Service

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server

# Test connection
redis-cli ping
# Output: PONG
```

**Expected status output:**

```text
● redis-server.service - Advanced key-value store
     Loaded: loaded (/usr/lib/systemd/system/redis-server.service; enabled; preset: enabled)
     Active: active (running)
     Status: "Ready to accept connections"
```

### Step 4: Update Environment Variable

```bash
nano /home/deploy/app/backend/.env
```

**Change:**

```text
# Before (Upstash)
REDIS_URL=rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379

# After (self-hosted)
REDIS_URL=redis://localhost:6379
```

### Step 5: Restart Backend

```bash
pm2 restart fastapi
pm2 save
pm2 status
pm2 logs fastapi --lines 20
```

---

## Verification Results

### Redis Status

```bash
redis-cli ping
# Output: PONG

redis-cli DBSIZE
# Output: (integer) 2
```

### PM2 Status

```text
┌────┬────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name       │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │
├────┼────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ fastapi    │ default     │ N/A     │ fork    │ 98905    │ 2m     │ 35   │ online    │ 0%       │ 26.8mb   │
└────┴────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┘
```

### Application Logs

```text
INFO:     Application startup complete.
```

No Redis connection errors.

### Health Check

```bash
curl http://localhost:8000/health
# Output: {"status":"healthy","checks":{"postgres":"ok","mongodb":"ok"}}
```

### Verify Localhost Binding

```bash
ss -tlnp | grep 6379
# Should show 127.0.0.1:6379 only, NOT 0.0.0.0:6379
```

---

## Security Configuration

| Security Measure | Status | Notes |
| ---------------- | ------ | ----- |
| Localhost binding | Enabled | `bind 127.0.0.1 -::1` |
| Protected mode | Enabled | Default `yes` |
| Firewall (port 6379) | Not exposed | Verify in DO dashboard |
| Password auth | Not configured | Optional for localhost-only |

### Optional: Add Password Authentication

For defense in depth, you can add a password:

```bash
sudo nano /etc/redis/redis.conf
# Find and set: requirepass your-strong-password-here

sudo systemctl restart redis-server
```

Update `.env`:

```text
REDIS_URL=redis://:your-strong-password-here@localhost:6379
```

Then restart FastAPI:

```bash
pm2 restart fastapi
```

---

## Quick Reference Commands

```bash
# Redis service management
sudo systemctl status redis-server
sudo systemctl restart redis-server
sudo systemctl stop redis-server

# Redis CLI
redis-cli ping                    # Test connection
redis-cli DBSIZE                  # Count cached keys
redis-cli INFO memory             # Memory usage stats
redis-cli MONITOR                 # Watch live commands (Ctrl+C to stop)
redis-cli CLIENT LIST             # Show connected clients
redis-cli FLUSHALL                # Clear all data (use with caution)

# Backend management
pm2 status                        # Check FastAPI status
pm2 logs fastapi --lines 50       # View recent logs
pm2 restart fastapi               # Restart backend

# Verify security
ss -tlnp | grep 6379              # Check Redis is localhost-only
```

---

## Rollback Procedure

If issues occur, revert to Upstash:

```bash
# 1. Update environment
nano /home/deploy/app/backend/.env
# Change to: REDIS_URL=rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379

# 2. Restart backend
pm2 restart fastapi

# 3. Optionally stop local Redis
sudo systemctl stop redis-server
sudo systemctl disable redis-server
```

---

## Post-Migration Cleanup

After confirming stability (recommended: wait 3-7 days):

1. **Cancel Upstash subscription** - Delete the Redis database in Upstash dashboard
2. **Remove unused env vars** - Delete `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from `.env` if present

---

## Troubleshooting

### Redis won't start

```bash
# Check for config errors
sudo redis-server --test-memory 256
sudo journalctl -u redis-server -n 50
```

### FastAPI can't connect to Redis

```bash
# Verify Redis is running
redis-cli ping

# Check the REDIS_URL in .env
cat /home/deploy/app/backend/.env | grep REDIS

# Restart both services
sudo systemctl restart redis-server
pm2 restart fastapi
```

### Memory issues

```bash
# Check Redis memory usage
redis-cli INFO memory

# Manually trigger eviction test
redis-cli DEBUG SLEEP 0
```
