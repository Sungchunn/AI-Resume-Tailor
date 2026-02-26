from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    raw_content = Column(Text, nullable=False)  # Original resume text (plain text)
    html_content = Column(Text, nullable=True)  # TipTap-compatible HTML for rich editing
    parsed_content = Column(JSON, nullable=True)  # Structured JSON after parsing
    style = Column(JSON, nullable=True)  # Font/margin/spacing settings for rendering

    # File storage fields (original uploaded file in MinIO/S3)
    original_file_key = Column(String(512), nullable=True)  # Storage path in MinIO/S3
    original_filename = Column(String(255), nullable=True)  # Original upload filename
    file_type = Column(String(10), nullable=True)  # "pdf" or "docx"
    file_size_bytes = Column(Integer, nullable=True)  # Size of original file

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="resumes")
    tailored_resumes = relationship("TailoredResume", back_populates="original_resume", cascade="all, delete-orphan")
