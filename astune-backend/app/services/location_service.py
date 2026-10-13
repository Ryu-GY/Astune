from functools import lru_cache

import pandas as pd

from app.core.config import get_settings
from app.core.error_codes import ErrorCode
from app.core.exceptions import AppException
from app.schemas.preview import PreviewRequest, ResolvedLocation


@lru_cache(maxsize=1)
def _load_city_table() -> pd.DataFrame:
    settings = get_settings()
    path = settings.city_data_abspath
    return pd.read_csv(path)


def resolve_location(payload: PreviewRequest) -> ResolvedLocation:
    if payload.latitude is not None and payload.longitude is not None:
        timezone = payload.timezone or get_settings().default_timezone
        return ResolvedLocation(
            source="coordinates",
            city_name=payload.city_name,
            latitude=payload.latitude,
            longitude=payload.longitude,
            timezone=timezone,
        )

    city_name = (payload.city_name or "").strip()
    if not city_name:
        raise AppException(
            code=ErrorCode.INVALID_INPUT,
            message="도시명 또는 좌표가 필요합니다.",
            status_code=400,
        )

    cities = _load_city_table()
    matched = cities[cities["name"].str.casefold() == city_name.casefold()]

    if matched.empty:
        raise AppException(
            code=ErrorCode.CITY_NOT_FOUND,
            message="도시명을 찾지 못했습니다. 좌표를 직접 입력해 주세요.",
            status_code=404,
            details={"city_name": city_name},
        )

    row = matched.iloc[0]
    timezone = payload.timezone or row["timezone"]
    if not timezone:
        raise AppException(
            code=ErrorCode.TIMEZONE_REQUIRED,
            message="시간대 정보를 확인할 수 없습니다.",
            status_code=400,
            details={"city_name": city_name},
        )

    return ResolvedLocation(
        source="city_table",
        city_name=str(row["name"]),
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        timezone=str(timezone),
    )
