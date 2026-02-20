"""
ScraperRun model for tracking scraper execution history.

Provides an audit trail of all scraper runs including timing,
success/failure status, and job counts per region.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Float,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.session import Base


class ScraperRun(Base):
    """
    Audit trail for scraper runs.

    Tracks each execution of the LinkedIn job scraper including
    regional breakdowns and error details.
    """

    __tablename__ = "scraper_runs"

    id = Column(Integer, primary_key=True, index=True)

    # Run identification
    run_type = Column(String(50), nullable=False, default="scheduled")  # scheduled, manual
    batch_id = Column(String(100), nullable=True)  # For grouping related runs

    # Overall status
    status = Column(String(20), nullable=False)  # success, partial, error, timeout

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Float, nullable=True)

    # Aggregate counts
    total_jobs_found = Column(Integer, default=0, nullable=False)
    total_jobs_created = Column(Integer, default=0, nullable=False)
    total_jobs_updated = Column(Integer, default=0, nullable=False)
    total_errors = Column(Integer, default=0, nullable=False)

    # Regional breakdown (JSONB array of ScraperRunResult)
    region_results = Column(JSONB, nullable=True)

    # Error details (JSONB array)
    error_details = Column(JSONB, nullable=True)

    # Metadata
    triggered_by = Column(String(100), nullable=True)  # scheduler, user_id, api
    config_snapshot = Column(JSONB, nullable=True)  # Snapshot of configs used
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Indexes for querying run history
    __table_args__ = (
        Index("ix_scraper_runs_status", "status"),
        Index("ix_scraper_runs_started_at", "started_at", postgresql_ops={"started_at": "DESC"}),
        Index("ix_scraper_runs_run_type", "run_type"),
    )

    def __repr__(self) -> str:
        return f"<ScraperRun {self.id}: {self.status} at {self.started_at}>"
