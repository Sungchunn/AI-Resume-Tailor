"""
ID Resolution Utilities for UUID/Integer Dual-Lookup Support.

During the security hardening migration (Phase 2), the API accepts both:
- UUID format (preferred): 550e8400-e29b-41d4-a716-446655440000
- Integer format (deprecated): 123

This module provides utilities to parse and resolve resource IDs in either format.
Integer ID usage is logged for migration tracking and will be removed in a future version.
"""

import logging
from uuid import UUID

from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("migration.uuid")


class IDResolutionError(Exception):
    """Raised when a resource ID cannot be resolved or is not authorized."""

    pass


def parse_resource_id(id_string: str) -> UUID | int:
    """
    Parse an ID string and return UUID or int.

    UUID format: 8-4-4-4-12 hex digits (e.g., 550e8400-e29b-41d4-a716-446655440000)
    Integer format: positive numeric string (e.g., 123)

    Args:
        id_string: The ID string to parse

    Returns:
        UUID if valid UUID format, int if valid positive integer

    Raises:
        ValueError: If neither format is valid or integer is non-positive
    """
    # Try UUID first (more specific format)
    try:
        return UUID(id_string)
    except ValueError:
        pass

    # Try integer
    try:
        parsed_int = int(id_string)
        if parsed_int <= 0:
            raise ValueError(f"Invalid ID format: {id_string}. Integer IDs must be positive.")
        return parsed_int
    except ValueError:
        raise ValueError(f"Invalid ID format: {id_string}. Expected UUID or positive integer.")


def add_deprecation_headers(response: Response, resource_type: str) -> None:
    """
    Add deprecation headers to response when integer IDs are used.

    Args:
        response: FastAPI Response object to add headers to
        resource_type: Name of the resource (e.g., "job", "resume_build")
    """
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "2026-07-01"
    response.headers["Link"] = f'</api/docs#uuid-migration>; rel="deprecation"'
    response.headers["X-Deprecation-Notice"] = (
        f"Integer IDs for {resource_type} are deprecated. Please migrate to UUID format."
    )


async def resolve_job_id(
    db: AsyncSession,
    id_string: str,
    owner_id: int,
    *,
    crud,  # JobCRUD instance
    log_legacy: bool = True,
    endpoint: str = "/api/jobs/{id}",
) -> "JobDescription":
    """
    Resolve job ID (UUID or int) to JobDescription with ownership check.

    Supports both UUID (preferred) and integer (deprecated) formats.
    When an integer ID is used, a warning is logged for migration tracking.

    Args:
        db: Database session
        id_string: UUID or integer ID as string
        owner_id: Expected owner ID for authorization
        crud: JobCRUD instance
        log_legacy: Whether to log when integer IDs are used
        endpoint: API endpoint for logging context (default: /api/jobs/{id})

    Returns:
        JobDescription if found and authorized

    Raises:
        IDResolutionError: If not found or not authorized
    """
    from app.models.job import JobDescription

    parsed_id = parse_resource_id(id_string)

    if isinstance(parsed_id, UUID):
        # UUID path - preferred
        job = await crud.get_by_public_id_and_owner(
            db, public_id=parsed_id, owner_id=owner_id
        )
    else:
        # Integer ID - legacy path
        if log_legacy:
            logger.warning(
                "Legacy integer ID used for job",
                extra={
                    "resource": "job",
                    "int_id": parsed_id,
                    "user_id": owner_id,
                    "endpoint": endpoint,
                },
            )
        job = await crud.get(db, id=parsed_id)
        if job and job.owner_id != owner_id:
            job = None  # Not authorized

    if not job:
        raise IDResolutionError("Job not found or not authorized")

    return job


async def resolve_resume_build_id(
    db: AsyncSession,
    id_string: str,
    user_id: int,
    *,
    repository,  # ResumeBuildRepository instance
    log_legacy: bool = True,
) -> "ResumeBuild":
    """
    Resolve resume build ID (UUID or int) to ResumeBuild model with ownership check.

    Supports both UUID (preferred) and integer (deprecated) formats.
    When an integer ID is used, a warning is logged for migration tracking.

    Args:
        db: Database session
        id_string: UUID or integer ID as string
        user_id: Expected user ID for authorization
        repository: ResumeBuildRepository instance
        log_legacy: Whether to log when integer IDs are used

    Returns:
        ResumeBuild model if found and authorized

    Raises:
        IDResolutionError: If not found or not authorized
    """
    from app.models.resume_build import ResumeBuild

    parsed_id = parse_resource_id(id_string)

    if isinstance(parsed_id, UUID):
        # UUID path - preferred
        resume_build = await repository.get_model_by_public_id(
            db, public_id=parsed_id, user_id=user_id
        )
    else:
        # Integer ID - legacy path
        if log_legacy:
            logger.warning(
                "Legacy integer ID used for resume_build",
                extra={
                    "resource": "resume_build",
                    "int_id": parsed_id,
                    "user_id": user_id,
                    "endpoint": "/api/resume-builds/{id}",
                },
            )
        resume_build = await repository.get_model(
            db, resume_build_id=parsed_id, user_id=user_id
        )

    if not resume_build:
        raise IDResolutionError("Resume build not found or not authorized")

    return resume_build


def is_uuid_format(id_string: str) -> bool:
    """
    Check if a string is in valid UUID format.

    Args:
        id_string: The string to check

    Returns:
        True if valid UUID format, False otherwise
    """
    try:
        UUID(id_string)
        return True
    except ValueError:
        return False
