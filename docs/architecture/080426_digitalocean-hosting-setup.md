# DigitalOcean Hosting Setup

**Last Updated:** 2026-04-08
**Server:** Resume-Tailor (DigitalOcean Droplet)
**IP:** 188.166.180.93

---

## Architecture Overview

```text
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  DigitalOcean Droplet (Ubuntu 24.04, 1GB RAM, Singapore)    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Nginx (reverse proxy + SSL termination)            │   │
│  │  - Listens on :80 (redirects to HTTPS)              │   │
│  │  - Listens on :443 (SSL via Let's Encrypt)          │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │ proxy_pass                        │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PM2 (process manager)                              │   │
│  │  └─ fastapi process                                 │   │
│  │      └─ Uvicorn (ASGI server, 2 workers)            │   │
│  │          └─ FastAPI application                     │   │
│  │              - Listens on 127.0.0.1:8000            │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Redis (localhost:6379)                             │   │
│  │  - Self-hosted, systemd managed                     │   │
│  │  - 256MB max memory, LRU eviction                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────┐         ┌──────────┐         ┌──────────┐
    │ Supabase │         │  MongoDB │         │  OpenAI  │
    │ Postgres │         │  Atlas   │         │   API    │
    │ (remote) │         │ (remote) │         │ (remote) │
    └──────────┘         └──────────┘         └──────────┘
```

---

## Component Stack

| Layer | Technology | Managed By | Listens On |
| ----- | ---------- | ---------- | ---------- |
| Reverse Proxy | Nginx 1.x | systemd | 0.0.0.0:80, 0.0.0.0:443 |
| Process Manager | PM2 | pm2 startup | N/A |
| ASGI Server | Uvicorn | PM2 | 127.0.0.1:8000 |
| Application | FastAPI (Python 3.12) | Uvicorn | N/A |
| Cache | Redis 7.0.15 | systemd | 127.0.0.1:6379 |
| SSL Certificates | Let's Encrypt (Certbot) | cron (auto-renew) | N/A |

---

## Directory Structure

```text
/home/deploy/app/                    # Main application directory
├── .git/                            # Git repository
├── backend/                         # FastAPI backend
│   ├── .env                         # Production environment variables
│   ├── .env.example                 # Template for .env
│   ├── app/                         # Application source code
│   │   └── main.py                  # FastAPI entry point
│   ├── alembic/                     # Database migrations
│   ├── alembic.ini                  # Alembic configuration
│   ├── pyproject.toml               # Poetry dependencies
│   ├── poetry.lock                  # Locked dependencies
│   └── tests/                       # Test suite
├── frontend/                        # Next.js frontend (deployed to Vercel)
├── docs/                            # Documentation
├── logs/                            # Application logs
│   ├── fastapi-out.log              # stdout logs
│   └── fastapi-error.log            # stderr logs
├── ecosystem.config.js              # PM2 configuration
├── CLAUDE.md                        # AI assistant guidelines
└── README.md                        # Project readme
```

---

## Services & How They Start

### 1. Nginx (Reverse Proxy)

**Managed by:** systemd
**Config location:** `/etc/nginx/sites-available/`

```bash
# Service management
sudo systemctl status nginx
sudo systemctl restart nginx
sudo systemctl reload nginx      # Reload config without downtime

# Test config before reload
sudo nginx -t

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

**What it does:**

- Terminates SSL (HTTPS) using Let's Encrypt certificates
- Redirects HTTP (port 80) to HTTPS (port 443)
- Proxies requests to Uvicorn on `127.0.0.1:8000`
- Adds security headers (X-Frame-Options, X-Content-Type-Options)
- Handles file upload size limit (10MB)

### 2. PM2 (Process Manager)

**Managed by:** PM2 startup script (runs as root)
**Config location:** `/home/deploy/app/ecosystem.config.js`

```bash
# Process management
pm2 status                       # View all processes
pm2 show fastapi                 # Detailed process info
pm2 restart fastapi              # Restart application
pm2 stop fastapi                 # Stop application
pm2 delete fastapi               # Remove from PM2

# Logs
pm2 logs fastapi                 # Stream logs
pm2 logs fastapi --lines 100    # Last 100 lines
pm2 flush                        # Clear all logs

# Save/restore process list
pm2 save                         # Save current processes
pm2 resurrect                    # Restore saved processes

# Startup configuration
pm2 startup                      # Generate startup script
pm2 unstartup                    # Remove startup script
```

**What it does:**

- Keeps Uvicorn running continuously
- Auto-restarts on crash (max 10 restarts)
- Auto-restarts if memory exceeds 800MB
- Logs stdout/stderr to `/home/deploy/app/logs/`
- Preserves process list across server reboots

### 3. Uvicorn (ASGI Server)

**Managed by:** PM2
**Executable:** `/root/.cache/pypoetry/virtualenvs/ai-resume-tailor-backend-sS6T8uKZ-py3.12/bin/uvicorn`

```bash
# PM2 runs this command:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

