"""
Unit tests for scraper orchestrator service.

Tests cover:
- run_all_scrapers flow
- Database persistence of scraped jobs
- Error handling and partial success scenarios
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.scraping.orchestrator import ScraperOrchestrator
from app.services.scraping.apify_client import ApifyClient
from app.schemas.scraper import ScraperConfig, ScraperRegion, ScraperRunResult
from app.schemas.job_listing import ApifyJobListing
from app.crud.job_listing import job_listing_repository
from app.models.job_listing import JobListing


@pytest.fixture
def mock_apify_client():
    """Create a mock APIFY client."""
    return MagicMock(spec=ApifyClient)


@pytest.fixture
def test_configs():
    """Create test scraper configurations for two regions."""
    return [
        ScraperConfig(
            region=ScraperRegion.THAILAND,
            geo_id="105146118",
            count=5,
            search_url="https://linkedin.com/jobs?geo=thailand",
        ),
        ScraperConfig(
            region=ScraperRegion.SINGAPORE,
            geo_id="102454443",
            count=5,
            search_url="https://linkedin.com/jobs?geo=singapore",
        ),
    ]


@pytest.fixture
def sample_jobs():
    """Sample parsed job listings from APIFY."""
    return [
        ApifyJobListing(
            id="job-th-001",
            title="Software Engineer",
            companyName="Thai Tech",
            jobUrl="https://linkedin.com/jobs/view/job-th-001",
            description="Build amazing software in Thailand",
            location="Bangkok, Thailand",
            country="Thailand",
            isRemote=False,
            easyApply=True,
            region="thailand",
        ),
        ApifyJobListing(
            id="job-th-002",
            title="Data Analyst",
            companyName="Bangkok Data Co",
            jobUrl="https://linkedin.com/jobs/view/job-th-002",
            description="Analyze data for insights",
            location="Bangkok, Thailand",
            country="Thailand",
            isRemote=True,
            region="thailand",
        ),
    ]


def create_success_result(region: ScraperRegion, jobs_found: int) -> ScraperRunResult:
    """Helper to create a successful ScraperRunResult."""
    return ScraperRunResult(
        region=region,
        status="success",
        jobs_found=jobs_found,
        jobs_created=0,
        jobs_updated=0,
        errors=0,
        error_details=[],
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        duration_seconds=1.5,
    )


def create_error_result(region: ScraperRegion, error_type: str) -> ScraperRunResult:
    """Helper to create an error ScraperRunResult."""
    return ScraperRunResult(
        region=region,
        status=error_type,
        jobs_found=0,
        jobs_created=0,
        jobs_updated=0,
        errors=1,
        error_details=[{"error": error_type, "message": f"{error_type} error occurred"}],
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        duration_seconds=0.5,
    )


class TestRunAllScrapers:
    """Tests for the run_all_scrapers orchestration flow."""

    @pytest.mark.asyncio
    async def test_run_all_scrapers_all_success(
        self, mock_apify_client, test_configs, sample_jobs
    ):
        """Test run_all_scrapers when all regions succeed."""
        # Mock APIFY client to return success for each config
        async def mock_run_actor(config):
            jobs = [
                ApifyJobListing(
                    id=f"job-{config.region.value}-001",
                    title="Test Job",
                    companyName="Test Corp",
                    jobUrl=f"https://linkedin.com/jobs/view/job-{config.region.value}-001",
                    description="Test description",
                    region=config.region.value,
                )
            ]
            result = create_success_result(config.region, len(jobs))
            return jobs, result

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        # Mock the database session and repository
        with patch("app.services.scraper_orchestrator.AsyncSessionLocal") as mock_session_local:
            mock_db = AsyncMock(spec=AsyncSession)
            mock_db.commit = AsyncMock()
            mock_db.rollback = AsyncMock()

            # Create async context manager for the session
            mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)

            with patch.object(
                job_listing_repository,
                "upsert_from_apify",
                new_callable=AsyncMock,
            ) as mock_upsert:
                # Return (listing, is_created=True) for each job
                mock_upsert.return_value = (MagicMock(spec=JobListing), True)

                orchestrator = ScraperOrchestrator()
                orchestrator.apify_client = mock_apify_client

                result = await orchestrator.run_all_scrapers(configs=test_configs)

                # Verify overall success
                assert result.status == "success"
                assert len(result.region_results) == 2
                assert result.total_jobs_found == 2  # 1 job per region
                assert result.total_jobs_created == 2
                assert result.total_errors == 0
                assert result.duration_seconds is not None

    @pytest.mark.asyncio
    async def test_run_all_scrapers_partial_failure(
        self, mock_apify_client, test_configs
    ):
        """Test run_all_scrapers when some regions fail."""
        call_count = 0

        async def mock_run_actor(config):
            nonlocal call_count
            call_count += 1

            if config.region == ScraperRegion.THAILAND:
                # First region succeeds
                jobs = [
                    ApifyJobListing(
                        id="job-th-001",
                        title="Test Job",
                        companyName="Test Corp",
                        jobUrl="https://linkedin.com/jobs/view/job-th-001",
                        description="Test description",
                        region="thailand",
                    )
                ]
                return jobs, create_success_result(config.region, 1)
            else:
                # Second region times out
                return [], create_error_result(config.region, "timeout")

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        with patch("app.services.scraper_orchestrator.AsyncSessionLocal") as mock_session_local:
            mock_db = AsyncMock(spec=AsyncSession)
            mock_db.commit = AsyncMock()
            mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)

            with patch.object(
                job_listing_repository,
                "upsert_from_apify",
                new_callable=AsyncMock,
            ) as mock_upsert:
                mock_upsert.return_value = (MagicMock(spec=JobListing), True)

                orchestrator = ScraperOrchestrator()
                orchestrator.apify_client = mock_apify_client

                result = await orchestrator.run_all_scrapers(configs=test_configs)

                # Verify partial status
                assert result.status == "partial"
                assert len(result.region_results) == 2
                assert result.total_jobs_found == 1
                assert result.total_errors >= 1

                # Verify individual region results
                thailand_result = next(
                    r for r in result.region_results if r.region == ScraperRegion.THAILAND
                )
                singapore_result = next(
                    r for r in result.region_results if r.region == ScraperRegion.SINGAPORE
                )

                assert thailand_result.status == "success"
                assert singapore_result.status == "timeout"

    @pytest.mark.asyncio
    async def test_run_all_scrapers_all_failure(self, mock_apify_client, test_configs):
        """Test run_all_scrapers when all regions fail."""

        async def mock_run_actor(config):
            return [], create_error_result(config.region, "error")

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        orchestrator = ScraperOrchestrator()
        orchestrator.apify_client = mock_apify_client

        result = await orchestrator.run_all_scrapers(configs=test_configs)

        # Verify overall error status
        assert result.status == "error"
        assert len(result.region_results) == 2
        assert result.total_jobs_found == 0
        assert result.total_errors >= 2

        # Verify all regions failed
        for region_result in result.region_results:
            assert region_result.status == "error"

    @pytest.mark.asyncio
    async def test_run_all_scrapers_uses_default_configs(self, mock_apify_client):
        """Test run_all_scrapers uses SCRAPER_CONFIGS when no configs provided."""

        async def mock_run_actor(config):
            return [], create_success_result(config.region, 0)

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        with patch(
            "app.services.scraper_orchestrator.SCRAPER_CONFIGS",
            [
                ScraperConfig(
                    region=ScraperRegion.EUROPE,
                    geo_id="91000002",
                    count=10,
                    search_url="https://linkedin.com/jobs?geo=europe",
                )
            ],
        ):
            orchestrator = ScraperOrchestrator()
            orchestrator.apify_client = mock_apify_client

            result = await orchestrator.run_all_scrapers()

            # Should have called run_actor for the default config
            assert mock_apify_client.run_actor.call_count == 1
            assert len(result.region_results) == 1
            assert result.region_results[0].region == ScraperRegion.EUROPE


class TestDatabasePersistence:
    """Tests for database persistence of scraped jobs."""

    @pytest.mark.asyncio
    async def test_jobs_persisted_to_database(self, mock_apify_client):
        """Test that scraped jobs are persisted to the database."""
        test_job = ApifyJobListing(
            id="persist-test-001",
            title="Database Test Job",
            companyName="Persist Corp",
            jobUrl="https://linkedin.com/jobs/view/persist-test-001",
            description="Testing database persistence",
            location="Singapore",
            country="Singapore",
            isRemote=False,
            region="singapore",
        )

        async def mock_run_actor(config):
            return [test_job], create_success_result(config.region, 1)

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        orchestrator = ScraperOrchestrator()
        orchestrator.apify_client = mock_apify_client

        config = ScraperConfig(
            region=ScraperRegion.SINGAPORE,
            geo_id="102454443",
            count=5,
            search_url="https://linkedin.com/jobs?geo=singapore",
        )

        with patch("app.services.scraper_orchestrator.AsyncSessionLocal") as mock_session_local:
            mock_db = AsyncMock(spec=AsyncSession)
            mock_db.commit = AsyncMock()
            mock_db.rollback = AsyncMock()
            mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)

            # Mock the repository to return (listing, is_created=True)
            mock_listing = MagicMock(spec=JobListing)
            mock_listing.job_title = "Database Test Job"
            mock_listing.company_name = "Persist Corp"
            mock_listing.region = "singapore"

            with patch.object(
                job_listing_repository,
                "upsert_from_apify",
                new_callable=AsyncMock,
            ) as mock_upsert:
                mock_upsert.return_value = (mock_listing, True)  # is_created=True

                result = await orchestrator.run_single_scraper(config)

                # Verify job was created
                assert result.jobs_created == 1
                assert result.jobs_updated == 0
                assert result.status == "success"

                # Verify repository was called with correct data
                mock_upsert.assert_called_once()
                call_args = mock_upsert.call_args
                assert call_args[1]["job_data"].id == "persist-test-001"
                assert call_args[1]["source_platform"] == "linkedin"

    @pytest.mark.asyncio
    async def test_duplicate_jobs_updated_not_created(self, mock_apify_client):
        """Test that existing jobs are updated, not duplicated."""
        test_job = ApifyJobListing(
            id="update-test-001",
            title="Original Title",
            companyName="Update Corp",
            jobUrl="https://linkedin.com/jobs/view/update-test-001",
            description="Original description",
            region="thailand",
        )

        async def mock_run_actor(config):
            return [test_job], create_success_result(config.region, 1)

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        orchestrator = ScraperOrchestrator()
        orchestrator.apify_client = mock_apify_client

        config = ScraperConfig(
            region=ScraperRegion.THAILAND,
            geo_id="105146118",
            count=5,
            search_url="https://linkedin.com/jobs?geo=thailand",
        )

        with patch("app.services.scraper_orchestrator.AsyncSessionLocal") as mock_session_local:
            mock_db = AsyncMock(spec=AsyncSession)
            mock_db.commit = AsyncMock()
            mock_db.rollback = AsyncMock()
            mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)

            mock_listing = MagicMock(spec=JobListing)

            with patch.object(
                job_listing_repository,
                "upsert_from_apify",
                new_callable=AsyncMock,
            ) as mock_upsert:
                # First call returns is_created=True
                # Second call returns is_created=False (update)
                mock_upsert.side_effect = [
                    (mock_listing, True),   # First run - created
                    (mock_listing, False),  # Second run - updated
                ]

                # First run - should create
                result1 = await orchestrator.run_single_scraper(config)
                assert result1.jobs_created == 1
                assert result1.jobs_updated == 0

                # Second run - should update
                result2 = await orchestrator.run_single_scraper(config)
                assert result2.jobs_created == 0
                assert result2.jobs_updated == 1

                # Verify repository was called twice
                assert mock_upsert.call_count == 2

    @pytest.mark.asyncio
    async def test_database_error_handling(self, mock_apify_client):
        """Test graceful handling of database errors."""
        test_job = ApifyJobListing(
            id="db-error-test-001",
            title="DB Error Test",
            companyName="Error Corp",
            jobUrl="https://linkedin.com/jobs/view/db-error-test-001",
            description="Testing database error handling",
            region="thailand",
        )

        async def mock_run_actor(config):
            return [test_job], create_success_result(config.region, 1)

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        with patch("app.services.scraper_orchestrator.AsyncSessionLocal") as mock_session_local:
            mock_db = AsyncMock(spec=AsyncSession)
            mock_db.commit = AsyncMock(side_effect=Exception("Database connection lost"))
            mock_db.rollback = AsyncMock()

            mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)

            with patch.object(
                job_listing_repository,
                "upsert_from_apify",
                new_callable=AsyncMock,
            ) as mock_upsert:
                mock_upsert.return_value = (MagicMock(spec=JobListing), True)

                orchestrator = ScraperOrchestrator()
                orchestrator.apify_client = mock_apify_client

                config = ScraperConfig(
                    region=ScraperRegion.THAILAND,
                    geo_id="105146118",
                    count=5,
                    search_url="https://linkedin.com/jobs?geo=thailand",
                )

                result = await orchestrator.run_single_scraper(config)

                # Should have recorded the error
                assert result.errors >= 1
                # Database rollback should have been called
                mock_db.rollback.assert_called_once()


class TestOrchestratorState:
    """Tests for orchestrator state management."""

    @pytest.mark.asyncio
    async def test_last_run_result_stored(self, mock_apify_client, test_configs):
        """Test that last run result is stored in orchestrator."""

        async def mock_run_actor(config):
            return [], create_success_result(config.region, 0)

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        orchestrator = ScraperOrchestrator()
        orchestrator.apify_client = mock_apify_client

        # Initially no last result
        assert orchestrator.last_run_result is None

        await orchestrator.run_all_scrapers(configs=test_configs)

        # After run, last result should be set
        assert orchestrator.last_run_result is not None
        assert orchestrator.last_run_result.status == "success"

    @pytest.mark.asyncio
    async def test_orchestrator_timing(self, mock_apify_client, test_configs):
        """Test that orchestrator tracks timing correctly."""
        import asyncio

        async def mock_run_actor(config):
            await asyncio.sleep(0.1)  # Simulate some work
            return [], create_success_result(config.region, 0)

        mock_apify_client.run_actor = AsyncMock(side_effect=mock_run_actor)

        orchestrator = ScraperOrchestrator()
        orchestrator.apify_client = mock_apify_client

        result = await orchestrator.run_all_scrapers(configs=test_configs)

        # Duration should be at least the sum of simulated work
        assert result.duration_seconds >= 0.2
        assert result.started_at is not None
        assert result.completed_at is not None
        assert result.completed_at > result.started_at
