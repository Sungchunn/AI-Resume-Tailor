"""Create initial indexes for resume_builds collection."""

from motor.motor_asyncio import AsyncIOMotorDatabase

revision = "20260302_0003"
description = "Create initial indexes for resume_builds collection"
depends_on = "20260302_0002"


async def upgrade(db: AsyncIOMotorDatabase) -> None:
    """Apply the migration."""
    await db.resume_builds.create_index("user_id")
    await db.resume_builds.create_index([("user_id", 1), ("status", 1)])


async def downgrade(db: AsyncIOMotorDatabase) -> None:
    """Reverse the migration."""
    await db.resume_builds.drop_index("user_id_1")
    await db.resume_builds.drop_index("user_id_1_status_1")
