from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/resume_tailor"
    database_url_sync: str | None = None  # Sync URL for Alembic migrations (psycopg2)

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    jwt_secret_key: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # AI Provider (Gemini)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # Environment
    environment: str = "development"

    # CORS Configuration
    cors_origins: list[str] = ["http://localhost:3000"]

    # Proxy Configuration
    trust_proxy: bool = False  # Set True when behind reverse proxy

    # Webhook Authentication (for n8n job listing ingestion)
    n8n_webhook_api_key: str = ""

    # Admin Authentication
    # DEPRECATED: admin_emails is only used for migration seeding (20260223_0002).
    # Remove this setting after migration has run in all environments.
    admin_emails: list[str] = []

    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_default_per_minute: int = 60
    rate_limit_default_per_hour: int = 1000
    rate_limit_ai_per_minute: int = 10
    rate_limit_ai_per_hour: int = 100
    rate_limit_auth_per_minute: int = 10
    rate_limit_auth_per_hour: int = 50

    # Audit Logging
    audit_log_enabled: bool = True

    # Document Upload
    max_upload_size_mb: int = 10

    # MinIO / S3 Object Storage
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "resumes"
    minio_secure: bool = False  # Use HTTPS if True

    # APIFY Integration
    apify_api_token: str = ""
    apify_actor_id: str = "hKByXkMQaC5Qt9UMN"
    apify_timeout_seconds: int = 300
    apify_max_retries: int = 3

    # Scraper Schedule
    scraper_schedule_hour: int = 6  # UTC
    scraper_schedule_minute: int = 0
    scraper_enabled: bool = True
    scraper_max_concurrent: int = 2  # Max concurrent APIFY calls (1 = sequential)
    scraper_retry_attempts: int = 2  # Retry attempts for transient failures
    scraper_retry_delay: int = 60  # Seconds between retries

    # Job Retention
    job_retention_days: int = 21  # Delete jobs older than this many days
    job_cleanup_enabled: bool = True  # Enable automatic job cleanup

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v: str, info) -> str:
        env = info.data.get("environment", "development")
        if env != "development" and v == "your-super-secret-key-change-in-production":
            raise ValueError("JWT secret must be changed in production")
        return v

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
