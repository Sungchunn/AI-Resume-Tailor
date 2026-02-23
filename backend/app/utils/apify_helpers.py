"""
Helper functions for transforming APIFY scraper data.

These utilities handle the conversion from APIFY's camelCase format
to the application's internal snake_case format.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


def parse_job_date(posted_at: datetime | str | None) -> datetime | None:
    """
    Parse date from Apify data.

    Handles both datetime objects and string formats:
    - ISO format with timezone: "2026-02-20T12:00:00Z"
    - Date-only format: "2026-02-20"

    Args:
        posted_at: Date value from Apify, can be datetime or string

    Returns:
        Parsed datetime object or None if parsing fails
    """
    if posted_at is None:
        return None

    if isinstance(posted_at, datetime):
        return posted_at

    if isinstance(posted_at, str):
        try:
            # Handle date-only format like "2026-02-20"
            if "T" not in posted_at:
                return datetime.strptime(posted_at, "%Y-%m-%d")
            # Handle ISO format with timezone
            return datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
        except ValueError:
            logger.warning(f"Could not parse postedAt: {posted_at}")
            return None

    return None


def extract_company_address(
    company_address: dict[str, Any] | None,
) -> tuple[str | None, str | None]:
    """
    Extract locality and country from nested company address object.

    Args:
        company_address: Nested address object from Apify data

    Returns:
        Tuple of (address_locality, address_country)
    """
    if not company_address:
        return None, None

    address_locality = company_address.get("addressLocality")
    address_country = company_address.get("addressCountry")
    return address_locality, address_country


def detect_remote(location: str | None) -> bool:
    """
    Determine if a job is remote based on location string.

    Args:
        location: Location string from job listing

    Returns:
        True if the job appears to be remote
    """
    if location and "remote" in location.lower():
        return True
    return False


def convert_employment_type(employment_type: str | None) -> list[str] | None:
    """
    Convert employmentType string to job_type list.

    Args:
        employment_type: Single employment type string from Apify

    Returns:
        List containing the employment type, or None if not provided
    """
    if employment_type:
        return [employment_type]
    return None
