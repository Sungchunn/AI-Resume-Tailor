"""
Custom Pydantic validators and types.
"""

from typing import Annotated

from pydantic import AfterValidator, HttpUrl


def validate_optional_url(value: str | None) -> str | None:
    """
    Validate URL if present, return None if empty.

    This allows fields to accept either valid URLs or None/empty strings.
    """
    if value is None or value == "":
        return None
    # Pydantic's HttpUrl will validate the URL format
    # We convert back to string for storage
    validated = HttpUrl(value)
    return str(validated)


# Type alias for optional HTTP URLs that validates format when present
OptionalHttpUrl = Annotated[str | None, AfterValidator(validate_optional_url)]
