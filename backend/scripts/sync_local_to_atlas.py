#!/usr/bin/env python
"""
Sync MongoDB data from local Docker to cloud MongoDB Atlas.

This script:
1. Connects to local Docker MongoDB (source)
2. Connects to cloud MongoDB Atlas (destination)
3. Copies all documents from local to Atlas, remapping user_id to target user

Usage:
    cd backend
    poetry run python scripts/sync_local_to_atlas.py

Options:
    --dry-run           Print what would be synced without making changes
    --target-user-id    Target user_id in Atlas (default: 1 for admin@admin.com)
    --replace           Replace existing documents in Atlas (default: skip existing)
"""

import argparse
import asyncio
import re
import sys

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
    target_user_id: int,
    replace: bool = False,
    dry_run: bool = False,
) -> dict:
    """
    Sync documents from source to destination collection.
    Remaps user_id to target_user_id for all documents.

    Returns dict with counts: inserted, skipped, replaced, errors
    """
    source_col = source_db[collection_name]
    dest_col = dest_db[collection_name]

    stats = {"inserted": 0, "skipped": 0, "replaced": 0, "errors": 0}

    print(f"\n--- Syncing {collection_name} ---")

    # Get all source documents
    cursor = source_col.find({})
    docs = await cursor.to_list(length=None)

    print(f"  Found {len(docs)} documents in local")

    if dry_run:
        print(f"  [DRY RUN] Would sync {len(docs)} documents (remapping user_id to {target_user_id})")
        return stats

    for doc in docs:
        try:
            # Remap user_id to target user
            original_user_id = doc.get("user_id")
            doc["user_id"] = target_user_id

            # Check if document exists in destination (by _id)
            existing = await dest_col.find_one({"_id": doc["_id"]})

            if existing:
                if replace:
                    # Replace existing document
                    await dest_col.replace_one({"_id": doc["_id"]}, doc)
                    stats["replaced"] += 1
                    print(f"    Replaced: {doc['_id']} (user_id: {original_user_id} -> {target_user_id})")
                else:
                    stats["skipped"] += 1
            else:
                # Insert new document
                await dest_col.insert_one(doc)
                stats["inserted"] += 1
                print(f"    Inserted: {doc['_id']} (user_id: {original_user_id} -> {target_user_id})")

        except Exception as e:
            stats["errors"] += 1
            print(f"    Error syncing {doc.get('_id')}: {e}")

    print(f"  Results: {stats['inserted']} inserted, {stats['skipped']} skipped, {stats['replaced']} replaced, {stats['errors']} errors")
    return stats


async def main(dry_run: bool = False, target_user_id: int = 1, replace: bool = False) -> None:
    """Main sync function."""
    print("=" * 70)
    print("Local Docker → MongoDB Atlas Sync")
    print("=" * 70)
    print(f"Source (Local):  {mask_uri_credentials(LOCAL_MONGODB_URI)}")
    print(f"Dest (Atlas):    {mask_uri_credentials(settings.mongodb_uri)}")
    print(f"Target user_id:  {target_user_id} (all docs will be remapped to this user)")
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
        print("\nLocal MongoDB (all documents):")
        for col_name in COLLECTIONS:
            stats = await get_collection_stats(local_db, col_name, None)
            print(f"  {stats['name']}: {stats['count']} documents")

        print(f"\nMongoDB Atlas (user_id={target_user_id}):")
        for col_name in COLLECTIONS:
            stats = await get_collection_stats(atlas_db, col_name, target_user_id)
            print(f"  {stats['name']}: {stats['count']} documents")

        # Sync each collection
        total_stats = {"inserted": 0, "skipped": 0, "replaced": 0, "errors": 0}

        for col_name in COLLECTIONS:
            stats = await sync_collection(
                local_db, atlas_db, col_name,
                target_user_id=target_user_id,
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
        "--target-user-id",
        type=int,
        default=1,
        help="Target user_id in Atlas to assign documents to (default: 1 for admin@admin.com)",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing documents in Atlas (default: skip existing)",
    )
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run, target_user_id=args.target_user_id, replace=args.replace))
