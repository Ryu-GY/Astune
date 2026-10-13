from fastapi import APIRouter, Query

from app.schemas.location import LocationRequest, LocationResponse
from app.schemas.common import ErrorResponse
from app.services.location_service import get_location_resolver
from app.core.telemetry import stage

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/resolve", response_model=LocationResponse, summary="로컬 도시 후보 검색 (호환 GET)",
            description="외부 검색은 수행하지 않습니다. 새 연동은 POST를 사용하세요.",
            responses={400: {"model": ErrorResponse, "description": "VALIDATION_ERROR"},
                       503: {"model": ErrorResponse, "description": "도시 데이터 사용 불가"}})
def search_local(q: str = Query(min_length=1, max_length=100)):
    # GET is always local and can safely be used for city suggestions.
    with stage("location"):
        return LocationResponse(data=get_location_resolver().search(LocationRequest(query=q)))


@router.post("/resolve", response_model=LocationResponse, summary="도시 또는 좌표의 위치와 시간대 해석",
             description="도시·국가 검색 또는 좌표 쌍을 받습니다. 후보가 없으면 200과 빈 items, 직접 입력 안내를 반환합니다. 육지 시간대가 없으면 timezone을 직접 지정해야 합니다. Next.js 공개 API는 camelCase와 data.candidates를 사용합니다.",
             responses={400: {"model": ErrorResponse, "description": "VALIDATION_ERROR"},
                        422: {"model": ErrorResponse, "description": "시간대 오류 (TIMEZONE_REQUIRED 등)"},
                        429: {"model": ErrorResponse, "description": "GEOCODER_RATE_LIMITED"},
                        500: {"model": ErrorResponse, "description": "INTERNAL_SERVER_ERROR"},
                        503: {"model": ErrorResponse, "description": "도시 데이터 또는 위치 서비스 사용 불가"}})
def resolve(payload: LocationRequest):
    with stage("location"):
        return LocationResponse(data=get_location_resolver().search(payload))
