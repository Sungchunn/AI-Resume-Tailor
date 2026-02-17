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

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        redis = AsyncMock()
        pipeline = AsyncMock()

        # Configure pipeline mock
        pipeline.zremrangebyscore = MagicMock(return_value=pipeline)
        pipeline.zcard = MagicMock(return_value=pipeline)
        pipeline.zadd = MagicMock(return_value=pipeline)
        pipeline.expire = MagicMock(return_value=pipeline)
        pipeline.execute = AsyncMock(return_value=[0, 0, 5, 10, None, None, None, None])

        redis.pipeline.return_value = pipeline
        redis.zrange = AsyncMock(return_value=[])

        return redis

    @pytest.fixture
    def limiter(self, mock_redis) -> RateLimiter:
        """Create RateLimiter with mock Redis."""
        config = RateLimitConfig()
        return RateLimiter(mock_redis, config)

    @pytest.mark.asyncio
    async def test_not_limited_under_threshold(self, limiter):
        """Should not limit when under threshold."""
        is_limited, info = await limiter.is_rate_limited("user:1", "default")

        assert is_limited is False
        assert info["limit"] == 60
        assert info["remaining"] >= 0

    @pytest.mark.asyncio
    async def test_limited_at_threshold(self, limiter, mock_redis):
        """Should limit when at threshold."""
        # Configure pipeline to return count at limit
        pipeline = mock_redis.pipeline.return_value
        pipeline.execute = AsyncMock(return_value=[0, 0, 60, 100, None, None, None, None])
        mock_redis.zrange = AsyncMock(return_value=[(b"key", 1000000)])

        is_limited, info = await limiter.is_rate_limited("user:1", "default")

        assert is_limited is True
        assert info["remaining"] == 0
        assert info["retry_after"] > 0

    @pytest.mark.asyncio
    async def test_ai_category_has_lower_limits(self, limiter, mock_redis):
        """Should apply lower limits for AI category."""
        # Configure pipeline for AI limit
        pipeline = mock_redis.pipeline.return_value
        pipeline.execute = AsyncMock(return_value=[0, 0, 10, 50, None, None, None, None])
        mock_redis.zrange = AsyncMock(return_value=[(b"key", 1000000)])

        is_limited, info = await limiter.is_rate_limited("user:1", "ai")

        assert is_limited is True
        assert info["limit"] == 10

    @pytest.mark.asyncio
    async def test_auth_category_limits(self, limiter, mock_redis):
        """Should apply auth category limits."""
        pipeline = mock_redis.pipeline.return_value
        pipeline.execute = AsyncMock(return_value=[0, 0, 5, 25, None, None, None, None])

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
