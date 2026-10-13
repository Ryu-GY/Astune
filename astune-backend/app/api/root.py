from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.schemas.common import HealthResponse, HealthData

router = APIRouter()


@router.get("/", tags=["root"])
def root() -> dict[str, str]:
    return {"message": "Astune API is running."}


@router.get("/ready", tags=["health"])
def ready(request: Request):
    data = getattr(request.app.state, "astronomy_ready", None)
    if data is None:
        return JSONResponse(status_code=503, content={"success": False, "error": {"code": "CATALOG_NOT_READY", "message": "Startup data checks have not completed"}})
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
