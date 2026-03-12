# PostgreSQL Table Usage Analysis

## Summary

After thorough analysis, **3 PostgreSQL tables can be safely removed:**

1. `flyway_schema_history` - Legacy migration tracking (replaced by Alembic)
2. `resumes` - Migrated to MongoDB ⚠️ **export.py requires complete rewrite**
3. `tailored_resumes` - Migrated to MongoDB ⚠️ **export.py requires complete rewrite**

**NOT safe to remove:**

- `resume_builds` - **Still actively used** by `backend/app/api/routes/resume_builds.py`

---

## All PostgreSQL Tables (13 Total)

### Core Tables (Actively Used)

| # | Table | Status | Notes |
| - | ----- | ------ | ----- |
| 1 | `users` | ✅ ACTIVE | Authentication, profile management |
| 2 | `job_descriptions` | ✅ ACTIVE | User-created job postings |
| 3 | `job_listings` | ✅ ACTIVE | Scraped LinkedIn jobs (11 indexes) |
| 4 | `experience_blocks` | ✅ ACTIVE | The Vault with pgvector embeddings |
| 5 | `user_job_interactions` | ✅ ACTIVE | Kanban board state |
| 6 | `resume_builds` | ✅ ACTIVE | Workshop feature |
| 7 | `audit_logs` | ✅ ACTIVE | Security compliance |

### Admin Tables (Actively Used)

| # | Table | Status |
| - | ----- | ------ |
| 8 | `scraper_runs` | ✅ ACTIVE |
| 9 | `scraper_presets` | ✅ ACTIVE |
| 10 | `scraper_schedule_settings` | ✅ ACTIVE |
| 11 | `scraper_requests` | ✅ ACTIVE |

### Legacy Tables (Can Be Removed)

| # | Table | Status | Blocker |
| - | ----- | ------ | ------- |
| 12 | `resumes` | ❌ LEGACY | `export.py` requires rewrite |
| 13 | `tailored_resumes` | ❌ LEGACY | `export.py` requires rewrite |
| 14 | `flyway_schema_history` | ❌ LEGACY | None - drop immediately |

---

## Detailed Analysis: Tables to Remove

### 1. flyway_schema_history ❌ **SAFE TO DROP IMMEDIATELY**

**Background:**

- Flyway migration tracking table (legacy)
- Project migrated to Alembic on 2026-02-20
- Migration script at `backend/scripts/migrate-from-flyway.sh` explicitly says to drop it

**Action:**

```sql
DROP TABLE IF EXISTS flyway_schema_history;
```

---

### 2. resumes ❌ **REQUIRES EXPORT.PY REWRITE FIRST**

**Migration Status:**

- ✅ Data migrated to MongoDB (`backend/scripts/migrate_to_mongodb.py`)
- ✅ Main endpoints use MongoDB: `backend/app/api/routes/resumes.py`
- ⚠️ **BLOCKER:** `backend/app/api/routes/export.py` still uses PostgreSQL CRUD

**Current export.py issue (lines 9, 51-56):**

```python
from app.crud import resume_crud  # PostgreSQL CRUD

# Later in the endpoint:
resume = await resume_crud.get(db, id=tailored.resume_id)
if not resume or resume.owner_id != current_user_id:
    ...
```

**Why a simple import swap won't work:**

The MongoDB CRUD has incompatible signatures:

| Aspect | PostgreSQL (`app.crud.resume`) | MongoDB (`app.crud.mongo.resume`) |
| ------ | ------------------------------ | --------------------------------- |
| DB param type | `AsyncSession` | `AsyncIOMotorDatabase` |
| ID param type | `int` | `str` (ObjectId) |
| Owner field | `owner_id` | `user_id` |
| Dependency | `Depends(get_db_session)` | `Depends(get_mongo_db)` |

**Actual fix required:**

1. Change endpoint dependency injection to use `get_mongo_db`
2. Update all field accesses (`owner_id` → `user_id`)
3. The relationship lookup via `tailored.resume_id` returns an ObjectId, not int

**After export.py is fixed:**

```sql
DROP TABLE IF EXISTS resumes CASCADE;
```

Then delete: `backend/app/crud/resume.py`

---

### 3. tailored_resumes ❌ **REQUIRES EXPORT.PY REWRITE FIRST**

**Migration Status:**

- ✅ Data migrated to MongoDB
- ✅ Main endpoints use MongoDB: `backend/app/api/routes/tailor.py`
- ⚠️ **BLOCKER:** `backend/app/api/routes/export.py` still uses PostgreSQL CRUD

**Current export.py issue (lines 10, 28, 43, 51, 59):**

```python
from app.crud.tailor import tailored_resume_crud  # PostgreSQL CRUD

# Route parameter:
async def export_tailored_resume(
    tailored_id: int,  # PostgreSQL uses int IDs
    ...
)

# Later in the endpoint:
tailored = await tailored_resume_crud.get(db, id=tailored_id)
...
tailored_content = json.loads(tailored.tailored_content)  # PostgreSQL stores JSON string
```

