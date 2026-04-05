"""MongoDB CRUD operations for KeywordOverride documents.

Stores user's keyword edits for a specific job listing.
These overrides are used in subsequent ATS scoring.
"""

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.mongo.keyword_override import (
    KeywordOverrideCreate,
    KeywordOverrideDocument,
    KeywordOverrideUpdate,
)


class KeywordOverrideCRUD:
    """CRUD operations for MongoDB KeywordOverride collection."""

    collection_name = "keyword_overrides"

    async def create(
        self,
        db: AsyncIOMotorDatabase,
        obj_in: KeywordOverrideCreate,
    ) -> KeywordOverrideDocument:
        """Create a new keyword override document."""
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": obj_in.user_id,
            "job_listing_id": obj_in.job_listing_id,
            "job_id": obj_in.job_id,
            "job_content_hash": obj_in.job_content_hash,
            "original_keywords": [kw.model_dump() for kw in obj_in.original_keywords],
            "keywords": [kw.model_dump() for kw in obj_in.keywords],
            "reviewed": obj_in.reviewed,
            "reviewed_at": now if obj_in.reviewed else None,
            "created_at": now,
            "updated_at": now,
        }
        result = await db[self.collection_name].insert_one(doc)
        doc["_id"] = result.inserted_id
        return KeywordOverrideDocument(**doc)

    async def get(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
        job_listing_id: int | None = None,
        job_id: int | None = None,
    ) -> KeywordOverrideDocument | None:
        """Get keyword override by user and job reference.

        Args:
            db: MongoDB database instance
            user_id: User ID
            job_listing_id: Job listing ID (for scraped jobs)
            job_id: Job ID (for user-created jobs)

        Returns:
            KeywordOverrideDocument if found, None otherwise
        """
        if not job_listing_id and not job_id:
            return None

        query: dict[str, Any] = {"user_id": user_id}
        if job_listing_id:
            query["job_listing_id"] = job_listing_id
        else:
            query["job_id"] = job_id

        doc = await db[self.collection_name].find_one(query)
        return KeywordOverrideDocument(**doc) if doc else None

    async def get_by_id(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
    ) -> KeywordOverrideDocument | None:
        """Get keyword override by MongoDB ObjectId.

        Args:
            db: MongoDB database instance
            id: MongoDB ObjectId as string

        Returns:
            KeywordOverrideDocument if found, None otherwise
        """
        from bson import ObjectId

        if not ObjectId.is_valid(id):
            return None

        doc = await db[self.collection_name].find_one({"_id": ObjectId(id)})
        return KeywordOverrideDocument(**doc) if doc else None

    async def upsert(
        self,
        db: AsyncIOMotorDatabase,
        obj_in: KeywordOverrideCreate,
    ) -> KeywordOverrideDocument:
        """Create or update a keyword override document.

        If a document exists for the user + job combination, updates it.
        Otherwise, creates a new document.
        """
        now = datetime.now(timezone.utc)

        # Build query based on job reference
        query: dict[str, Any] = {"user_id": obj_in.user_id}
        if obj_in.job_listing_id:
            query["job_listing_id"] = obj_in.job_listing_id
        else:
            query["job_id"] = obj_in.job_id

        update_doc = {
            "$set": {
                "job_content_hash": obj_in.job_content_hash,
                "keywords": [kw.model_dump() for kw in obj_in.keywords],
                "reviewed": obj_in.reviewed,
                "reviewed_at": now if obj_in.reviewed else None,
                "updated_at": now,
            },
            "$setOnInsert": {
                "user_id": obj_in.user_id,
                "job_listing_id": obj_in.job_listing_id,
                "job_id": obj_in.job_id,
                "original_keywords": [kw.model_dump() for kw in obj_in.original_keywords],
                "created_at": now,
            },
        }

        result = await db[self.collection_name].find_one_and_update(
            query,
            update_doc,
            upsert=True,
            return_document=True,
        )
        return KeywordOverrideDocument(**result)

    async def update(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
        job_listing_id: int | None = None,
        job_id: int | None = None,
        obj_in: KeywordOverrideUpdate | None = None,
    ) -> KeywordOverrideDocument | None:
        """Update an existing keyword override.

        Args:
            db: MongoDB database instance
            user_id: User ID
            job_listing_id: Job listing ID (for scraped jobs)
            job_id: Job ID (for user-created jobs)
            obj_in: Update data

        Returns:
            Updated KeywordOverrideDocument if found, None otherwise
        """
        if not job_listing_id and not job_id:
            return None

        query: dict[str, Any] = {"user_id": user_id}
        if job_listing_id:
            query["job_listing_id"] = job_listing_id
        else:
            query["job_id"] = job_id

        update_data: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}

        if obj_in:
            if obj_in.keywords is not None:
                update_data["keywords"] = [kw.model_dump() for kw in obj_in.keywords]
            if obj_in.reviewed is not None:
                update_data["reviewed"] = obj_in.reviewed
                if obj_in.reviewed:
                    update_data["reviewed_at"] = datetime.now(timezone.utc)

        result = await db[self.collection_name].find_one_and_update(
            query,
            {"$set": update_data},
            return_document=True,
        )
        return KeywordOverrideDocument(**result) if result else None

    async def delete(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
        job_listing_id: int | None = None,
        job_id: int | None = None,
    ) -> bool:
        """Delete a keyword override.

        Args:
            db: MongoDB database instance
            user_id: User ID
            job_listing_id: Job listing ID (for scraped jobs)
            job_id: Job ID (for user-created jobs)

        Returns:
            True if deleted, False otherwise
        """
        if not job_listing_id and not job_id:
            return False

        query: dict[str, Any] = {"user_id": user_id}
        if job_listing_id:
            query["job_listing_id"] = job_listing_id
        else:
            query["job_id"] = job_id

        result = await db[self.collection_name].delete_one(query)
        return result.deleted_count > 0

    async def delete_by_user(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
    ) -> int:
        """Delete all keyword overrides for a user.

        Args:
            db: MongoDB database instance
            user_id: User ID

        Returns:
            Number of documents deleted
        """
        result = await db[self.collection_name].delete_many({"user_id": user_id})
        return result.deleted_count

    async def exists(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
        job_listing_id: int | None = None,
        job_id: int | None = None,
    ) -> bool:
        """Check if a keyword override exists.

        Args:
            db: MongoDB database instance
            user_id: User ID
            job_listing_id: Job listing ID (for scraped jobs)
            job_id: Job ID (for user-created jobs)

        Returns:
            True if exists, False otherwise
        """
        if not job_listing_id and not job_id:
            return False

        query: dict[str, Any] = {"user_id": user_id}
        if job_listing_id:
            query["job_listing_id"] = job_listing_id
        else:
            query["job_id"] = job_id

        doc = await db[self.collection_name].find_one(query, {"_id": 1})
        return doc is not None

    async def is_stale(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
        job_listing_id: int | None,
        job_id: int | None,
        current_hash: str,
    ) -> bool:
        """Check if the saved keywords are stale (JD content changed).

        Args:
            db: MongoDB database instance
            user_id: User ID
            job_listing_id: Job listing ID
            job_id: Job ID
            current_hash: Current hash of the job description

        Returns:
            True if stale (hash mismatch), False if current or not found
        """
        override = await self.get(db, user_id, job_listing_id, job_id)
        if not override:
            return False
        return override.job_content_hash != current_hash


# Singleton instance
keyword_override_crud = KeywordOverrideCRUD()
