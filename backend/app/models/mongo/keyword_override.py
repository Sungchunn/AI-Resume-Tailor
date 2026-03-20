"""MongoDB Pydantic model for KeywordOverride documents.

Stores user's keyword edits for a specific job listing.
These overrides are used in subsequent ATS scoring instead of
re-extracting keywords from the job description.
"""

import hashlib
from datetime import datetime
from typing import Literal

from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer

from app.models.mongo.resume import PyObjectId


# Valid importance levels (4-tier system)
KeywordImportanceLevel = Literal[
    "required",
    "strongly_preferred",
    "preferred",
    "nice_to_have",
]

# Valid source section types
SourceSectionType = Literal[
    "requirements",
    "qualifications",
    "nice_to_have",
    "responsibilities",
    "about",
    "benefits",
    "other",
]


class KeywordEntry(BaseModel):
    """A single keyword with metadata."""

    keyword: str
    importance: KeywordImportanceLevel
    context: str | None = None  # The sentence from JD where keyword appears
    source_section: SourceSectionType | None = None  # Which section it came from
    frequency: int = 1  # Count of occurrences in JD
    user_added: bool = False  # True if user manually added this keyword
    user_modified: bool = False  # True if user changed the importance


class KeywordOverrideDocument(BaseModel):
    """MongoDB document for user's keyword edits.

    Stores both the original AI-extracted keywords and the user's
    edited version. The edited keywords are used for subsequent
    ATS scoring instead of re-extracting.
    """

    id: PyObjectId | None = Field(default=None, alias="_id")

    # User reference (FK to Postgres users.id)
    user_id: int

    # Job reference - one of these must be set
    job_listing_id: int | None = None  # FK to job_listings (scraped jobs)
    job_id: int | None = None  # FK to job_descriptions (user-created jobs)

    # Hash of job description content for cache invalidation
    # If the JD changes, we should re-extract keywords
    job_content_hash: str

    # Original AI-extracted keywords (immutable reference)
    original_keywords: list[KeywordEntry] = Field(default_factory=list)

    # User's edited keyword list
    keywords: list[KeywordEntry] = Field(default_factory=list)

    # Review status
    reviewed: bool = False
    reviewed_at: datetime | None = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    @field_serializer("id")
    def serialize_id(self, v: PyObjectId | None) -> str | None:
        return str(v) if v else None


class KeywordOverrideCreate(BaseModel):
    """Schema for creating a new keyword override."""

    user_id: int
    job_listing_id: int | None = None
    job_id: int | None = None
    job_content_hash: str
    original_keywords: list[KeywordEntry]
    keywords: list[KeywordEntry]
    reviewed: bool = False


class KeywordOverrideUpdate(BaseModel):
    """Schema for updating an existing keyword override."""

    keywords: list[KeywordEntry] | None = None
    reviewed: bool | None = None


def compute_job_content_hash(job_description: str) -> str:
    """Compute a hash of the job description content.

    Used for cache invalidation - if the JD changes, we should
    prompt the user to re-review keywords.

    Args:
        job_description: The raw job description text

    Returns:
        SHA256 hash of the normalized content
    """
    # Normalize: lowercase, strip whitespace, remove extra spaces
    normalized = " ".join(job_description.lower().split())
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]
