"""Create initial indexes for resumes collection."""

from motor.motor_asyncio import AsyncIOMotorDatabase

revision = "20260302_0001"
description = "Create initial indexes for resumes collection"
depends_on = None


async def upgrade(db: AsyncIOMotorDatabase) -> None:
    """Apply the migration."""
    await db.resumes.create_index("user_id")
    await db.resumes.create_index([("user_id", 1), ("updated_at", -1)])


async def downgrade(db: AsyncIOMotorDatabase) -> None:
    """Reverse the migration."""
    await db.resumes.drop_index("user_id_1")
    await db.resumes.drop_index("user_id_1_updated_at_-1")
