from fastapi import APIRouter

from app.api.v1.endpoints.preview import router as preview_router
from app.api.v1.endpoints.locations import router as locations_router

router = APIRouter(prefix="/api/v1")
router.include_router(preview_router)
router.include_router(locations_router)
