# Fix: Duplicate `external_job_id` on Apify Batch Upsert

## Context

Supabase is logging recurring errors after recent ingestion runs:

```text
duplicate key value violates unique constraint "ix_job_listings_external_job_id"
Key (external_job_id)=(4400059907) already exists.
```

The fit-scoring work (v2/v3) did not touch the scraper path. The trigger is commit **40ed58e** (`infra: bump job retention from 21 to 31 days`) — older rows linger 10 extra days, so the same LinkedIn job reappears in scrapes while the previous row is still present.

## Root Cause

`backend/app/crud/job_listing.py:730-733` upserts with a single conflict target:

```python
stmt.on_conflict_do_update(
    index_elements=["dedup_hash"],
    set_=update_cols,
)
```

But `JobListing` has **two** unique constraints (`backend/app/models/job_listing.py:36-37`):

- `external_job_id` (unique, indexed) — LinkedIn's job ID
- `dedup_hash` (unique, indexed) — MD5 of `(job_title, company_name, city)`, added in plan `260414_job-listing-dedup`

`dedup_hash` was introduced to catch reposts where LinkedIn assigns a **new** `external_job_id` but the underlying job is the same. Since then, we've also seen the inverse: reposts with the **same** `external_job_id` but slightly different city/title normalization — different `dedup_hash`. These fail the current upsert because Postgres `ON CONFLICT` can only target one constraint.

Three collision shapes now exist in prod:

| Existing row | New scrape | Current behavior |
| ------------ | ---------- | ---------------- |
| `ext=X, hash=A` | `ext=X, hash=A` | Works — `dedup_hash` conflict → UPDATE |
| `ext=Y, hash=A` | `ext=Z, hash=A` | Works — `dedup_hash` conflict → UPDATE (ext_id refreshed) |
| `ext=X, hash=A` | `ext=X, hash=B` | **Fails** — no `dedup_hash` conflict → INSERT → `external_job_id` violation |

The third shape is what's firing the Supabase errors.

A naive swap to `ON CONFLICT (external_job_id)` would fix shape 3 but break shape 2. Both unique constraints are load-bearing.

## Fix

Replace the single `ON CONFLICT` upsert with a two-phase approach: pre-query existing rows by **either** key, then partition the batch into INSERT vs UPDATE-by-pk.

### Edit — `backend/app/crud/job_listing.py` (lines ~710-733)

Replace the intra-batch dedup + single upsert with:

```python
# Intra-batch dedup: a single Apify run can repeat rows under either key.
# Prefer last occurrence keyed by external_job_id (stable LinkedIn identity
# when available); fall back to dedup_hash otherwise.
by_ext: dict[str, dict] = {}
by_hash: dict[str, dict] = {}
for v in values_list:
    by_ext[v["external_job_id"]] = v
# Rebuild values_list from the ext-keyed map, then collapse any remaining
# hash collisions within the batch.
for v in by_ext.values():
    by_hash[v["dedup_hash"]] = v
values_list = list(by_hash.values())

# Pre-query existing rows matching either key in this batch.
ext_ids = [v["external_job_id"] for v in values_list]
hashes = [v["dedup_hash"] for v in values_list]
existing = await db.execute(
    select(JobListing.id, JobListing.external_job_id, JobListing.dedup_hash)
    .where(or_(
        JobListing.external_job_id.in_(ext_ids),
        JobListing.dedup_hash.in_(hashes),
    ))
)
existing_by_ext: dict[str, int] = {}
existing_by_hash: dict[str, int] = {}
for row_id, ext, h in existing.all():
    existing_by_ext[ext] = row_id
    existing_by_hash[h] = row_id

to_insert: list[dict] = []
to_update: list[tuple[int, dict]] = []
for v in values_list:
    pk = existing_by_ext.get(v["external_job_id"]) \
        or existing_by_hash.get(v["dedup_hash"])
    if pk is not None:
        to_update.append((pk, v))
    else:
        to_insert.append(v)

excluded_from_update = {"id", "created_at"}

async with db.begin_nested():
    if to_insert:
        await db.execute(insert(JobListing).values(to_insert))
    for pk, v in to_update:
        update_values = {k: val for k, val in v.items() if k not in excluded_from_update}
        await db.execute(
            update(JobListing).where(JobListing.id == pk).values(**update_values)
        )

created_count += len(to_insert)
updated_count += len(to_update)
```

Properties:

- Shape 1 (same ext_id, same hash): `existing_by_ext` hit → UPDATE.
- Shape 2 (different ext_id, same hash — repost): `existing_by_hash` hit → UPDATE, `external_job_id` refreshed.
- Shape 3 (same ext_id, different hash — renormalized repost): `existing_by_ext` hit → UPDATE, `dedup_hash` refreshed.
- New job: neither map hit → INSERT.

The per-row UPDATE loop is acceptable at our batch sizes (100 rows, mostly INSERTs). If batch sizes grow significantly, revisit with a `CASE`-based bulk UPDATE.

## Verification

1. **Unit test** — add to `backend/tests/crud/test_job_listing.py` (or create):
   - Seed row `(ext=X, hash=A)`. Call `batch_upsert_from_apify` with a job producing `(ext=X, hash=B)`. Expect 1 row total, `dedup_hash=B`, no exception.
   - Seed row `(ext=Y, hash=A)`. Call `batch_upsert_from_apify` with `(ext=Z, hash=A)`. Expect 1 row total, `external_job_id=Z`.
   - Seed nothing. Call with a new job. Expect 1 INSERT.
2. **Prod** — trigger a scraper run via admin endpoint and tail logs for `duplicate key value`; should be zero. Confirm Supabase error log stays clean for 24h.

## Critical files

| File | Change |
| ---- | ------ |
| `backend/app/crud/job_listing.py:710-733` | Replace single ON CONFLICT with pre-query + partition |
| `backend/tests/crud/test_job_listing.py` | Regression tests for all three collision shapes |

## Commits

1. `docs: plan fix for external_job_id upsert collision`
2. `backend: partition scraper batches to handle both upsert keys`

## Out of scope

- Retention policy revert (31 days is intentional, per 40ed58e).
- Changing the `dedup_hash` formula.
- Removing either unique constraint.
