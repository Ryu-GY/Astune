from datetime import date, time

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator
from app.astro.schemas import RepresentativeStarResult
from app.schemas.location import ResolvedLocation


class PreviewRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid", json_schema_extra={"examples": [
        {"birth_date": "1995-05-05", "birth_time_local": "15:00:00", "latitude": 37.5665,
         "longitude": 126.978, "timezone": "Asia/Seoul", "max_magnitude": 2},
        {"birth_date": "2021-11-07", "birth_time_local": "01:30:00", "city_name": "New York", "dst_fold": 1},
    ]})
    birth_date: date
    birth_time: time = Field(validation_alias=AliasChoices("birth_time_local", "birth_time"), description="UTC 오프셋 없는 출생 현지 시각. birth_time은 호환 별칭입니다.")
    city_name: str | None = Field(default=None, min_length=1, max_length=100)
    country_code: str | None = Field(default=None, pattern=r"^[A-Za-z]{2}$")
    allow_external: bool = False
    location_name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    timezone: str | None = Field(default=None, min_length=1, max_length=80)
    dst_fold: int | None = Field(default=None, ge=0, le=1, strict=True)
    max_magnitude: float = Field(default=2.0, ge=-2, le=5.5)

    @model_validator(mode="after")
    def validate_location_fields(self) -> "PreviewRequest":
        has_city = bool(self.city_name and self.city_name.strip())
        has_coords = self.latitude is not None and self.longitude is not None
        if not has_city and not has_coords:
            raise ValueError("city_name 또는 latitude/longitude 중 하나는 반드시 필요합니다.")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude와 longitude를 함께 입력해 주세요.")
        if self.birth_time.tzinfo is not None:
            raise ValueError("출생 시간에는 오프셋 대신 별도의 timezone을 사용해 주세요.")
        return self


class PreviewData(RepresentativeStarResult):
    local_datetime: str
    utc_datetime: str
    resolved_location: ResolvedLocation


class PreviewResponse(BaseModel):
    success: bool = True
    data: PreviewData
