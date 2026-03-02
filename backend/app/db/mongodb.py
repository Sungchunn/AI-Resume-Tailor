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
    mongodb.client = AsyncIOMotorClient(settings.mongodb_uri)
    mongodb.db = mongodb.client[settings.mongodb_database]


async def close_mongodb() -> None:
    """Close MongoDB connection on application shutdown."""
    if mongodb.client:
        mongodb.client.close()


def get_mongodb() -> AsyncIOMotorDatabase:
    """Get the MongoDB database instance for dependency injection."""
    if mongodb.db is None:
        raise RuntimeError("MongoDB is not initialized. Call connect_mongodb() first.")
    return mongodb.db
