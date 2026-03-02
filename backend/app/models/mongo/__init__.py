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
    TailoredResumeFinalize,
    TailoredResumeStatus,
    JobSource,
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
    "TailoredResumeFinalize",
    "TailoredResumeStatus",
    "JobSource",
    "ATSKeywords",
    # Resume Build
    "ResumeBuildDocument",
    "ResumeBuildCreate",
    "ResumeBuildUpdate",
    "JobInfo",
    "PendingDiff",
    "ResumeSections",
]
