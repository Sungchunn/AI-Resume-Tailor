"""
File storage service with S3-compatible backend (MinIO for dev, S3 for prod).

Provides abstraction for storing and retrieving original resume files.
"""

import io
import logging
import uuid
from functools import lru_cache
from typing import BinaryIO

from minio import Minio
from minio.error import S3Error

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class FileStorageError(Exception):
    """Base exception for file storage errors."""


class StorageFileNotFoundError(FileStorageError):
    """Raised when a file is not found in storage."""


class FileUploadError(FileStorageError):
    """Raised when file upload fails."""


class FileStorageService:
    """
    S3-compatible file storage service.

    Uses MinIO in development, can be configured for AWS S3 in production.
    """

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool = False,
    ):
        self.bucket = bucket
        self.client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self) -> None:
        """Create the bucket if it doesn't exist."""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
        except S3Error as e:
            logger.error(f"Failed to ensure bucket exists: {e}")
            raise FileStorageError(f"Failed to initialize storage: {e}")

    def generate_file_key(
        self,
        user_id: int,
        original_filename: str,
        file_type: str,
    ) -> str:
        """
        Generate a unique file key for storage.

        Format: users/{user_id}/resumes/{uuid}_{original_filename}
        """
        unique_id = uuid.uuid4().hex[:8]
        safe_filename = original_filename.replace("/", "_").replace("\\", "_")
        return f"users/{user_id}/resumes/{unique_id}_{safe_filename}"

    async def upload(
        self,
        file_key: str,
        file_data: BinaryIO | bytes,
        content_type: str,
        file_size: int | None = None,
    ) -> str:
        """
        Upload a file to storage.

        Args:
            file_key: The storage path/key for the file
            file_data: File content as bytes or file-like object
            content_type: MIME type of the file
            file_size: Size of the file in bytes (required if file_data is BinaryIO)

        Returns:
            The file key for later retrieval

        Raises:
            FileUploadError: If upload fails
        """
        try:
            if isinstance(file_data, bytes):
                data = io.BytesIO(file_data)
                size = len(file_data)
            else:
                data = file_data
                if file_size is None:
                    raise FileUploadError("file_size required for stream uploads")
                size = file_size

            self.client.put_object(
                bucket_name=self.bucket,
                object_name=file_key,
                data=data,
                length=size,
                content_type=content_type,
            )
            logger.info(f"Uploaded file: {file_key}")
            return file_key
        except S3Error as e:
            logger.error(f"Failed to upload file {file_key}: {e}")
            raise FileUploadError(f"Failed to upload file: {e}")

    async def download(self, file_key: str) -> bytes:
        """
        Download a file from storage.

        Args:
            file_key: The storage path/key for the file

        Returns:
            File content as bytes

        Raises:
            StorageFileNotFoundError: If file doesn't exist
            FileStorageError: If download fails
        """
        try:
            response = self.client.get_object(
                bucket_name=self.bucket,
                object_name=file_key,
            )
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            if e.code == "NoSuchKey":
                raise StorageFileNotFoundError(f"File not found: {file_key}")
            logger.error(f"Failed to download file {file_key}: {e}")
            raise FileStorageError(f"Failed to download file: {e}")

    async def get_presigned_url(
        self,
        file_key: str,
        expires_seconds: int = 3600,
    ) -> str:
        """
        Generate a presigned URL for direct file access.

        Args:
            file_key: The storage path/key for the file
            expires_seconds: URL expiration time in seconds (default 1 hour)

        Returns:
            Presigned URL for direct download

        Raises:
            StorageFileNotFoundError: If file doesn't exist
            FileStorageError: If URL generation fails
        """
        from datetime import timedelta

        try:
            # Check if file exists first
            self.client.stat_object(self.bucket, file_key)

            url = self.client.presigned_get_object(
                bucket_name=self.bucket,
                object_name=file_key,
                expires=timedelta(seconds=expires_seconds),
            )
            return url
        except S3Error as e:
            if e.code == "NoSuchKey":
                raise StorageFileNotFoundError(f"File not found: {file_key}")
            logger.error(f"Failed to generate presigned URL for {file_key}: {e}")
            raise FileStorageError(f"Failed to generate presigned URL: {e}")

    async def delete(self, file_key: str) -> bool:
        """
        Delete a file from storage.

        Args:
            file_key: The storage path/key for the file

        Returns:
            True if deleted successfully

        Raises:
            FileStorageError: If deletion fails
        """
        try:
            self.client.remove_object(
                bucket_name=self.bucket,
                object_name=file_key,
            )
            logger.info(f"Deleted file: {file_key}")
            return True
        except S3Error as e:
            logger.error(f"Failed to delete file {file_key}: {e}")
            raise FileStorageError(f"Failed to delete file: {e}")

    async def exists(self, file_key: str) -> bool:
        """
        Check if a file exists in storage.

        Args:
            file_key: The storage path/key for the file

        Returns:
            True if file exists, False otherwise
        """
        try:
            self.client.stat_object(self.bucket, file_key)
            return True
        except S3Error:
            return False


@lru_cache
def get_storage_service() -> FileStorageService:
    """Get the singleton file storage service instance."""
    settings = get_settings()
    return FileStorageService(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        bucket=settings.minio_bucket,
        secure=settings.minio_secure,
    )
