#!/usr/bin/env python
"""
One-time migration script to move resume data from PostgreSQL to MongoDB.

Migrates:
- resumes -> MongoDB resumes collection
- tailored_resumes -> MongoDB tailored_resumes collection
- resume_builds -> MongoDB resume_builds collection

Experience blocks remain in PostgreSQL for pgvector semantic search.

Usage:
    cd backend
    poetry run python scripts/migrate_to_mongodb.py

Options:
    --dry-run    Print what would be migrated without making changes
    --verify     Verify migration counts match after migration
"""

import argparse
import asyncio
import re
import sys
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Add parent directory to path for imports
sys.path.insert(0, str(__file__).rsplit("/scripts", 1)[0])

from app.core.config import get_settings


settings = get_settings()


def mask_uri_credentials(uri: str) -> str:
    """Mask password in MongoDB/PostgreSQL URI for safe logging."""
    # Pattern matches user:password@ and replaces password with ***
    return re.sub(r"(://[^:]+:)[^@]+(@)", r"\1***\2", uri)


def get_pg_sync_url() -> str:
    """Get synchronous PostgreSQL URL for migration."""
    # Convert async URL to sync
    url = settings.database_url
    if "+asyncpg" in url:
        url = url.replace("+asyncpg", "")
    return url


async def migrate_resumes(pg_session: Session, mongo_db, dry_run: bool = False) -> dict[int, str]:
    """
    Migrate resumes from PostgreSQL to MongoDB.
    Returns mapping of pg_id -> mongo_oid for foreign key updates.
    """
    print("\n--- Migrating resumes ---")

    # Query all resumes from Postgres
    result = pg_session.execute(text("""
        SELECT
            id, owner_id, title, raw_content, html_content,
            parsed_content, style, original_file_key, original_filename,
            file_type, file_size_bytes, created_at, updated_at
        FROM resumes
        ORDER BY id
    """))
    rows = result.fetchall()
    print(f"Found {len(rows)} resumes in PostgreSQL")

    if dry_run:
        print("[DRY RUN] Would migrate resumes")
        return {}

    id_mapping = {}  # pg_id -> mongo_oid

    for row in rows:
        (
            pg_id, owner_id, title, raw_content, html_content,
            parsed_content, style, original_file_key, original_filename,
            file_type, file_size_bytes, created_at, updated_at
        ) = row

        # Build MongoDB document with legacy ID for idempotent migration
        doc = {
            "_legacy_pg_id": pg_id,  # Track source ID for idempotent upsert
            "user_id": owner_id,
            "title": title,
            "raw_content": raw_content or "",
            "html_content": html_content,
            "parsed": parsed_content,  # Already JSON in Postgres
            "style": style,  # Already JSON in Postgres
            "original_file": {
                "storage_key": original_file_key,
                "filename": original_filename,
                "file_type": file_type,
                "size_bytes": file_size_bytes,
            } if original_file_key else None,
            "created_at": created_at or datetime.now(timezone.utc),
            "updated_at": updated_at or datetime.now(timezone.utc),
        }

        # Use upsert to make migration idempotent
        result = await mongo_db.resumes.update_one(
            {"_legacy_pg_id": pg_id},
            {"$set": doc},
            upsert=True,
        )
        # Get the document to retrieve its _id
        migrated_doc = await mongo_db.resumes.find_one(
            {"_legacy_pg_id": pg_id},
            {"_id": 1},
        )
        id_mapping[pg_id] = migrated_doc["_id"]
        action = "Updated" if result.matched_count > 0 else "Migrated"
        print(f"  {action} resume {pg_id} -> {migrated_doc['_id']}")

    print(f"Migrated {len(id_mapping)} resumes")
    return id_mapping


