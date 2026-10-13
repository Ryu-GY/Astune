from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.core.error_codes import ErrorCode
from app.core.exceptions import AppException
from app.schemas.common import HealthResponse, HealthData

router = APIRouter()


@router.get("/", tags=["root"])
def root() -> dict[str, str]:
    return {"message": "Astune API is running."}


@router.get("/ready", tags=["health"])
def ready(request: Request):
    data = getattr(request.app.state, "astronomy_ready", None)
    if data is None:
        raise AppException(code=ErrorCode.CATALOG_NOT_READY, message="Startup data checks have not completed", status_code=503)
    return {"success": True, "data": data}


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
