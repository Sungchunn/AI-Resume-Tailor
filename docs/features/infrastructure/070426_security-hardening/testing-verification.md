# Testing and Verification Plan

**Parent:** `master-plan.md`
**Status:** Not Started

---

## Overview

This document outlines the comprehensive testing strategy to verify the security hardening implementation across all phases.

---

## Test Categories

| Category | Purpose | When to Run |
| -------- | ------- | ----------- |
| Unit Tests | Verify individual functions and methods | After each code change |
| Integration Tests | Verify API endpoints work correctly | After Phase 2-3 |
| Security Tests | Verify RLS and authorization | After Phase 4 |
| Regression Tests | Ensure existing functionality works | After each phase |
| Performance Tests | Verify no significant slowdown | After Phase 1, 4 |

---

## Phase 1: UUID Migration Tests

### Phase 1 Unit Tests

**File:** `/backend/tests/unit/test_uuid_columns.py`

```python
import pytest
from uuid import UUID
import uuid

from app.models.job import JobDescription
from app.models.resume_build import ResumeBuild


class TestUUIDColumnDefaults:
    """Test UUID column default generation."""

    def test_job_description_generates_uuid_on_create(self):
        """New JobDescription should have a valid UUID."""
        job = JobDescription(
            title="Test Job",
            owner_id=1
        )
        assert job.public_id is not None
        assert isinstance(job.public_id, UUID)

    def test_resume_build_generates_uuid_on_create(self):
        """New ResumeBuild should have a valid UUID."""
        build = ResumeBuild(
            name="Test Build",
            user_id=1
        )
        assert build.public_id is not None
        assert isinstance(build.public_id, UUID)

    def test_uuid_uniqueness(self):
        """Generated UUIDs should be unique."""
        uuids = [JobDescription(title=f"Job {i}", owner_id=1).public_id for i in range(100)]
        assert len(set(uuids)) == 100  # All unique

    def test_uuid_version_4(self):
        """Generated UUIDs should be version 4 (random)."""
        job = JobDescription(title="Test", owner_id=1)
        # Version 4 UUIDs have '4' in the 13th character
        uuid_str = str(job.public_id)
        assert uuid_str[14] == '4'
```

### Database Migration Tests

**File:** `/backend/tests/integration/test_uuid_migration.py`

```python
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class TestUUIDMigration:
    """Test UUID migration was successful."""

    async def test_all_jobs_have_uuid(self, db_session: AsyncSession):
        """Every job_description record should have a public_id."""
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM job_descriptions WHERE public_id IS NULL")
        )
        null_count = result.scalar()
        assert null_count == 0, f"Found {null_count} jobs without public_id"

    async def test_all_builds_have_uuid(self, db_session: AsyncSession):
        """Every resume_build record should have a public_id."""
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM resume_builds WHERE public_id IS NULL")
        )
        null_count = result.scalar()
        assert null_count == 0

    async def test_uuid_index_exists(self, db_session: AsyncSession):
        """Unique index on public_id should exist for fast lookups."""
        result = await db_session.execute(
            text("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'job_descriptions'
                AND indexname LIKE '%public_id%'
            """)
        )
        indexes = result.scalars().all()
        assert len(indexes) > 0, "No index found on job_descriptions.public_id"

    async def test_uuid_uniqueness_constraint(self, db_session: AsyncSession):
        """Duplicate UUIDs should be rejected."""
        # Get an existing UUID
        result = await db_session.execute(
            text("SELECT public_id FROM job_descriptions LIMIT 1")
        )
        existing_uuid = result.scalar()

        if existing_uuid:
            with pytest.raises(Exception) as exc_info:
                await db_session.execute(
                    text("""
                        INSERT INTO job_descriptions (title, owner_id, public_id)
                        VALUES ('Duplicate', 1, :uuid)
                    """),
                    {"uuid": existing_uuid}
                )
                await db_session.commit()
            assert "unique" in str(exc_info.value).lower()
```

---

## Phase 2: API Update Tests

### CRUD Method Tests

**File:** `/backend/tests/unit/test_job_crud.py`

