# AI Resume Tailor -- Deployment Master Plan

## Stack Overview

| Layer | Tech | Platform | Cost |
| ----- | ---- | -------- | ---- |
| Frontend | Next.js 15 + Bun + TypeScript | Vercel (free tier) | $0/mo |
| Backend | FastAPI + Python | DigitalOcean droplet ($6/mo) | $6/mo |
| Relational DB | PostgreSQL | Supabase (free tier, 500MB) | $0/mo |
| Document DB | MongoDB | Atlas (free tier, 512MB) | $0/mo |
| Cache | Redis | Self-hosted on droplet (or Upstash) | $0/mo |
| AI | TBD (OpenAI / Gemini) | API keys | Usage-based |
| **Total** | | | **~$6/mo** |

---

## Phase 1: Databases (Postgres + MongoDB)

### 1A. Supabase (PostgreSQL)

**Platform:** <https://supabase.com>

1. Sign up / log in
2. Create a new project (pick a region close to your DO droplet -- Singapore recommended)
3. Set a strong database password (save it somewhere safe)
4. Wait for project to provision (~2 min)
5. Go to **Settings > Database** and copy the connection string:

   ```text
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

6. Under **Database > Connection Pooling**, note the pooled connection string (use this in production for better connection management)
7. Go to **Settings > API** and note the project URL and anon key if you plan to use Supabase Auth later

**Important settings:**

- Under **Database > Network**, add your DO droplet IP to the allowed list once you have it
- Free tier: 500MB storage, 2 GB bandwidth, 50k monthly active users

**Test it:** Connect from your local machine using `psql` or any GUI tool (TablePlus, DBeaver) to verify the connection works before moving on.

---

### 1B. MongoDB Atlas

**Platform:** <https://www.mongodb.com/atlas>

1. Sign up / log in
2. Create a free shared cluster (M0 tier)
3. Pick cloud provider: AWS, region: Singapore (ap-southeast-1) to minimize latency to DO
4. Set a database username and password
5. Under **Network Access**, add `0.0.0.0/0` for now (restricts to your droplet IP later)
6. Under **Database > Connect**, choose "Connect your application" and copy the connection string:

   ```text
   mongodb+srv://[USER]:[PASSWORD]@[CLUSTER].mongodb.net/[DB-NAME]?retryWrites=true&w=majority
   ```

7. Replace `[DB-NAME]` with your actual database name (e.g., `resumedb`)

**Free tier limits:** 512MB storage, shared RAM, no dedicated resources.

**Test it:** Use MongoDB Compass or `mongosh` locally to verify you can connect and create a test collection.

---

## Phase 2: Redis (Self-Hosted on Droplet)

**Recommended:** Self-hosted Redis on the same droplet as FastAPI. No external dependencies, no rate limits, better latency.

See: `docs/features/infrastructure/260408_redis-self-hosted-migration/implementation-record.md` for detailed setup.

**Quick setup:**

```bash
# Install Redis
sudo apt update && sudo apt install redis-server -y

# Configure memory limit (edit /etc/redis/redis.conf)
# Add: maxmemory 256mb
# Add: maxmemory-policy allkeys-lru

# Start and enable
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Test
redis-cli ping  # Should return PONG
```

**Connection string:** `redis://localhost:6379`

### Alternative: Upstash (Managed Redis)

If you prefer managed Redis, use Upstash:

**Platform:** <https://upstash.com>

1. Sign up / log in
2. Create a new Redis database (Singapore region)
3. Copy connection string: `rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379`

**Free tier limits:** 10,000 commands/day, 256MB storage.

---

## Phase 3: Backend (FastAPI on DigitalOcean)

### 3A. Create the Droplet

**Platform:** <https://cloud.digitalocean.com>

1. Sign up / log in
2. Create a new Droplet:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, Regular, $6/mo (1 vCPU, 1GB RAM, 25GB SSD)
   - **Region:** Singapore (SGP1)
   - **Authentication:** SSH key (add your public key)
3. Note the droplet's public IP address

### 3B. Initial Server Setup

SSH into your droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

Claude Code can generate a full setup script for you, but here's what it covers:

1. **Create a non-root user** with sudo privileges
2. **Configure UFW firewall** (allow SSH, HTTP, HTTPS)
3. **Install dependencies:**
   - Python 3.11+, pip, Poetry (your backend uses Poetry)
   - Node.js + npm (for PM2)
   - Nginx
   - Certbot (for SSL)
4. **Clone your repo** from GitHub
5. **Install Python dependencies** via Poetry
6. **Set up .env file** with all connection strings from Phases 1-2

### 3C. Configure Environment Variables

Create `/home/youruser/app/.env`:

