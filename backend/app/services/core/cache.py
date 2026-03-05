import json
import hashlib
from datetime import datetime, timezone
from typing import Any
from functools import lru_cache

import redis.asyncio as redis

from app.core.config import get_settings


class CacheService:
    """Redis caching service for AI responses."""

    # Cache TTL values in seconds
    PARSE_TTL = 60 * 60 * 24  # 24 hours for parsed content
    TAILOR_TTL = 60 * 60 * 24 * 7  # 7 days for tailored results
    ATS_TTL = 60 * 60 * 24  # 24 hours for ATS analysis results

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

    # ATS Analysis Cache Methods
    def _make_ats_key(self, resume_content_hash: str, job_id: int) -> str:
        """Generate a cache key for ATS analysis results.

        Args:
            resume_content_hash: First 16 chars of SHA256 hash of resume content.
            job_id: The job ID (either job_descriptions.id or job_listings.id).

        Returns:
            Cache key in format: ats:{resume_hash}:{job_id}
        """
        return f"ats:{resume_content_hash[:16]}:{job_id}"

    @staticmethod
    def hash_content(content: str) -> str:
        """Generate SHA256 hash of content, returning first 16 characters.

        This is a utility method for callers to generate the resume_content_hash
        parameter needed for ATS cache methods.
        """
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    async def get_ats_result(
        self, resume_content_hash: str, job_id: int
    ) -> dict | None:
        """Get cached ATS analysis result.

        Args:
            resume_content_hash: First 16 chars of SHA256 hash of resume content.
            job_id: The job ID.

        Returns:
            Cached result dict with keys:
            - composite_score: The ATSCompositeScore data
            - stage_results: Dict of stage_key -> stage result
            - cached_at: ISO timestamp of when cache was populated
            - resume_content_hash: Hash used for staleness detection
            Returns None if not found.
        """
        key = self._make_ats_key(resume_content_hash, job_id)
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def set_ats_result(
        self,
        resume_content_hash: str,
        job_id: int,
        composite_score: dict,
        stage_results: dict,
    ) -> None:
        """Cache ATS analysis result with timestamp.

        Args:
            resume_content_hash: First 16 chars of SHA256 hash of resume content.
            job_id: The job ID.
            composite_score: The ATSCompositeScore data dict.
            stage_results: Dict of stage_key -> stage result dict.
        """
        key = self._make_ats_key(resume_content_hash, job_id)
        cached_data = {
            "composite_score": composite_score,
            "stage_results": stage_results,
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "resume_content_hash": resume_content_hash,
        }
        await self.redis.setex(key, self.ATS_TTL, json.dumps(cached_data))

    async def get_ats_metadata(
        self, resume_content_hash: str, job_id: int
    ) -> dict | None:
        """Get just the ATS cache metadata (cached_at, resume_content_hash) without full results.

        This is useful for checking staleness without loading the full stage results.

        Args:
            resume_content_hash: First 16 chars of SHA256 hash of resume content.
            job_id: The job ID.

        Returns:
            Dict with keys cached_at, resume_content_hash, and final_score.
            Returns None if not found.
        """
        result = await self.get_ats_result(resume_content_hash, job_id)
        if result:
            return {
                "cached_at": result.get("cached_at"),
                "resume_content_hash": result.get("resume_content_hash"),
                "final_score": result.get("composite_score", {}).get("final_score"),
            }
        return None

    async def invalidate_ats_result(self, resume_content_hash: str, job_id: int) -> None:
        """Invalidate cached ATS analysis result.

        Args:
            resume_content_hash: First 16 chars of SHA256 hash of resume content.
            job_id: The job ID.
        """
        key = self._make_ats_key(resume_content_hash, job_id)
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
