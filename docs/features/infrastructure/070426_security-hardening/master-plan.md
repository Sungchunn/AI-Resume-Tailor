# Security Hardening Plan: User Data Isolation

**Scope:** Full implementation (UUIDs + RLS)
**Status:** Planning
**Created:** 2026-04-07

---

## Executive Summary

A security audit identified that while the codebase has strong application-level security, two improvements are needed to fully protect user data:

1. **UUID migration** for PostgreSQL user-facing IDs (currently sequential integers)
2. **Supabase RLS** as defense-in-depth (second layer of protection)

This plan addresses both issues through a phased implementation approach that minimizes disruption to existing functionality while maximizing security improvements.

---

## Table of Contents

| Phase | Document | Description |
| ----- | -------- | ----------- |
| Overview | `master-plan.md` (this file) | Executive summary, current status, risk assessment |
| Phase 1 | `phase-1-uuid-migration.md` | Database schema changes, UUID column addition |
| Phase 2 | `phase-2-api-update.md` | Backend API refactoring to use UUIDs |
| Phase 3 | `phase-3-frontend-update.md` | Frontend route and API client updates |
| Phase 4 | `phase-4-rls-policies.md` | Supabase Row Level Security implementation |
| Testing | `testing-verification.md` | Comprehensive testing strategy and verification |

---

## Current Security Status

### Secure Areas (No Action Required)

| Area | Status | Implementation Details |
| ---- | ------ | ----- |
| Authentication | Secure | JWT-based with RS256 signing, user_id extracted from verified tokens only |
| Ownership verification | Secure | All CRUD endpoints verify `resource.user_id == current_user_id` before operations |
| Response serialization | Secure | Explicit Pydantic schemas with field whitelisting, no raw ORM leakage |
| File storage | Secure | Namespaced paths: `users/{user_id}/resumes/{uuid}_{filename}` |
| MongoDB IDs | Secure | Uses ObjectId (24-character hex, cryptographically unpredictable) |
| SQL injection | Secure | SQLAlchemy ORM with parameterized queries throughout |
| CORS | Secure | Strict origin whitelist, credentials mode properly configured |
| Rate limiting | Secure | Per-user rate limits on AI endpoints via Redis |

### Areas Requiring Improvement

| Area | Risk Level | Issue | Impact |
| ---- | ---------- | ----- | ------ |
| PostgreSQL IDs | MEDIUM | Sequential integers exposed in API URLs | Enumeration attack possible (estimate user count, find valid IDs) |
| Supabase RLS | LOW | No row-level security policies configured | Single point of failure if app-level auth bypassed |

---

## Risk Assessment

### Current Vulnerabilities

#### 1. Sequential Integer ID Exposure

- **Attack vector:** An attacker can enumerate resource IDs by incrementing integers
- **Information leakage:** Total count of resources reveals business metrics
- **IDOR potential:** While ownership is checked, predictable IDs make targeting easier
- **Affected endpoints:**
  - `GET /api/jobs/{id}` - User's job descriptions
  - `GET /api/resume-builds/{id}` - Resume build sessions
  - `GET /api/tailor/{id}` - Tailored resume results

#### 2. Single Layer of Authorization

- **Current state:** All authorization happens at the FastAPI route handler level
- **Risk:** A bug in route handler code could expose data across users
- **Example scenarios:**
  - Accidental removal of ownership check in a route
  - New endpoint added without proper authorization
  - ORM relationship traversal bypassing intended access controls

### Risk Mitigation Strategy

| Risk | Mitigation | Phase |
| ---- | ---------- | ----- |
| ID enumeration | Replace integers with UUIDs in public API | Phase 1-2 |
| Single auth layer | Add RLS as database-level enforcement | Phase 4 |
| Migration errors | Dual-lookup period with gradual rollout | Phase 2-3 |
| RLS misconfiguration | Extensive testing before production | Phase 4 |

---

## Tables Analysis

### Tables Requiring UUID Addition

| Table | Current ID | Public Exposure | Risk Level | Priority |
| ----- | ---------- | --------------- | ---------- | -------- |
| `job_descriptions` | `INTEGER` | `/api/jobs/{id}` | HIGH | P0 |
| `resume_builds` | `INTEGER` | `/api/resume-builds/{id}` | HIGH | P0 |
| `user_job_interactions` | `INTEGER` | Indirect (linked from job listings) | MEDIUM | P1 |
| `tailored_resumes` | `VARCHAR` | `/api/tailor/{id}` (uses mongo_id) | LOW | P2 |

### Tables NOT Requiring UUID Changes

| Table | Reason |
| ----- | ------ |
| `resumes` | Uses MongoDB ObjectId as primary identifier (already secure) |
| `tailored_resumes` | Primary lookup via `mongo_id` (ObjectId string), not integer ID |
| `job_listings` | System-wide scraped data, not user-owned, public by design |
| `users` | Authentication via JWT, IDs never exposed in URLs |
| `ai_usage_records` | Internal analytics, no public API exposure |
| `scraper_runs` | Admin-only endpoints, no public API |