```python
import pytest
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.job import job_crud
from app.models.job import JobDescription


class TestJobCRUDPublicId:
    """Test CRUD operations with public_id."""

    @pytest.fixture
    async def sample_job(self, db_session: AsyncSession):
        """Create a sample job for testing."""
        job = JobDescription(
            title="Sample Job",
            owner_id=1,
            company="Test Corp"
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)
        return job

    async def test_get_by_public_id(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription
    ):
        """Should retrieve job by public_id."""
        found = await job_crud.get_by_public_id(
            db_session,
            public_id=sample_job.public_id
        )
        assert found is not None
        assert found.id == sample_job.id
        assert found.title == sample_job.title

    async def test_get_by_public_id_not_found(self, db_session: AsyncSession):
        """Should return None for non-existent public_id."""
        fake_uuid = uuid4()
        found = await job_crud.get_by_public_id(
            db_session,
            public_id=fake_uuid
        )
        assert found is None

    async def test_get_by_public_id_and_owner_success(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription
    ):
        """Should retrieve job when owner matches."""
        found = await job_crud.get_by_public_id_and_owner(
            db_session,
            public_id=sample_job.public_id,
            owner_id=1
        )
        assert found is not None
        assert found.id == sample_job.id

    async def test_get_by_public_id_and_owner_wrong_owner(
        self,
        db_session: AsyncSession,
        sample_job: JobDescription
    ):
        """Should return None when owner doesn't match."""
        found = await job_crud.get_by_public_id_and_owner(
            db_session,
            public_id=sample_job.public_id,
            owner_id=999  # Different owner
        )
        assert found is None
```

### API Endpoint Tests

**File:** `/backend/tests/integration/test_jobs_api_uuid.py`

```python
import pytest
from uuid import uuid4
from httpx import AsyncClient

from app.main import app


class TestJobsAPIWithUUID:
    """Test job endpoints with UUID-based paths."""

    @pytest.fixture
    def auth_headers(self, test_user_token: str):
        """Headers with valid auth token."""
        return {"Authorization": f"Bearer {test_user_token}"}

    async def test_list_jobs_returns_uuids(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_job_in_db,
    ):
        """GET /jobs should return jobs with UUID ids."""
        response = await client.get("/api/jobs", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert "items" in data

        for job in data["items"]:
            # Verify id is UUID format
            assert "id" in job
            assert "-" in job["id"]  # UUIDs have dashes
            assert len(job["id"]) == 36  # UUID length

            # Verify internal integer id is not exposed
            assert "internal_id" not in job
            assert not isinstance(job["id"], int)

    async def test_get_job_by_uuid(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_job_in_db,
    ):
        """GET /jobs/{uuid} should work."""
        job_uuid = sample_job_in_db.public_id

        response = await client.get(
            f"/api/jobs/{job_uuid}",
            headers=auth_headers
        )
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == str(job_uuid)
        assert data["title"] == sample_job_in_db.title

    async def test_get_job_by_invalid_uuid_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """GET /jobs/{invalid-uuid} should return 404."""
        fake_uuid = uuid4()

        response = await client.get(
            f"/api/jobs/{fake_uuid}",
            headers=auth_headers
        )
        assert response.status_code == 404

    async def test_get_job_by_integer_deprecated(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_job_in_db,
    ):
        """GET /jobs/{int} should work but include deprecation header."""
        job_int_id = sample_job_in_db.id  # Internal integer ID

        response = await client.get(
            f"/api/jobs/{job_int_id}",
            headers=auth_headers
        )

        # Should still work during transition
        assert response.status_code == 200

        # Should include deprecation warning
        assert response.headers.get("Deprecation") == "true"

    async def test_create_job_returns_uuid(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """POST /jobs should return job with UUID id."""
        response = await client.post(
            "/api/jobs",
            headers=auth_headers,
            json={
                "title": "New Job",
                "company": "New Corp"
            }
        )
        assert response.status_code == 201

        data = response.json()
        assert "id" in data
        assert "-" in data["id"]  # UUID format

    async def test_update_job_by_uuid(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_job_in_db,
    ):
        """PUT /jobs/{uuid} should update the job."""
        job_uuid = sample_job_in_db.public_id

        response = await client.put(
            f"/api/jobs/{job_uuid}",
            headers=auth_headers,
            json={"title": "Updated Title"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["id"] == str(job_uuid)

    async def test_delete_job_by_uuid(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_job_in_db,
    ):
        """DELETE /jobs/{uuid} should delete the job."""
        job_uuid = sample_job_in_db.public_id

        response = await client.delete(
            f"/api/jobs/{job_uuid}",
            headers=auth_headers
        )
        assert response.status_code == 204

        # Verify deleted
        response = await client.get(
            f"/api/jobs/{job_uuid}",
            headers=auth_headers
        )
        assert response.status_code == 404

    async def test_cannot_access_other_users_job(
        self,
        client: AsyncClient,
        other_user_headers: dict,
        sample_job_in_db,  # Owned by test_user
    ):
        """Should return 404 when accessing another user's job."""
        job_uuid = sample_job_in_db.public_id

        response = await client.get(
            f"/api/jobs/{job_uuid}",
            headers=other_user_headers  # Different user
        )
        # 404, not 403 - don't reveal existence
        assert response.status_code == 404
```

