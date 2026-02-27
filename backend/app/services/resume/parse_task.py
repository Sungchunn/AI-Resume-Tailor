"""
Parse Task Service

Manages parse task state via Redis for background resume parsing.
Provides task lifecycle management: create, complete, fail, query.
"""

import json
import uuid
import logging
from functools import lru_cache

import redis.asyncio as redis

from app.core.config import get_settings
from app.schemas.resume import ParseStatusResponse


logger = logging.getLogger(__name__)


# Task TTL in seconds (1 hour)
TASK_TTL = 60 * 60


class ParseTaskService:
    """Service for managing parse task state in Redis."""

    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.key_prefix = "parse_task"

    def _make_key(self, task_id: str) -> str:
        """Generate Redis key for a task."""
        return f"{self.key_prefix}:{task_id}"

    async def create_task(self, resume_id: int) -> str:
        """
        Create a new parse task in pending state.

        Args:
            resume_id: The resume ID being parsed

        Returns:
            task_id: Unique identifier for the task
        """
        task_id = str(uuid.uuid4())
        key = self._make_key(task_id)

        task_data = {
            "task_id": task_id,
            "status": "pending",
            "resume_id": resume_id,
            "error": None,
        }

        await self.redis.setex(key, TASK_TTL, json.dumps(task_data))
        logger.info(f"Created parse task {task_id} for resume {resume_id}")

        return task_id

    async def get_task_status(self, task_id: str) -> ParseStatusResponse | None:
        """
        Get the current status of a parse task.

        Args:
            task_id: The task ID to query

        Returns:
            ParseStatusResponse or None if task not found/expired
        """
        key = self._make_key(task_id)
        data = await self.redis.get(key)

        if not data:
            return None

        task_data = json.loads(data)
        return ParseStatusResponse(
            task_id=task_data["task_id"],
            status=task_data["status"],
            resume_id=task_data["resume_id"],
            error=task_data.get("error"),
        )

    async def complete_task(self, task_id: str, resume_id: int) -> None:
        """
        Mark a task as completed.

        Args:
            task_id: The task ID to complete
            resume_id: The resume ID that was parsed
        """
        key = self._make_key(task_id)

        task_data = {
            "task_id": task_id,
            "status": "completed",
            "resume_id": resume_id,
            "error": None,
        }

        # Update with fresh TTL
        await self.redis.setex(key, TASK_TTL, json.dumps(task_data))
        logger.info(f"Completed parse task {task_id} for resume {resume_id}")

    async def fail_task(self, task_id: str, error: str) -> None:
        """
        Mark a task as failed with an error message.

        Args:
            task_id: The task ID that failed
            error: Error message describing the failure
        """
        key = self._make_key(task_id)

        # Get existing data to preserve resume_id
        existing = await self.redis.get(key)
        if existing:
            task_data = json.loads(existing)
            task_data["status"] = "failed"
            task_data["error"] = error
        else:
            # Fallback if task expired during processing
            task_data = {
                "task_id": task_id,
                "status": "failed",
                "resume_id": 0,
                "error": error,
            }

        await self.redis.setex(key, TASK_TTL, json.dumps(task_data))
        logger.warning(f"Failed parse task {task_id}: {error}")

    async def close(self) -> None:
        """Close the Redis connection."""
        await self.redis.close()


@lru_cache
def get_parse_task_service() -> ParseTaskService:
    """Get a singleton parse task service instance."""
    settings = get_settings()
    return ParseTaskService(redis_url=settings.redis_url)
