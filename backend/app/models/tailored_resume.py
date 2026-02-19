"""
TailoredResume model for AI-tailored resume outputs.

Supports both user-created JobDescription and system-wide JobListing
as job sources, with style settings and section ordering.
"""

from typing import Any

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Float,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func

from app.db.session import Base


# Default section order for new tailored resumes
DEFAULT_SECTION_ORDER = ["summary", "experience", "skills", "education", "projects"]


class TailoredResume(Base):
    """
    AI-generated tailored resume linking a base resume to a job.

    Supports two job sources:
    - job_id: User-created JobDescription (manual entry)
    - job_listing_id: System-wide JobListing (from Apify/n8n)

    Exactly one of these must be set (enforced by CHECK constraint).
    """

    __tablename__ = "tailored_resumes"

    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)

    # Job source - exactly one must be set
    job_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=True)
    job_listing_id = Column(Integer, ForeignKey("job_listings.id"), nullable=True)

    # Content
    tailored_content = Column(Text, nullable=False)  # Final tailored resume text
    suggestions = Column(JSON, nullable=True)  # AI suggestions and changes made
    match_score = Column(Float, nullable=True)  # Score indicating match quality

    # Style settings for PDF generation
    style_settings: Mapped[dict[str, Any]] = Column(
        JSONB,
        default=dict,
        nullable=False,
        server_default="{}",
    )

    # Section ordering (drag-drop support)
    section_order: Mapped[list[str]] = Column(
        ARRAY(String),
        default=lambda: DEFAULT_SECTION_ORDER.copy(),
        nullable=False,
    )

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    original_resume = relationship("Resume", back_populates="tailored_resumes")
    job_description = relationship("JobDescription", back_populates="tailored_resumes")
    job_listing = relationship("JobListing", back_populates="tailored_resumes")

    __table_args__ = (
        # Ensure exactly one job source is set
        CheckConstraint(
            "(job_id IS NOT NULL AND job_listing_id IS NULL) OR "
            "(job_id IS NULL AND job_listing_id IS NOT NULL)",
            name="ck_tailored_resume_one_job_source",
        ),
    )

    def __repr__(self) -> str:
        job_source = f"job_id={self.job_id}" if self.job_id else f"job_listing_id={self.job_listing_id}"
        return f"<TailoredResume {self.id}: resume={self.resume_id} {job_source}>"

    @property
    def job_source_type(self) -> str:
        """Return which type of job source is being used."""
        return "job_description" if self.job_id else "job_listing"

    def get_style_setting(self, key: str, default: Any = None) -> Any:
        """Get a specific style setting with optional default."""
        return self.style_settings.get(key, default) if self.style_settings else default

    def update_style_settings(self, **kwargs: Any) -> None:
        """Update style settings (merge with existing)."""
        if self.style_settings is None:
            self.style_settings = {}
        self.style_settings.update(kwargs)
