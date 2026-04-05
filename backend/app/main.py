import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.exc import TimeoutError as SQLTimeoutError

from app.api import api_router
from app.core.config import get_settings
from app.db.mongodb import close_mongodb, connect_mongodb
from app.db.redis import close_redis, connect_redis
from app.db.session import engine
from app.middleware.rate_limiter import RateLimitConfig, RateLimitMiddleware
from app.services.scraping.scheduler import get_scheduler_service

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown events."""
    # Startup: Initialize MongoDB connection
    await connect_mongodb()

    # Startup: Initialize Redis connection
    await connect_redis()

    # Startup: Initialize scheduler
    scheduler = get_scheduler_service()
    scheduler.start()

    # Load schedule settings from database and register preset-based job
    await scheduler.reconfigure_from_db()

    yield

    # Shutdown: Stop scheduler gracefully
    scheduler.stop()

    # Shutdown: Dispose PostgreSQL engine (releases all connections)
    await engine.dispose()

    # Shutdown: Close Redis connection
    await close_redis()

    # Shutdown: Close MongoDB connection
    await close_mongodb()


app = FastAPI(
    title="re-zoo-me API",
    description="API for AI-powered resume customization",
    version="0.1.0",
    lifespan=lifespan,
)


# Global exception handlers
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Handle database integrity errors (unique constraints, foreign keys, etc.).

    Converts SQLAlchemy IntegrityError to user-friendly error responses.
    """
    error_message = str(exc.orig) if exc.orig else str(exc)
    logger.warning(f"Database integrity error: {error_message}")

    # Check for common constraint violations and provide user-friendly messages
    if "unique constraint" in error_message.lower() or "duplicate key" in error_message.lower():
        # Try to extract the field name from the error
        if "email" in error_message.lower():
            detail = "Email already registered"
        elif "username" in error_message.lower():
            detail = "Username already taken"
        else:
            detail = "A record with this value already exists"
        return JSONResponse(
            status_code=409,
            content={"detail": detail},
        )

    if "foreign key" in error_message.lower():
        detail = "Referenced record does not exist"
        return JSONResponse(
            status_code=400,
            content={"detail": detail},
        )

    # Generic database error
    return JSONResponse(
        status_code=400,
        content={"detail": "Database constraint violation"},
    )


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
    """Handle database operational errors (connection issues, pool exhaustion, etc.).

    These typically indicate infrastructure issues with the database connection.
    """
    error_message = str(exc.orig) if exc.orig else str(exc)
    logger.error(f"Database operational error: {error_message}")

    # Check for connection-related issues
    if any(keyword in error_message.lower() for keyword in [
        "connection", "pool", "timeout", "refused", "unavailable", "closed"
    ]):
        return JSONResponse(
            status_code=503,
            content={"detail": "Database temporarily unavailable. Please try again in a moment."},
        )

    # Generic operational error
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred. Please try again."},
    )


@app.exception_handler(SQLTimeoutError)
async def timeout_error_handler(request: Request, exc: SQLTimeoutError) -> JSONResponse:
    """Handle database timeout errors."""
    logger.error(f"Database timeout error: {exc}")
    return JSONResponse(
        status_code=504,
        content={"detail": "Database request timed out. Please try again."},
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
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {"message": "re-zoo-me API", "docs": "/docs"}