---

## Phase 3: Frontend Tests

### Phase 3 Unit Tests

**File:** `/frontend/src/lib/api/__tests__/jobs.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { isValidUUID, getJob, listJobs } from '../jobs';

describe('isValidUUID', () => {
  it('validates correct UUID format', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidUUID('123')).toBe(false);  // Integer
    expect(isValidUUID('invalid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);  // Too short
    expect(isValidUUID('')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });
});

describe('getJob', () => {
  it('throws for invalid UUID', async () => {
    await expect(getJob('123')).rejects.toThrow('Invalid job ID format');
  });

  it('makes request with valid UUID', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getJob('550e8400-e29b-41d4-a716-446655440000');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/jobs/550e8400-e29b-41d4-a716-446655440000'),
      expect.any(Object)
    );
  });
});
```

### E2E Tests

**File:** `/frontend/e2e/jobs/uuid-routes.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Job routes with UUIDs', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/library');
  });

  test('job list shows UUID-based links', async ({ page }) => {
    await page.goto('/library?tab=jobs');

    // Wait for jobs to load
    await page.waitForSelector('[data-testid="job-card"]');

    // Click first job
    const jobLink = page.locator('[data-testid="job-card"] a').first();
    const href = await jobLink.getAttribute('href');

    // Verify UUID in URL
    expect(href).toMatch(/\/library\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  test('direct navigation to job with UUID works', async ({ page }) => {
    // First get a valid UUID from the list
    await page.goto('/library?tab=jobs');
    await page.waitForSelector('[data-testid="job-card"]');

    const firstJobLink = page.locator('[data-testid="job-card"] a').first();
    const href = await firstJobLink.getAttribute('href');

    // Navigate directly
    await page.goto(href!);

    // Should load job detail page
    expect(await page.locator('[data-testid="job-title"]').isVisible()).toBe(true);
  });

  test('invalid UUID shows 404', async ({ page }) => {
    await page.goto('/library/jobs/invalid-uuid');

    // Should show not found
    await expect(page.locator('text=not found')).toBeVisible();
  });

  test('create job redirects to UUID-based URL', async ({ page }) => {
    await page.goto('/library/jobs/new');

    // Fill form
    await page.fill('[data-testid="job-title-input"]', 'New Test Job');
    await page.fill('[data-testid="job-company-input"]', 'Test Corp');
    await page.click('[data-testid="save-job-button"]');

    // Should redirect to job detail with UUID
    await page.waitForURL(/\/library\/jobs\/[0-9a-f-]{36}$/);
  });
});
```

---

## Phase 4: RLS Security Tests

### Isolation Tests

**File:** `/backend/tests/security/test_rls_isolation.py`

