from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # User profile fields
    headline = Column(String(255), nullable=True)  # Professional title/headline

    # AI-generated "About Me" blurb for library page
    about_me = Column(Text, nullable=True)
    about_me_generated_at = Column(DateTime(timezone=True), nullable=True)

    # User preferences
    timezone = Column(String(100), nullable=True, default="UTC")  # IANA timezone string

    # Relationships
    resumes = relationship("Resume", back_populates="owner", cascade="all, delete-orphan")
    job_descriptions = relationship("JobDescription", back_populates="owner", cascade="all, delete-orphan")
    experience_blocks = relationship("ExperienceBlock", back_populates="owner", cascade="all, delete-orphan")
    resume_builds = relationship("ResumeBuild", back_populates="owner", cascade="all, delete-orphan")
    job_interactions = relationship(
        "UserJobInteraction", back_populates="user", cascade="all, delete-orphan"
    )

    # Backward compatibility alias
    @property
    def workshops(self):
        return self.resume_builds
