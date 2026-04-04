# Phase 3: N+1 Query Optimization

**Priority:** P1 - High
**Estimated Time:** 1 hour
**Risk Level:** Low (code refactor, no schema changes)
**Prerequisite:** Phase 1 and 2 complete

---

## Overview

This phase fixes N+1 query patterns in the job listings API where user interactions are fetched in a loop instead of batched.

---

## Problem Analysis

### Current Code Pattern

**File:** `backend/app/api/routes/job_listings.py`

**Lines 208-225 (list_job_listings endpoint):**

```python
listings, total = await job_listing_repository.list(
    db, filters=filters, user_id=current_user_id
)

# Get user interactions for each listing
response_listings = []
for listing in listings:
    interaction = await user_job_interaction_repository.get(
        db, user_id=current_user_id, job_listing_id=listing.id
    )
    response_listings.append(_build_listing_response(listing, interaction))
```

**Lines 250-259 (search_job_listings endpoint):**

```python
listings, total = await job_listing_repository.list(
    db, filters=filters, user_id=current_user_id
)

response_listings = []
for listing in listings:
    interaction = await user_job_interaction_repository.get(
        db, user_id=current_user_id, job_listing_id=listing.id
    )
    response_listings.append(_build_listing_response(listing, interaction))
```

**Lines 286-296 (list_saved_jobs endpoint):**

```python
listings, total = await job_listing_repository.list(
    db, filters=filters, user_id=current_user_id
)

response_listings = []
for listing in listings:
    interaction = await user_job_interaction_repository.get(
        db, user_id=current_user_id, job_listing_id=listing.id
    )
    response_listings.append(_build_listing_response(listing, interaction))
```

The same pattern appears in `list_applied_jobs` and other endpoints.

### Why This Is a Problem

For a request returning 20 job listings:

1. **Query 1:** Fetch 20 job listings
2. **Query 2-21:** Fetch interaction for listing 1, 2, 3... 20

**Total: 21 database queries per request**

This is the classic **N+1 problem**:

- N = number of listings
- 1 = initial query
- N+1 = total queries

With 20 listings and 100ms per query, that's 2+ seconds of database time per request.

### The Fix: Batch Fetching

Instead of N individual queries, use a single query with `IN`:

```sql
-- Current (N queries):
SELECT * FROM user_job_interactions WHERE user_id = 1 AND job_listing_id = 101;
SELECT * FROM user_job_interactions WHERE user_id = 1 AND job_listing_id = 102;
SELECT * FROM user_job_interactions WHERE user_id = 1 AND job_listing_id = 103;
-- ... 17 more queries

-- Fixed (1 query):
SELECT * FROM user_job_interactions
WHERE user_id = 1 AND job_listing_id IN (101, 102, 103, ..., 120);
```

---

## Implementation

### Step 1: Add Batch Fetch Method to Repository

**File:** `backend/app/crud/user_job_interaction.py`

First, let's check the current repository structure:

**Current `get` method (assumed):**

```python
async def get(
    self,
    db: AsyncSession,
    *,
    user_id: int,
    job_listing_id: int,
) -> UserJobInteraction | None:
    """Get a single user-job interaction."""
    result = await db.execute(
        select(UserJobInteraction).where(
            UserJobInteraction.user_id == user_id,
            UserJobInteraction.job_listing_id == job_listing_id,
        )
    )
    return result.scalar_one_or_none()
```

**Add new batch method:**

```python
async def get_batch(
    self,
    db: AsyncSession,
    *,
    user_id: int,
    job_listing_ids: list[int],
) -> dict[int, UserJobInteraction]:
    """
    Get interactions for multiple job listings in a single query.

    Args:
        db: Database session
        user_id: The user's ID
        job_listing_ids: List of job listing IDs to fetch interactions for

    Returns:
        Dictionary mapping job_listing_id -> UserJobInteraction
        Missing interactions (no record) will not have a key in the dict.

    Example:
        interactions = await repo.get_batch(db, user_id=1, job_listing_ids=[1, 2, 3])
        # Returns: {1: <interaction>, 3: <interaction>}
        # Note: listing 2 has no interaction, so it's not in the dict
    """
    if not job_listing_ids:
        return {}

    result = await db.execute(
        select(UserJobInteraction).where(
            UserJobInteraction.user_id == user_id,
            UserJobInteraction.job_listing_id.in_(job_listing_ids),
        )
    )
    interactions = result.scalars().all()

    # Build lookup dict: job_listing_id -> interaction
    return {interaction.job_listing_id: interaction for interaction in interactions}
```

### Step 2: Update Route Handlers

