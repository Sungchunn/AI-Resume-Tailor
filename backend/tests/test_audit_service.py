"""Tests for the Audit Service."""

import pytest
import pytest_asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models.audit_log import AuditLog
from app.services.audit import (
    AuditService,
    AuditAction,
    get_audit_service,
    audit_service,
)


# Use SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture
async def audit_db_session():
    """Create a fresh database for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestAuditAction:
    """Test AuditAction constants."""

    def test_crud_actions(self):
        """Should have standard CRUD actions."""
        assert AuditAction.CREATE == "create"
        assert AuditAction.READ == "read"
        assert AuditAction.UPDATE == "update"
        assert AuditAction.DELETE == "delete"

    def test_auth_actions(self):
        """Should have auth-related actions."""
        assert AuditAction.LOGIN == "login"
        assert AuditAction.LOGOUT == "logout"
        assert AuditAction.LOGIN_FAILED == "login_failed"

    def test_special_actions(self):
        """Should have special action types."""
        assert AuditAction.EXPORT == "export"
        assert AuditAction.IMPORT == "import"
        assert AuditAction.AI_GENERATE == "ai_generate"


class TestAuditService:
    """Test AuditService functionality."""

    @pytest.fixture
    def service(self) -> AuditService:
        """Create AuditService instance."""
        return AuditService()

    @pytest.mark.asyncio
    async def test_log_create(self, service, audit_db_session):
        """Should log a create action."""
        result = await service.log_create(
            db=audit_db_session,
            user_id=1,
            resource_type="resume",
            resource_id=123,
            new_value={"title": "My Resume"},
        )

        assert result is not None
        assert result.action == AuditAction.CREATE
        assert result.user_id == 1
        assert result.resource_type == "resume"
        assert result.resource_id == 123
        assert result.new_value == {"title": "My Resume"}
        assert result.status == "success"

    @pytest.mark.asyncio
    async def test_log_read(self, service, audit_db_session):
        """Should log a read action."""
        result = await service.log_read(
            db=audit_db_session,
            user_id=2,
            resource_type="job",
            resource_id=456,
        )

        assert result is not None
        assert result.action == AuditAction.READ
        assert result.user_id == 2
        assert result.resource_type == "job"
        assert result.resource_id == 456

    @pytest.mark.asyncio
    async def test_log_update(self, service, audit_db_session):
        """Should log an update action with old/new values."""
        result = await service.log_update(
            db=audit_db_session,
            user_id=1,
            resource_type="block",
            resource_id=789,
            old_value={"content": "old text"},
            new_value={"content": "new text"},
        )

        assert result is not None
        assert result.action == AuditAction.UPDATE
        assert result.old_value == {"content": "old text"}
        assert result.new_value == {"content": "new text"}

    @pytest.mark.asyncio
    async def test_log_delete(self, service, audit_db_session):
        """Should log a delete action."""
        result = await service.log_delete(
            db=audit_db_session,
            user_id=1,
            resource_type="workshop",
            resource_id=100,
            old_value={"title": "Deleted Workshop"},
        )

        assert result is not None
        assert result.action == AuditAction.DELETE
        assert result.old_value == {"title": "Deleted Workshop"}

    @pytest.mark.asyncio
    async def test_log_login_success(self, service, audit_db_session):
        """Should log successful login."""
        result = await service.log_login(
            db=audit_db_session,
            user_id=1,
            success=True,
        )

        assert result is not None
        assert result.action == AuditAction.LOGIN
        assert result.status == "success"

    @pytest.mark.asyncio
    async def test_log_login_failure(self, service, audit_db_session):
        """Should log failed login."""
        result = await service.log_login(
            db=audit_db_session,
            user_id=None,  # No user ID for failed login
            success=False,
            details={"email": "test@example.com"},
        )

        assert result is not None
        assert result.action == AuditAction.LOGIN_FAILED
        assert result.status == "failure"

    @pytest.mark.asyncio
    async def test_log_export(self, service, audit_db_session):
        """Should log export operations."""
        result = await service.log_export(
            db=audit_db_session,
            user_id=1,
            resource_type="workshop",
            resource_id=50,
            export_format="pdf",
        )

        assert result is not None
        assert result.action == AuditAction.EXPORT
        assert result.details == {"format": "pdf"}

    @pytest.mark.asyncio
    async def test_log_ai_operation(self, service, audit_db_session):
        """Should log AI operations."""
        result = await service.log_ai_operation(
            db=audit_db_session,
            user_id=1,
            operation="tailor",
            resource_type="resume",
            resource_id=10,
            details={"job_id": 5},
        )

        assert result is not None
        assert result.action == AuditAction.AI_GENERATE
        assert result.details["operation"] == "tailor"
        assert result.details["job_id"] == 5

    @pytest.mark.asyncio
    async def test_log_with_request(self, service, audit_db_session):
        """Should extract metadata from request."""
        mock_request = MagicMock()
        mock_request.headers = {
            "X-Forwarded-For": "192.168.1.1",
            "User-Agent": "Test/1.0",
        }
        mock_request.url = MagicMock()
        mock_request.url.path = "/api/v1/resumes"
        mock_request.method = "POST"

        result = await service.log_create(
            db=audit_db_session,
            user_id=1,
            resource_type="resume",
            resource_id=1,
            request=mock_request,
        )

        assert result is not None
        assert result.ip_address == "192.168.1.1"
        assert result.user_agent == "Test/1.0"
        assert result.endpoint == "/api/v1/resumes"
        assert result.http_method == "POST"

    @pytest.mark.asyncio
    async def test_log_disabled(self, audit_db_session):
        """Should not log when disabled."""
        with patch.object(AuditService, "enabled", False):
            service = AuditService()
            result = await service.log_create(
                db=audit_db_session,
                user_id=1,
                resource_type="test",
                resource_id=1,
            )
            assert result is None

    @pytest.mark.asyncio
    async def test_get_user_activity(self, service, audit_db_session):
        """Should retrieve user activity logs."""
        # Create some logs
        await service.log_create(
            db=audit_db_session,
            user_id=1,
            resource_type="resume",
            resource_id=1,
        )
        await service.log_read(
            db=audit_db_session,
            user_id=1,
            resource_type="job",
            resource_id=2,
        )
        await service.log_create(
            db=audit_db_session,
            user_id=2,  # Different user
            resource_type="resume",
            resource_id=3,
        )

        # Query user 1's activity
        logs = await service.get_user_activity(audit_db_session, user_id=1)

        assert len(logs) == 2
        assert all(log.user_id == 1 for log in logs)

    @pytest.mark.asyncio
    async def test_get_user_activity_with_filters(self, service, audit_db_session):
        """Should filter user activity by action and resource type."""
        # Create logs
        await service.log_create(
            db=audit_db_session,
            user_id=1,
            resource_type="resume",
            resource_id=1,
        )
        await service.log_read(
            db=audit_db_session,
            user_id=1,
            resource_type="resume",
            resource_id=1,
        )
        await service.log_create(
            db=audit_db_session,
            user_id=1,
            resource_type="job",
            resource_id=2,
        )

        # Filter by action
        create_logs = await service.get_user_activity(
            audit_db_session,
            user_id=1,
            action=AuditAction.CREATE,
        )
        assert len(create_logs) == 2

        # Filter by resource type
        resume_logs = await service.get_user_activity(
            audit_db_session,
            user_id=1,
            resource_type="resume",
        )
        assert len(resume_logs) == 2

    @pytest.mark.asyncio
    async def test_get_resource_history(self, service, audit_db_session):
        """Should get history for a specific resource."""
        # Create logs for same resource
        await service.log_create(
            db=audit_db_session,
            user_id=1,
            resource_type="resume",
            resource_id=100,
        )
        await service.log_update(
            db=audit_db_session,
            user_id=1,
            resource_type="resume",
            resource_id=100,
        )
        await service.log_read(
            db=audit_db_session,
            user_id=2,
            resource_type="resume",
            resource_id=100,
        )
        # Different resource
        await service.log_create(
            db=audit_db_session,
            user_id=1,
            resource_type="resume",
            resource_id=200,
        )

        history = await service.get_resource_history(
            audit_db_session,
            resource_type="resume",
            resource_id=100,
        )

        assert len(history) == 3
        assert all(log.resource_id == 100 for log in history)


class TestAuditServiceSingleton:
    """Test singleton pattern."""

    def test_singleton_instance(self):
        """Should return singleton instance."""
        instance1 = get_audit_service()
        instance2 = get_audit_service()
        assert instance1 is instance2

    def test_module_level_instance(self):
        """Should have module-level instance available."""
        assert audit_service is not None
        assert isinstance(audit_service, AuditService)
