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


def parse_location(
    location: str | None,
    company_address: dict[str, Any] | None = None,
) -> tuple[str | None, str | None, str | None]:
    """
    Parse location string to extract city, state, and country.

    Handles formats like:
    - "Pune, Maharashtra, India"
    - "San Francisco, CA"
    - "London, United Kingdom"
    - "Remote"

    Also uses company address as fallback for country.

    Args:
        location: Location string from job listing
        company_address: Optional company address object with addressCountry

    Returns:
        Tuple of (city, state, country)
    """
    if not location:
        # Try to get country from company address
        if company_address:
            country_code = company_address.get("addressCountry")
            country = _country_code_to_name(country_code)
            return None, None, country
        return None, None, None

    # Handle remote-only locations
    if location.strip().lower() == "remote":
        return None, None, None

    # Split by comma and strip whitespace
    parts = [p.strip() for p in location.split(",")]

    city = None
    state = None
    country = None

    if len(parts) == 1:
        # Single value - could be city or country
        # Check if it's a known country
        if _is_known_country(parts[0]):
            country = parts[0]
        else:
            city = parts[0]
    elif len(parts) == 2:
        # Could be "City, Country" or "City, State"
        city = parts[0]
        if _is_known_country(parts[1]):
            country = parts[1]
        else:
            state = parts[1]
    elif len(parts) >= 3:
        # "City, State, Country" format
        city = parts[0]
        state = parts[1]
        country = parts[-1]  # Last part is typically country

    # Fallback to company address country if we couldn't parse one
    if not country and company_address:
        country_code = company_address.get("addressCountry")
        country = _country_code_to_name(country_code)

    return city, state, country


# Common country codes to full names
_COUNTRY_CODE_MAP = {
    "IN": "India",
    "US": "United States",
    "USA": "United States",
    "UK": "United Kingdom",
    "GB": "United Kingdom",
    "CA": "Canada",
    "AU": "Australia",
    "SG": "Singapore",
    "MY": "Malaysia",
    "TH": "Thailand",
    "DE": "Germany",
    "FR": "France",
    "NL": "Netherlands",
    "JP": "Japan",
    "CN": "China",
    "HK": "Hong Kong",
    "TW": "Taiwan",
    "KR": "South Korea",
    "PH": "Philippines",
    "ID": "Indonesia",
    "VN": "Vietnam",
    "AE": "United Arab Emirates",
    "IL": "Israel",
    "IE": "Ireland",
    "CH": "Switzerland",
    "SE": "Sweden",
    "NO": "Norway",
    "DK": "Denmark",
    "FI": "Finland",
    "PL": "Poland",
    "ES": "Spain",
    "IT": "Italy",
    "PT": "Portugal",
    "BR": "Brazil",
    "MX": "Mexico",
    "AR": "Argentina",
    "CL": "Chile",
    "CO": "Colombia",
    "NZ": "New Zealand",
}

# Known country names for detection
_KNOWN_COUNTRIES = {
    "india",
    "united states",
    "usa",
    "united kingdom",
    "uk",
    "canada",
    "australia",
    "singapore",
    "malaysia",
    "thailand",
    "germany",
    "france",
    "netherlands",
    "japan",
    "china",
    "hong kong",
    "taiwan",
    "south korea",
    "philippines",
    "indonesia",
    "vietnam",
    "united arab emirates",
    "uae",
    "israel",
    "ireland",
    "switzerland",
    "sweden",
    "norway",
    "denmark",
    "finland",
    "poland",
    "spain",
    "italy",
    "portugal",
    "brazil",
    "mexico",
    "argentina",
    "chile",
    "colombia",
    "new zealand",
    "belgium",
    "austria",
    "czech republic",
    "romania",
    "hungary",
    "greece",
    "turkey",
    "russia",
    "ukraine",
    "egypt",
    "south africa",
    "nigeria",
    "kenya",
    "pakistan",
    "bangladesh",
    "sri lanka",
    "nepal",
}


def _country_code_to_name(code: str | None) -> str | None:
    """Convert a country code to its full name."""
    if not code:
        return None
    return _COUNTRY_CODE_MAP.get(code.upper(), code)


def _is_known_country(text: str) -> bool:
    """Check if the text is a known country name."""
    return text.lower() in _KNOWN_COUNTRIES
