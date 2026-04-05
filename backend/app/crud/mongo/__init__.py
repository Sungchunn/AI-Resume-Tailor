"""MongoDB CRUD operations."""

from app.crud.mongo.exceptions import VersionConflictError
from app.crud.mongo.keyword_override import KeywordOverrideCRUD, keyword_override_crud
from app.crud.mongo.resume import ResumeCRUD, resume_crud
from app.crud.mongo.resume_build import ResumeBuildCRUD, resume_build_crud
from app.crud.mongo.tailored_resume import TailoredResumeCRUD, tailored_resume_crud

__all__ = [
    "VersionConflictError",
    "resume_crud",
    "ResumeCRUD",
    "tailored_resume_crud",
    "TailoredResumeCRUD",
    "resume_build_crud",
    "ResumeBuildCRUD",
    "keyword_override_crud",
    "KeywordOverrideCRUD",
]
