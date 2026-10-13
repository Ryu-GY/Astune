from fastapi import APIRouter

from app.schemas.preview import PreviewRequest, PreviewResponse
from app.schemas.common import ErrorResponse
from app.services.preview_service import build_preview

router = APIRouter(prefix="/readings", tags=["readings"])


@router.post("/preview", response_model=PreviewResponse, summary="대표 별 천문 계산 (해석·저장 없음)",
             description="로컬 성표와 Skyfield로 대표 별을 계산합니다. 해석 5개 섹션과 점수 4개는 Next.js 공개 preview가 결합합니다. 중복 현지 시각은 dst_fold=0 또는 1을 지정합니다. 요청 추적에는 X-Request-ID 헤더를 사용합니다.",
             responses={404: {"model": ErrorResponse, "description": "CITY_NOT_FOUND"},
                        409: {"model": ErrorResponse, "description": "CITY_AMBIGUOUS"},
                        422: {"model": ErrorResponse, "description": "입력·DST·시간대·천체력 범위·별 후보 오류"},
                        429: {"model": ErrorResponse, "description": "GEOCODER_RATE_LIMITED"},
                        500: {"model": ErrorResponse, "description": "CALCULATION_FAILED 또는 INTERNAL_SERVER_ERROR"},
                        503: {"model": ErrorResponse, "description": "CATALOG_NOT_READY 또는 GEOCODER_UNAVAILABLE"}})
def preview_reading(payload: PreviewRequest) -> PreviewResponse:
    return build_preview(payload)
