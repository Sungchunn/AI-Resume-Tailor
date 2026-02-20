from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import get_settings
from app.middleware.rate_limiter import RateLimitConfig, RateLimitMiddleware
from app.services.scheduler import get_scheduler_service

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown events."""
    # Startup: Initialize scheduler
    scheduler = get_scheduler_service()
    scheduler.start()

    yield

    # Shutdown: Stop scheduler gracefully
    scheduler.stop()


app = FastAPI(
    title="AI Resume Tailor API",
    description="API for AI-powered resume customization",
    version="0.1.0",
    lifespan=lifespan,
)

# Add middleware in order (last added = first executed)
# Rate limiting middleware
if settings.rate_limit_enabled:
    rate_limit_config = RateLimitConfig(
        default_requests_per_minute=settings.rate_limit_default_per_minute,
        default_requests_per_hour=settings.rate_limit_default_per_hour,
        ai_requests_per_minute=settings.rate_limit_ai_per_minute,
        ai_requests_per_hour=settings.rate_limit_ai_per_hour,
        auth_requests_per_minute=settings.rate_limit_auth_per_minute,
        auth_requests_per_hour=settings.rate_limit_auth_per_hour,
        enabled=True,
    )
    app.add_middleware(RateLimitMiddleware, config=rate_limit_config)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {"message": "AI Resume Tailor API", "docs": "/docs"}
