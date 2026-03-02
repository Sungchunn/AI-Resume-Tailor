"""MongoDB connection management using Motor async driver."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

settings = get_settings()


class MongoDB:
    """MongoDB connection manager singleton."""

    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongodb = MongoDB()


async def connect_mongodb() -> None:
    """Initialize MongoDB connection on application startup."""
    mongodb.client = AsyncIOMotorClient(
        settings.mongodb_uri,
        maxPoolSize=50,
        minPoolSize=10,
        serverSelectionTimeoutMS=5000,
    )
    mongodb.db = mongodb.client[settings.mongodb_database]

    # Create indexes on startup (idempotent operation)
    await _create_indexes(mongodb.db)


async def _create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create MongoDB indexes for optimal query performance.

    This is idempotent - MongoDB skips index creation if index already exists.
    """
    # resumes collection indexes
    await db.resumes.create_index("user_id")
    await db.resumes.create_index([("user_id", 1), ("updated_at", -1)])

    # tailored_resumes collection indexes
    await db.tailored_resumes.create_index("resume_id")
    await db.tailored_resumes.create_index("user_id")
    await db.tailored_resumes.create_index([("job_source.type", 1), ("job_source.id", 1)])

    # resume_builds collection indexes
    await db.resume_builds.create_index("user_id")
    await db.resume_builds.create_index([("user_id", 1), ("status", 1)])


async def close_mongodb() -> None:
    """Close MongoDB connection on application shutdown."""
    if mongodb.client:
        mongodb.client.close()


def get_mongodb() -> AsyncIOMotorDatabase:
    """Get the MongoDB database instance for dependency injection."""
    if mongodb.db is None:
        raise RuntimeError("MongoDB is not initialized. Call connect_mongodb() first.")
    return mongodb.db
