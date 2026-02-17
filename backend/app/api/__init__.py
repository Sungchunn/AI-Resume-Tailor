from fastapi import APIRouter

from app.api.routes import auth, resumes, jobs, tailor, export

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(tailor.router, prefix="/tailor", tags=["tailor"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
