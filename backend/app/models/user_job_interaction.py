"""
UserJobInteraction model for tracking user interactions with job listings.

Tracks saves, hides, applications, and views for each user-job combination.
"""

from sqlalchemy import (
    Column,
    Integer,
    DateTime,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    Index,
)
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    job_listing_id = Column(
        Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False
    )

    # Interaction states
    is_saved = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    last_viewed_at = Column(DateTime(timezone=True), nullable=True)

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
    )

    def __repr__(self) -> str:
        return f"<UserJobInteraction user={self.user_id} job={self.job_listing_id}>"
