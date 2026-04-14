# Job Listing Deduplication

## Context

The LinkedIn scraper assigns different `external_job_id` values when the same job is reposted. Since `external_job_id` is the sole unique constraint on `job_listings`, reposted jobs create duplicate records with the same title, company, and city. This plan adds content-based deduplication to both prevent future duplicates and clean up existing ones.

**Match key:** `(lower(trim(job_title)), lower(trim(company_name)), lower(trim(coalesce(city, ''))))`

**Mechanism:** A new `dedup_hash` column (`VARCHAR(32)`) stores the MD5 hex digest of the concatenated normalized match key. A unique index on this column enables O(1) duplicate detection. The `|` delimiter between fields prevents boundary collisions.

---

## Step 1 — Add `compute_dedup_hash()` Utility

**File:** `backend/app/utils/apify_helpers.py`

```python
import hashlib

def compute_dedup_hash(job_title: str, company_name: str, city: str | None) -> str:
    normalized = "|".join([
        job_title.strip().lower(),
        company_name.strip().lower(),
        (city or "").strip().lower(),
    ])
    return hashlib.md5(normalized.encode()).hexdigest()
```

---

## Step 2 — Alembic Migration

**File:** `backend/alembic/versions/20260414_0001_add_dedup_hash_and_cleanup.py`
**Chain:** `down_revision = "20260411_0001"`

### Phase A — Add Column and Populate

```sql
ALTER TABLE job_listings ADD COLUMN dedup_hash VARCHAR(32);

UPDATE job_listings
SET dedup_hash = MD5(
    LOWER(TRIM(job_title)) || '|' ||
    LOWER(TRIM(company_name)) || '|' ||
    LOWER(TRIM(COALESCE(city, '')))
);
```

### Phase B — Cleanup Existing Duplicates

For each duplicate group (rows sharing `dedup_hash`), keep the **newest** record (highest `id`) as the winner:

1. **Find groups:**

   ```sql
   SELECT dedup_hash, ARRAY_AGG(id ORDER BY id DESC) AS ids
   FROM job_listings
   WHERE dedup_hash IS NOT NULL
   GROUP BY dedup_hash
   HAVING COUNT(*) > 1
   ```

