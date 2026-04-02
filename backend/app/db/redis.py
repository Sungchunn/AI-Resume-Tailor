"""Redis connection management using redis.asyncio."""

import redis.asyncio as redis
from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()


class RedisDB:
    """Redis connection manager singleton."""

    client: Redis | None = None


redis_db = RedisDB()


async def connect_redis() -> None:
    """Initialize Redis connection on application startup.

    Supports both redis:// (local) and rediss:// (TLS, e.g., Upstash) protocols.
    """
    redis_db.client = redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )

    # Verify connection is working
    await redis_db.client.ping()


async def close_redis() -> None:
    """Close Redis connection on application shutdown."""
    if redis_db.client:
        await redis_db.client.aclose()


def get_redis() -> Redis:
    """Get the Redis client instance for dependency injection."""
    if redis_db.client is None:
        raise RuntimeError("Redis is not initialized. Call connect_redis() first.")
    return redis_db.client
