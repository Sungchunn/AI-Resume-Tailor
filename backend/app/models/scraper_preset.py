"""
ScraperPreset model for saving LinkedIn URL presets.

Allows admins to save named presets with URL and job count
for scheduled scraping runs.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
)
from sqlalchemy.sql import func

from app.db.session import Base


class ScraperPreset(Base):
    """
    Saved LinkedIn URL preset for scheduled scraping.

    Each preset represents a LinkedIn job search URL that can be
    run on a schedule. Individual presets can be toggled active/inactive.
    """

    __tablename__ = "scraper_presets"

    id = Column(Integer, primary_key=True, index=True)

    # Preset identification
    name = Column(String(100), nullable=False)  # e.g., "Thailand Remote Jobs"

    # Scraper configuration
    url = Column(Text, nullable=False)  # LinkedIn job search URL
    count = Column(Integer, nullable=False, default=100)  # Max jobs to scrape (1-500)

    # Status
    is_active = Column(Boolean, nullable=False, default=True)  # Pause/resume individual presets

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        status = "active" if self.is_active else "inactive"
        return f"<ScraperPreset {self.id}: {self.name} ({status})>"
