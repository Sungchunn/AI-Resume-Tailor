"""Tests for the File Storage Service."""

import io
import pytest
from unittest.mock import MagicMock, patch, PropertyMock

from minio.error import S3Error

from app.services.storage.file_storage import (
    FileStorageService,
    FileStorageError,
    FileUploadError,
    StorageFileNotFoundError,
    get_storage_service,
)


class TestFileStorageService:
    """Test FileStorageService functionality."""

    @pytest.fixture
    def mock_minio_client(self):
        """Create a mock MinIO client."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = True
            mock_class.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def service(self, mock_minio_client) -> FileStorageService:
        """Create FileStorageService with mocked MinIO client."""
        return FileStorageService(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            bucket="test-bucket",
            secure=False,
        )

    def test_init_creates_bucket_if_not_exists(self):
        """Should create bucket if it doesn't exist."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = False
            mock_class.return_value = mock_client

            FileStorageService(
                endpoint="localhost:9000",
                access_key="minioadmin",
                secret_key="minioadmin",
                bucket="new-bucket",
                secure=False,
            )

            mock_client.make_bucket.assert_called_once_with("new-bucket")

    def test_init_skips_bucket_creation_if_exists(self, mock_minio_client):
        """Should not create bucket if it already exists."""
        mock_minio_client.bucket_exists.return_value = True

        FileStorageService(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            bucket="existing-bucket",
            secure=False,
        )

        mock_minio_client.make_bucket.assert_not_called()

    def test_init_handles_bucket_error(self):
        """Should raise FileStorageError if bucket creation fails."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.side_effect = S3Error(
                code="AccessDenied",
                message="Access Denied",
                resource="test-bucket",
                request_id="123",
                host_id="456",
                response=None,
            )
            mock_class.return_value = mock_client

            with pytest.raises(FileStorageError, match="Failed to initialize storage"):
                FileStorageService(
                    endpoint="localhost:9000",
                    access_key="minioadmin",
                    secret_key="minioadmin",
                    bucket="test-bucket",
                    secure=False,
                )


class TestGenerateFileKey:
    """Test file key generation."""

    @pytest.fixture
    def service(self):
        """Create service with mocked client."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = True
            mock_class.return_value = mock_client
            return FileStorageService(
                endpoint="localhost:9000",
                access_key="minioadmin",
                secret_key="minioadmin",
                bucket="test-bucket",
                secure=False,
            )

    def test_generate_file_key_format(self, service):
        """Should generate key in correct format."""
        key = service.generate_file_key(
            user_id=123,
            original_filename="resume.pdf",
            file_type="pdf",
        )

        assert key.startswith("users/123/resumes/")
        assert key.endswith("_resume.pdf")
        # Should have 8-char UUID between path and filename
        parts = key.split("/")
        assert len(parts) == 4
        filename_part = parts[-1]
        assert len(filename_part.split("_")[0]) == 8

    def test_generate_file_key_sanitizes_filename(self, service):
        """Should sanitize path separators in filename to prevent path traversal."""
        key = service.generate_file_key(
            user_id=1,
            original_filename="path/to/resume.pdf",
            file_type="pdf",
        )

        # Path separators should be replaced with underscores
        # The filename portion should not contain "/" or "\"
        filename_part = key.split("resumes/")[1]
        assert "/" not in filename_part.split("_", 1)[1]  # After the UUID prefix
        assert "\\" not in filename_part

    def test_generate_file_key_unique(self, service):
        """Should generate unique keys for same input."""
        key1 = service.generate_file_key(1, "resume.pdf", "pdf")
        key2 = service.generate_file_key(1, "resume.pdf", "pdf")

        assert key1 != key2


