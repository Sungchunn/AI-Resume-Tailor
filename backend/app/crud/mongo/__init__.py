"""MongoDB CRUD operations."""

from app.crud.mongo.exceptions import VersionConflictError
from app.crud.mongo.resume import resume_crud, ResumeCRUD
from app.crud.mongo.tailored_resume import tailored_resume_crud, TailoredResumeCRUD
from app.crud.mongo.resume_build import resume_build_crud, ResumeBuildCRUD

__all__ = [
    "VersionConflictError",
    "resume_crud",
    "ResumeCRUD",
    "tailored_resume_crud",
    "TailoredResumeCRUD",
    "resume_build_crud",
    "ResumeBuildCRUD",
]
