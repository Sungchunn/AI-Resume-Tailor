"""MongoDB Pydantic models for document-centric data."""

from app.models.mongo.keyword_override import (
    KeywordEntry,
    KeywordImportanceLevel,
    KeywordOverrideCreate,
    KeywordOverrideDocument,
    KeywordOverrideUpdate,
    SourceSectionType,
    compute_job_content_hash,
)
from app.models.mongo.resume import (
    ContactInfo,
    EducationEntry,
    ExperienceEntry,
    OriginalFile,
    ParsedContent,
    ProjectEntry,
    ResumeCreate,
    ResumeDocument,
    ResumeUpdate,
    StyleSettings,
)
from app.models.mongo.resume_build import (
    JobInfo,
    PendingDiff,
    ResumeBuildCreate,
    ResumeBuildDocument,
    ResumeBuildUpdate,
    ResumeSections,
)
from app.models.mongo.tailored_resume import (
    ATSKeywords,
    JobSource,
    TailoredResumeCreate,
    TailoredResumeDocument,
    TailoredResumeFinalize,
    TailoredResumeStatus,
    TailoredResumeUpdate,
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
    # Keyword Override
    "KeywordOverrideDocument",
    "KeywordOverrideCreate",
    "KeywordOverrideUpdate",
    "KeywordEntry",
    "KeywordImportanceLevel",
    "SourceSectionType",
    "compute_job_content_hash",
]
