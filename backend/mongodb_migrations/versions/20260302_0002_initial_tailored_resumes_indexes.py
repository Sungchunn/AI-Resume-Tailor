"""Create initial indexes for tailored_resumes collection."""

from motor.motor_asyncio import AsyncIOMotorDatabase

revision = "20260302_0002"
description = "Create initial indexes for tailored_resumes collection"
depends_on = "20260302_0001"


async def upgrade(db: AsyncIOMotorDatabase) -> None:
    """Apply the migration."""
    await db.tailored_resumes.create_index("resume_id")
    await db.tailored_resumes.create_index("user_id")
    await db.tailored_resumes.create_index([("job_source.type", 1), ("job_source.id", 1)])


async def downgrade(db: AsyncIOMotorDatabase) -> None:
    """Reverse the migration."""
    await db.tailored_resumes.drop_index("resume_id_1")
    await db.tailored_resumes.drop_index("user_id_1")
    await db.tailored_resumes.drop_index("job_source.type_1_job_source.id_1")
