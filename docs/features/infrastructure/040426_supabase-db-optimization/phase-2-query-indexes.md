# Phase 2: Query Optimization Indexes

**Priority:** P1 - High
**Estimated Time:** 30 minutes
**Risk Level:** Low (additive migrations only)
**Prerequisite:** Phase 1 complete

---

## Overview

This phase adds indexes to optimize common query patterns that currently cause full table scans:

1. Expression indexes for case-insensitive `func.lower()` filters
2. GIN trigram indexes for `ILIKE` pattern matching

---

## Problem Analysis

### Issue 1: Case-Insensitive Filters Bypass B-tree Indexes

**File:** `backend/app/crud/job_listing.py`

**Lines 148-156 (seniority filter):**

```python
# Handle seniority filter (could be comma-separated)
if filters.seniority:
    seniorities = [s.strip().lower() for s in filters.seniority.split(",")]
    seniority_conditions = [
        func.lower(JobListing.seniority) == s for s in seniorities
    ]
    conditions.append(or_(*seniority_conditions))
```

**Lines 176-189 (city filter):**

```python
# Handle city filter
if filters.city:
    cities = [c.strip() for c in filters.city.split(",")]
    city_conditions = [
        func.lower(JobListing.city) == c.lower() for c in cities
    ]
    conditions.append(or_(*city_conditions))

# Handle city exclusion
if filters.exclude_city:
    exclude_cities = [c.strip().lower() for c in filters.exclude_city.split(",")]
    for exc_city in exclude_cities:
        conditions.append(func.lower(JobListing.city) != exc_city)
```

### Why This Is Slow

When you use `func.lower(column)` in a WHERE clause:

1. PostgreSQL cannot use a B-tree index on `column`
2. It must compute `LOWER(column)` for **every row** in the table
3. This is a **full sequential scan** + computation overhead

**Existing indexes that are NOT being used:**

```python
Index("ix_job_listings_seniority", "seniority"),  # BYPASSED by func.lower()
```

The city column doesn't even have a regular index.

### Solution: Expression Indexes

PostgreSQL supports **expression indexes** that pre-compute the function result:

```sql
CREATE INDEX ix_job_listings_seniority_lower ON job_listings (LOWER(seniority));
```

Now when the query uses `WHERE LOWER(seniority) = 'senior'`, PostgreSQL can use this index.

---

### Issue 2: ILIKE Pattern Matching Without GIN Indexes

**File:** `backend/app/crud/job_listing.py`

**Lines 137-142 (location filter):**

```python
if filters.location:
    locations = [loc.strip() for loc in filters.location.split(",")]
    location_conditions = [
        JobListing.location.ilike(f"%{loc}%") for loc in locations
    ]
    conditions.append(or_(*location_conditions))
```

**Lines 163-171 (region/country filters):**

```python
if filters.region:
    regions = [r.strip() for r in filters.region.split(",")]
    region_conditions = [
        JobListing.region.ilike(f"%{r}%") for r in regions
    ]
    conditions.append(or_(*region_conditions))

if filters.country:
    countries = [c.strip() for c in filters.country.split(",")]
    country_conditions = [
        JobListing.country.ilike(f"%{c}%") for c in countries
    ]
    conditions.append(or_(*country_conditions))
```

**Lines 231, 236 (job_function/industry filters):**

```python
if filters.job_function:
    conditions.append(JobListing.job_function.ilike(f"%{filters.job_function}%"))
if filters.industry:
    conditions.append(JobListing.industry.ilike(f"%{filters.industry}%"))
```

### Why This Is Slow

`ILIKE '%pattern%'` (pattern matching with wildcards on both sides) cannot use standard B-tree indexes. PostgreSQL must:

1. Scan every row in the table
2. Apply the pattern match to each value
3. This is O(n) where n = total rows

### Solution: GIN Trigram Indexes

PostgreSQL's `pg_trgm` extension provides **trigram indexes** that enable fast pattern matching:

```sql
CREATE INDEX ix_job_listings_location_gin ON job_listings USING gin(location gin_trgm_ops);
```

Trigram indexes work by:

1. Breaking strings into 3-character sequences (trigrams)
2. Indexing these trigrams for fast lookup
3. Supporting `LIKE`, `ILIKE`, `~`, and `~*` operators

**Note:** The baseline migration already enables `pg_trgm`:

```python
# From 20260220_0000_baseline_from_flyway.py
op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
```

And creates GIN indexes for `job_title` and `job_description`:

```python
Index("ix_job_listings_title_gin", "job_title", postgresql_using="gin", postgresql_ops={"job_title": "gin_trgm_ops"}),
Index("ix_job_listings_desc_gin", "job_description", postgresql_using="gin", postgresql_ops={"job_description": "gin_trgm_ops"}),
```

But location, region, country, job_function, and industry are **missing GIN indexes**.

---

## Migration 1: Expression Indexes

**File:** `backend/alembic/versions/20260404_0002_add_expression_indexes.py`

```python
"""Add expression indexes for case-insensitive filters.

Revision ID: 20260404_0002
Revises: 20260404_0001
Create Date: 2026-04-04

The seniority and city filters use func.lower() which bypasses normal B-tree
indexes. Expression indexes on LOWER(column) enable index usage for these
case-insensitive equality checks.

Affected queries:
- GET /api/job-listings?seniority=senior,mid-level
- GET /api/job-listings?city=san francisco,new york
- GET /api/job-listings?exclude_city=los angeles
"""
from collections.abc import Sequence
from alembic import op


revision: str = "20260404_0002"
down_revision: str | None = "20260404_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Expression index for case-insensitive seniority filtering
    # Supports: WHERE LOWER(seniority) = 'senior'
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_seniority_lower
        ON job_listings (LOWER(seniority))
        """
    )

    # Expression index for case-insensitive city filtering
    # Supports: WHERE LOWER(city) = 'san francisco'
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_city_lower
        ON job_listings (LOWER(city))
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_job_listings_city_lower")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_seniority_lower")
```