**What it does:**

- Runs the FastAPI application
- Spawns 2 worker processes for concurrency
- Binds to all interfaces on port 8000 (only accessible via Nginx)

### 4. Redis (Cache)

**Managed by:** systemd
**Config location:** `/etc/redis/redis.conf`

```bash
# Service management
sudo systemctl status redis-server
sudo systemctl restart redis-server

# CLI access
redis-cli ping                   # Test connection
redis-cli DBSIZE                 # Count keys
redis-cli INFO memory            # Memory stats
redis-cli MONITOR                # Watch live commands

# Flush data (use with caution)
redis-cli FLUSHALL               # Clear all data
```

**Configuration:**

| Setting | Value | Purpose |
| ------- | ----- | ------- |
| bind | 127.0.0.1 -::1 | Localhost only (security) |
| maxmemory | 256mb | Memory limit |
| maxmemory-policy | allkeys-lru | Evict least-recently-used when full |

---

## Environment Variables

**Location:** `/home/deploy/app/backend/.env`

| Variable | Purpose | Example Value |
| -------- | ------- | ------------- |
| `DATABASE_URL` | PostgreSQL (Supabase) connection | `postgresql+asyncpg://...` |
| `DATABASE_URL_SYNC` | Sync URL for Alembic migrations | `postgresql://...` |
| `MONGODB_URI` | MongoDB Atlas connection | `mongodb+srv://...` |
| `MONGODB_DATABASE` | MongoDB database name | `resume_tailor` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `JWT_SECRET_KEY` | JWT signing secret | (keep secret) |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `30` |
| `AI_PROVIDER` | AI provider selection | `openai` or `gemini` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `OPENAI_MODEL` | OpenAI model | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | Embedding model | `text-embedding-3-small` |
| `GEMINI_API_KEY` | Gemini API key (if used) | (optional) |
| `GEMINI_MODEL` | Gemini model | `gemini-2.0-flash` |
| `CORS_ORIGINS` | Allowed origins | `https://re-zoo-me.com,...` |
| `ENVIRONMENT` | Environment name | `production` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `...apps.googleusercontent.com` |
| `GOOGLE_OAUTH_ENABLED` | Enable Google OAuth | `true` |
| `APIFY_API_TOKEN` | Apify scraper token | (keep secret) |
| `SCRAPER_ENABLED` | Enable job scraper | `true` |
| `ADMIN_EMAILS` | Admin user emails | `email@example.com` |

---

## PM2 Ecosystem Configuration

**Location:** `/home/deploy/app/ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: "fastapi",
    script: "/root/.cache/pypoetry/virtualenvs/ai-resume-tailor-backend-sS6T8uKZ-py3.12/bin/uvicorn",
    args: "app.main:app --host 0.0.0.0 --port 8000 --workers 2",
    cwd: "/home/deploy/app/backend",
    interpreter: "none",
    env: {
      PATH: "/root/.cache/pypoetry/virtualenvs/ai-resume-tailor-backend-sS6T8uKZ-py3.12/bin:/usr/local/bin:/usr/bin:/bin",
      CORS_ORIGINS: "http://localhost:3000,https://re-zoo-me.com,https://www.re-zoo-me.com,https://ai-resume-tailor-sigma.vercel.app",
      GOOGLE_CLIENT_ID: "...",
      GOOGLE_OAUTH_ENABLED: "true"
    },
    max_restarts: 10,
    min_uptime: "10s",
    max_memory_restart: "800M",
    error_file: "/home/deploy/app/logs/fastapi-error.log",
    out_file: "/home/deploy/app/logs/fastapi-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true
  }]
}
```

---

## Nginx Configuration

**Location:** `/etc/nginx/sites-available/`

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name re-zoo-me.com;
    return 301 https://$host$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl;
    server_name re-zoo-me.com;

    ssl_certificate /etc/letsencrypt/live/re-zoo-me.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/re-zoo-me.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Fallback server (direct IP access)
