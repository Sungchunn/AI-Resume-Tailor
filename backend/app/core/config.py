from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/resume_tailor"

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

    # Webhook Authentication (for n8n job listing ingestion)
    n8n_webhook_api_key: str = ""

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

    # APIFY Integration
    apify_api_token: str = ""
    apify_actor_id: str = "hKByXkMQaC5Qt9UMN"
    apify_timeout_seconds: int = 300
    apify_max_retries: int = 3

    # Scraper Schedule
    scraper_schedule_hour: int = 6  # UTC
    scraper_schedule_minute: int = 0
    scraper_enabled: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
