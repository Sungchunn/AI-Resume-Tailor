from app.models.ai_pricing_config import AIPricingConfig
from app.models.ai_usage_log import AIUsageLog
from app.models.audit_log import AuditLog
from app.models.fit_score_batch_run import FitScoreBatchRun
from app.models.job import JobDescription
from app.models.job_listing import JobListing
from app.models.resume import Resume
from app.models.resume_build import ResumeBuild
from app.models.scraper_preset import ScraperPreset
from app.models.scraper_request import RequestStatus, ScraperRequest
from app.models.scraper_run import ScraperRun
from app.models.scraper_schedule_settings import ScraperScheduleSettings
from app.models.tailored_resume import TailoredResume
from app.models.user import User
from app.models.user_job_interaction import UserJobInteraction

# Backward compatibility alias
Workshop = ResumeBuild

__all__ = [
    "User",
    "Resume",
    "JobDescription",
    "JobListing",
    "UserJobInteraction",
    "TailoredResume",
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
    "FitScoreBatchRun",
]
