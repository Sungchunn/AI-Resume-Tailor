"""Tests for the Audit Service."""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from app.services.audit import (
    AuditService,
    AuditAction,
    get_audit_service,
    audit_service,
)


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

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        db = AsyncMock()
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.rollback = AsyncMock()
        return db

    @pytest.mark.asyncio
    async def test_log_create(self, service, mock_db):
        """Should log a create action."""
        result = await service.log_create(
            db=mock_db,
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
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_read(self, service, mock_db):
        """Should log a read action."""
        result = await service.log_read(
            db=mock_db,
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
    async def test_log_update(self, service, mock_db):
        """Should log an update action with old/new values."""
        result = await service.log_update(
            db=mock_db,
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
    async def test_log_delete(self, service, mock_db):
        """Should log a delete action."""
        result = await service.log_delete(
            db=mock_db,
            user_id=1,
            resource_type="workshop",
            resource_id=100,
            old_value={"title": "Deleted Workshop"},
        )

        assert result is not None
        assert result.action == AuditAction.DELETE
        assert result.old_value == {"title": "Deleted Workshop"}

    @pytest.mark.asyncio
    async def test_log_login_success(self, service, mock_db):
        """Should log successful login."""
        result = await service.log_login(
            db=mock_db,
            user_id=1,
            success=True,
        )

        assert result is not None
        assert result.action == AuditAction.LOGIN
        assert result.status == "success"

    @pytest.mark.asyncio
    async def test_log_login_failure(self, service, mock_db):
        """Should log failed login."""
        result = await service.log_login(
            db=mock_db,
            user_id=None,
            success=False,
            details={"email": "test@example.com"},
        )

        assert result is not None
        assert result.action == AuditAction.LOGIN_FAILED
        assert result.status == "failure"

    @pytest.mark.asyncio
    async def test_log_export(self, service, mock_db):
        """Should log export operations."""
        result = await service.log_export(
            db=mock_db,
            user_id=1,
            resource_type="workshop",
            resource_id=50,
            export_format="pdf",
        )

        assert result is not None
        assert result.action == AuditAction.EXPORT
        assert result.details == {"format": "pdf"}

    @pytest.mark.asyncio
    async def test_log_ai_operation(self, service, mock_db):
        """Should log AI operations."""
        result = await service.log_ai_operation(
            db=mock_db,
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
    async def test_log_with_request(self, service, mock_db):
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
            db=mock_db,
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
    async def test_log_disabled(self, mock_db):
        """Should not log when disabled."""
        with patch.object(AuditService, "enabled", False):
            service = AuditService()
            result = await service.log_create(
                db=mock_db,
                user_id=1,
                resource_type="test",
                resource_id=1,
            )
            assert result is None
            mock_db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_log_handles_db_error(self, service, mock_db):
        """Should handle database errors gracefully."""
        mock_db.commit = AsyncMock(side_effect=Exception("DB error"))

        # Should not raise, just return None
        result = await service.log_create(
            db=mock_db,
            user_id=1,
            resource_type="test",
            resource_id=1,
        )

        assert result is None
        mock_db.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_extracts_ip_from_client(self, service, mock_db):
        """Should use client IP when no X-Forwarded-For."""
        mock_request = MagicMock()
        mock_request.headers = {"User-Agent": "Test"}
        mock_request.client = MagicMock()
        mock_request.client.host = "10.0.0.1"
        mock_request.url = MagicMock()
        mock_request.url.path = "/api/test"
        mock_request.method = "GET"

        result = await service.log_read(
            db=mock_db,
            user_id=1,
            resource_type="test",
            request=mock_request,
        )

        assert result.ip_address == "10.0.0.1"


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
