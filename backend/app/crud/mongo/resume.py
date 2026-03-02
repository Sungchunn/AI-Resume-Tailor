"""MongoDB CRUD operations for Resume documents."""

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.mongo.resume import (
    ResumeDocument,
    ResumeCreate,
    ResumeUpdate,
)


class ResumeCRUD:
    """CRUD operations for MongoDB Resume collection."""

    collection_name = "resumes"

    async def create(
        self,
        db: AsyncIOMotorDatabase,
        obj_in: ResumeCreate,
    ) -> ResumeDocument:
        """Create a new resume document."""
        now = datetime.utcnow()
        doc = {
            "user_id": obj_in.user_id,
            "title": obj_in.title,
            "raw_content": obj_in.raw_content,
            "html_content": obj_in.html_content,
            "parsed": obj_in.parsed.model_dump() if obj_in.parsed else None,
            "style": obj_in.style.model_dump() if obj_in.style else None,
            "original_file": obj_in.original_file.model_dump() if obj_in.original_file else None,
            "created_at": now,
            "updated_at": now,
        }
        result = await db[self.collection_name].insert_one(doc)
        doc["_id"] = result.inserted_id
        return ResumeDocument(**doc)

    async def get(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
    ) -> ResumeDocument | None:
        """Get a resume by its ObjectId."""
        if not ObjectId.is_valid(id):
            return None
        doc = await db[self.collection_name].find_one({"_id": ObjectId(id)})
        return ResumeDocument(**doc) if doc else None

    async def get_by_user(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ResumeDocument]:
        """Get all resumes for a user, ordered by updated_at descending."""
        cursor = (
            db[self.collection_name]
            .find({"user_id": user_id})
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [ResumeDocument(**doc) for doc in docs]

    async def update(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        obj_in: ResumeUpdate,
    ) -> ResumeDocument | None:
        """Update an existing resume."""
        if not ObjectId.is_valid(id):
            return None

        # Build update dict with only provided fields
        update_data = {}
        if obj_in.title is not None:
            update_data["title"] = obj_in.title
        if obj_in.raw_content is not None:
            update_data["raw_content"] = obj_in.raw_content
        if obj_in.html_content is not None:
            update_data["html_content"] = obj_in.html_content
        if obj_in.parsed is not None:
            update_data["parsed"] = obj_in.parsed.model_dump()
        if obj_in.style is not None:
            update_data["style"] = obj_in.style.model_dump()

        if not update_data:
            # No fields to update, just return current document
            return await self.get(db, id)

        update_data["updated_at"] = datetime.utcnow()

        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {"$set": update_data},
            return_document=True,
        )
        return ResumeDocument(**result) if result else None

    async def delete(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
    ) -> bool:
        """Delete a resume by its ObjectId."""
        if not ObjectId.is_valid(id):
            return False
        result = await db[self.collection_name].delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0

    async def delete_by_user(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
    ) -> int:
        """Delete all resumes for a user. Returns count of deleted documents."""
        result = await db[self.collection_name].delete_many({"user_id": user_id})
        return result.deleted_count

    async def exists(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        user_id: int | None = None,
    ) -> bool:
        """Check if a resume exists, optionally verifying ownership."""
        if not ObjectId.is_valid(id):
            return False
        query = {"_id": ObjectId(id)}
        if user_id is not None:
            query["user_id"] = user_id
        doc = await db[self.collection_name].find_one(query, {"_id": 1})
        return doc is not None

    async def count_by_user(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
    ) -> int:
        """Count resumes for a user."""
        return await db[self.collection_name].count_documents({"user_id": user_id})


# Singleton instance
resume_crud = ResumeCRUD()