server {
    listen 80;
    server_name _;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

---

## SSL Certificates (Let's Encrypt)

**Certificate location:** `/etc/letsencrypt/live/re-zoo-me.com/`
**Managed by:** Certbot with auto-renewal

```bash
# Check certificate status
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# View renewal timer
systemctl list-timers | grep certbot
```

---

## Poetry & Python Environment

**Python version:** 3.12.3
**Poetry location:** `/root/.local/bin/poetry` (symlink to `/root/.local/share/pypoetry/venv/bin/poetry`)
**Virtual environment:** `/root/.cache/pypoetry/virtualenvs/ai-resume-tailor-backend-sS6T8uKZ-py3.12/`

```bash
# Add Poetry to PATH (required for manual commands)
export PATH="/root/.local/bin:$PATH"

# Install dependencies
cd /home/deploy/app/backend
poetry install --no-interaction

# Run database migrations
poetry run alembic upgrade head

# Activate virtual environment manually
source /root/.cache/pypoetry/virtualenvs/ai-resume-tailor-backend-sS6T8uKZ-py3.12/bin/activate
```

---

## Deployment Process

Deployments are automated via GitHub Actions (`.github/workflows/deploy-backend.yml`).

**Trigger:** Push to `main` branch with changes in `backend/` directory

**Steps:**

1. GitHub Actions SSHs into the droplet
2. Pulls latest code from `origin/main`
3. Installs dependencies via Poetry
4. Runs Alembic migrations
5. Restarts PM2 process
6. Runs health check (`/health` endpoint)

```bash
# Manual deployment (if needed)
cd /home/deploy/app
git fetch origin
git reset --hard origin/main
cd backend
export PATH="/root/.local/bin:$PATH"
poetry install --no-interaction
poetry run alembic upgrade head
pm2 restart fastapi
pm2 save
```

---

## Health Check

**Endpoint:** `GET /health`

```bash
# Local check
curl http://localhost:8000/health

# External check
curl https://re-zoo-me.com/health
```

**Expected response:**

```json
{"status":"healthy","checks":{"postgres":"ok","mongodb":"ok"}}
```

---

## Log Locations

| Log | Location | Command |
| --- | -------- | ------- |
| FastAPI stdout | `/home/deploy/app/logs/fastapi-out.log` | `pm2 logs fastapi` |
| FastAPI stderr | `/home/deploy/app/logs/fastapi-error.log` | `pm2 logs fastapi` |
| Nginx access | `/var/log/nginx/access.log` | `sudo tail -f /var/log/nginx/access.log` |
| Nginx error | `/var/log/nginx/error.log` | `sudo tail -f /var/log/nginx/error.log` |
| Redis | `/var/log/redis/redis-server.log` | `sudo tail -f /var/log/redis/redis-server.log` |
| System | `/var/log/syslog` | `sudo tail -f /var/log/syslog` |

---

## Quick Reference Commands

```bash
# Application
pm2 status                           # Check all processes
pm2 restart fastapi                  # Restart backend
pm2 logs fastapi --lines 50         # View recent logs
curl http://localhost:8000/health   # Health check

# Nginx
sudo systemctl status nginx          # Check Nginx status
sudo nginx -t && sudo systemctl reload nginx  # Reload config

# Redis
redis-cli ping                       # Test Redis
redis-cli INFO memory               # Memory usage
sudo systemctl restart redis-server # Restart Redis

# SSL
sudo certbot certificates            # Check SSL status
sudo certbot renew --dry-run        # Test renewal

# Database migrations
cd /home/deploy/app/backend
export PATH="/root/.local/bin:$PATH"
poetry run alembic upgrade head      # Run migrations
poetry run alembic history          # View migration history

# System
htop                                 # Resource usage
df -h                                # Disk usage
free -m                              # Memory usage
```

---

## External Services

| Service | Purpose | Dashboard |
| ------- | ------- | --------- |
| Supabase | PostgreSQL database | <https://supabase.com/dashboard> |
| MongoDB Atlas | Document database | <https://cloud.mongodb.com> |
| Vercel | Frontend hosting | <https://vercel.com/dashboard> |
| DigitalOcean | Droplet hosting | <https://cloud.digitalocean.com> |
| OpenAI | AI API | <https://platform.openai.com> |
| Apify | Job scraping | <https://console.apify.com> |
| Let's Encrypt | SSL certificates | (auto-managed) |

---

## Troubleshooting

### Backend not responding

```bash
pm2 status                          # Check if running
pm2 logs fastapi --lines 100       # Check for errors
pm2 restart fastapi                 # Restart
```

### 502 Bad Gateway

```bash
# Check if Uvicorn is running
pm2 status
curl http://localhost:8000/health   # Direct check

# Check Nginx config
sudo nginx -t
sudo systemctl reload nginx
```

### SSL certificate expired

```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Redis connection error

```bash
redis-cli ping                      # Should return PONG
sudo systemctl status redis-server
sudo systemctl restart redis-server
```

### Out of memory

```bash
free -m                             # Check memory
pm2 monit                           # Monitor processes
# Consider upgrading droplet or reducing workers
```
