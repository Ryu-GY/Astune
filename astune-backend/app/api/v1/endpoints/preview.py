from fastapi import APIRouter

from app.schemas.preview import PreviewRequest, PreviewResponse
from app.services.preview_service import build_preview

router = APIRouter(prefix="/readings", tags=["readings"])


@router.post("/preview", response_model=PreviewResponse)
def preview_reading(payload: PreviewRequest) -> PreviewResponse:
    return build_preview(payload)
