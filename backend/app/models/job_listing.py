"""
JobListing model for system-wide job listings.

Job listings are populated from external sources (Apify/n8n) and are
visible to all authenticated users. Unlike JobDescription, these are
not user-owned but system-wide resources.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class JobListing(Base):
    """
    System-wide job listing from external sources (LinkedIn, Indeed, etc.).

    These listings are ingested via webhook from n8n/Apify and are shared
    across all users. Users interact with listings through UserJobInteraction.
    """

    __tablename__ = "job_listings"

    id = Column(Integer, primary_key=True, index=True)
    external_job_id = Column(String(255), unique=True, index=True, nullable=False)

    # Core job fields
    job_title = Column(String(500), nullable=False)
    company_name = Column(String(255), nullable=False)
    company_url = Column(String(2000), nullable=True)
    company_logo = Column(String(2000), nullable=True)
    location = Column(String(500), nullable=True)
    city = Column(String(255), nullable=True)
    state = Column(String(255), nullable=True)
    country = Column(String(255), nullable=True)
    is_remote = Column(Boolean, default=False, nullable=False)
    seniority = Column(String(100), nullable=True)  # Entry, Mid, Senior, Lead
    job_function = Column(String(255), nullable=True)  # Engineering, Design, etc.
    industry = Column(String(255), nullable=True)
    job_description = Column(Text, nullable=False)
    job_url = Column(String(2000), nullable=False)
    job_url_direct = Column(String(2000), nullable=True)
    job_type = Column(JSONB, nullable=True)  # e.g. ["Full-time", "Contract"]
    emails = Column(JSONB, nullable=True)  # e.g. ["careers@company.com"]
    easy_apply = Column(Boolean, default=False, nullable=False)
    applicants_count = Column(String(50), nullable=True)  # e.g. "25", "100+", "Over 200"

    # Salary information
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    salary_currency = Column(String(10), default="USD")
    salary_period = Column(String(20), nullable=True)  # yearly, hourly

    # Metadata
    date_posted = Column(DateTime(timezone=True), nullable=True)
    scraped_at = Column(DateTime(timezone=True), nullable=True)
    source_platform = Column(String(100), nullable=True)  # linkedin, indeed
    region = Column(String(100), nullable=True)  # e.g. thailand, taiwan, singapore
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user_interactions = relationship(
        "UserJobInteraction",
        back_populates="job_listing",
        cascade="all, delete-orphan",
    )
    tailored_resumes = relationship(
        "TailoredResume",
        back_populates="job_listing",
        cascade="all, delete-orphan",
    )

    # Indexes for filtering
    __table_args__ = (
        Index("ix_job_listings_company", "company_name"),
        Index("ix_job_listings_location", "location"),
        Index("ix_job_listings_seniority", "seniority"),
        Index("ix_job_listings_job_function", "job_function"),
        Index("ix_job_listings_industry", "industry"),
        Index("ix_job_listings_date_posted", "date_posted", postgresql_ops={"date_posted": "DESC"}),
        Index("ix_job_listings_salary", "salary_min", "salary_max"),
        Index("ix_job_listings_active", "is_active"),
        Index("ix_job_listings_country", "country"),
        Index("ix_job_listings_is_remote", "is_remote"),
        Index("ix_job_listings_region", "region"),
        Index("ix_job_listings_easy_apply", "easy_apply"),
    )

    def __repr__(self) -> str:
        return f"<JobListing {self.id}: {self.job_title} at {self.company_name}>"