**File:** `backend/app/api/routes/job_listings.py`

**Update `list_job_listings` (lines 208-225):**

```python
listings, total = await job_listing_repository.list(
    db, filters=filters, user_id=current_user_id
)

# Batch fetch all interactions in a single query (fixes N+1)
listing_ids = [listing.id for listing in listings]
interactions_map = await user_job_interaction_repository.get_batch(
    db, user_id=current_user_id, job_listing_ids=listing_ids
)

# Build responses using the pre-fetched interactions
response_listings = [
    _build_listing_response(listing, interactions_map.get(listing.id))
    for listing in listings
]
```

**Update `search_job_listings` (lines 250-259):**

```python
listings, total = await job_listing_repository.list(
    db, filters=filters, user_id=current_user_id
)

# Batch fetch all interactions in a single query (fixes N+1)
listing_ids = [listing.id for listing in listings]
interactions_map = await user_job_interaction_repository.get_batch(
    db, user_id=current_user_id, job_listing_ids=listing_ids
)

response_listings = [
    _build_listing_response(listing, interactions_map.get(listing.id))
    for listing in listings
]
```

**Update `list_saved_jobs` (lines 286-296):**

```python
listings, total = await job_listing_repository.list(
    db, filters=filters, user_id=current_user_id
)

# Batch fetch all interactions in a single query (fixes N+1)
listing_ids = [listing.id for listing in listings]
interactions_map = await user_job_interaction_repository.get_batch(
    db, user_id=current_user_id, job_listing_ids=listing_ids
)

response_listings = [
    _build_listing_response(listing, interactions_map.get(listing.id))
    for listing in listings
]
```

**Update `list_applied_jobs` (similar pattern):**

```python
listings, total = await job_listing_repository.list(
    db, filters=filters, user_id=current_user_id
)

listing_ids = [listing.id for listing in listings]
interactions_map = await user_job_interaction_repository.get_batch(
    db, user_id=current_user_id, job_listing_ids=listing_ids
)

response_listings = [
    _build_listing_response(listing, interactions_map.get(listing.id))
    for listing in listings
]
```

---

## Full Code Changes

### File 1: `backend/app/crud/user_job_interaction.py`

**Add after the existing `get` method:**

```python
async def get_batch(
    self,
    db: AsyncSession,
    *,
    user_id: int,
    job_listing_ids: list[int],
) -> dict[int, UserJobInteraction]:
    """
    Get interactions for multiple job listings in a single query.

    This method eliminates N+1 query problems when fetching interactions
    for a list of job listings. Instead of N individual queries, it uses
    a single query with an IN clause.

    Args:
        db: Database session
        user_id: The user's ID
        job_listing_ids: List of job listing IDs to fetch interactions for

    Returns:
        Dictionary mapping job_listing_id -> UserJobInteraction.
        Job listings without interactions will not have entries in the dict.

    Performance:
        - Before: N queries (one per listing)
        - After: 1 query with IN clause

    Example:
        # Fetch interactions for 20 listings in 1 query
        interactions = await repo.get_batch(
            db,
            user_id=current_user_id,
            job_listing_ids=[1, 2, 3, ..., 20]
        )

        # Access by listing ID (returns None if no interaction)
        interaction = interactions.get(listing_id)
    """
    if not job_listing_ids:
        return {}

    result = await db.execute(
        select(UserJobInteraction).where(
            UserJobInteraction.user_id == user_id,
            UserJobInteraction.job_listing_id.in_(job_listing_ids),
        )
    )
    interactions = result.scalars().all()

    return {interaction.job_listing_id: interaction for interaction in interactions}
```

### File 2: `backend/app/api/routes/job_listings.py`

**Replace the N+1 pattern in all affected endpoints.**

The pattern to find and replace:

```python
# BEFORE (N+1 pattern):
response_listings = []
for listing in listings:
    interaction = await user_job_interaction_repository.get(
        db, user_id=current_user_id, job_listing_id=listing.id
    )
    response_listings.append(_build_listing_response(listing, interaction))

# AFTER (batch pattern):
listing_ids = [listing.id for listing in listings]
interactions_map = await user_job_interaction_repository.get_batch(
    db, user_id=current_user_id, job_listing_ids=listing_ids
)
response_listings = [
    _build_listing_response(listing, interactions_map.get(listing.id))
    for listing in listings
]
```

**Endpoints to update:**

1. `list_job_listings` (lines 212-218)
2. `search_job_listings` (lines 254-259)
3. `list_saved_jobs` (lines 290-296)
4. `list_applied_jobs` (similar location)

---

## Performance Comparison

### Before (N+1)

