"""MongoDB CRUD operations for ResumeBuild (workshop) documents."""

from datetime import datetime, timezone
from typing import Any, Literal

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.mongo.resume_build import (
    ResumeBuildDocument,
    ResumeBuildCreate,
    ResumeBuildUpdate,
    PendingDiff,
    ResumeSections,
)


class ResumeBuildCRUD:
    """CRUD operations for MongoDB ResumeBuild collection."""

    collection_name = "resume_builds"

    async def create(
        self,
        db: AsyncIOMotorDatabase,
        obj_in: ResumeBuildCreate,
    ) -> ResumeBuildDocument:
        """Create a new resume build document."""
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": obj_in.user_id,
            "job": obj_in.job.model_dump(),
            "status": obj_in.status or "draft",
            "sections": obj_in.sections.model_dump() if obj_in.sections else ResumeSections().model_dump(),
            "section_order": obj_in.section_order or ["summary", "experience", "skills", "education", "projects"],
            "pulled_block_ids": obj_in.pulled_block_ids or [],
            "pending_diffs": [],
            "created_at": now,
            "updated_at": now,
            "exported_at": None,
        }
        result = await db[self.collection_name].insert_one(doc)
        doc["_id"] = result.inserted_id
        return ResumeBuildDocument(**doc)

    async def get(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        projection: dict[str, Any] | None = None,
    ) -> ResumeBuildDocument | None:
        """Get a resume build by its ObjectId.

        Args:
            db: MongoDB database instance
            id: ResumeBuild ObjectId as string
            projection: Optional MongoDB projection dict to limit returned fields.
                       When using projection, non-projected fields will be None.
        """
        if not ObjectId.is_valid(id):
            return None
        doc = await db[self.collection_name].find_one({"_id": ObjectId(id)}, projection)
        return ResumeBuildDocument(**doc) if doc else None

    async def get_by_user(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        status: str | None = None,
        projection: dict[str, Any] | None = None,
    ) -> list[ResumeBuildDocument]:
        """Get all resume builds for a user, optionally filtered by status."""
        query: dict[str, Any] = {"user_id": user_id}
        if status:
            query["status"] = status
        cursor = (
            db[self.collection_name]
            .find(query, projection)
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [ResumeBuildDocument(**doc) for doc in docs]

    async def update(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        obj_in: ResumeBuildUpdate,
    ) -> ResumeBuildDocument | None:
        """Update an existing resume build."""
        if not ObjectId.is_valid(id):
            return None

        # Build update dict with only provided fields
        update_data = {}
        if obj_in.job is not None:
            update_data["job"] = obj_in.job.model_dump()
        if obj_in.status is not None:
            update_data["status"] = obj_in.status
        if obj_in.sections is not None:
            update_data["sections"] = obj_in.sections.model_dump()
        if obj_in.section_order is not None:
            update_data["section_order"] = obj_in.section_order
        if obj_in.pulled_block_ids is not None:
            update_data["pulled_block_ids"] = obj_in.pulled_block_ids
        if obj_in.pending_diffs is not None:
            update_data["pending_diffs"] = [d.model_dump() for d in obj_in.pending_diffs]
        if obj_in.exported_at is not None:
            update_data["exported_at"] = obj_in.exported_at

        if not update_data:
            return await self.get(db, id)

        update_data["updated_at"] = datetime.now(timezone.utc)

        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {"$set": update_data},
            return_document=True,
        )
        return ResumeBuildDocument(**result) if result else None

    async def update_status(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        status: Literal["draft", "in_progress", "exported"],
    ) -> ResumeBuildDocument | None:
        """Update only the status of a resume build."""
        if not ObjectId.is_valid(id):
            return None

        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc),
        }
        if status == "exported":
            update_data["exported_at"] = datetime.now(timezone.utc)

        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {"$set": update_data},
            return_document=True,
        )
        return ResumeBuildDocument(**result) if result else None

    async def update_sections(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        sections: dict[str, Any],
    ) -> ResumeBuildDocument | None:
        """Update the sections of a resume build."""
        if not ObjectId.is_valid(id):
            return None
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "sections": sections,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            return_document=True,
        )
        return ResumeBuildDocument(**result) if result else None

    async def update_section_order(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        section_order: list[str],
    ) -> ResumeBuildDocument | None:
        """Update the section order for drag-drop reordering."""
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
        return ResumeBuildDocument(**result) if result else None

    async def add_pulled_block(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        block_id: int,
    ) -> ResumeBuildDocument | None:
        """Add a block ID to the pulled blocks list."""
        if not ObjectId.is_valid(id):
            return None
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {
                "$addToSet": {"pulled_block_ids": block_id},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
            return_document=True,
        )
        return ResumeBuildDocument(**result) if result else None

    async def remove_pulled_block(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        block_id: int,
    ) -> ResumeBuildDocument | None:
        """Remove a block ID from the pulled blocks list."""
        if not ObjectId.is_valid(id):
            return None
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {
                "$pull": {"pulled_block_ids": block_id},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
            return_document=True,
        )
        return ResumeBuildDocument(**result) if result else None

    async def add_pending_diff(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        diff: PendingDiff,
    ) -> ResumeBuildDocument | None:
        """Add a pending diff suggestion."""
        if not ObjectId.is_valid(id):
            return None
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {
                "$push": {"pending_diffs": diff.model_dump()},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
            return_document=True,
        )
        return ResumeBuildDocument(**result) if result else None

    async def remove_pending_diff(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        diff_id: str,
    ) -> ResumeBuildDocument | None:
        """Remove a pending diff by its ID."""
        if not ObjectId.is_valid(id):
            return None
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {
                "$pull": {"pending_diffs": {"id": diff_id}},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
            return_document=True,
        )
        return ResumeBuildDocument(**result) if result else None

    async def clear_pending_diffs(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
    ) -> ResumeBuildDocument | None:
        """Clear all pending diffs."""
        if not ObjectId.is_valid(id):
            return None
        result = await db[self.collection_name].find_one_and_update(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "pending_diffs": [],
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            return_document=True,
        )
        return ResumeBuildDocument(**result) if result else None

    async def delete(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
    ) -> bool:
        """Delete a resume build by its ObjectId."""
        if not ObjectId.is_valid(id):
            return False
        result = await db[self.collection_name].delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0

    async def delete_by_user(
        self,
        db: AsyncIOMotorDatabase,
        user_id: int,
    ) -> int:
        """Delete all resume builds for a user. Returns count."""
        result = await db[self.collection_name].delete_many({"user_id": user_id})
        return result.deleted_count

    async def exists(
        self,
        db: AsyncIOMotorDatabase,
        id: str,
        user_id: int | None = None,
    ) -> bool:
        """Check if a resume build exists, optionally verifying ownership."""
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
        status: str | None = None,
    ) -> int:
        """Count resume builds for a user, optionally filtered by status."""
        query = {"user_id": user_id}
        if status:
            query["status"] = status
        return await db[self.collection_name].count_documents(query)


# Singleton instance
resume_build_crud = ResumeBuildCRUD()
