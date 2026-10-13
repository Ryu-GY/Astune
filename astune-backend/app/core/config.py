from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Astune API", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_host: str = Field(default="127.0.0.1", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    app_secret: str = Field(default="change-me", alias="APP_SECRET")
    app_cors_origins: str = Field(
        default="http://127.0.0.1:3000,http://localhost:3000",
        alias="APP_CORS_ORIGINS",
    )
    astro_catalog_path: str = Field(
        default="../data/astro/bright-stars.json",
        alias="ASTRO_CATALOG_PATH",
    )
    city_data_path: str = Field(
        default="data/locations/cities_sample.csv",
        alias="CITY_DATA_PATH",
    )
    astro_ephemeris_path: str = Field(default="data/astro/de421.bsp", alias="ASTRO_EPHEMERIS_PATH")
    default_timezone: str = Field(default="Asia/Seoul", alias="DEFAULT_TIMEZONE")
    database_url: str = Field(
        default="postgresql://user:password@localhost:5432/astune",
        alias="DATABASE_URL",
    )
    admin_bootstrap_email: str = Field(
        default="admin@example.com",
        alias="ADMIN_BOOTSTRAP_EMAIL",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.app_cors_origins.split(",") if origin.strip()]

    @property
    def astro_catalog_abspath(self) -> Path:
        return (BASE_DIR / self.astro_catalog_path).resolve()

    @property
    def astro_ephemeris_abspath(self) -> Path:
        return (BASE_DIR / self.astro_ephemeris_path).resolve()

    @property
    def city_data_abspath(self) -> Path:
        return (BASE_DIR / self.city_data_path).resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
