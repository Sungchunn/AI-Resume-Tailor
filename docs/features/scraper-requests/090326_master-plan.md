# Scraper Request System - Master Plan

**Created:** March 9, 2026
**Status:** Planning

## Overview

Allow users to submit LinkedIn job URLs for admin review. Admins can approve requests (converting them to scraper presets) or reject them with feedback. This keeps cost and quality control with admins while giving users a voice in what jobs get scraped.

## User Story

As a **user**, I want to request jobs from specific LinkedIn searches so that the system scrapes job listings relevant to my needs.

As an **admin**, I want to review user requests before scraping so that I can control costs and ensure quality.

## Data Flow

```text
User submits URL → Request created (pending) → Admin reviews
  ↓ Approve: Create preset → Existing scraper flow handles jobs
  ↓ Reject: User sees rejection reason
```

## Key Design Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Scraping trigger | Admin approval, not automatic | Cost control (Apify charges per scrape) |
| Request storage | PostgreSQL `scraper_requests` table | Consistent with existing scraper models |
| Approval action | Create scraper preset | Reuses existing scraper infrastructure |
| User visibility | Own requests only | Privacy, simplicity |

## Feature Scope

**In Scope:**

- User request submission (URL, optional name/reason)
- Admin review queue with approve/reject actions
- Automatic preset creation on approval
- Request status tracking for users

**Out of Scope (Future):**

- Email notifications on status change
- Request priority/voting system
- Automatic duplicate detection
- User quotas/rate limits

## Implementation Phases

1. **Phase 1: Backend** - Model, schemas, repository, API routes
2. **Phase 2: Frontend** - Types, hooks, user modal, admin queue
3. **Phase 3: Documentation** - API docs update

## Related Documents

- [Phase 1: Backend Implementation](./090326_phase-1-backend.md)
- [Phase 2: Frontend Implementation](./090326_phase-2-frontend.md)

## Related Files

| Area | Key Files |
| ---- | --------- |
| Backend Model | `/backend/app/models/scraper_request.py` |
| Backend Routes | `/backend/app/api/routes/scraper_requests.py`, `/backend/app/api/routes/admin.py` |
| Frontend Components | `/frontend/src/components/jobs/RequestJobsModal.tsx` |
| Admin UI | `/frontend/src/app/(protected)/admin/scraper/components/RequestQueue.tsx` |
