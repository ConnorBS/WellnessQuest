from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://wq:wq@postgres:5432/wellnessquest",
        alias="DATABASE_URL",
    )

    jwt_secret: str = Field(default="dev-insecure-change-me", alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_ttl_seconds: int = Field(default=15 * 60, alias="ACCESS_TOKEN_TTL_SECONDS")
    refresh_token_ttl_seconds: int = Field(default=30 * 24 * 3600, alias="REFRESH_TOKEN_TTL_SECONDS")

    fernet_key: str = Field(default="", alias="FERNET_KEY")

    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

    admin_email: str = Field(default="admin@local", alias="ADMIN_EMAIL")
    admin_password: str = Field(default="change-me-admin", alias="ADMIN_PASSWORD")
    partner_email: str = Field(default="partner@local", alias="PARTNER_EMAIL")
    partner_password: str = Field(default="change-me-partner", alias="PARTNER_PASSWORD")

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    tz: str = Field(default="UTC", alias="TZ")

    uploads_dir: str = Field(default="/app/data/uploads", alias="WQ_UPLOADS_DIR")
    upload_max_bytes: int = Field(default=5 * 1024 * 1024, alias="WQ_UPLOAD_MAX_BYTES")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
