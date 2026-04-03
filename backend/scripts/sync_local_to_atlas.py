#!/usr/bin/env python
"""
Sync MongoDB data from local Docker to cloud MongoDB Atlas.

This script:
1. Connects to local Docker MongoDB (source)
2. Connects to cloud MongoDB Atlas (destination)
3. Copies all documents from local to Atlas for the specified user

Usage:
    cd backend
    poetry run python scripts/sync_local_to_atlas.py

Options:
    --dry-run       Print what would be synced without making changes
    --user-id ID    Sync only documents for this user ID (default: 1 for admin)
    --replace       Replace existing documents in Atlas (default: skip existing)
"""

import argparse
import asyncio
import re
import sys
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path for imports
sys.path.insert(0, str(__file__).rsplit("/scripts", 1)[0])

from app.core.config import get_settings

settings = get_settings()

# Local Docker MongoDB connection
LOCAL_MONGODB_URI = "mongodb://mongouser:mongopass@localhost:27017/resume_tailor?authSource=admin"
LOCAL_MONGODB_DATABASE = "resume_tailor"

# Collections to sync (all have user_id field)
COLLECTIONS = ["resumes", "tailored_resumes", "resume_builds", "keyword_overrides"]


def mask_uri_credentials(uri: str) -> str:
    """Mask password in MongoDB URI for safe logging."""
    return re.sub(r"(://[^:]+:)[^@]+(@)", r"\1***\2", uri)


async def get_collection_stats(db, collection_name: str, user_id: int | None = None) -> dict:
    """Get stats for a collection."""
    collection = db[collection_name]
    query = {"user_id": user_id} if user_id else {}
    count = await collection.count_documents(query)
    return {"name": collection_name, "count": count}


async def sync_collection(
    source_db,
    dest_db,
    collection_name: str,
    user_id: int | None = None,
    replace: bool = False,
    dry_run: bool = False,
) -> dict:
    """
    Sync documents from source to destination collection.

    Returns dict with counts: inserted, skipped, replaced, errors
    """
    source_col = source_db[collection_name]
    dest_col = dest_db[collection_name]

    query = {"user_id": user_id} if user_id else {}

    stats = {"inserted": 0, "skipped": 0, "replaced": 0, "errors": 0}

    print(f"\n--- Syncing {collection_name} ---")

    # Get all source documents
    cursor = source_col.find(query)
    docs = await cursor.to_list(length=None)

    print(f"  Found {len(docs)} documents in local")

    if dry_run:
        print(f"  [DRY RUN] Would sync {len(docs)} documents")
        return stats

    for doc in docs:
        try:
            # Check if document exists in destination (by _id)
            existing = await dest_col.find_one({"_id": doc["_id"]})

            if existing:
                if replace:
                    # Replace existing document
                    await dest_col.replace_one({"_id": doc["_id"]}, doc)
                    stats["replaced"] += 1
                    print(f"    Replaced: {doc['_id']}")
                else:
                    stats["skipped"] += 1
            else:
                # Insert new document
                await dest_col.insert_one(doc)
                stats["inserted"] += 1
                print(f"    Inserted: {doc['_id']}")

        except Exception as e:
            stats["errors"] += 1
            print(f"    Error syncing {doc.get('_id')}: {e}")

    print(f"  Results: {stats['inserted']} inserted, {stats['skipped']} skipped, {stats['replaced']} replaced, {stats['errors']} errors")
    return stats


async def main(dry_run: bool = False, user_id: int | None = None, replace: bool = False) -> None:
    """Main sync function."""
    print("=" * 70)
    print("Local Docker → MongoDB Atlas Sync")
    print("=" * 70)
    print(f"Source (Local):  {mask_uri_credentials(LOCAL_MONGODB_URI)}")
    print(f"Dest (Atlas):    {mask_uri_credentials(settings.mongodb_uri)}")
    print(f"User filter:     {f'user_id={user_id}' if user_id else 'ALL users'}")
    print(f"Replace mode:    {replace}")
    print(f"Mode:            {'DRY RUN' if dry_run else 'LIVE SYNC'}")
    print("=" * 70)

    # Connect to local MongoDB
    print("\nConnecting to local MongoDB...")
    try:
        local_client = AsyncIOMotorClient(LOCAL_MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Test connection
        await local_client.admin.command('ping')
        local_db = local_client[LOCAL_MONGODB_DATABASE]
        print("  Connected to local MongoDB")
    except Exception as e:
        print(f"  ERROR: Cannot connect to local MongoDB: {e}")
        print("  Make sure Docker containers are running: docker-compose up -d")
        return

    # Connect to Atlas MongoDB
    print("\nConnecting to MongoDB Atlas...")
    try:
        atlas_client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=10000)
        # Test connection
        await atlas_client.admin.command('ping')
        atlas_db = atlas_client[settings.mongodb_database]
        print("  Connected to MongoDB Atlas")
    except Exception as e:
        print(f"  ERROR: Cannot connect to MongoDB Atlas: {e}")
        local_client.close()
        return

    try:
        # Show current stats
        print("\n--- Current State ---")
        print("\nLocal MongoDB:")
        for col_name in COLLECTIONS:
            stats = await get_collection_stats(local_db, col_name, user_id)
            print(f"  {stats['name']}: {stats['count']} documents")

        print("\nMongoDB Atlas:")
        for col_name in COLLECTIONS:
            stats = await get_collection_stats(atlas_db, col_name, user_id)
            print(f"  {stats['name']}: {stats['count']} documents")

        # Sync each collection
        total_stats = {"inserted": 0, "skipped": 0, "replaced": 0, "errors": 0}

        for col_name in COLLECTIONS:
            stats = await sync_collection(
                local_db, atlas_db, col_name,
                user_id=user_id,
                replace=replace,
                dry_run=dry_run,
            )
            for key in total_stats:
                total_stats[key] += stats[key]

        # Summary
        print("\n" + "=" * 70)
        if dry_run:
            print("DRY RUN completed - no changes made")
        else:
            print("Sync completed!")
            print(f"  Total inserted: {total_stats['inserted']}")
            print(f"  Total skipped:  {total_stats['skipped']}")
            print(f"  Total replaced: {total_stats['replaced']}")
            print(f"  Total errors:   {total_stats['errors']}")
        print("=" * 70)

    except Exception as e:
        print(f"\nERROR: Sync failed: {e}")
        raise
    finally:
        local_client.close()
        atlas_client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sync MongoDB data from local Docker to cloud Atlas"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be synced without making changes",
    )
    parser.add_argument(
        "--user-id",
        type=int,
        default=None,
        help="Sync only documents for this user ID (default: all users)",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing documents in Atlas (default: skip existing)",
    )
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run, user_id=args.user_id, replace=args.replace))
