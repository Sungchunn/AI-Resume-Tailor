"""
Apify cost tracking service with daily/weekly budget caps.

Uses Redis to track cumulative Apify API costs and enforce
spending limits to prevent runaway costs.
"""

import logging
from datetime import datetime, timezone
from functools import lru_cache

from app.core.config import get_settings
from app.services.core.cache import get_cache_service

logger = logging.getLogger(__name__)


class ApifyCostTracker:
    """
    Track Apify usage costs in Redis with daily/weekly caps.

    Keys:
    - apify:cost:daily:{YYYYMMDD} - Daily cost accumulator
    - apify:cost:weekly:{YYYY}W{WW} - Weekly cost accumulator

    Both keys expire automatically after their respective periods.
    """

    DAILY_KEY_PREFIX = "apify:cost:daily"
    WEEKLY_KEY_PREFIX = "apify:cost:weekly"

    # TTL for keys (with buffer for timezone edge cases)
    DAILY_TTL_SECONDS = 60 * 60 * 36  # 36 hours
    WEEKLY_TTL_SECONDS = 60 * 60 * 24 * 10  # 10 days

    def __init__(
        self,
        daily_limit_usd: float,
        weekly_limit_usd: float,
    ):
        self.daily_limit = daily_limit_usd
        self.weekly_limit = weekly_limit_usd
        self._cache = get_cache_service()

    def _get_daily_key(self, dt: datetime | None = None) -> str:
        """Get Redis key for daily cost tracking."""
        if dt is None:
            dt = datetime.now(timezone.utc)
        date_str = dt.strftime("%Y%m%d")
        return f"{self.DAILY_KEY_PREFIX}:{date_str}"

    def _get_weekly_key(self, dt: datetime | None = None) -> str:
        """Get Redis key for weekly cost tracking."""
        if dt is None:
            dt = datetime.now(timezone.utc)
        year, week, _ = dt.isocalendar()
        return f"{self.WEEKLY_KEY_PREFIX}:{year}W{week:02d}"

    async def check_budget_available(self) -> tuple[bool, str]:
        """
        Check if daily/weekly budget allows another run.

        Returns:
            Tuple of (can_run: bool, reason: str)
            If can_run is False, reason explains which limit was hit.
        """
        daily_used = await self._get_cost(self._get_daily_key())
        weekly_used = await self._get_cost(self._get_weekly_key())

        if daily_used >= self.daily_limit:
            return False, f"Daily budget exceeded: ${daily_used:.2f} >= ${self.daily_limit:.2f}"

        if weekly_used >= self.weekly_limit:
            return False, f"Weekly budget exceeded: ${weekly_used:.2f} >= ${self.weekly_limit:.2f}"

        return True, "Budget available"

    async def record_cost(self, cost_usd: float) -> None:
        """
        Record cost after successful run.

        Increments both daily and weekly accumulators.

        Args:
            cost_usd: The cost in USD to record
        """
        if cost_usd <= 0:
            return

        daily_key = self._get_daily_key()
        weekly_key = self._get_weekly_key()

        try:
            # Use Redis INCRBYFLOAT for atomic increment
            pipe = self._cache.redis.pipeline()

            # Increment daily counter
            pipe.incrbyfloat(daily_key, cost_usd)
            pipe.expire(daily_key, self.DAILY_TTL_SECONDS)

            # Increment weekly counter
            pipe.incrbyfloat(weekly_key, cost_usd)
            pipe.expire(weekly_key, self.WEEKLY_TTL_SECONDS)

            await pipe.execute()

            logger.info(f"Recorded Apify cost: ${cost_usd:.4f}")

        except Exception as e:
            logger.error(f"Failed to record Apify cost: {e}")
            # Don't raise - cost tracking failure shouldn't block scraping

    async def get_current_usage(self) -> dict:
        """
        Get current daily/weekly usage for monitoring.

        Returns:
            Dict with usage statistics and remaining budget.
        """
        daily_used = await self._get_cost(self._get_daily_key())
        weekly_used = await self._get_cost(self._get_weekly_key())

        return {
            "daily_used_usd": round(daily_used, 4),
            "daily_limit_usd": self.daily_limit,
            "daily_remaining_usd": round(max(0, self.daily_limit - daily_used), 4),
            "weekly_used_usd": round(weekly_used, 4),
            "weekly_limit_usd": self.weekly_limit,
            "weekly_remaining_usd": round(max(0, self.weekly_limit - weekly_used), 4),
            "budget_exceeded": daily_used >= self.daily_limit or weekly_used >= self.weekly_limit,
        }

    async def _get_cost(self, key: str) -> float:
        """Get current cost from Redis key."""
        try:
            value = await self._cache.redis.get(key)
            if value is None:
                return 0.0
            return float(value)
        except Exception as e:
            logger.error(f"Failed to get cost from Redis: {e}")
            return 0.0

    async def reset_daily(self) -> None:
        """Reset daily cost counter (for testing)."""
        await self._cache.redis.delete(self._get_daily_key())

    async def reset_weekly(self) -> None:
        """Reset weekly cost counter (for testing)."""
        await self._cache.redis.delete(self._get_weekly_key())


@lru_cache
def get_cost_tracker() -> ApifyCostTracker:
    """Get a singleton cost tracker instance."""
    settings = get_settings()
    return ApifyCostTracker(
        daily_limit_usd=settings.apify_daily_cost_limit_usd,
        weekly_limit_usd=settings.apify_weekly_cost_limit_usd,
    )
