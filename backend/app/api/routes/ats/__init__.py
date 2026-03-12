"""ATS Analysis API Routes - Modular Package."""

from fastapi import APIRouter

from app.api.routes.ats.knockout import router as knockout_router
from app.api.routes.ats.structure import router as structure_router
from app.api.routes.ats.keywords import router as keywords_router
from app.api.routes.ats.content_quality import router as content_quality_router
from app.api.routes.ats.role_proximity import router as role_proximity_router
from app.api.routes.ats.progressive import router as progressive_router

router = APIRouter()

router.include_router(knockout_router)
router.include_router(structure_router)
router.include_router(keywords_router)
router.include_router(content_quality_router)
router.include_router(role_proximity_router)
router.include_router(progressive_router)
