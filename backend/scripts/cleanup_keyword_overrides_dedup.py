"""Post-deploy script: migrate MongoDB collections from dedup losers to winners.

Reads the _dedup_loser_winner_map table created by migration 20260414_0001
and re-points documents in both keyword_overrides and tailored_resumes
MongoDB collections from loser IDs to winner IDs.

Usage:
    cd backend
    poetry run python scripts/cleanup_keyword_overrides_dedup.py

After successful execution, drop the temp table:
    DROP TABLE IF EXISTS _dedup_loser_winner_map;
"""
import asyncio
import os

import asyncpg
from motor.motor_asyncio import AsyncIOMotorClient


async def main() -> None:
    pg_url = os.environ["DATABASE_URL"]
    mongo_url = os.environ["MONGODB_URL"]
    mongo_db_name = os.environ.get("MONGODB_DB_NAME", "resume_builder")

    pg_conn = await asyncpg.connect(pg_url)
    mongo_client: AsyncIOMotorClient = AsyncIOMotorClient(mongo_url)
    mongo_db = mongo_client[mongo_db_name]
    collection = mongo_db["keyword_overrides"]

    rows = await pg_conn.fetch(
        "SELECT loser_id, winner_id FROM _dedup_loser_winner_map"
    )

    if not rows:
        print("No loser-to-winner mappings found. Nothing to do.")
        await pg_conn.close()
        mongo_client.close()
        return

    # 1. Re-point keyword_overrides
    print("Re-pointing keyword_overrides...")
    kw_updated = 0
    for row in rows:
        loser_id = row["loser_id"]
        winner_id = row["winner_id"]
        result = await collection.update_many(
            {"job_listing_id": loser_id},
            {"$set": {"job_listing_id": winner_id}},
        )
        if result.modified_count:
            print(f"  keyword_overrides: {result.modified_count} docs {loser_id} -> {winner_id}")
            kw_updated += result.modified_count

    # 2. Re-point tailored_resumes (migrated from PG to MongoDB in 20260312_0002)
    print("Re-pointing tailored_resumes...")
    tailored = mongo_db["tailored_resumes"]
    tr_updated = 0
    for row in rows:
        loser_id = row["loser_id"]
        winner_id = row["winner_id"]
        result = await tailored.update_many(
            {"job_source.type": "job_listing", "job_source.id": loser_id},
            {"$set": {"job_source.id": winner_id}},
        )
        if result.modified_count:
            print(f"  tailored_resumes: {result.modified_count} docs {loser_id} -> {winner_id}")
            tr_updated += result.modified_count

    print(f"Done. Updated {kw_updated} keyword_overrides + {tr_updated} tailored_resumes across {len(rows)} mappings.")
    print("You can now drop the temp table:")
    print("  DROP TABLE IF EXISTS _dedup_loser_winner_map;")

    await pg_conn.close()
    mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
