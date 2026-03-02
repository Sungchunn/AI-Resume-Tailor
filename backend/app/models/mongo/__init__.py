"""MongoDB Pydantic models for document-centric data."""

from app.models.mongo.resume import (
    ResumeDocument,
    ResumeCreate,
    ResumeUpdate,
    ContactInfo,
    ExperienceEntry,
    EducationEntry,
    ProjectEntry,
    ParsedContent,
    StyleSettings,
    OriginalFile,
)
from app.models.mongo.tailored_resume import (
    TailoredResumeDocument,
    TailoredResumeCreate,
    TailoredResumeUpdate,
    JobSource,
    Suggestion,
    ATSKeywords,
)
from app.models.mongo.resume_build import (
    ResumeBuildDocument,
    ResumeBuildCreate,
    ResumeBuildUpdate,
    JobInfo,
    PendingDiff,
    ResumeSections,
)

__all__ = [
    # Resume
    "ResumeDocument",
    "ResumeCreate",
    "ResumeUpdate",
    "ContactInfo",
    "ExperienceEntry",
    "EducationEntry",
    "ProjectEntry",
    "ParsedContent",
    "StyleSettings",
    "OriginalFile",
    # Tailored Resume
    "TailoredResumeDocument",
    "TailoredResumeCreate",
    "TailoredResumeUpdate",
    "JobSource",
    "Suggestion",
    "ATSKeywords",
    # Resume Build
    "ResumeBuildDocument",
    "ResumeBuildCreate",
    "ResumeBuildUpdate",
    "JobInfo",
    "PendingDiff",
    "ResumeSections",
]