```python
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import JobDescription


class TestRLSIsolation:
    """Test that RLS properly isolates user data."""

    @pytest.fixture
    async def user1_job(self, db_session: AsyncSession):
        """Create job owned by user 1."""
        await db_session.execute(text("SET LOCAL app.current_user_id = '1'"))
        job = JobDescription(title="User 1 Secret Job", owner_id=1)
        db_session.add(job)
        await db_session.commit()
        return job

    @pytest.fixture
    async def user2_job(self, db_session: AsyncSession):
        """Create job owned by user 2."""
        await db_session.execute(text("SET LOCAL app.current_user_id = '2'"))
        job = JobDescription(title="User 2 Secret Job", owner_id=2)
        db_session.add(job)
        await db_session.commit()
        return job

    async def test_user_cannot_read_other_users_data(
        self,
        db_session: AsyncSession,
        user1_job,
        user2_job,
    ):
        """User 1 should not see User 2's jobs."""
        # Set context to user 1
        await db_session.execute(text("SET LOCAL app.current_user_id = '1'"))

        result = await db_session.execute(
            text("SELECT title FROM job_descriptions")
        )
        titles = [row[0] for row in result.fetchall()]

        assert "User 1 Secret Job" in titles
        assert "User 2 Secret Job" not in titles

    async def test_no_context_returns_empty(
        self,
        db_session: AsyncSession,
        user1_job,
    ):
        """Query without user context should return empty."""
        # Clear any context
        await db_session.execute(text("RESET app.current_user_id"))

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM job_descriptions")
        )
        count = result.scalar()
        assert count == 0

    async def test_cannot_insert_for_other_user(
        self,
        db_session: AsyncSession,
    ):
        """Cannot insert job with different owner_id."""
        await db_session.execute(text("SET LOCAL app.current_user_id = '1'"))

        with pytest.raises(Exception):
            await db_session.execute(
                text("""
                    INSERT INTO job_descriptions (title, owner_id, public_id)
                    VALUES ('Malicious', 2, gen_random_uuid())
                """)
            )
            await db_session.commit()

    async def test_cannot_update_other_users_data(
        self,
        db_session: AsyncSession,
        user1_job,
    ):
        """User 2 cannot update User 1's job."""
        await db_session.execute(text("SET LOCAL app.current_user_id = '2'"))

        result = await db_session.execute(
            text("""
                UPDATE job_descriptions
                SET title = 'Hacked'
                WHERE id = :id
            """),
            {"id": user1_job.id}
        )
        assert result.rowcount == 0

    async def test_cannot_delete_other_users_data(
        self,
        db_session: AsyncSession,
        user1_job,
    ):
        """User 2 cannot delete User 1's job."""
        await db_session.execute(text("SET LOCAL app.current_user_id = '2'"))

        result = await db_session.execute(
            text("DELETE FROM job_descriptions WHERE id = :id"),
            {"id": user1_job.id}
        )
        assert result.rowcount == 0


class TestRLSPerformance:
    """Test RLS doesn't significantly impact performance."""

    async def test_rls_query_uses_index(self, db_session: AsyncSession):
        """RLS-filtered queries should use indexes."""
        await db_session.execute(text("SET LOCAL app.current_user_id = '1'"))

        result = await db_session.execute(
            text("""
                EXPLAIN (FORMAT JSON)
                SELECT id, title FROM job_descriptions
                WHERE public_id = '550e8400-e29b-41d4-a716-446655440000'
            """)
        )
        plan = result.scalar()

        # Should use index scan, not sequential scan
        assert "Index" in str(plan)
        assert "Seq Scan" not in str(plan)
```

---

## Regression Test Suite

### Full API Regression

**File:** `/backend/tests/regression/test_api_regression.py`

```python
import pytest
from httpx import AsyncClient


class TestAPIRegression:
    """Ensure all existing functionality still works after security changes."""

    async def test_job_crud_workflow(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Full CRUD workflow should work with UUIDs."""
        # Create
        create_response = await client.post(
            "/api/jobs",
            headers=auth_headers,
            json={"title": "Regression Test Job", "company": "Test Corp"}
        )
        assert create_response.status_code == 201
        job_id = create_response.json()["id"]

        # Read
        get_response = await client.get(
            f"/api/jobs/{job_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["title"] == "Regression Test Job"

        # Update
        update_response = await client.put(
            f"/api/jobs/{job_id}",
            headers=auth_headers,
            json={"title": "Updated Regression Job"}
        )
        assert update_response.status_code == 200
        assert update_response.json()["title"] == "Updated Regression Job"

        # Delete
        delete_response = await client.delete(
            f"/api/jobs/{job_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 204

        # Verify deleted
        verify_response = await client.get(
            f"/api/jobs/{job_id}",
            headers=auth_headers
        )
        assert verify_response.status_code == 404

    async def test_resume_build_workflow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_resume_id: str,
    ):
        """Resume build CRUD should work with UUIDs."""
        # Create build
        create_response = await client.post(
            "/api/resume-builds",
            headers=auth_headers,
            json={"name": "Regression Build", "resume_id": sample_resume_id}
        )
        assert create_response.status_code == 201
        build_id = create_response.json()["id"]

        # Verify UUID format
        assert "-" in build_id

        # Get build
        get_response = await client.get(
            f"/api/resume-builds/{build_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200

    async def test_tailor_flow_with_job_uuid(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_job_uuid: str,
        sample_resume_id: str,
    ):
        """Tailoring should work with job UUIDs."""
        response = await client.post(
            "/api/tailor",
            headers=auth_headers,
            json={
                "resume_id": sample_resume_id,
                "job_id": sample_job_uuid
            }
        )
        assert response.status_code in [200, 201]
```

