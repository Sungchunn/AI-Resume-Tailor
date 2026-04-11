"""Cache-TTL helpers derived from the scraper schedule.

Phase 4 of the job-listings caching plan anchors fastapi-cache entries to the
time of the next scraper run instead of a fixed TTL, so the worst-case staleness
of any cached row is bounded by the scrape interval regardless of whether the
post-scrape ``FastAPICache.clear()`` call succeeded.

See /docs/features/infrastructure/110426_jobs-page-caching/phase-4-query-optimization.md
"""
from __future__ import annotations

from datetime import datetime, timezone

from apscheduler.triggers.cron import CronTrigger

# Safety bounds — never cache longer than a day, never shorter than a minute.
_MIN_TTL_SECONDS = 60
_MAX_TTL_SECONDS = 86_400

_cached_schedule: tuple[int, int, str] | None = None


def seconds_until_next_scraper_run(
    schedule_hour: int,
    schedule_minute: int,
    timezone_name: str = "UTC",
    now: datetime | None = None,
) -> int:
    """Return seconds from now until the next cron fire of the scraper.

    Clamped to ``[60, 86400]`` so a mis-configured schedule cannot produce
    pathological cache lifetimes.
    """
    now = now or datetime.now(timezone.utc)
    trigger = CronTrigger(
        hour=schedule_hour,
        minute=schedule_minute,
        timezone=timezone_name,
    )
    next_fire = trigger.get_next_fire_time(None, now)
    if next_fire is None:
        return _MAX_TTL_SECONDS
    delta = int((next_fire - now).total_seconds())
    return max(_MIN_TTL_SECONDS, min(_MAX_TTL_SECONDS, delta))


def set_cached_schedule(
    hour: int,
    minute: int,
    timezone_name: str = "UTC",
) -> None:
    """Record the current scraper schedule for later TTL lookups.

    Called from ``SchedulerService.start()`` and ``reconfigure_from_db()`` so
    that cache writes can compute their expiry without hitting the database.
    """
    global _cached_schedule
    _cached_schedule = (hour, minute, timezone_name)


def get_cache_ttl_seconds() -> int:
    """TTL to use for cache entries written right now.

    Falls back to the 24 h maximum before the scheduler wires the cached
    schedule, which happens during app startup. The next scraper run will
    evict those entries regardless via ``FastAPICache.clear()``.
    """
    if _cached_schedule is None:
        return _MAX_TTL_SECONDS
    hour, minute, tz_name = _cached_schedule
    return seconds_until_next_scraper_run(hour, minute, tz_name)
