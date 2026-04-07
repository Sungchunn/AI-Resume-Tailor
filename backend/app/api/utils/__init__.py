"""API utilities for request handling and ID resolution."""

from app.api.utils.id_resolution import (
    IDResolutionError,
    add_deprecation_headers,
    is_uuid_format,
    parse_resource_id,
    resolve_job_id,
    resolve_resume_build_id,
)

__all__ = [
    "IDResolutionError",
    "add_deprecation_headers",
    "is_uuid_format",
    "parse_resource_id",
    "resolve_job_id",
    "resolve_resume_build_id",
]