async def migrate_tailored_resumes(
    pg_session: Session,
    mongo_db,
    resume_id_mapping: dict[int, str],
    dry_run: bool = False,
) -> int:
    """
    Migrate tailored_resumes from PostgreSQL to MongoDB.
    Requires resume_id_mapping to link to MongoDB resume IDs.
    """
    print("\n--- Migrating tailored_resumes ---")

    # Query all tailored resumes from Postgres
    result = pg_session.execute(text("""
        SELECT
            tr.id, tr.resume_id, r.owner_id as user_id,
            tr.job_id, tr.job_listing_id,
            tr.tailored_content, tr.suggestions, tr.match_score,
            tr.style_settings, tr.section_order,
            tr.created_at, tr.updated_at
        FROM tailored_resumes tr
        JOIN resumes r ON tr.resume_id = r.id
        ORDER BY tr.id
    """))
    rows = result.fetchall()
    print(f"Found {len(rows)} tailored resumes in PostgreSQL")

    if dry_run:
        print("[DRY RUN] Would migrate tailored resumes")
        return 0

    count = 0
    for row in rows:
        (
            pg_id, resume_id, user_id, job_id, job_listing_id,
            tailored_content, suggestions, match_score,
            style_settings, section_order, created_at, updated_at
        ) = row

        # Get MongoDB resume ID
        mongo_resume_id = resume_id_mapping.get(resume_id)
        if not mongo_resume_id:
            print(f"  WARNING: Resume {resume_id} not found in mapping, skipping tailored resume {pg_id}")
            continue

        # Determine job source
        if job_id:
            job_source = {"type": "user_created", "id": job_id}
        else:
            job_source = {"type": "job_listing", "id": job_listing_id}

        # Convert suggestions to new format if needed
        formatted_suggestions = []
        if suggestions:
            for i, s in enumerate(suggestions if isinstance(suggestions, list) else []):
                formatted_suggestions.append({
                    "id": s.get("id", f"suggestion_{i}"),
                    "section": s.get("section", "unknown"),
                    "path": s.get("path", ""),
                    "original": s.get("original", ""),
                    "suggested": s.get("suggested", ""),
                    "reason": s.get("reason", ""),
                    "status": s.get("status", "pending"),
                })

        doc = {
            "_legacy_pg_id": pg_id,  # Track source ID for idempotent upsert
            "resume_id": mongo_resume_id,
            "user_id": user_id,
            "job_source": job_source,
            "content": tailored_content or "",
            "section_order": section_order or ["summary", "experience", "skills", "education", "projects"],
            "suggestions": formatted_suggestions,
            "match_score": float(match_score) if match_score else None,
            "ats_keywords": None,  # New field, will be populated by future tailoring
            "style_settings": style_settings or {},
            "created_at": created_at or datetime.now(timezone.utc),
            "updated_at": updated_at or datetime.now(timezone.utc),
        }

        # Use upsert to make migration idempotent
        result = await mongo_db.tailored_resumes.update_one(
            {"_legacy_pg_id": pg_id},
            {"$set": doc},
            upsert=True,
        )
        migrated_doc = await mongo_db.tailored_resumes.find_one(
            {"_legacy_pg_id": pg_id},
            {"_id": 1},
        )
        count += 1
        action = "Updated" if result.matched_count > 0 else "Migrated"
        print(f"  {action} tailored resume {pg_id} -> {migrated_doc['_id']}")

    print(f"Migrated {count} tailored resumes")
    return count


async def migrate_resume_builds(
    pg_session: Session,
    mongo_db,
    dry_run: bool = False,
) -> int:
    """
    Migrate resume_builds from PostgreSQL to MongoDB.
    """
    print("\n--- Migrating resume_builds ---")

    # Query all resume builds from Postgres
    result = pg_session.execute(text("""
        SELECT
            id, user_id, job_title, job_company, job_description,
            job_embedding, status, sections, pulled_block_ids,
            pending_diffs, created_at, updated_at, exported_at
        FROM resume_builds
        ORDER BY id
    """))
    rows = result.fetchall()
    print(f"Found {len(rows)} resume builds in PostgreSQL")

    if dry_run:
        print("[DRY RUN] Would migrate resume builds")
        return 0

    count = 0
    for row in rows:
        (
            pg_id, user_id, job_title, job_company, job_description,
            job_embedding, status, sections, pulled_block_ids,
            pending_diffs, created_at, updated_at, exported_at
        ) = row

        # Convert job_embedding from pgvector to list
        embedding_list = None
        if job_embedding is not None:
            try:
                # pgvector returns as numpy array or list-like
                embedding_list = list(job_embedding)
            except (TypeError, ValueError):
                print(f"  WARNING: Could not convert embedding for build {pg_id}")

        # Convert pending_diffs from JSON Patch format to new format
        formatted_diffs = []
        if pending_diffs:
            for i, diff in enumerate(pending_diffs if isinstance(pending_diffs, list) else []):
                formatted_diffs.append({
                    "id": diff.get("id", f"diff_{i}"),
                    "section": diff.get("section", _extract_section_from_path(diff.get("path", ""))),
                    "path": diff.get("path", ""),
                    "operation": _map_json_patch_op(diff.get("op", "replace")),
                    "original_value": diff.get("original_value"),
                    "suggested_value": diff.get("value"),
                    "reason": diff.get("reason", ""),
                    "created_at": datetime.now(timezone.utc),
                })

        doc = {
            "_legacy_pg_id": pg_id,  # Track source ID for idempotent upsert
            "user_id": user_id,
            "job": {
                "title": job_title,
                "company": job_company,
                "description": job_description,
                "embedding": embedding_list,
            },
            "status": status or "draft",
            "sections": sections or {
                "summary": None,
                "experience": [],
                "skills": [],
                "education": [],
                "projects": [],
            },
            "section_order": ["summary", "experience", "skills", "education", "projects"],
            "pulled_block_ids": pulled_block_ids or [],
            "pending_diffs": formatted_diffs,
            "created_at": created_at or datetime.now(timezone.utc),
            "updated_at": updated_at or datetime.now(timezone.utc),
            "exported_at": exported_at,
        }

        # Use upsert to make migration idempotent
        result = await mongo_db.resume_builds.update_one(
            {"_legacy_pg_id": pg_id},
            {"$set": doc},
            upsert=True,
        )
        migrated_doc = await mongo_db.resume_builds.find_one(
            {"_legacy_pg_id": pg_id},
            {"_id": 1},
        )
        count += 1
        action = "Updated" if result.matched_count > 0 else "Migrated"
        print(f"  {action} resume build {pg_id} -> {migrated_doc['_id']}")

    print(f"Migrated {count} resume builds")
    return count


