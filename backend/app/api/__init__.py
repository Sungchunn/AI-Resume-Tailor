from fastapi import APIRouter

from app.api.routes import auth, resumes, jobs, tailor, export, blocks, match, workshops, ats

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(tailor.router, prefix="/tailor", tags=["tailor"])
api_router.include_router(export.router, prefix="/export", tags=["export"])

# Phase 2: Vault & Workshop API
api_router.include_router(blocks.router, prefix="/v1/blocks", tags=["blocks"])
api_router.include_router(match.router, prefix="/v1/match", tags=["match"])
api_router.include_router(workshops.router, prefix="/v1/workshops", tags=["workshops"])

# Phase 5: ATS Analysis
api_router.include_router(ats.router, prefix="/v1/ats", tags=["ats"])
