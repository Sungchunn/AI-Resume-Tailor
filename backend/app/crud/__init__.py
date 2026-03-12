from app.crud.job import job_crud
from app.crud.job_listing import job_listing_repository, user_job_interaction_repository
from app.crud.block import block_repository
from app.crud.resume_build import resume_build_repository
from app.crud.scraper_preset import scraper_preset_repository
from app.crud.schedule_settings import schedule_settings_repository

# Backward compatibility alias
workshop_repository = resume_build_repository

__all__ = [
    "job_crud",
    "job_listing_repository",
    "user_job_interaction_repository",
    "block_repository",
    "resume_build_repository",
    "workshop_repository",  # Backward compatibility
    "scraper_preset_repository",
    "schedule_settings_repository",
]