def _extract_section_from_path(path: str) -> str:
    """Extract section name from JSON path like '/experience/0/bullets/1'."""
    if not path:
        return "unknown"
    parts = path.strip("/").split("/")
    return parts[0] if parts else "unknown"


def _map_json_patch_op(op: str) -> str:
    """Map JSON Patch operation to our format."""
    mapping = {
        "add": "insert",
        "remove": "delete",
        "replace": "update",
        "move": "reorder",
    }
    return mapping.get(op, "update")


async def create_indexes(mongo_db) -> None:
    """Create MongoDB indexes for optimal query performance."""
    print("\n--- Creating indexes ---")

    # resumes collection indexes
    await mongo_db.resumes.create_index("user_id")
    await mongo_db.resumes.create_index([("user_id", 1), ("updated_at", -1)])
    print("  Created resumes indexes")

    # tailored_resumes collection indexes
    await mongo_db.tailored_resumes.create_index("resume_id")
    await mongo_db.tailored_resumes.create_index("user_id")
    await mongo_db.tailored_resumes.create_index(
        [("job_source.type", 1), ("job_source.id", 1)]
    )
    print("  Created tailored_resumes indexes")

    # resume_builds collection indexes
    await mongo_db.resume_builds.create_index("user_id")
    await mongo_db.resume_builds.create_index([("user_id", 1), ("status", 1)])
    print("  Created resume_builds indexes")


async def verify_migration(pg_session: Session, mongo_db) -> bool:
    """Verify migration counts match between PostgreSQL and MongoDB."""
    print("\n--- Verifying migration ---")

    # Count resumes
    pg_count = pg_session.execute(text("SELECT COUNT(*) FROM resumes")).scalar()
    mongo_count = await mongo_db.resumes.count_documents({})
    resumes_match = pg_count == mongo_count
    print(f"  Resumes: PostgreSQL={pg_count}, MongoDB={mongo_count} {'OK' if resumes_match else 'MISMATCH!'}")

    # Count tailored_resumes
    pg_count = pg_session.execute(text("SELECT COUNT(*) FROM tailored_resumes")).scalar()
    mongo_count = await mongo_db.tailored_resumes.count_documents({})
    tailored_match = pg_count == mongo_count
    print(f"  Tailored resumes: PostgreSQL={pg_count}, MongoDB={mongo_count} {'OK' if tailored_match else 'MISMATCH!'}")

    # Count resume_builds
    pg_count = pg_session.execute(text("SELECT COUNT(*) FROM resume_builds")).scalar()
    mongo_count = await mongo_db.resume_builds.count_documents({})
    builds_match = pg_count == mongo_count
    print(f"  Resume builds: PostgreSQL={pg_count}, MongoDB={mongo_count} {'OK' if builds_match else 'MISMATCH!'}")

    all_match = resumes_match and tailored_match and builds_match
    if all_match:
        print("\nVerification PASSED: All counts match!")
    else:
        print("\nVerification FAILED: Some counts do not match!")

    return all_match


async def main(dry_run: bool = False, verify: bool = False) -> None:
    """Main migration function."""
    print("=" * 60)
    print("MongoDB Migration Script")
    print("=" * 60)
    print(f"PostgreSQL: {mask_uri_credentials(get_pg_sync_url())}")
    print(f"MongoDB: {mask_uri_credentials(settings.mongodb_uri)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE MIGRATION'}")
    print("=" * 60)

    # Connect to PostgreSQL
    pg_engine = create_engine(get_pg_sync_url())
    pg_session = Session(pg_engine)

    # Connect to MongoDB
    mongo_client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo_db = mongo_client[settings.mongodb_database]

    try:
        # Run migrations
        resume_id_mapping = await migrate_resumes(pg_session, mongo_db, dry_run)
        await migrate_tailored_resumes(pg_session, mongo_db, resume_id_mapping, dry_run)
        await migrate_resume_builds(pg_session, mongo_db, dry_run)

        if not dry_run:
            await create_indexes(mongo_db)

        if verify and not dry_run:
            await verify_migration(pg_session, mongo_db)

        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)

        if not dry_run:
            print("\nNEXT STEPS:")
            print("1. Update API routes to use MongoDB CRUD")
            print("2. Test all resume-related endpoints")
            print("3. Once verified, create Alembic migration to drop old tables:")
            print("   - DROP TABLE tailored_resumes CASCADE;")
            print("   - DROP TABLE resumes CASCADE;")
            print("   - DROP TABLE resume_builds CASCADE;")

    except Exception as e:
        print(f"\nERROR: Migration failed: {e}")
        raise
    finally:
        pg_session.close()
        mongo_client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate resume data from PostgreSQL to MongoDB")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be migrated without making changes")
    parser.add_argument("--verify", action="store_true", help="Verify migration counts match after migration")
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run, verify=args.verify))
