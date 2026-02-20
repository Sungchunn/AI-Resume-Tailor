import json
import hashlib
from typing import Any
from functools import lru_cache

import redis.asyncio as redis

from app.core.config import get_settings


class CacheService:
    """Redis caching service for AI responses."""

    # Cache TTL values in seconds
    PARSE_TTL = 60 * 60 * 24  # 24 hours for parsed content
    TAILOR_TTL = 60 * 60 * 24 * 7  # 7 days for tailored results

    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url, decode_responses=True)

    def _make_key(self, prefix: str, content: str) -> str:
        """Generate a cache key from content hash."""
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        return f"{prefix}:{content_hash}"

    async def get_parsed_resume(self, raw_content: str) -> dict | None:
        """Get cached parsed resume."""
        key = self._make_key("resume_parsed", raw_content)
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def set_parsed_resume(self, raw_content: str, parsed: dict) -> None:
        """Cache parsed resume."""
        key = self._make_key("resume_parsed", raw_content)
        await self.redis.setex(key, self.PARSE_TTL, json.dumps(parsed))

    async def get_parsed_job(self, raw_content: str) -> dict | None:
        """Get cached parsed job description."""
        key = self._make_key("job_parsed", raw_content)
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def set_parsed_job(self, raw_content: str, parsed: dict) -> None:
        """Cache parsed job description."""
        key = self._make_key("job_parsed", raw_content)
        await self.redis.setex(key, self.PARSE_TTL, json.dumps(parsed))

    async def get_tailored_result(
        self, resume_id: int, job_id: int, resume_hash: str, job_hash: str
    ) -> dict | None:
        """Get cached tailoring result."""
        key = f"tailored:{resume_id}:{job_id}:{resume_hash[:8]}:{job_hash[:8]}"
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def set_tailored_result(
        self, resume_id: int, job_id: int, resume_hash: str, job_hash: str, result: dict
    ) -> None:
        """Cache tailoring result."""
        key = f"tailored:{resume_id}:{job_id}:{resume_hash[:8]}:{job_hash[:8]}"
        await self.redis.setex(key, self.TAILOR_TTL, json.dumps(result))

    async def invalidate_resume(self, raw_content: str) -> None:
        """Invalidate cached parsed resume."""
        key = self._make_key("resume_parsed", raw_content)
        await self.redis.delete(key)

    async def invalidate_job(self, raw_content: str) -> None:
        """Invalidate cached parsed job."""
        key = self._make_key("job_parsed", raw_content)
        await self.redis.delete(key)

    # Generic cache methods (for ICache protocol)
    async def get(self, key: str) -> Any | None:
        """Get cached value by key."""
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        """Set cached value with TTL."""
        await self.redis.setex(key, ttl_seconds, json.dumps(value))

    async def delete(self, key: str) -> None:
        """Delete cached value."""
        await self.redis.delete(key)

    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        return bool(await self.redis.exists(key))

    async def close(self) -> None:
        """Close the Redis connection."""
        await self.redis.close()


@lru_cache
def get_cache_service() -> CacheService:
    """Get a singleton cache service instance."""
    settings = get_settings()
    return CacheService(redis_url=settings.redis_url)