```env
# Databases
DATABASE_URL=postgresql://postgres:PASS@db.XXXX.supabase.co:5432/postgres
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/resumedb
REDIS_URL=rediss://default:pass@endpoint.upstash.io:6379

# App
APP_ENV=production
SECRET_KEY=your-secret-key
CORS_ORIGINS=https://yourdomain.com

# AI (when ready)
OPENAI_API_KEY=sk-xxx
```

### 3D. PM2 Configuration

Create `ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: "fastapi",
    script: "uvicorn",
    args: "app.main:app --host 0.0.0.0 --port 8000",
    interpreter: "none",
    cwd: "/home/youruser/app/backend",
    env: {
      // PM2 reads from .env, or define here
    }
  }]
}
```

Start with: `pm2 start ecosystem.config.js`
Enable auto-restart: `pm2 startup && pm2 save`

### 3E. Nginx Reverse Proxy

Configure Nginx to proxy requests to FastAPI:

```nginx
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3F. SSL with Certbot

```bash
sudo certbot --nginx -d api.yourdomain.com
```

Certbot auto-renews. Your API is now accessible at `https://api.yourdomain.com`.

### 3G. Verify Everything Works

Hit your health check endpoint:

```bash
curl https://api.yourdomain.com/health
```

This should return confirmation that FastAPI can reach Postgres, MongoDB, and Redis. **Do not move to Phase 4 until this passes.**

---

## Phase 4: Frontend (Next.js on Vercel)

**Platform:** <https://vercel.com>

1. Sign up / log in (connect your GitHub account)
2. Import your repository
3. Set framework preset to **Next.js**
4. Add environment variable:

   ```text
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   ```

5. Deploy

**Automatic from here:** Every push to `main` triggers a new deployment. Preview deployments are created for PRs.

**Custom domain:** In Vercel dashboard, add your domain and update your DNS records.

---

## Phase 5: DNS Configuration

At your domain registrar, set up:

| Record       | Name | Value                            |
| ------------ | ---- | -------------------------------- |
| A            | api  | YOUR_DROPLET_IP                  |
| CNAME        | www  | cname.vercel-dns.com             |
| A (or CNAME) | @    | Vercel's IP (shown in dashboard) |

---

## Phase 6: CI/CD (Optional but Recommended)

Claude Code can generate a GitHub Actions workflow that:

1. On push to `main`:
   - SSHs into your DO droplet
   - Pulls latest code
   - Installs dependencies
   - Restarts PM2
2. Vercel handles frontend deployment automatically (no action needed)

---

## Post-Deployment Checklist

- [ ] Supabase: Restrict network access to droplet IP only
- [ ] Atlas: Replace `0.0.0.0/0` with droplet IP
- [ ] Upstash: Verify rate limits are sufficient
- [ ] DO: UFW only allows ports 22, 80, 443
- [ ] Nginx: HTTPS redirect is working
- [ ] PM2: Auto-restart on crash and server reboot confirmed
- [ ] CORS: Only your frontend domain is allowed
- [ ] .env: Not committed to Git (.gitignore verified)
- [ ] Health endpoint: Returns 200 with DB connectivity status
- [ ] Frontend: API calls working in production
- [ ] SSL: Certificate auto-renewal tested

---

## Architecture Diagram

```text
User
  |
  v
[Vercel CDN] -- serves --> Next.js 15 Frontend
  |
  | API calls (HTTPS)
  v
[DO Droplet - SGP1]
  Nginx (reverse proxy + SSL)
    |
    v
  FastAPI (managed by PM2)
    |
    +--> Supabase PostgreSQL (resume metadata, users, auth)
    +--> Atlas MongoDB (resume JSON blocks, document store)
    +--> Upstash Redis (caching, sessions)
    +--> OpenAI / Gemini API (AI tailoring)
```

---

## Cost Summary

| Service | Tier | Monthly Cost |
| ------- | ---- | ------------ |
| Vercel | Free (Hobby) | $0 |
| DigitalOcean | Basic Droplet | $6 |
| Supabase | Free | $0 |
| MongoDB Atlas | M0 Free | $0 |
| Upstash Redis | Free | $0 |
| Domain | Varies | ~$10-15/yr |
| AI API | Usage-based | Variable |
| **Total (excluding AI/domain)** | | **$6/mo** |

---

## When to Upgrade

- **Supabase:** Upgrade when you exceed 500MB storage or need more than 50k MAU ($25/mo Pro)
- **Atlas:** Upgrade to M2/M5 when you need more than 512MB or need dedicated resources ($9-25/mo)
- **Upstash:** Upgrade when 10k commands/day is insufficient ($10/mo Pay-as-you-go)
- **DO Droplet:** Upgrade to $12/mo (2GB RAM) if FastAPI starts hitting memory limits under load
- **Vercel:** Upgrade to Pro ($20/mo) if you need team features or exceed bandwidth limits
