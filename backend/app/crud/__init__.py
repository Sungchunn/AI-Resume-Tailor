from app.crud.resume import resume_crud
from app.crud.job import job_crud
from app.crud.job_listing import job_listing_repository, user_job_interaction_repository
from app.crud.tailor import tailored_resume_crud
from app.crud.block import block_repository
from app.crud.resume_build import resume_build_repository

# Backward compatibility alias
workshop_repository = resume_build_repository

__all__ = [
    "resume_crud",
    "job_crud",
    "job_listing_repository",
    "user_job_interaction_repository",
    "tailored_resume_crud",
    "block_repository",
    "resume_build_repository",
    "workshop_repository",  # Backward compatibility
]
