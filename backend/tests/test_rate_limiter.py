"""Tests for the Rate Limiter middleware."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.testclient import TestClient

from app.middleware.rate_limiter import (
    RateLimitConfig,
    RateLimiter,
    RateLimitMiddleware,
)


class TestRateLimitConfig:
    """Test RateLimitConfig dataclass."""

    def test_default_values(self):
        """Should have sensible defaults."""
        config = RateLimitConfig()

        assert config.default_requests_per_minute == 60
        assert config.default_requests_per_hour == 1000
        assert config.ai_requests_per_minute == 10
        assert config.ai_requests_per_hour == 100
        assert config.auth_requests_per_minute == 10
        assert config.enabled is True

    def test_custom_values(self):
        """Should accept custom values."""
        config = RateLimitConfig(
            default_requests_per_minute=100,
            ai_requests_per_minute=5,
            enabled=False,
        )

        assert config.default_requests_per_minute == 100
        assert config.ai_requests_per_minute == 5
        assert config.enabled is False


class TestRateLimiter:
    """Test RateLimiter class."""

    def _create_mock_redis(self, minute_count=5, hour_count=10):
        """Create mock Redis client with specified counts."""
        redis = MagicMock()
        pipeline = MagicMock()

        # Configure pipeline mock - methods return pipeline for chaining
        pipeline.zremrangebyscore.return_value = pipeline
        pipeline.zcard.return_value = pipeline
        pipeline.zadd.return_value = pipeline
        pipeline.expire.return_value = pipeline

        # execute() returns the results of all commands
        # [zremrangebyscore_result, zremrangebyscore_result, zcard_minute, zcard_hour, ...]
        execute_result = [0, 0, minute_count, hour_count, None, None, None, None]

        async def async_execute():
            return execute_result

        pipeline.execute = async_execute

        redis.pipeline.return_value = pipeline

        async def async_zrange(*args, **kwargs):
            return []

        redis.zrange = async_zrange

        return redis, pipeline, execute_result

    @pytest.mark.asyncio
    async def test_not_limited_under_threshold(self):
        """Should not limit when under threshold."""
        mock_redis, pipeline, _ = self._create_mock_redis(minute_count=5, hour_count=10)
        config = RateLimitConfig()
        limiter = RateLimiter(mock_redis, config)

        is_limited, info = await limiter.is_rate_limited("user:1", "default")

        assert is_limited is False
        assert info["limit"] == 60
        assert info["remaining"] >= 0

    @pytest.mark.asyncio
    async def test_limited_at_threshold(self):
        """Should limit when at threshold."""
        import time

        mock_redis, pipeline, execute_result = self._create_mock_redis(minute_count=60, hour_count=100)

        # Use a realistic timestamp (30 seconds ago, so retry_after will be ~30)
        recent_timestamp = time.time() - 30

        async def async_zrange(*args, **kwargs):
            return [(b"key", recent_timestamp)]

        mock_redis.zrange = async_zrange

        config = RateLimitConfig()
        limiter = RateLimiter(mock_redis, config)

        is_limited, info = await limiter.is_rate_limited("user:1", "default")

        assert is_limited is True
        assert info["remaining"] == 0
        assert info["retry_after"] > 0
        assert info["retry_after"] <= 60  # Should be at most 60 seconds

    @pytest.mark.asyncio
    async def test_ai_category_has_lower_limits(self):
        """Should apply lower limits for AI category."""
        import time

        mock_redis, pipeline, _ = self._create_mock_redis(minute_count=10, hour_count=50)

        recent_timestamp = time.time() - 30

        async def async_zrange(*args, **kwargs):
            return [(b"key", recent_timestamp)]

        mock_redis.zrange = async_zrange

        config = RateLimitConfig()
        limiter = RateLimiter(mock_redis, config)

        is_limited, info = await limiter.is_rate_limited("user:1", "ai")

        assert is_limited is True
        assert info["limit"] == 10

    @pytest.mark.asyncio
    async def test_auth_category_limits(self):
        """Should apply auth category limits."""
        mock_redis, pipeline, _ = self._create_mock_redis(minute_count=5, hour_count=25)

        config = RateLimitConfig()
        limiter = RateLimiter(mock_redis, config)

        is_limited, info = await limiter.is_rate_limited("user:1", "auth")

        assert is_limited is False
        # Check it's using auth limits (10/min)
        assert info["limit"] == 10


class TestRateLimitMiddleware:
    """Test RateLimitMiddleware."""

    def test_get_identifier_with_user(self):
        """Should use user ID when available."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            config=RateLimitConfig(enabled=False),
        )

        request = MagicMock()
        request.state = MagicMock()
        request.state.user_id = 123

        identifier = middleware._get_identifier(request)
        assert identifier == "user:123"

    def test_get_identifier_with_ip(self):
        """Should use IP address when no user."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            config=RateLimitConfig(enabled=False),
        )

        request = MagicMock()
        request.state = MagicMock(spec=[])  # No user_id attribute
        request.headers = {}
        request.client = MagicMock()
        request.client.host = "192.168.1.1"

        identifier = middleware._get_identifier(request)
        assert identifier == "ip:192.168.1.1"

    def test_get_identifier_with_forwarded_for(self):
        """Should use X-Forwarded-For header when present."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            config=RateLimitConfig(enabled=False),
        )

        request = MagicMock()
        request.state = MagicMock(spec=[])
        request.headers = {"X-Forwarded-For": "10.0.0.1, 10.0.0.2"}
        request.client = MagicMock()
        request.client.host = "192.168.1.1"

        identifier = middleware._get_identifier(request)
        assert identifier == "ip:10.0.0.1"

    def test_get_category_default(self):
        """Should return 'default' for unknown endpoints."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            config=RateLimitConfig(enabled=False),
        )

        assert middleware._get_category("/api/v1/resumes") == "default"
        assert middleware._get_category("/api/v1/unknown") == "default"

    def test_get_category_ai(self):
        """Should return 'ai' for AI endpoints."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            config=RateLimitConfig(enabled=False),
        )

        assert middleware._get_category("/api/v1/tailor") == "ai"
        assert middleware._get_category("/api/v1/match") == "ai"

    def test_get_category_auth(self):
        """Should return 'auth' for auth endpoints."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            config=RateLimitConfig(enabled=False),
        )

        assert middleware._get_category("/api/v1/auth/login") == "auth"
        assert middleware._get_category("/api/v1/auth/register") == "auth"

    def test_get_category_export(self):
        """Should return 'export' for export endpoints."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            config=RateLimitConfig(enabled=False),
        )

        assert middleware._get_category("/api/v1/export") == "export"
