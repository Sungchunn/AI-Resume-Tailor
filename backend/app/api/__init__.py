from fastapi import APIRouter

from app.api.routes import (
    admin,
    ai,
    ats,
    auth,
    blocks,
    export,
    job_listings,
    jobs,
    match,
    resumes,
    scraper_requests,
    tailor,
    upload,
    resume_builds,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(tailor.router, prefix="/tailor", tags=["tailor"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])

# Phase 2: Vault & Resume Build API
api_router.include_router(blocks.router, prefix="/v1/blocks", tags=["blocks"])
api_router.include_router(match.router, prefix="/v1/match", tags=["match"])
api_router.include_router(resume_builds.router, prefix="/v1/resume-builds", tags=["resume-builds"])

# Phase 5: ATS Analysis
api_router.include_router(ats.router, prefix="/v1/ats", tags=["ats"])

# Phase 6: AI Chat for Resume Editor
api_router.include_router(ai.router, prefix="/v1/ai", tags=["ai"])

# Job Listings (system-wide jobs from external sources)
api_router.include_router(job_listings.router, prefix="/job-listings", tags=["job-listings"])

# Scraper Requests (user-submitted job URL requests)
api_router.include_router(scraper_requests.router, tags=["scraper-requests"])

# Admin endpoints (scheduler management)
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
