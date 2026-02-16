from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)  # Job title
    company = Column(String(255), nullable=True)
    raw_content = Column(Text, nullable=False)  # Original job description text
    parsed_content = Column(JSON, nullable=True)  # Extracted requirements, keywords, etc.
    url = Column(String(500), nullable=True)  # Link to job posting
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="job_descriptions")
    tailored_resumes = relationship("TailoredResume", back_populates="job_description", cascade="all, delete-orphan")
