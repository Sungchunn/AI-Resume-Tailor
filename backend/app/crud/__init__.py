from app.crud.resume import resume_crud
from app.crud.job import job_crud
from app.crud.job_listing import job_listing_repository, user_job_interaction_repository
from app.crud.tailor import tailored_resume_crud
from app.crud.block import block_repository
from app.crud.workshop import workshop_repository

__all__ = [
    "resume_crud",
    "job_crud",
    "job_listing_repository",
    "user_job_interaction_repository",
    "tailored_resume_crud",
    "block_repository",
    "workshop_repository",
]
