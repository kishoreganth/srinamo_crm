from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        extra="ignore",
        env_file_encoding="utf-8",
    )

    DATABASE_URL: str = "postgresql://srinamo:srinamo_secret_change_me@localhost:5432/srinamo_pms"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    JWT_SECRET: str = "change-me-to-a-long-random-string-min-32-chars"
    JWT_EXPIRES_IN: str = "1d"
    JWT_REFRESH_SECRET: str = "another-long-random-string-min-32-chars"
    JWT_REFRESH_EXPIRES_IN: str = "7d"
    MINIO_ENDPOINT: str = "localhost"
    MINIO_PORT: int = 9000
    MINIO_ROOT_USER: str = "srinamo_minio"
    MINIO_ROOT_PASSWORD: str = "minio_secret_change_me"
    MINIO_BUCKET: str = "srinamo-documents"
    MINIO_USE_SSL: bool = False
    RESORT_NAME: str = "SriNamo Farms Resort"
    N8N_WEBHOOK_BASE: str = "http://localhost:5678/webhook"
    N8N_WEBHOOK_SECRET: str = ""
    WHATSAPP_ENABLED: bool = False
    RESORT_MAP_URL: str = "https://maps.app.goo.gl/srinamofarms"
    REVIEW_URL: str = "https://g.page/r/srinamofarms/review"
    ICAL_FEED_TOKEN: str = "srinamo-ical-change-me"
    ICAL_IMPORT_URL: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
