from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.common import HealthResponse, HealthData

router = APIRouter()


@router.get("/", tags=["root"])
def root() -> dict[str, str]:
    return {"message": "Astune API is running."}


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        data=HealthData(
            app_name=settings.app_name,
            environment=settings.app_env,
            status="ok",
        )
    )
