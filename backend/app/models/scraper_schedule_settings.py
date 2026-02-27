"""
ScraperScheduleSettings model for global schedule configuration.

Singleton model (always id=1) that stores the global schedule
settings for automated scraper runs.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
)
from sqlalchemy.sql import func

from app.db.session import Base


class ScraperScheduleSettings(Base):
    """
    Global schedule settings for automated scraper runs.

    This is a singleton model - there should only ever be one row (id=1).
    Controls when the scheduler runs all active presets.
    """

    __tablename__ = "scraper_schedule_settings"

    id = Column(Integer, primary_key=True, default=1)

    # Global on/off toggle
    is_enabled = Column(Boolean, nullable=False, default=False)

    # Schedule configuration
    schedule_type = Column(String(20), nullable=False, default="daily")  # "daily" | "weekly"
    schedule_hour = Column(Integer, nullable=False, default=2)  # 0-23 UTC
    schedule_minute = Column(Integer, nullable=False, default=0)  # 0-59
    schedule_day_of_week = Column(Integer, nullable=True)  # 0-6 (Mon=0), only for weekly
    schedule_timezone = Column(String(50), nullable=False, default="Asia/Bangkok")

    # Tracking
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        status = "enabled" if self.is_enabled else "disabled"
        return f"<ScraperScheduleSettings {self.schedule_type} at {self.schedule_hour:02d}:{self.schedule_minute:02d} {self.schedule_timezone} ({status})>"
