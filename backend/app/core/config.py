import json
from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource


def parse_comma_separated_list(v: Any) -> list[str]:
    """Parse comma-separated string into list. Handles both JSON and plain formats."""
    if isinstance(v, list):
        return v
    if not isinstance(v, str):
        return []
    if not v or not v.strip():
        return []
    # Try JSON first for backwards compatibility with ["url1", "url2"] format
    if v.strip().startswith("["):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            pass
    # Fall back to comma-separated parsing
    return [origin.strip() for origin in v.split(",") if origin.strip()]


class CustomDotEnvSettingsSource(PydanticBaseSettingsSource):
    """Custom settings source that handles comma-separated list fields without JSON parsing."""

    LIST_FIELDS = {"cors_origins", "admin_emails"}

    def __init__(self, settings_cls: type[BaseSettings], env_file: str | None = ".env"):
        super().__init__(settings_cls)
        self._env_file = env_file

    def get_field_value(
        self, field: Any, field_name: str
    ) -> tuple[Any, str, bool]:
        # Delegate to dotenv source but handle list fields specially
        return None, field_name, False

    def __call__(self) -> dict[str, Any]:
        """Load values from .env file with custom list parsing."""
        import os
        from pathlib import Path

        env_path = Path(self._env_file) if self._env_file else None
        if not env_path or not env_path.exists():
            return {}

        # Parse .env file manually
        env_vars: dict[str, str] = {}
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                # Remove surrounding quotes if present
                value = value.strip()
                if (value.startswith('"') and value.endswith('"')) or (
                    value.startswith("'") and value.endswith("'")
                ):
                    value = value[1:-1]
                env_vars[key] = value

        # Build result dict with custom parsing for list fields
        result: dict[str, Any] = {}
        for field_name, field_info in self.settings_cls.model_fields.items():
            env_name = field_name.upper()
            if env_name in env_vars:
                value = env_vars[env_name]
                if field_name in self.LIST_FIELDS:
                    result[field_name] = parse_comma_separated_list(value)
                else:
                    result[field_name] = value

        return result


class CustomEnvSettingsSource(PydanticBaseSettingsSource):
    """Custom settings source that handles comma-separated list fields from environment."""

    LIST_FIELDS = {"cors_origins", "admin_emails"}

    def get_field_value(
        self, field: Any, field_name: str
    ) -> tuple[Any, str, bool]:
        return None, field_name, False

    def __call__(self) -> dict[str, Any]:
        """Load values from environment variables with custom list parsing."""
        import os

        result: dict[str, Any] = {}
        for field_name in self.settings_cls.model_fields:
            env_name = field_name.upper()
            value = os.environ.get(env_name)
            if value is not None:
                if field_name in self.LIST_FIELDS:
                    result[field_name] = parse_comma_separated_list(value)
                else:
                    result[field_name] = value

        return result


class Settings(BaseSettings):
    # Database (PostgreSQL)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/resume_tailor"
    database_url_sync: str | None = None  # Sync URL for Alembic migrations (psycopg2)

    # MongoDB
    mongodb_uri: str = ""  # Must be configured via environment variable
    mongodb_database: str = "resume_tailor"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    jwt_secret_key: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # AI Provider Selection
    # Options: "gemini" or "openai"
    ai_provider: str = "openai"

    # Gemini Configuration
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # OpenAI Configuration
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"  # Default to cost-effective model
    openai_embedding_model: str = "text-embedding-3-small"

    # AI Generation Settings
    ai_max_tokens: int = 8192  # Max tokens for AI generation (tailoring, parsing, etc.)

    # Environment
    environment: str = "development"

    # CORS Configuration
    cors_origins: list[str] = ["http://localhost:3000"]

    # Proxy Configuration
    trust_proxy: bool = False  # Set True when behind reverse proxy

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
    storage_enabled: bool = False  # Set to True to enable file storage
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
    apify_memory_mbytes: int = 1024  # Memory allocation for actor (256, 512, 1024, 2048, 4096)

    # Apify Cost Limits
    apify_max_cost_per_run_usd: float = 1.0  # Max $1 per actor run
    apify_daily_cost_limit_usd: float = 5.0  # Max $5 per day
    apify_weekly_cost_limit_usd: float = 20.0  # Max $20 per week

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

    # Google OAuth
    google_client_id: str = ""
    google_oauth_enabled: bool = False

    @property
    def google_oauth_configured(self) -> bool:
        """Check if Google OAuth is properly configured."""
        return bool(self.google_client_id) and self.google_oauth_enabled

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v: str, info) -> str:
        env = info.data.get("environment", "development")
        if env != "development" and v == "your-super-secret-key-change-in-production":
            raise ValueError("JWT secret must be changed in production")
        return v

    @field_validator("mongodb_uri")
    @classmethod
    def validate_mongodb_uri(cls, v: str) -> str:
        if not v:
            raise ValueError("MONGODB_URI environment variable must be set")
        return v

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        """Use custom sources that handle comma-separated list fields."""
        return (
            init_settings,
            CustomEnvSettingsSource(settings_cls),
            CustomDotEnvSettingsSource(settings_cls, env_file=".env"),
            file_secret_settings,
        )

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Gracefully ignore unknown fields from .env


@lru_cache
def get_settings() -> Settings:
    return Settings()
