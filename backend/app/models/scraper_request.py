"""
ScraperRequest model for user-submitted job scraping requests.

Allows users to submit LinkedIn job URLs for admin review.
Admins can approve (creating presets) or reject with feedback.
"""

import enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Enum as SQLAlchemyEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class RequestStatus(str, enum.Enum):
    """Status of a scraper request."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ScraperRequest(Base):
    """
    User-submitted request for job scraping.

    Users submit LinkedIn job search URLs for admin review.
    Admins can approve (which creates a scraper preset) or reject
    with feedback explaining why.
    """

    __tablename__ = "scraper_requests"

    id = Column(Integer, primary_key=True, index=True)

    # Requester
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Request data
    url = Column(Text, nullable=False)
    name = Column(String(100), nullable=True)  # User-suggested preset name
    reason = Column(Text, nullable=True)  # Why they want these jobs

    # Status
    status = Column(
        SQLAlchemyEnum(RequestStatus),
        nullable=False,
        default=RequestStatus.PENDING,
        index=True,
    )
    admin_notes = Column(Text, nullable=True)  # Rejection reason or approval notes

    # Admin review
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Link to created preset (if approved)
    preset_id = Column(Integer, ForeignKey("scraper_presets.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    reviewer = relationship("User", foreign_keys=[reviewed_by], lazy="selectin")
    preset = relationship("ScraperPreset", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ScraperRequest {self.id}: {self.status.value} by user {self.user_id}>"
