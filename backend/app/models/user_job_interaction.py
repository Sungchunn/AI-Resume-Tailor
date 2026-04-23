"""
UserJobInteraction model for tracking user interactions with job listings.

Tracks saves, hides, applications, and views for each user-job combination.
"""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class UserJobInteraction(Base):
    """
    Tracks user interactions with system-wide job listings.

    Each user can have at most one interaction record per job listing,
    tracking their save/hide/applied status and view history.
    """

    __tablename__ = "user_job_interactions"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(
        UUID(as_uuid=True),
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        unique=True,
        nullable=False,
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    job_listing_id = Column(
        Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False
    )

    # Interaction states
    is_saved = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    last_viewed_at = Column(DateTime(timezone=True), nullable=True)

    # Kanban board fields
    # Application status: "applied", "interview", "accepted", "rejected", "ghosted"
    application_status = Column(String(20), nullable=True, default=None)
    # When status last changed (for notification system)
    status_changed_at = Column(DateTime(timezone=True), nullable=True)
    # Position within column for drag ordering
    column_position = Column(Integer, nullable=True, default=0)

    # Job-fit pre-scoring
    fit_score_raw = Column(Integer, nullable=True)
    scored_resume_hash = Column(String(64), nullable=True)
    # v4 transparency: semantic/keyword sub-scores, matched/missing keywords,
    # required-skill state, and cap flag. Same shape for v3 fallback (with
    # version=3, semantic_sub=None).
    fit_score_breakdown = Column(JSONB, nullable=True)
    # Denormalized from breakdown for index-backed "Hide capped scores" filter.
    fit_score_is_capped = Column(Boolean, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="job_interactions")
    job_listing = relationship("JobListing", back_populates="user_interactions")

    __table_args__ = (
        UniqueConstraint("user_id", "job_listing_id", name="uq_user_job_interaction"),
        Index("ix_user_job_interactions_user", "user_id"),
        Index("ix_user_job_interactions_job", "job_listing_id"),
        Index("ix_user_job_interactions_saved", "user_id", "is_saved"),
        Index("ix_user_job_interactions_hidden", "user_id", "is_hidden"),
        Index("ix_user_job_interactions_status", "user_id", "application_status"),
        # Partial indexes created via migration (CONCURRENTLY, not declarative):
        # - idx_uji_fit_score (20260420_0001): (user_id, fit_score_raw DESC) WHERE fit_score_raw IS NOT NULL
        # - idx_uji_fit_not_capped (20260424_0001): (user_id, fit_score_raw DESC) WHERE fit_score_raw IS NOT NULL AND fit_score_is_capped IS NOT TRUE
    )

    def __repr__(self) -> str:
        return f"<UserJobInteraction user={self.user_id} job={self.job_listing_id}>"
