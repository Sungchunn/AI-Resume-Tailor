"""MongoDB CRUD operations for TailoredResume documents."""

from datetime import datetime
from typing import Literal

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.mongo.tailored_resume import (
    TailoredResumeDocument,
    TailoredResumeCreate,
    TailoredResumeUpdate,
    DEFAULT_SECTION_ORDER,
)


class TailoredResumeCRUD:
    """CRUD operations for MongoDB TailoredResume collection."""

    collection_name = "tailored_resumes"

    async def create(
        self,
        db: AsyncIOMotorDatabase,
        obj_in: TailoredResumeCreate,
    ) -> TailoredResumeDocument:
        """Create a new tailored resume document."""
        now = datetime.utcnow()
        doc = {
            "resume_id": ObjectId(obj_in.resume_id),
            "user_id": obj_in.user_id,
            "job_source": obj_in.job_source.model_dump(),
            "content": obj_in.content,
            "section_order": obj_in.section_order or DEFAULT_SECTION_ORDER.copy(),
            "suggestions": [s.model_dump() for s in obj_in.suggestions] if obj_in.suggestions else [],
            "match_score": obj_in.match_score,
            "ats_keywords": obj_in.ats_keywords.model_dump() if obj_in.ats_keywords else None,
            "style_settings": obj_in.style_settings or {},
            "created_at": now,
            "updated_at": now,
        }
        result = await db[self.collection_name].insert_one(doc)
        doc["_id"] = result.inserted_id
        return TailoredResumeDocument(**doc)

    async def get(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
    ) -> TailoredResumeDocument | None:
        """Get a tailored resume by its ObjectId."""
        if not ObjectId.is_valid(id):
            return None
        doc = await db[self.collection_name].find_one({"_id": ObjectId(id)})
        return TailoredResumeDocument(**doc) if doc else None

    async def get_by_resume(
        self,
        db: AsyncIOMotorDatabase,
        resume_id: str,
        skip: int = 0,
        limit: int = 100,
    ) -> list[TailoredResumeDocument]:
        """Get all tailored resumes for a base resume."""
        if not ObjectId.is_valid(resume_id):
            return []
        cursor = (
            db[self.collection_name]
            .find({"resume_id": ObjectId(resume_id)})
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [TailoredResumeDocument(**doc) for doc in docs]

    async def get_by_user(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[TailoredResumeDocument]:
        """Get all tailored resumes for a user."""
        cursor = (
            db[self.collection_name]
            .find({"user_id": user_id})
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [TailoredResumeDocument(**doc) for doc in docs]

    async def get_by_job_source(
        self,
        db: AsyncIOMotorDatabase,
        job_source_type: Literal["user_created", "job_listing"],
        job_source_id: int,
    ) -> list[TailoredResumeDocument]:
        """Get all tailored resumes for a specific job."""
        cursor = db[self.collection_name].find({
            "job_source.type": job_source_type,
            "job_source.id": job_source_id,
        })
        docs = await cursor.to_list(length=100)
        return [TailoredResumeDocument(**doc) for doc in docs]

    async def update(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        obj_in: TailoredResumeUpdate,
    ) -> TailoredResumeDocument | None:
        """Update an existing tailored resume."""
        if not ObjectId.is_valid(id):
            return None

        # Build update dict with only provided fields
        update_data = {}
        if obj_in.content is not None:
            update_data["content"] = obj_in.content
        if obj_in.section_order is not None:
            update_data["section_order"] = obj_in.section_order
        if obj_in.suggestions is not None:
            update_data["suggestions"] = [s.model_dump() for s in obj_in.suggestions]
        if obj_in.match_score is not None:
            update_data["match_score"] = obj_in.match_score
        if obj_in.ats_keywords is not None:
            update_data["ats_keywords"] = obj_in.ats_keywords.model_dump()
        if obj_in.style_settings is not None:
            update_data["style_settings"] = obj_in.style_settings

        if not update_data:
            return await self.get(db, id)

        update_data["updated_at"] = datetime.utcnow()

        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {"$set": update_data},
            return_document=True,
        )
        return TailoredResumeDocument(**result) if result else None

    async def update_section_order(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        section_order: list[str],
    ) -> TailoredResumeDocument | None:
        """Update only the section order (for drag-drop reordering)."""
        if not ObjectId.is_valid(id):
            return None
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "section_order": section_order,
                    "updated_at": datetime.utcnow(),
                }
            },
            return_document=True,
        )
        return TailoredResumeDocument(**result) if result else None

    async def update_suggestion_status(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        suggestion_id: str,
        status: Literal["pending", "accepted", "rejected"],
    ) -> TailoredResumeDocument | None:
        """Update the status of a specific suggestion."""
        if not ObjectId.is_valid(id):
            return None
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id), "suggestions.id": suggestion_id},
            {
                "$set": {
                    "suggestions.$.status": status,
                    "updated_at": datetime.utcnow(),
                }
            },
            return_document=True,
        )
        return TailoredResumeDocument(**result) if result else None

    async def delete(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
    ) -> bool:
        """Delete a tailored resume by its ObjectId."""
        if not ObjectId.is_valid(id):
            return False
        result = await db[self.collection_name].delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0

    async def delete_by_resume(
        self,
        db: AsyncIOMotorDatabase,
        resume_id: str,
    ) -> int:
        """Delete all tailored resumes for a base resume. Returns count."""
        if not ObjectId.is_valid(resume_id):
            return 0
        result = await db[self.collection_name].delete_many({"resume_id": ObjectId(resume_id)})
        return result.deleted_count

    async def delete_by_user(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
    ) -> int:
        """Delete all tailored resumes for a user. Returns count."""
        result = await db[self.collection_name].delete_many({"user_id": user_id})
        return result.deleted_count

    async def exists(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        user_id: int | None = None,
    ) -> bool:
        """Check if a tailored resume exists, optionally verifying ownership."""
        if not ObjectId.is_valid(id):
            return False
        query = {"_id": ObjectId(id)}
        if user_id is not None:
            query["user_id"] = user_id
        doc = await db[self.collection_name].find_one(query, {"_id": 1})
        return doc is not None


# Singleton instance
tailored_resume_crud = TailoredResumeCRUD()