2. **Migrate `user_job_interactions`:**
   - User has interactions on **both** winner and loser: merge fields (`is_saved` OR'd, earliest `applied_at`, most recent `application_status` by `status_changed_at`), then delete loser interaction
   - User has interaction on **loser only**: `UPDATE job_listing_id` to winner

3. **Migrate `tailored_resumes`:**

   ```sql
   UPDATE tailored_resumes SET job_listing_id = :winner_id WHERE job_listing_id = :loser_id
   ```

4. **Deactivate losers:** `SET is_active = FALSE` (soft-delete — `tailored_resumes` FK has no CASCADE, so hard-delete would cause FK violations)

5. **Log loser-to-winner mapping** for MongoDB cleanup (Step 8)

### Phase C — Add Constraints

```sql
ALTER TABLE job_listings ALTER COLUMN dedup_hash SET NOT NULL;
CREATE UNIQUE INDEX ix_job_listings_dedup_hash ON job_listings (dedup_hash);
```

---

## Step 3 — Update JobListing Model

**File:** `backend/app/models/job_listing.py`

Add column:

```python
dedup_hash = Column(String(32), nullable=False, unique=True, index=True)
```

---

## Step 4 — Update `batch_upsert_from_apify`

**File:** `backend/app/crud/job_listing.py` (lines 559-717)

Three changes:

**4a.** Compute hash in the values loop (after `city` is parsed, ~line 609):

```python
dedup = compute_dedup_hash(job_data.title, job_data.companyName, city)
# Add "dedup_hash": dedup to values_list entry
```

**4b.** Switch ON CONFLICT target from `external_job_id` to `dedup_hash` (~line 685):

```python
excluded_from_update = {"id", "dedup_hash", "created_at"}  # external_job_id removed from exclusion
stmt = stmt.on_conflict_do_update(
    index_elements=["dedup_hash"],
    set_=update_cols,
)
```

When a repost arrives with a new `external_job_id`, the existing row's `external_job_id` gets overwritten with the fresh one.

**4c.** Deduplicate within batch before executing (same scrape batch could contain duplicates):

```python
seen = {}
for v in values_list:
    seen[v["dedup_hash"]] = v
values_list = list(seen.values())
```

---

## Step 5 — Update `upsert_from_apify`

**File:** `backend/app/crud/job_listing.py` (lines 451-534)

Add `get_by_dedup_hash()` method. In `upsert_from_apify`, after computing `city` (~line 476):

```python
dedup = compute_dedup_hash(job_data.title, job_data.companyName, city)
existing = await self.get_by_external_id(db, external_job_id=external_id)
if not existing:
    existing = await self.get_by_dedup_hash(db, dedup_hash=dedup)
data["dedup_hash"] = dedup
```

---

## Step 6 — Update `upsert_from_webhook`

**File:** `backend/app/crud/job_listing.py` (lines 419-449)

Same dual-lookup pattern — compute hash from `job_data.job_title`, `job_data.company_name`, and `getattr(job_data, 'city', None)`. Include `dedup_hash` in data dict.

---

## Step 7 — Update `create()` Method

**File:** `backend/app/crud/job_listing.py` (lines 44-93)

Auto-compute hash before adding the record:

```python
db_obj.dedup_hash = compute_dedup_hash(obj_in.job_title, obj_in.company_name, obj_in.city)
```

---

## Step 8 — MongoDB Keyword Override Cleanup (Post-Deploy)

**File:** `backend/scripts/cleanup_keyword_overrides_dedup.py` (new)

Reads the loser-to-winner mapping logged during migration. Updates `keyword_overrides` collection:

```python
collection.update_many(
    {"job_listing_id": loser_id},
    {"$set": {"job_listing_id": winner_id}}
)
```

---

## Files to Modify

| File | Change |
| ---- | ------ |
| `backend/app/utils/apify_helpers.py` | Add `compute_dedup_hash()` |
| `backend/alembic/versions/20260414_0001_...py` | New migration |
| `backend/app/models/job_listing.py` | Add `dedup_hash` column |
| `backend/app/crud/job_listing.py` | Update 4 ingestion paths + add `get_by_dedup_hash()` |
| `backend/scripts/cleanup_keyword_overrides_dedup.py` | New post-deploy MongoDB script |

---

## Edge Cases

| Case | Handling |
| ---- | -------- |
| NULL city | `COALESCE(city, '')` — two jobs with same title/company and NULL city are considered duplicates |
| User has interactions on both winner and loser | Merge: OR `is_saved`, earliest `applied_at`, most recent `application_status`, then delete loser interaction |
| `tailored_resumes` FK (no CASCADE) | Soft-delete losers (`is_active = FALSE`), re-point FK to winner |
| Within-batch duplicates | Deduplicated before INSERT by keeping last occurrence per `dedup_hash` |
| `external_job_id` UNIQUE constraint | Kept as safety net — not dropped |

---

## Verification

1. **Pre-migration** — count existing duplicate groups:

   ```sql
   SELECT COUNT(*) FROM (
     SELECT MD5(LOWER(TRIM(job_title)) || '|' || LOWER(TRIM(company_name)) || '|' || LOWER(TRIM(COALESCE(city, ''))))
     FROM job_listings WHERE is_active = TRUE
     GROUP BY 1 HAVING COUNT(*) > 1
   ) dupes;
   ```

2. **Post-migration** — no active duplicates:

   ```sql
   SELECT dedup_hash, COUNT(*) FROM job_listings
   WHERE is_active = TRUE GROUP BY dedup_hash HAVING COUNT(*) > 1;
   -- Should return 0 rows
   ```

3. **Interactions preserved** — none pointing to inactive listings:

   ```sql
   SELECT COUNT(*) FROM user_job_interactions uji
   JOIN job_listings jl ON jl.id = uji.job_listing_id
   WHERE jl.is_active = FALSE;
   -- Should be 0
   ```

4. **Prevention test** — insert two APIFY records with same title/company/city but different `id`, verify only one active row.

5. **List endpoint** — confirm API returns deduplicated results with all user interactions intact.