---

## Architecture Overview

### Current Flow (Integer IDs)

```text
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Frontend     │      │    Backend      │      │   PostgreSQL    │
│                 │      │                 │      │                 │
│ /jobs/123       │─────▶│ GET /api/jobs/  │─────▶│ SELECT * FROM   │
│                 │      │     {id:int}    │      │ job_descriptions│
│                 │      │                 │      │ WHERE id = 123  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                               │
                               ▼
                         Check: job.owner_id == current_user_id
                               │
                               ▼
                         Return job or 403
```

### Target Flow (UUID + RLS)

```text
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Frontend     │      │    Backend      │      │   PostgreSQL    │
│                 │      │                 │      │   + RLS         │
│ /jobs/550e8400- │─────▶│ GET /api/jobs/  │─────▶│ SET app.user_id │
│ e29b-41d4-a716- │      │   {id:uuid}     │      │ = 42;           │
│ 446655440000    │      │                 │      │                 │
│                 │      │                 │      │ SELECT * FROM   │
│                 │      │                 │      │ job_descriptions│
│                 │      │                 │      │ WHERE public_id │
│                 │      │                 │      │ = '550e8400...' │
└─────────────────┘      └─────────────────┘      │                 │
                               │                  │ RLS: owner_id   │
                               │                  │ = app.user_id   │
                               ▼                  └─────────────────┘
                         App-level check (defense in depth)
                               │
                               ▼
                         Return job or 403/404
```

---

## Implementation Phases

### Phase 1: Database Schema Changes

**Objective:** Add UUID columns to PostgreSQL tables without disrupting existing functionality.

**Key activities:**

- Create Alembic migration for `public_id` columns
- Backfill existing records with generated UUIDs
- Add unique indexes for UUID lookups
- Update SQLAlchemy models

**Detailed plan:** See `phase-1-uuid-migration.md`

---

### Phase 2: Backend API Refactoring

**Objective:** Update API routes and CRUD operations to use UUIDs while maintaining backward compatibility.

**Key activities:**

- Add `get_by_public_id` CRUD methods
- Update route handlers to accept UUID strings
- Modify response schemas to return UUIDs
- Implement dual-lookup transition period

**Detailed plan:** See `phase-2-api-update.md`

---

### Phase 3: Frontend Updates

**Objective:** Update frontend to use UUID-based routes and API calls.

**Key activities:**

- Update API client functions
- Verify Next.js dynamic route compatibility
- Update any hardcoded ID references
- Test all user flows

**Detailed plan:** See `phase-3-frontend-update.md`

---

### Phase 4: Row Level Security

**Objective:** Implement Supabase RLS as a defense-in-depth layer.

**Key activities:**

- Enable RLS on user-owned tables
- Create policies using session variables
- Update database session management
- Test RLS enforcement

**Detailed plan:** See `phase-4-rls-policies.md`

---

## Success Criteria

### Security Requirements

- [ ] No sequential integer IDs exposed in public API responses
- [ ] All user-owned resources identified by UUID in URLs
- [ ] RLS policies enforce ownership at database level
- [ ] Direct database queries without session variable return empty results

### Functional Requirements

- [ ] All existing API endpoints function correctly with UUID parameters
- [ ] Frontend routes work with UUID-based URLs
- [ ] No data loss during migration
- [ ] Backward compatibility maintained during transition period

### Performance Requirements

- [ ] UUID lookups perform within 10% of integer lookups (indexed)
- [ ] RLS overhead does not exceed 5ms per query
- [ ] No N+1 queries introduced by changes

---

## Rollback Strategy

### Phase 1 Rollback

If UUID migration causes issues:

1. Revert Alembic migration: `alembic downgrade -1`
2. Column removal is safe as it's additive-only

### Phase 2-3 Rollback

If API/Frontend changes cause issues:

1. Deploy previous backend version (integer ID routes)
2. Frontend can continue using integer IDs
3. Database still has both columns

### Phase 4 Rollback

If RLS causes performance or functionality issues:

1. Disable RLS: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
2. Drop policies: `DROP POLICY ... ON ...`
3. Revert session variable injection code

---

## Dependencies and Prerequisites

### Technical Prerequisites

- [ ] Alembic migrations are up to date
- [ ] PostgreSQL 13+ (for `gen_random_uuid()`)
- [ ] All tests passing before starting
- [ ] Database backup taken

### Knowledge Prerequisites

- Understanding of SQLAlchemy async patterns
- Familiarity with Alembic migrations
- Understanding of PostgreSQL RLS concepts

---

## Related Documentation

- `/docs/architecture/database-rules.md` - Database conventions
- `/docs/architecture/backend-architecture.md` - API design patterns
- `/docs/api/jobs.md` - Job endpoints documentation
- `/docs/api/resume-builds.md` - Resume build endpoints documentation
