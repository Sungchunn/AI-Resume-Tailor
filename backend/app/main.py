import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.backends.redis import RedisBackend
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.exc import TimeoutError as SQLTimeoutError

from app.api import api_router
from app.core.config import get_settings
from app.db.mongodb import close_mongodb, connect_mongodb, get_mongodb
from app.db.redis import close_redis, connect_redis, get_redis
from app.db.session import AsyncSessionLocal, engine
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

    # Startup: Initialize FastAPI cache with Redis backend.
    # Shared across workers; falls back to in-process cache if Redis fails.
    try:
        FastAPICache.init(RedisBackend(get_redis()), prefix="rb-cache")
    except Exception:
        logger.warning("Redis unavailable for FastAPICache, falling back to InMemoryBackend")
        FastAPICache.init(InMemoryBackend(), prefix="rb-cache")

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
    description="""API for AI-powered resume customization.

## API Version 2.0.0 - UUID Migration

As of v2.0.0, resource identifiers are transitioning from integer IDs to UUIDs:

- **Preferred format**: UUID string (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- **Deprecated format**: Integer string (e.g., `123`) - will be removed in a future version

When using deprecated integer IDs, responses include deprecation headers:
- `Deprecation: true`
- `Sunset: 2026-07-01`

**Affected resources**: jobs, resume_builds

**Note**: Internal integer IDs (`owner_id`, `user_id`) are no longer exposed in API responses.
""",
    version="2.0.0",
    lifespan=lifespan,
)


# Error-envelope helper
#
# All error responses returned from registered exception handlers share a
# stable shape so clients can correlate failures with server logs:
#
#     {"detail": <str|dict>, "error_id": <12-hex>, "error_code": <str>}
#
# Because these handlers run inside ExceptionMiddleware (i.e. inside the
# user middleware stack), responses flow back through CORSMiddleware and
# receive Access-Control-Allow-Origin headers automatically. This is the
# reason the catch-all Exception handler exists: without it, uncaught
# errors are intercepted by Starlette's ServerErrorMiddleware outside the
# user middleware stack and the browser sees "CORS blocked" instead of
# the real 500.
def _make_error_response(
    *,
    status_code: int,
    detail: str | dict,
    error_code: str,
) -> tuple[str, JSONResponse]:
    error_id = uuid.uuid4().hex[:12]
    return error_id, JSONResponse(
        status_code=status_code,
        content={
            "detail": detail,
            "error_id": error_id,
            "error_code": error_code,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for unexpected errors.

    Produces a structured 500 envelope with a correlation id and logs the
    full stack trace under that id. Runs inside the middleware stack so
    CORS headers are attached to the response.
    """
    error_id, response = _make_error_response(
        status_code=500,
        detail="Internal server error",
        error_code="internal_error",
    )
    logger.error(
        "unhandled_exception error_id=%s method=%s path=%s",
        error_id,
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return response


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Handle database integrity errors (unique constraints, foreign keys, etc.)."""
    error_message = str(exc.orig) if exc.orig else str(exc)
    lowered = error_message.lower()

    if "unique constraint" in lowered or "duplicate key" in lowered:
        if "email" in lowered:
            detail = "Email already registered"
        elif "username" in lowered:
            detail = "Username already taken"
        else:
            detail = "A record with this value already exists"
        status_code = 409
    elif "foreign key" in lowered:
        detail = "Referenced record does not exist"
        status_code = 400
    else:
        detail = "Database constraint violation"
        status_code = 400

    error_id, response = _make_error_response(
        status_code=status_code,
        detail=detail,
        error_code="db_integrity",
    )
    logger.warning(
        "db_integrity error_id=%s path=%s: %s",
        error_id,
        request.url.path,
        error_message,
    )
    return response


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
    """Handle database operational errors (connection issues, pool exhaustion, etc.)."""
    error_message = str(exc.orig) if exc.orig else str(exc)
    lowered = error_message.lower()

    if any(
        keyword in lowered
        for keyword in ("connection", "pool", "timeout", "refused", "unavailable", "closed")
    ):
        detail = "Database temporarily unavailable. Please try again in a moment."
        status_code = 503
        error_code = "db_unavailable"
    else:
        detail = "A database error occurred. Please try again."
        status_code = 500
        error_code = "db_operational"

    error_id, response = _make_error_response(
        status_code=status_code,
        detail=detail,
        error_code=error_code,
    )
    logger.error(
        "db_operational error_id=%s path=%s: %s",
        error_id,
        request.url.path,
        error_message,
    )
    return response


@app.exception_handler(SQLTimeoutError)
async def timeout_error_handler(request: Request, exc: SQLTimeoutError) -> JSONResponse:
    """Handle database timeout errors."""
    error_id, response = _make_error_response(
        status_code=504,
        detail="Database request timed out. Please try again.",
        error_code="db_timeout",
    )
    logger.error(
        "db_timeout error_id=%s path=%s: %s",
        error_id,
        request.url.path,
        exc,
    )
    return response


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
    """
    Health check endpoint with dependency verification.

    Returns:
        200: All dependencies healthy
        503: One or more dependencies unhealthy

    Response format:
        {
            "status": "healthy" | "unhealthy",
            "checks": {
                "postgres": "ok" | "error: <message>",
                "mongodb": "ok" | "error: <message>"
            }
        }
    """
    checks = {
        "status": "healthy",
        "checks": {}
    }

    # Check PostgreSQL connectivity
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["checks"]["postgres"] = "ok"
    except Exception as e:
        checks["checks"]["postgres"] = f"error: {str(e)}"
        checks["status"] = "unhealthy"

    # Check MongoDB connectivity
    try:
        mongo = get_mongodb()
        await mongo.command("ping")
        checks["checks"]["mongodb"] = "ok"
    except Exception as e:
        checks["checks"]["mongodb"] = f"error: {str(e)}"
        checks["status"] = "unhealthy"

    # Return appropriate status code
    status_code = 200 if checks["status"] == "healthy" else 503
    return JSONResponse(content=checks, status_code=status_code)


@app.get("/")
async def root():
    return {"message": "re-zoo-me API", "docs": "/docs"}
