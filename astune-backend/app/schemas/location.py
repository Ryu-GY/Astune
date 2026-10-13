from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class LocationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, json_schema_extra={"examples": [
        {"query": "서울", "country_code": "KR", "limit": 3},
        {"latitude": 37.5665, "longitude": 126.978},
        {"latitude": 0, "longitude": -140, "timezone": "Etc/GMT+9"},
    ]})
    query: str | None = Field(default=None, min_length=1, max_length=100)
    country_code: str | None = Field(default=None, pattern=r"^[A-Za-z]{2}$")
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    timezone: str | None = Field(default=None, min_length=1, max_length=80)
    allow_external: bool = False
    limit: int = Field(default=5, ge=1, le=10, strict=True, description="후보 수. 좌표 직접 입력은 한 개를 반환합니다.")

    @field_validator("country_code")
    @classmethod
    def uppercase_country(cls, value):
        return value.upper() if value else value

    @model_validator(mode="after")
    def location_required(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude와 longitude를 함께 입력해 주세요.")
        if self.latitude is None and not self.query:
            raise ValueError("도시명 또는 좌표가 필요합니다.")
        return self


class ResolvedLocation(BaseModel):
    model_config = ConfigDict(frozen=True)
    source: Literal["coordinates", "city_table", "geocoder"]
    city_name: str | None = None
    display_name: str | None = None
    country_code: str | None = None
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    timezone: str
    timezone_source: str = "manual"
    attribution: str | None = None


class LocationData(BaseModel):
    items: list[ResolvedLocation]
    cache_hit: bool = False
    manual_input_hint: str = "정확한 출생 좌표와 IANA 시간대를 직접 입력할 수도 있습니다."


class LocationResponse(BaseModel):
    success: bool = True
    data: LocationData
