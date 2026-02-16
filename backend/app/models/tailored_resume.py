from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class TailoredResume(Base):
    __tablename__ = "tailored_resumes"

    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)
    tailored_content = Column(Text, nullable=False)  # Final tailored resume text
    suggestions = Column(JSON, nullable=True)  # AI suggestions and changes made
    match_score = Column(Float, nullable=True)  # Score indicating how well resume matches job
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    original_resume = relationship("Resume", back_populates="tailored_resumes")
    job_description = relationship("JobDescription", back_populates="tailored_resumes")
