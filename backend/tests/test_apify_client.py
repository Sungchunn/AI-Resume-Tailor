"""
Unit tests for APIFY client service.

Tests cover:
- Successful actor run with job parsing
- Timeout handling
- HTTP error handling
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import httpx

from app.services.apify_client import ApifyClient, ApifyClientError
from app.schemas.scraper import ScraperConfig, ScraperRegion


@pytest.fixture
def apify_client():
    """Create an APIFY client with test credentials."""
    return ApifyClient(
        api_token="test-token",
        actor_id="test-actor-id",
        timeout_seconds=30,
        max_retries=3,
    )


@pytest.fixture
def scraper_config():
    """Create a test scraper configuration."""
    return ScraperConfig(
        region=ScraperRegion.THAILAND,
        geo_id="105146118",
        count=10,
        search_url="https://www.linkedin.com/jobs/search/?keywords=software",
    )


@pytest.fixture
def sample_job_response():
    """Sample APIFY job response data."""
    return [
        {
            "id": "job-123",
            "title": "Senior Software Engineer",
            "companyName": "Tech Corp",
            "jobUrl": "https://linkedin.com/jobs/view/job-123",
            "description": "We are looking for a skilled developer...",
            "location": "Bangkok, Thailand",
            "city": "Bangkok",
            "country": "Thailand",
            "isRemote": False,
            "easyApply": True,
            "datePosted": "2026-02-18T10:00:00Z",
            "scrapedAt": "2026-02-20T08:00:00Z",
        },
        {
            "id": "job-456",
            "title": "Data Engineer",
            "companyName": "Data Inc",
            "jobUrl": "https://linkedin.com/jobs/view/job-456",
            "description": "Build data pipelines and infrastructure...",
            "location": "Remote",
            "isRemote": True,
            "easyApply": False,
        },
    ]


class TestApifyClientSuccess:
    """Tests for successful APIFY actor runs."""

    @pytest.mark.asyncio
    async def test_run_actor_success(
        self, apify_client, scraper_config, sample_job_response
    ):
        """Test successful actor run returns parsed jobs and result."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_job_response

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            # Verify API was called correctly
            mock_client.post.assert_called_once()
            call_args = mock_client.post.call_args

            assert "test-actor-id" in call_args[0][0]
            assert call_args[1]["json"]["maxItems"] == 10
            assert "Bearer test-token" in call_args[1]["headers"]["Authorization"]

            # Verify results
            assert len(jobs) == 2
            assert jobs[0].id == "job-123"
            assert jobs[0].title == "Senior Software Engineer"
            assert jobs[0].companyName == "Tech Corp"
            assert jobs[0].region == "thailand"

            assert jobs[1].id == "job-456"
            assert jobs[1].title == "Data Engineer"

            # Verify run result
            assert result.status == "success"
            assert result.jobs_found == 2
            assert result.region == ScraperRegion.THAILAND
            assert result.errors == 0
            assert result.duration_seconds is not None

    @pytest.mark.asyncio
    async def test_run_actor_partial_parse_failure(
        self, apify_client, scraper_config
    ):
        """Test actor run with some jobs failing to parse."""
        response_data = [
            {
                "id": "job-valid",
                "title": "Valid Job",
                "companyName": "Valid Corp",
                "jobUrl": "https://linkedin.com/jobs/view/job-valid",
                "description": "A valid job description",
            },
            {
                # Missing required fields - will fail validation
                "id": "job-invalid",
                # Missing: title, companyName, jobUrl, description
            },
        ]

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = response_data

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            # Should have 1 valid job and 1 error
            assert len(jobs) == 1
            assert jobs[0].id == "job-valid"
            assert result.status == "success"
            assert result.jobs_found == 1
            assert result.errors == 1
            assert len(result.error_details) == 1
            assert result.error_details[0]["item_id"] == "job-invalid"

    @pytest.mark.asyncio
    async def test_run_actor_empty_response(self, apify_client, scraper_config):
        """Test actor run with empty job list."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = []

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            assert len(jobs) == 0
            assert result.status == "success"
            assert result.jobs_found == 0
            assert result.errors == 0


class TestApifyClientTimeout:
    """Tests for timeout handling."""

    @pytest.mark.asyncio
    async def test_run_actor_timeout(self, apify_client, scraper_config):
        """Test actor run handles timeout correctly."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = httpx.TimeoutException("Request timed out")
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            # Should return empty jobs and timeout status
            assert len(jobs) == 0
            assert result.status == "timeout"
            assert result.jobs_found == 0
            assert result.errors == 1
            assert len(result.error_details) == 1
            assert result.error_details[0]["error"] == "timeout"
            assert result.region == ScraperRegion.THAILAND

    @pytest.mark.asyncio
    async def test_run_actor_connect_timeout(self, apify_client, scraper_config):
        """Test actor run handles connection timeout."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = httpx.ConnectTimeout("Connection timed out")
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            assert len(jobs) == 0
            assert result.status == "timeout"
            assert result.errors == 1


class TestApifyClientHTTPError:
    """Tests for HTTP error handling.

    Note: The APIFY client catches HTTP errors internally and returns
    an error result instead of raising exceptions. This is by design
    for robust error handling in the scraper orchestrator.
    """

    @pytest.mark.asyncio
    async def test_run_actor_http_401_unauthorized(self, apify_client, scraper_config):
        """Test actor run returns error result on 401 unauthorized."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Invalid API token"

        with patch(
            "app.services.apify_client.httpx.AsyncClient"
        ) as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            # Should return empty jobs and error status
            assert len(jobs) == 0
            assert result.status == "error"
            assert result.errors == 1
            assert "401" in str(result.error_details[0]["message"])

    @pytest.mark.asyncio
    async def test_run_actor_http_404_not_found(self, apify_client, scraper_config):
        """Test actor run returns error result on 404 actor not found."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Actor not found"

        with patch(
            "app.services.apify_client.httpx.AsyncClient"
        ) as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            assert len(jobs) == 0
            assert result.status == "error"
            assert result.errors == 1
            assert "404" in str(result.error_details[0]["message"])

    @pytest.mark.asyncio
    async def test_run_actor_http_500_server_error(self, apify_client, scraper_config):
        """Test actor run returns error result on 500 server error."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"

        with patch(
            "app.services.apify_client.httpx.AsyncClient"
        ) as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            assert len(jobs) == 0
            assert result.status == "error"
            assert result.errors == 1
            assert "500" in str(result.error_details[0]["message"])

    @pytest.mark.asyncio
    async def test_run_actor_http_429_rate_limited(self, apify_client, scraper_config):
        """Test actor run returns error result on 429 rate limit."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Too many requests"

        with patch(
            "app.services.apify_client.httpx.AsyncClient"
        ) as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            assert len(jobs) == 0
            assert result.status == "error"
            assert result.errors == 1
            assert "429" in str(result.error_details[0]["message"])

    @pytest.mark.asyncio
    async def test_run_actor_network_error(self, apify_client, scraper_config):
        """Test actor run handles network errors."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = httpx.NetworkError("Network unreachable")
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            jobs, result = await apify_client.run_actor(scraper_config)

            assert len(jobs) == 0
            assert result.status == "error"
            assert result.errors == 1
            assert result.error_details[0]["error"] == "http_error"


class TestApifyClientConfiguration:
    """Tests for client configuration."""

    def test_client_initialization(self):
        """Test client initializes with provided values."""
        client = ApifyClient(
            api_token="my-token",
            actor_id="my-actor",
            timeout_seconds=60,
            max_retries=5,
        )

        assert client.api_token == "my-token"
        assert client.actor_id == "my-actor"
        assert client.timeout_seconds == 60
        assert client.max_retries == 5

    def test_client_default_values(self):
        """Test client uses settings for defaults."""
        with patch("app.services.apify_client.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                apify_api_token="settings-token",
                apify_actor_id="settings-actor",
                apify_timeout_seconds=300,
                apify_max_retries=3,
            )

            # When using get_apify_client, it should use settings
            from app.services.apify_client import get_apify_client

            # Clear the cached client
            import app.services.apify_client

            app.services.apify_client.get_apify_client.cache_clear()

            client = get_apify_client()

            assert client.api_token == "settings-token"
            assert client.actor_id == "settings-actor"
