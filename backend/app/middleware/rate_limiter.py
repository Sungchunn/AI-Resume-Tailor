"""
Rate Limiting Middleware

Redis-based rate limiting using the sliding window algorithm.
Provides per-user, per-endpoint rate limits to prevent abuse.

Features:
- Sliding window counters (more accurate than fixed windows)
- Per-user rate limits (authenticated users)
- Per-IP rate limits (anonymous users)
- Configurable limits per endpoint pattern
- X-RateLimit headers in responses
"""

import time
from typing import Optional, Callable
from dataclasses import dataclass

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis

from app.core.config import get_settings


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""

    # Default limits
    default_requests_per_minute: int = 60
    default_requests_per_hour: int = 1000

    # AI endpoint limits (more restrictive due to cost)
    ai_requests_per_minute: int = 10
    ai_requests_per_hour: int = 100

    # Auth endpoint limits (prevent brute force)
    auth_requests_per_minute: int = 10
    auth_requests_per_hour: int = 50

    # Export endpoint limits
    export_requests_per_minute: int = 5
    export_requests_per_hour: int = 30

    # Sliding window size in seconds
    window_size_minutes: int = 60

    # Whether to enable rate limiting
    enabled: bool = True

    # Redis key prefix
    key_prefix: str = "ratelimit"


# Singleton settings
rate_limit_settings = RateLimitConfig()


class RateLimiter:
    """
    Redis-based sliding window rate limiter.

    Uses a sorted set with timestamps as scores to implement
    a true sliding window algorithm.
    """

    def __init__(self, redis_client: redis.Redis, config: RateLimitConfig):
        self.redis = redis_client
        self.config = config

    async def is_rate_limited(
        self,
        identifier: str,
        endpoint_category: str = "default",
    ) -> tuple[bool, dict]:
        """
        Check if request should be rate limited.

        Args:
            identifier: User ID or IP address
            endpoint_category: Category for limit lookup (default, ai, auth, export)

        Returns:
            Tuple of (is_limited, rate_limit_info)
            rate_limit_info contains: limit, remaining, reset_at
        """
        # Get limits for this category
        limit_per_minute, limit_per_hour = self._get_limits(endpoint_category)

        now = time.time()
        minute_ago = now - 60
        hour_ago = now - 3600

        # Keys for minute and hour windows
        minute_key = f"{self.config.key_prefix}:{identifier}:minute"
        hour_key = f"{self.config.key_prefix}:{identifier}:hour"

        # Use pipeline for atomic operations
        pipe = self.redis.pipeline()

        # Remove old entries outside window
        pipe.zremrangebyscore(minute_key, 0, minute_ago)
        pipe.zremrangebyscore(hour_key, 0, hour_ago)

        # Count current requests in window
        pipe.zcard(minute_key)
        pipe.zcard(hour_key)

        # Add current request
        pipe.zadd(minute_key, {str(now): now})
        pipe.zadd(hour_key, {str(now): now})

        # Set expiry on keys
        pipe.expire(minute_key, 120)  # 2 minutes
        pipe.expire(hour_key, 7200)  # 2 hours

        results = await pipe.execute()

        minute_count = results[2]
        hour_count = results[3]

        # Check limits
        minute_limited = minute_count >= limit_per_minute
        hour_limited = hour_count >= limit_per_hour

        is_limited = minute_limited or hour_limited

        # Calculate remaining and reset time
        if minute_limited:
            remaining = 0
            # Get oldest entry to calculate reset
            oldest = await self.redis.zrange(minute_key, 0, 0, withscores=True)
            reset_at = int(oldest[0][1] + 60) if oldest else int(now + 60)
            limit = limit_per_minute
        elif hour_limited:
            remaining = 0
            oldest = await self.redis.zrange(hour_key, 0, 0, withscores=True)
            reset_at = int(oldest[0][1] + 3600) if oldest else int(now + 3600)
            limit = limit_per_hour
        else:
            # Use minute remaining as primary
            remaining = limit_per_minute - minute_count - 1
            reset_at = int(now + 60)
            limit = limit_per_minute

        return is_limited, {
            "limit": limit,
            "remaining": max(0, remaining),
            "reset_at": reset_at,
            "retry_after": reset_at - int(now) if is_limited else 0,
        }

    def _get_limits(self, category: str) -> tuple[int, int]:
        """Get per-minute and per-hour limits for category."""
        limits = {
            "default": (
                self.config.default_requests_per_minute,
                self.config.default_requests_per_hour,
            ),
            "ai": (
                self.config.ai_requests_per_minute,
                self.config.ai_requests_per_hour,
            ),
            "auth": (
                self.config.auth_requests_per_minute,
                self.config.auth_requests_per_hour,
            ),
            "export": (
                self.config.export_requests_per_minute,
                self.config.export_requests_per_hour,
            ),
        }
        return limits.get(category, limits["default"])


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.

    Extracts user ID from JWT or falls back to IP address.
    Categorizes endpoints and applies appropriate limits.
    """

    # Endpoint patterns and their categories
    ENDPOINT_CATEGORIES = {
        # AI-related endpoints (expensive)
        "/api/v1/tailor": "ai",
        "/api/v1/match": "ai",
        "/api/v1/blocks/import": "ai",
        "/api/v1/workshops/": "ai",  # Workshop suggestions use AI
        # Auth endpoints (brute force protection)
        "/api/v1/auth/login": "auth",
        "/api/v1/auth/register": "auth",
        "/api/v1/auth/refresh": "auth",
        # Export endpoints
        "/api/v1/export": "export",
    }

    # Paths to skip rate limiting
    SKIP_PATHS = {
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/",
    }

    def __init__(
        self,
        app,
        redis_url: Optional[str] = None,
        config: Optional[RateLimitConfig] = None,
    ):
        super().__init__(app)
        self.config = config or rate_limit_settings
        self.redis_url = redis_url or get_settings().redis_url
        self._redis: Optional[redis.Redis] = None
        self._limiter: Optional[RateLimiter] = None

    async def _get_limiter(self) -> RateLimiter:
        """Lazy initialization of Redis connection and limiter."""
        if self._limiter is None:
            self._redis = redis.from_url(self.redis_url, decode_responses=True)
            self._limiter = RateLimiter(self._redis, self.config)
        return self._limiter

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Process request with rate limiting."""
        # Skip if disabled
        if not self.config.enabled:
            return await call_next(request)

        # Skip certain paths
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        # Get identifier (user ID or IP)
        identifier = self._get_identifier(request)

        # Get endpoint category
        category = self._get_category(request.url.path)

        # Check rate limit
        try:
            limiter = await self._get_limiter()
            is_limited, info = await limiter.is_rate_limited(identifier, category)
        except Exception:
            # If Redis is down, allow the request (fail open)
            return await call_next(request)

        # Return 429 if rate limited
        if is_limited:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please slow down.",
                    "retry_after": info["retry_after"],
                },
                headers={
                    "X-RateLimit-Limit": str(info["limit"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(info["reset_at"]),
                    "Retry-After": str(info["retry_after"]),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(info["reset_at"])

        return response

    def _get_identifier(self, request: Request) -> str:
        """
        Extract identifier for rate limiting.

        Uses user ID from JWT if authenticated, otherwise falls back to IP.
        """
        # Try to get user ID from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"

        # Fall back to IP address
        # Check for X-Forwarded-For header (behind proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP (client IP)
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"

        return f"ip:{ip}"

    def _get_category(self, path: str) -> str:
        """Determine the rate limit category for an endpoint."""
        for pattern, category in self.ENDPOINT_CATEGORIES.items():
            if path.startswith(pattern):
                return category
        return "default"