**Why a simple import swap won't work:**

| Aspect | PostgreSQL (`app.crud.tailor`) | MongoDB (`app.crud.mongo.tailored_resume`) |
| ------ | ------------------------------ | ------------------------------------------ |
| DB param type | `AsyncSession` | `AsyncIOMotorDatabase` |
| ID param type | `int` | `str` (ObjectId) |
| Content field | `tailored_content` (JSON string) | `tailored_data` (dict) |
| Resume ref | `resume_id: int` | `resume_id: ObjectId` |
| Dependency | `Depends(get_db_session)` | `Depends(get_mongo_db)` |

**Actual fix required:**

1. Change route parameter: `tailored_id: int` → `tailored_id: str`
2. Change dependency: `get_db_session` → `get_mongo_db`
3. Update content access: Remove `json.loads()` since MongoDB stores dict
4. Update field names: `tailored_content` → `tailored_data` or `finalized_data`
5. Update ownership check to use MongoDB resume lookup

**Frontend impact:**

The API path `/export/{tailored_id}` changes from accepting `int` to `str`. Any frontend code calling this endpoint must be updated.

**After export.py is fixed:**

```sql
DROP TABLE IF EXISTS tailored_resumes CASCADE;
```

Then delete: `backend/app/crud/tailor.py`

---

### 4. resume_builds ✅ **CANNOT BE DROPPED - STILL IN USE**

**Previous (incorrect) assessment:** "All endpoints use MongoDB CRUD"

**Actual status:**

The PostgreSQL CRUD is **actively used**:

- `backend/app/api/routes/resume_builds.py:17` imports:

  ```python
  from app.crud.resume_build import resume_build_repository
  ```

- `backend/app/crud/__init__.py:6` exports:

  ```python
  from app.crud.resume_build import resume_build_repository
  ```

- The repository at `backend/app/crud/resume_build.py` performs SQLAlchemy operations on the `ResumeBuild` model

**This table is NOT a migration candidate.** The workshop feature actively uses PostgreSQL for resume builds.

---

## Summary of Actions

### Phase 1: Immediate Cleanup (No Code Changes)

```sql
DROP TABLE IF EXISTS flyway_schema_history;
```

### Phase 2: Export Endpoint Rewrite

**Task:** Rewrite `backend/app/api/routes/export.py` to use MongoDB

**Changes required:**

1. Replace imports:

   ```python
   # FROM:
   from app.crud import resume_crud
   from app.crud.tailor import tailored_resume_crud

   # TO:
   from app.crud.mongo import resume_crud, tailored_resume_crud
   ```

2. Add MongoDB dependency:

   ```python
   from app.api.deps import get_mongo_db
   from motor.motor_asyncio import AsyncIOMotorDatabase
   ```

3. Change route parameter type:

   ```python
   # FROM:
   tailored_id: int

   # TO:
   tailored_id: str
   ```

4. Change dependency injection:

   ```python
   # FROM:
   db: AsyncSession = Depends(get_db_session)

   # TO:
   mongo: AsyncIOMotorDatabase = Depends(get_mongo_db)
   ```

5. Update all CRUD calls and field accesses:
   - `tailored_resume_crud.get(db, id=tailored_id)` → `tailored_resume_crud.get(mongo, id=tailored_id)`
   - `tailored.tailored_content` → `tailored.finalized_data` or `tailored.tailored_data`
   - Remove `json.loads()` for content
   - `resume.owner_id` → `resume.user_id`

6. Update frontend API calls to use string IDs

**Testing required:**

- PDF export
- DOCX export
- TXT export
- Ownership verification
- 404 handling for invalid ObjectIds

### Phase 3: Table Cleanup (After Phase 2)

```sql
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS tailored_resumes CASCADE;
```

### Phase 4: Code Cleanup

Delete unused PostgreSQL CRUD files:

- `backend/app/crud/resume.py`
- `backend/app/crud/tailor.py`

Update `backend/app/crud/__init__.py` to remove the deleted exports.

---

## Corrections from Previous Analysis

| Claim | Previous | Corrected |
| ----- | -------- | --------- |
| `resume_builds` status | "Can be dropped immediately" | **Still in active use** |
| Export fix complexity | "Simple import change" | **Complete endpoint rewrite** |
| Tables to remove | 4 tables | **3 tables** (resume_builds excluded) |
| Frontend impact | Not mentioned | **API contract change (int→str)** |

---

## Recommendations

### Database Optimization Opportunities

1. **Archive Old Audit Logs**
   - `audit_logs` grows indefinitely
   - Consider archiving logs older than 6-12 months

2. **Monitor Job Listings Growth**
   - High volume from scraper
   - Consider TTL for jobs >90 days old

3. **Experience Blocks Soft Deletes**
   - Uses `deleted_at` for soft delete
   - Consider hard delete cleanup after 30-90 days

4. **Scraper Runs Cleanup**
   - Accumulates historical data
   - Consider keeping only last 6 months
