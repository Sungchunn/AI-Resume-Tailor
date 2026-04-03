#!/usr/bin/env python
"""
Sync all MongoDB documents to the admin@admin.com user account.

This script:
1. Finds the user with email admin@admin.com in PostgreSQL
2. Updates all MongoDB collections (resumes, tailored_resumes, resume_builds, keyword_overrides)
   to set user_id to that admin user's ID

Usage:
    cd backend
    poetry run python scripts/sync_mongo_to_admin.py

Options:
    --dry-run    Print what would be updated without making changes
    --create     Create the admin user if it doesn't exist (password: admin123)
"""

import argparse
import asyncio
import re
import sys

from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Add parent directory to path for imports
sys.path.insert(0, str(__file__).rsplit("/scripts", 1)[0])

from app.core.config import get_settings
from app.core.security import get_password_hash

settings = get_settings()

ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "admin123"  # Default password if creating new admin


def mask_uri_credentials(uri: str) -> str:
    """Mask password in MongoDB/PostgreSQL URI for safe logging."""
    return re.sub(r"(://[^:]+:)[^@]+(@)", r"\1***\2", uri)


def get_pg_sync_url() -> str:
    """Get synchronous PostgreSQL URL."""
    url = settings.database_url
    if "+asyncpg" in url:
        url = url.replace("+asyncpg", "")
    return url


def get_or_create_admin_user(pg_session: Session, create_if_missing: bool = False) -> int | None:
    """
    Find admin@admin.com user in PostgreSQL.
    Returns user ID or None if not found.
    """
    result = pg_session.execute(
        text("SELECT id, email, is_admin FROM users WHERE email = :email"),
        {"email": ADMIN_EMAIL},
    )
    row = result.fetchone()

    if row:
        user_id, email, is_admin = row
        print(f"Found admin user: id={user_id}, email={email}, is_admin={is_admin}")
        return user_id

    if create_if_missing:
        print(f"Admin user not found, creating {ADMIN_EMAIL}...")
        hashed_password = get_password_hash(ADMIN_PASSWORD)
        pg_session.execute(
            text("""
                INSERT INTO users (email, hashed_password, full_name, is_active, is_admin)
                VALUES (:email, :password, :name, true, true)
            """),
            {
                "email": ADMIN_EMAIL,
                "password": hashed_password,
                "name": "Admin User",
            },
        )
        pg_session.commit()

        # Get the new user's ID
        result = pg_session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": ADMIN_EMAIL},
        )
        row = result.fetchone()
        if row:
            print(f"Created admin user with id={row[0]}")
            return row[0]

    print(f"Admin user {ADMIN_EMAIL} not found in PostgreSQL!")
    print("Use --create flag to create the admin user")
    return None


async def sync_collection(
    mongo_db,
    collection_name: str,
    admin_user_id: int,
    dry_run: bool = False,
) -> int:
    """
    Update all documents in a collection to use the admin user_id.
    Returns count of updated documents.
    """
    collection = mongo_db[collection_name]

    # Count documents that need updating
    total_count = await collection.count_documents({})
    different_user_count = await collection.count_documents({"user_id": {"$ne": admin_user_id}})

    print(f"\n--- {collection_name} ---")
    print(f"  Total documents: {total_count}")
    print(f"  Documents with different user_id: {different_user_count}")

    if dry_run:
        print(f"  [DRY RUN] Would update {different_user_count} documents")
        return 0

    if different_user_count == 0:
        print("  No updates needed")
        return 0

    # Update all documents to use admin user_id
    result = await collection.update_many(
        {"user_id": {"$ne": admin_user_id}},
        {"$set": {"user_id": admin_user_id}},
    )

    print(f"  Updated {result.modified_count} documents")
    return result.modified_count


async def main(dry_run: bool = False, create_admin: bool = False) -> None:
    """Main sync function."""
    print("=" * 60)
    print("MongoDB Admin Sync Script")
    print("=" * 60)
    print(f"PostgreSQL: {mask_uri_credentials(get_pg_sync_url())}")
    print(f"MongoDB: {mask_uri_credentials(settings.mongodb_uri)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE SYNC'}")
    print("=" * 60)

    # Connect to PostgreSQL
    pg_engine = create_engine(get_pg_sync_url())
    pg_session = Session(pg_engine)

    # Get or create admin user
    admin_user_id = get_or_create_admin_user(pg_session, create_if_missing=create_admin)
    if admin_user_id is None:
        pg_session.close()
        return

    print(f"\nSyncing all MongoDB documents to user_id={admin_user_id}")

    # Connect to MongoDB
    mongo_client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo_db = mongo_client[settings.mongodb_database]

    try:
        total_updated = 0

        # Sync all collections with user_id field
        collections = ["resumes", "tailored_resumes", "resume_builds", "keyword_overrides"]

        for collection_name in collections:
            updated = await sync_collection(mongo_db, collection_name, admin_user_id, dry_run)
            total_updated += updated

        print("\n" + "=" * 60)
        if dry_run:
            print("DRY RUN completed - no changes made")
        else:
            print(f"Sync completed! Total documents updated: {total_updated}")
        print("=" * 60)

    except Exception as e:
        print(f"\nERROR: Sync failed: {e}")
        raise
    finally:
        pg_session.close()
        mongo_client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sync all MongoDB documents to admin@admin.com user"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be updated without making changes",
    )
    parser.add_argument(
        "--create",
        action="store_true",
        help="Create the admin user if it doesn't exist",
    )
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run, create_admin=args.create))