```text
Request: GET /api/job-listings?limit=20

Database queries:
1. SELECT ... FROM job_listings WHERE ... LIMIT 20
2. SELECT ... FROM user_job_interactions WHERE user_id=1 AND job_listing_id=101
3. SELECT ... FROM user_job_interactions WHERE user_id=1 AND job_listing_id=102
... (18 more queries)

Total queries: 21
Estimated time: 21 * 5ms = 105ms database time
```

### After (Batched)

```text
Request: GET /api/job-listings?limit=20

Database queries:
1. SELECT ... FROM job_listings WHERE ... LIMIT 20
2. SELECT ... FROM user_job_interactions WHERE user_id=1 AND job_listing_id IN (101, 102, ..., 120)

Total queries: 2
Estimated time: 2 * 5ms = 10ms database time
```

**Improvement: 90% reduction in database queries**

---

## Verification Steps

### 1. Unit Test the Batch Method

Create a test to verify the batch method works:

```python
# backend/tests/crud/test_user_job_interaction.py

import pytest
from app.crud import user_job_interaction_repository


@pytest.mark.asyncio
async def test_get_batch_returns_dict(db_session, test_user, test_job_listings):
    """Test that get_batch returns a dictionary keyed by job_listing_id."""
    # Create interactions for some listings
    for listing in test_job_listings[:3]:
        await user_job_interaction_repository.get_or_create(
            db_session,
            user_id=test_user.id,
            job_listing_id=listing.id,
        )
    await db_session.commit()

    # Batch fetch
    all_ids = [listing.id for listing in test_job_listings]
    result = await user_job_interaction_repository.get_batch(
        db_session,
        user_id=test_user.id,
        job_listing_ids=all_ids,
    )

    # Should return dict with 3 entries (only listings with interactions)
    assert len(result) == 3
    assert all(isinstance(k, int) for k in result.keys())


@pytest.mark.asyncio
async def test_get_batch_empty_list(db_session, test_user):
    """Test that get_batch handles empty list gracefully."""
    result = await user_job_interaction_repository.get_batch(
        db_session,
        user_id=test_user.id,
        job_listing_ids=[],
    )
    assert result == {}
```

### 2. Integration Test the Endpoints

```python
# backend/tests/api/test_job_listings.py

@pytest.mark.asyncio
async def test_list_job_listings_no_n_plus_one(client, auth_headers, db_session, mocker):
    """Verify the endpoint uses batch fetching, not N+1 queries."""
    # Mock the repository to track calls
    get_batch_spy = mocker.spy(user_job_interaction_repository, 'get_batch')
    get_single_spy = mocker.spy(user_job_interaction_repository, 'get')

    response = await client.get("/api/job-listings?limit=20", headers=auth_headers)
    assert response.status_code == 200

    # Should call get_batch once, not get() 20 times
    assert get_batch_spy.call_count == 1
    assert get_single_spy.call_count == 0  # Old method should not be called
```

### 3. Manual Verification with Query Logging

Temporarily enable SQL logging to verify query count:

```python
# In backend/app/db/session.py, temporarily set:
engine = create_async_engine(
    settings.database_url,
    echo=True,  # Enable for testing
    # ...
)
```

Then make a request and count the `SELECT ... FROM user_job_interactions` queries in the logs. Should see exactly 1.

### 4. Load Test Comparison

```bash
# Before fix (baseline)
ab -n 100 -c 10 "http://localhost:8000/api/job-listings?limit=20"

# After fix
ab -n 100 -c 10 "http://localhost:8000/api/job-listings?limit=20"

# Compare "Time per request" and "Requests per second"
```

---

## Edge Cases Handled

### Empty Job Listings

```python
# If listings is empty, job_listing_ids will be []
# get_batch handles this gracefully:
if not job_listing_ids:
    return {}
```

### No Interactions for User

```python
# If user has no interactions, get_batch returns {}
# interactions_map.get(listing.id) returns None
# _build_listing_response handles None interaction correctly
```

### Large Result Sets

For very large result sets (100+ listings), the IN clause could become slow. However:

1. The API limits results to 100 max (`Query(ge=1, le=100)`)
2. PostgreSQL handles IN clauses with 100 elements efficiently
3. If needed, could batch the IN clause into chunks of 50

---

## Rollback Plan

If issues arise, revert to the original N+1 pattern:

```python
# Revert to original code:
response_listings = []
for listing in listings:
    interaction = await user_job_interaction_repository.get(
        db, user_id=current_user_id, job_listing_id=listing.id
    )
    response_listings.append(_build_listing_response(listing, interaction))
```

The `get_batch` method can remain in the repository (unused but harmless).
