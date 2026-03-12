from app.models.user import User
from app.models.resume import Resume
from app.models.job import JobDescription
from app.models.job_listing import JobListing
from app.models.user_job_interaction import UserJobInteraction
from app.models.tailored_resume import TailoredResume
from app.models.experience_block import ExperienceBlock
from app.models.resume_build import ResumeBuild
from app.models.audit_log import AuditLog
from app.models.scraper_run import ScraperRun
from app.models.scraper_preset import ScraperPreset
from app.models.scraper_schedule_settings import ScraperScheduleSettings
from app.models.scraper_request import ScraperRequest, RequestStatus
from app.models.ai_usage_log import AIUsageLog
from app.models.ai_pricing_config import AIPricingConfig

# Backward compatibility alias
Workshop = ResumeBuild

__all__ = [
    "User",
    "Resume",
    "JobDescription",
    "JobListing",
    "UserJobInteraction",
    "TailoredResume",
    "ExperienceBlock",
    "ResumeBuild",
    "Workshop",  # Backward compatibility
    "AuditLog",
    "ScraperRun",
    "ScraperPreset",
    "ScraperScheduleSettings",
    "ScraperRequest",
    "RequestStatus",
    "AIUsageLog",
    "AIPricingConfig",
]