---

## Performance Benchmarks

### Baseline Measurements

Run before migration to establish baselines:

```bash
# Run performance tests
cd backend
poetry run pytest tests/performance/ -v --benchmark-json=baseline.json
```

**File:** `/backend/tests/performance/test_query_performance.py`

```python
import pytest
from sqlalchemy import text


class TestQueryPerformance:
    """Benchmark query performance."""

    @pytest.mark.benchmark
    async def test_get_job_by_uuid_performance(
        self,
        db_session,
        benchmark,
        sample_job,
    ):
        """Benchmark UUID lookup performance."""
        async def lookup():
            await db_session.execute(
                text("""
                    SELECT id, title, company, created_at
                    FROM job_descriptions
                    WHERE public_id = :uuid
                """),
                {"uuid": str(sample_job.public_id)}
            )

        result = benchmark(lookup)
        # Assert reasonable performance (adjust threshold as needed)
        assert result.stats.mean < 0.01  # Less than 10ms

    @pytest.mark.benchmark
    async def test_list_jobs_with_rls_performance(
        self,
        db_session,
        benchmark,
    ):
        """Benchmark list query with RLS."""
        await db_session.execute(text("SET LOCAL app.current_user_id = '1'"))

        async def list_jobs():
            await db_session.execute(
                text("SELECT id, title, company FROM job_descriptions LIMIT 100")
            )

        result = benchmark(list_jobs)
        assert result.stats.mean < 0.05  # Less than 50ms
```

---

## Test Execution Plan

### Pre-Migration

```bash
# 1. Run existing test suite to establish baseline
cd backend
poetry run pytest -v

# 2. Record test count and pass rate
poetry run pytest --collect-only | tail -1
```

### Per Phase

```bash
# After Phase 1 (UUID Migration)
poetry run pytest tests/unit/test_uuid_columns.py tests/integration/test_uuid_migration.py -v

# After Phase 2 (API Update)
poetry run pytest tests/unit/test_job_crud.py tests/integration/test_jobs_api_uuid.py -v

# After Phase 3 (Frontend Update)
cd frontend
bun run test:e2e e2e/jobs/uuid-routes.spec.ts

# After Phase 4 (RLS)
cd backend
poetry run pytest tests/security/test_rls_isolation.py tests/security/test_rls_policies.py -v
```

### Full Regression

```bash
# Run full test suite after all phases
cd backend
poetry run pytest -v --tb=short

cd frontend
bun test
bun run test:e2e
```

---

## Completion Checklist

### Phase 1 Tests

- [ ] UUID column default generation tests pass
- [ ] Migration verification tests pass
- [ ] Index verification tests pass

### Phase 2 Tests

- [ ] CRUD by public_id tests pass
- [ ] API endpoint tests with UUID pass
- [ ] Deprecation header tests pass

### Phase 3 Tests

- [ ] Frontend unit tests pass
- [ ] E2E UUID route tests pass
- [ ] Legacy URL handling verified

### Phase 4 Tests

- [ ] RLS isolation tests pass
- [ ] RLS performance tests pass
- [ ] Security tests pass

### Regression

- [ ] Full backend test suite passes
- [ ] Full frontend test suite passes
- [ ] Performance within acceptable thresholds