class TestUpload:
    """Test file upload functionality."""

    @pytest.fixture
    def mock_minio_client(self):
        """Create a mock MinIO client."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = True
            mock_class.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def service(self, mock_minio_client) -> FileStorageService:
        """Create FileStorageService with mocked MinIO client."""
        return FileStorageService(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            bucket="test-bucket",
            secure=False,
        )

    @pytest.mark.asyncio
    async def test_upload_bytes(self, service, mock_minio_client):
        """Should upload bytes data successfully."""
        file_data = b"test file content"

        result = await service.upload(
            file_key="users/1/resumes/test.pdf",
            file_data=file_data,
            content_type="application/pdf",
        )

        assert result == "users/1/resumes/test.pdf"
        mock_minio_client.put_object.assert_called_once()
        call_kwargs = mock_minio_client.put_object.call_args
        assert call_kwargs.kwargs["bucket_name"] == "test-bucket"
        assert call_kwargs.kwargs["object_name"] == "users/1/resumes/test.pdf"
        assert call_kwargs.kwargs["length"] == len(file_data)
        assert call_kwargs.kwargs["content_type"] == "application/pdf"

    @pytest.mark.asyncio
    async def test_upload_stream_with_size(self, service, mock_minio_client):
        """Should upload stream when file_size is provided."""
        file_data = io.BytesIO(b"test stream content")

        result = await service.upload(
            file_key="users/1/resumes/test.docx",
            file_data=file_data,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            file_size=19,
        )

        assert result == "users/1/resumes/test.docx"
        mock_minio_client.put_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_stream_without_size_raises(self, service):
        """Should raise error when uploading stream without file_size."""
        file_data = io.BytesIO(b"test content")

        with pytest.raises(FileUploadError, match="file_size required"):
            await service.upload(
                file_key="users/1/resumes/test.pdf",
                file_data=file_data,
                content_type="application/pdf",
            )

    @pytest.mark.asyncio
    async def test_upload_handles_s3_error(self, service, mock_minio_client):
        """Should raise FileUploadError on S3 failure."""
        mock_minio_client.put_object.side_effect = S3Error(
            code="InternalError",
            message="Internal Server Error",
            resource="test.pdf",
            request_id="123",
            host_id="456",
            response=None,
        )

        with pytest.raises(FileUploadError, match="Failed to upload file"):
            await service.upload(
                file_key="users/1/resumes/test.pdf",
                file_data=b"content",
                content_type="application/pdf",
            )


class TestDownload:
    """Test file download functionality."""

    @pytest.fixture
    def mock_minio_client(self):
        """Create a mock MinIO client."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = True
            mock_class.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def service(self, mock_minio_client) -> FileStorageService:
        """Create FileStorageService with mocked MinIO client."""
        return FileStorageService(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            bucket="test-bucket",
            secure=False,
        )

    @pytest.mark.asyncio
    async def test_download_success(self, service, mock_minio_client):
        """Should download file successfully."""
        mock_response = MagicMock()
        mock_response.read.return_value = b"file content"
        mock_minio_client.get_object.return_value = mock_response

        result = await service.download("users/1/resumes/test.pdf")

        assert result == b"file content"
        mock_minio_client.get_object.assert_called_once_with(
            bucket_name="test-bucket",
            object_name="users/1/resumes/test.pdf",
        )
        mock_response.close.assert_called_once()
        mock_response.release_conn.assert_called_once()

    @pytest.mark.asyncio
    async def test_download_file_not_found(self, service, mock_minio_client):
        """Should raise StorageFileNotFoundError when file doesn't exist."""
        error = S3Error(
            code="NoSuchKey",
            message="The specified key does not exist",
            resource="test.pdf",
            request_id="123",
            host_id="456",
            response=None,
        )
        mock_minio_client.get_object.side_effect = error

        with pytest.raises(StorageFileNotFoundError, match="File not found"):
            await service.download("users/1/resumes/nonexistent.pdf")

    @pytest.mark.asyncio
    async def test_download_handles_other_s3_errors(self, service, mock_minio_client):
        """Should raise FileStorageError for other S3 errors."""
        error = S3Error(
            code="InternalError",
            message="Internal error",
            resource="test.pdf",
            request_id="123",
            host_id="456",
            response=None,
        )
        mock_minio_client.get_object.side_effect = error

        with pytest.raises(FileStorageError, match="Failed to download file"):
            await service.download("users/1/resumes/test.pdf")