---

## Migration 2: GIN Trigram Indexes

**File:** `backend/alembic/versions/20260404_0003_add_gin_trgm_indexes.py`

```python
"""Add GIN trigram indexes for ILIKE pattern matching.

Revision ID: 20260404_0003
Revises: 20260404_0002
Create Date: 2026-04-04

ILIKE queries with wildcards on both sides (e.g., '%pattern%') require GIN
indexes with pg_trgm for efficient pattern matching. Without these indexes,
each ILIKE query causes a full sequential scan.

The pg_trgm extension is already enabled in the baseline migration.

Affected queries:
- GET /api/job-listings?location=california
- GET /api/job-listings?region=west coast
- GET /api/job-listings?country=united states
- GET /api/job-listings?job_function=engineering
- GET /api/job-listings?industry=technology
- GET /api/job-listings?company_name=google

Note: job_title and job_description already have GIN indexes from baseline.
"""
from collections.abc import Sequence
from alembic import op


revision: str = "20260404_0003"
down_revision: str | None = "20260404_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # GIN trigram indexes for ILIKE pattern matching
    # These enable efficient '%pattern%' searches

    # Location filter: job_listings?location=california
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_location_gin
        ON job_listings USING gin(location gin_trgm_ops)
        """
    )

    # Region filter: job_listings?region=west coast
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_region_gin
        ON job_listings USING gin(region gin_trgm_ops)
        """
    )

    # Country filter: job_listings?country=united states
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_country_gin
        ON job_listings USING gin(country gin_trgm_ops)
        """
    )

    # City filter (for ILIKE searches, separate from the LOWER expression index)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_city_gin
        ON job_listings USING gin(city gin_trgm_ops)
        """
    )

    # Job function filter: job_listings?job_function=engineering
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_job_function_gin
        ON job_listings USING gin(job_function gin_trgm_ops)
        """
    )

    # Industry filter: job_listings?industry=technology
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_industry_gin
        ON job_listings USING gin(industry gin_trgm_ops)
        """
    )

    # Company name filter: job_listings?company_name=google
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_listings_company_name_gin
        ON job_listings USING gin(company_name gin_trgm_ops)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_job_listings_company_name_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_industry_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_job_function_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_city_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_country_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_region_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_listings_location_gin")
```

---

## Index Size Considerations

GIN indexes are larger than B-tree indexes. For Supabase free tier (500MB storage limit):

| Index Type | Approximate Size (10k rows) |
| ---------- | --------------------------- |
| B-tree (expression) | ~1-2 MB |
| GIN (trigram) | ~5-10 MB per column |

With 7 new indexes, expect ~50-70 MB additional storage. This is acceptable for the performance gains.

---

## Verification Steps

### 1. Run Migrations

```bash
cd backend
poetry run alembic upgrade head

# Verify all migrations applied
poetry run alembic current
# Should show: 20260404_0003 (head)
```

### 2. Verify Indexes Created

```sql
-- Run in Supabase SQL Editor
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'job_listings'
ORDER BY indexname;

-- Should include:
-- ix_job_listings_city_gin
-- ix_job_listings_city_lower
-- ix_job_listings_company_name_gin
-- ix_job_listings_country_gin
-- ix_job_listings_created_at (from Phase 1)
-- ix_job_listings_industry_gin
-- ix_job_listings_job_function_gin
-- ix_job_listings_location_gin
-- ix_job_listings_region_gin
-- ix_job_listings_seniority_lower
```

### 3. Test Expression Index Usage

```sql
-- Test seniority filter uses expression index
EXPLAIN ANALYZE
SELECT id, job_title FROM job_listings
WHERE LOWER(seniority) = 'senior';

-- Look for:
-- Index Scan using ix_job_listings_seniority_lower on job_listings
-- NOT: Seq Scan
```

### 4. Test GIN Index Usage

```sql
-- Test location ILIKE uses GIN index
EXPLAIN ANALYZE
SELECT id, job_title FROM job_listings
WHERE location ILIKE '%california%';

-- Look for:
-- Bitmap Heap Scan on job_listings
--   -> Bitmap Index Scan on ix_job_listings_location_gin
-- NOT: Seq Scan
```

### 5. Check Index Sizes

```sql
-- Monitor index storage usage
SELECT
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE relname = 'job_listings'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Model Updates (Optional)

For documentation purposes, you can add the new indexes to the model's `__table_args__`. However, since we're using raw SQL in migrations (required for expression indexes), this is optional:

**File:** `backend/app/models/job_listing.py`

Add comments documenting the additional indexes:

```python
__table_args__ = (
    # ... existing indexes ...

    # Expression indexes (created via migration, not declarative)
    # - ix_job_listings_seniority_lower: LOWER(seniority)
    # - ix_job_listings_city_lower: LOWER(city)

    # GIN trigram indexes (created via migration, not declarative)
    # - ix_job_listings_location_gin
    # - ix_job_listings_region_gin
    # - ix_job_listings_country_gin
    # - ix_job_listings_city_gin
    # - ix_job_listings_job_function_gin
    # - ix_job_listings_industry_gin
    # - ix_job_listings_company_name_gin
)
```

---

## Rollback Plan

If issues arise:

```bash
# Rollback GIN indexes
poetry run alembic downgrade 20260404_0002

# Rollback expression indexes
poetry run alembic downgrade 20260404_0001

# Or rollback all Phase 2
poetry run alembic downgrade 20260404_0001
```

The queries will still work without these indexes - they'll just be slower (sequential scans).
