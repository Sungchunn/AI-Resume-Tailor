"""
Phase 1 Unit Tests: UUID Column Definitions.

Tests that verify UUID columns are properly defined on models
with correct configuration for defaults and uniqueness.

Note: SQLAlchemy column defaults are only called during ORM operations.
These tests verify the column definitions are correct, while integration
tests (test_uuid_migration.py) verify runtime behavior.
"""

import pytest
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID

from app.models.job import JobDescription
from app.models.resume_build import ResumeBuild
from app.models.user_job_interaction import UserJobInteraction


class TestUUIDColumnDefinition:
    """Test UUID column is properly defined on models."""

    def test_job_description_has_public_id_column(self):
        """JobDescription model should have public_id column."""
        mapper = inspect(JobDescription)
        assert "public_id" in mapper.columns
        column = mapper.columns["public_id"]
        assert column.nullable is False
        assert column.unique is True
        assert column.index is True

    def test_resume_build_has_public_id_column(self):
        """ResumeBuild model should have public_id column."""
        mapper = inspect(ResumeBuild)
        assert "public_id" in mapper.columns
        column = mapper.columns["public_id"]
        assert column.nullable is False
        assert column.unique is True
        assert column.index is True

    def test_user_job_interaction_has_public_id_column(self):
        """UserJobInteraction model should have public_id column."""
        mapper = inspect(UserJobInteraction)
        assert "public_id" in mapper.columns
        column = mapper.columns["public_id"]
        assert column.nullable is False
        assert column.unique is True
        assert column.index is True


class TestUUIDColumnDefaults:
    """Test UUID columns have proper default configuration."""

    def test_job_description_has_python_default(self):
        """JobDescription.public_id should have a Python default."""
        mapper = inspect(JobDescription)
        column = mapper.columns["public_id"]
        # SQLAlchemy stores callable defaults in column.default.arg
        assert column.default is not None
        assert callable(column.default.arg)

    def test_job_description_has_server_default(self):
        """JobDescription.public_id should have a server_default for database-level generation."""
        mapper = inspect(JobDescription)
        column = mapper.columns["public_id"]
        assert column.server_default is not None

    def test_resume_build_has_python_default(self):
        """ResumeBuild.public_id should have a Python default."""
        mapper = inspect(ResumeBuild)
        column = mapper.columns["public_id"]
        assert column.default is not None
        assert callable(column.default.arg)

    def test_resume_build_has_server_default(self):
        """ResumeBuild.public_id should have a server_default."""
        mapper = inspect(ResumeBuild)
        column = mapper.columns["public_id"]
        assert column.server_default is not None


class TestUUIDColumnType:
    """Test UUID columns use the correct PostgreSQL type."""

    def test_job_description_uuid_type(self):
        """JobDescription.public_id should be PostgreSQL UUID type."""
        mapper = inspect(JobDescription)
        column = mapper.columns["public_id"]
        assert isinstance(column.type, PostgresUUID)
        assert column.type.as_uuid is True

    def test_resume_build_uuid_type(self):
        """ResumeBuild.public_id should be PostgreSQL UUID type."""
        mapper = inspect(ResumeBuild)
        column = mapper.columns["public_id"]
        assert isinstance(column.type, PostgresUUID)
        assert column.type.as_uuid is True

    def test_user_job_interaction_uuid_type(self):
        """UserJobInteraction.public_id should be PostgreSQL UUID type."""
        mapper = inspect(UserJobInteraction)
        column = mapper.columns["public_id"]
        assert isinstance(column.type, PostgresUUID)
        assert column.type.as_uuid is True


class TestOwnershipColumns:
    """Test models have ownership columns for RLS policies."""

    def test_job_description_has_owner_id(self):
        """JobDescription should have owner_id for RLS."""
        mapper = inspect(JobDescription)
        assert "owner_id" in mapper.columns
        column = mapper.columns["owner_id"]
        assert column.nullable is False

    def test_resume_build_has_user_id(self):
        """ResumeBuild should have user_id for RLS."""
        mapper = inspect(ResumeBuild)
        assert "user_id" in mapper.columns
        column = mapper.columns["user_id"]
        assert column.nullable is False

    def test_user_job_interaction_has_user_id(self):
        """UserJobInteraction should have user_id for RLS."""
        mapper = inspect(UserJobInteraction)
        assert "user_id" in mapper.columns
        column = mapper.columns["user_id"]
        assert column.nullable is False
