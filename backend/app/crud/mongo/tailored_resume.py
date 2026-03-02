"""MongoDB CRUD operations for TailoredResume documents.

Two Copies Architecture:
- Stores complete tailored_data (AI-generated) and finalized_data (user-approved)
- get_compare_data() returns both original resume and tailored resume for frontend diffing
- finalize() sets the user's final approved version
"""

from datetime import datetime, timezone
from typing import Any, Literal

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.mongo.tailored_resume import (
    TailoredResumeDocument,
    TailoredResumeCreate,
    TailoredResumeUpdate,
    TailoredResumeFinalize,
    TailoredResumeStatus,
    DEFAULT_SECTION_ORDER,
)
from app.models.mongo.resume import ResumeDocument


class CompareData:
    """Data returned by get_compare_data for frontend diffing."""

    def __init__(
        self,
        tailored_resume: TailoredResumeDocument,
        original_parsed: dict[str, Any],
    ):
        self.tailored_resume = tailored_resume
        self.original_parsed = original_parsed


class TailoredResumeCRUD:
    """CRUD operations for MongoDB TailoredResume collection."""

    collection_name = "tailored_resumes"
    resumes_collection = "resumes"

    async def create(
        self,
        db: AsyncIOMotorDatabase,
        obj_in: TailoredResumeCreate,
    ) -> TailoredResumeDocument:
        """Create a new tailored resume document."""
        now = datetime.now(timezone.utc)
        doc = {
            "resume_id": ObjectId(obj_in.resume_id),
            "user_id": obj_in.user_id,
            "job_source": obj_in.job_source.model_dump(),
            "tailored_data": obj_in.tailored_data,
            "finalized_data": None,
            "status": TailoredResumeStatus.PENDING.value,
            "section_order": obj_in.section_order or DEFAULT_SECTION_ORDER.copy(),
            "match_score": obj_in.match_score,
            "ats_keywords": obj_in.ats_keywords.model_dump() if obj_in.ats_keywords else None,
            "ai_model": obj_in.ai_model,
            "job_title": obj_in.job_title,
            "company_name": obj_in.company_name,
            "style_settings": obj_in.style_settings or {},
            "created_at": now,
            "updated_at": now,
            "finalized_at": None,
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

    async def get_compare_data(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
    ) -> CompareData | None:
        """Get both original resume's parsed content and tailored resume for frontend diffing.

        This is the critical method for the Two Copies architecture. It fetches:
        1. The tailored resume document (contains tailored_data)
        2. The original resume's parsed content

        Frontend uses these two documents to compute diffs client-side.
        """
        if not ObjectId.is_valid(id):
            return None

        # Get the tailored resume
        tailored_doc = await db[self.collection_name].find_one({"_id": ObjectId(id)})
        if not tailored_doc:
            return None

        tailored_resume = TailoredResumeDocument(**tailored_doc)

        # Get the original resume's parsed content (explicit projection)
        original_doc = await db[self.resumes_collection].find_one(
            {"_id": tailored_resume.resume_id},
            {"parsed": 1, "_id": 1},  # Only fetch what we need
        )
        if not original_doc:
            return None

        # Extract parsed content (this is what we diff against)
        original_parsed = original_doc.get("parsed") or {}

        return CompareData(
            tailored_resume=tailored_resume,
            original_parsed=original_parsed,
        )

    async def get_by_resume(
        self,
        db: AsyncIOMotorDatabase,
        resume_id: str,
        status: TailoredResumeStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[TailoredResumeDocument]:
        """Get all tailored resumes for a base resume, optionally filtered by status."""
        if not ObjectId.is_valid(resume_id):
            return []

        query: dict[str, Any] = {"resume_id": ObjectId(resume_id)}
        if status is not None:
            query["status"] = status.value

        cursor = (
            db[self.collection_name]
            .find(query)
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
        status: TailoredResumeStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[TailoredResumeDocument]:
        """Get all tailored resumes for a user, optionally filtered by status."""
        query: dict[str, Any] = {"user_id": user_id}
        if status is not None:
            query["status"] = status.value

        cursor = (
            db[self.collection_name]
            .find(query)
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
        status: TailoredResumeStatus | None = None,
    ) -> list[TailoredResumeDocument]:
        """Get all tailored resumes for a specific job."""
        query: dict[str, Any] = {
            "job_source.type": job_source_type,
            "job_source.id": job_source_id,
        }
        if status is not None:
            query["status"] = status.value

        cursor = db[self.collection_name].find(query)
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
        update_data: dict[str, Any] = {}
        if obj_in.tailored_data is not None:
            update_data["tailored_data"] = obj_in.tailored_data
        if obj_in.section_order is not None:
            update_data["section_order"] = obj_in.section_order
        if obj_in.match_score is not None:
            update_data["match_score"] = obj_in.match_score
        if obj_in.ats_keywords is not None:
            update_data["ats_keywords"] = obj_in.ats_keywords.model_dump()
        if obj_in.style_settings is not None:
            update_data["style_settings"] = obj_in.style_settings

        if not update_data:
            return await self.get(db, id)

        update_data["updated_at"] = datetime.now(timezone.utc)

        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {"$set": update_data},
            return_document=True,
        )
        return TailoredResumeDocument(**result) if result else None

    async def finalize(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        obj_in: TailoredResumeFinalize,
    ) -> TailoredResumeDocument | None:
        """Finalize a tailored resume with the user's approved changes.

        This is called when the user clicks "Finalize" after accepting/rejecting
        sections on the frontend. The finalized_data is the merged document
        the user built by accepting some AI changes and keeping some originals.
        """
        if not ObjectId.is_valid(id):
            return None

        now = datetime.now(timezone.utc)
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "finalized_data": obj_in.finalized_data,
                    "status": TailoredResumeStatus.FINALIZED.value,
                    "updated_at": now,
                    "finalized_at": now,
                }
            },
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
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            return_document=True,
        )
        return TailoredResumeDocument(**result) if result else None

    async def update_status(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        status: TailoredResumeStatus,
    ) -> TailoredResumeDocument | None:
        """Update the status of a tailored resume."""
        if not ObjectId.is_valid(id):
            return None

        update_data: dict[str, Any] = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc),
        }

        # Set finalized_at if transitioning to finalized
        if status == TailoredResumeStatus.FINALIZED:
            update_data["finalized_at"] = datetime.now(timezone.utc)

        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {"$set": update_data},
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
        query: dict[str, Any] = {"_id": ObjectId(id)}
        if user_id is not None:
            query["user_id"] = user_id
        doc = await db[self.collection_name].find_one(query, {"_id": 1})
        return doc is not None


# Singleton instance
tailored_resume_crud = TailoredResumeCRUD()