class TestGetPresignedUrl:
    """Test presigned URL generation."""

    @pytest.fixture
    def mock_minio_client(self):
        """Create a mock MinIO client."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = True
            mock_class.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def service(self, mock_minio_client) -> FileStorageService:
        """Create FileStorageService with mocked MinIO client."""
        return FileStorageService(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            bucket="test-bucket",
            secure=False,
        )

    @pytest.mark.asyncio
    async def test_get_presigned_url_success(self, service, mock_minio_client):
        """Should generate presigned URL successfully."""
        mock_minio_client.presigned_get_object.return_value = (
            "http://localhost:9000/test-bucket/users/1/resumes/test.pdf?signature=abc"
        )

        result = await service.get_presigned_url("users/1/resumes/test.pdf")

        assert "test.pdf" in result
        mock_minio_client.stat_object.assert_called_once()
        mock_minio_client.presigned_get_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_presigned_url_custom_expiry(self, service, mock_minio_client):
        """Should use custom expiry time."""
        mock_minio_client.presigned_get_object.return_value = "http://url"

        await service.get_presigned_url(
            "users/1/resumes/test.pdf",
            expires_seconds=7200,
        )

        call_kwargs = mock_minio_client.presigned_get_object.call_args.kwargs
        assert call_kwargs["expires"].total_seconds() == 7200

    @pytest.mark.asyncio
    async def test_get_presigned_url_file_not_found(self, service, mock_minio_client):
        """Should raise error when file doesn't exist."""
        error = S3Error(
            code="NoSuchKey",
            message="Not found",
            resource="test.pdf",
            request_id="123",
            host_id="456",
            response=None,
        )
        mock_minio_client.stat_object.side_effect = error

        with pytest.raises(StorageFileNotFoundError, match="File not found"):
            await service.get_presigned_url("users/1/resumes/nonexistent.pdf")


class TestDelete:
    """Test file deletion functionality."""

    @pytest.fixture
    def mock_minio_client(self):
        """Create a mock MinIO client."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = True
            mock_class.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def service(self, mock_minio_client) -> FileStorageService:
        """Create FileStorageService with mocked MinIO client."""
        return FileStorageService(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            bucket="test-bucket",
            secure=False,
        )

    @pytest.mark.asyncio
    async def test_delete_success(self, service, mock_minio_client):
        """Should delete file successfully."""
        result = await service.delete("users/1/resumes/test.pdf")

        assert result is True
        mock_minio_client.remove_object.assert_called_once_with(
            bucket_name="test-bucket",
            object_name="users/1/resumes/test.pdf",
        )

    @pytest.mark.asyncio
    async def test_delete_handles_error(self, service, mock_minio_client):
        """Should raise FileStorageError on failure."""
        mock_minio_client.remove_object.side_effect = S3Error(
            code="AccessDenied",
            message="Access Denied",
            resource="test.pdf",
            request_id="123",
            host_id="456",
            response=None,
        )

        with pytest.raises(FileStorageError, match="Failed to delete file"):
            await service.delete("users/1/resumes/test.pdf")


class TestExists:
    """Test file existence check."""

    @pytest.fixture
    def mock_minio_client(self):
        """Create a mock MinIO client."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = True
            mock_class.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def service(self, mock_minio_client) -> FileStorageService:
        """Create FileStorageService with mocked MinIO client."""
        return FileStorageService(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin",
            bucket="test-bucket",
            secure=False,
        )

    @pytest.mark.asyncio
    async def test_exists_returns_true(self, service, mock_minio_client):
        """Should return True when file exists."""
        result = await service.exists("users/1/resumes/test.pdf")

        assert result is True
        mock_minio_client.stat_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_exists_returns_false(self, service, mock_minio_client):
        """Should return False when file doesn't exist."""
        mock_minio_client.stat_object.side_effect = S3Error(
            code="NoSuchKey",
            message="Not found",
            resource="test.pdf",
            request_id="123",
            host_id="456",
            response=None,
        )

        result = await service.exists("users/1/resumes/nonexistent.pdf")

        assert result is False


class TestGetStorageServiceSingleton:
    """Test singleton pattern for get_storage_service."""

    def test_returns_same_instance(self):
        """Should return the same instance on multiple calls."""
        with patch("app.services.storage.file_storage.Minio") as mock_class:
            mock_client = MagicMock()
            mock_client.bucket_exists.return_value = True
            mock_class.return_value = mock_client

            # Clear any cached instance
            get_storage_service.cache_clear()

            instance1 = get_storage_service()
            instance2 = get_storage_service()

            assert instance1 is instance2

            # Clean up
            get_storage_service.cache_clear()
