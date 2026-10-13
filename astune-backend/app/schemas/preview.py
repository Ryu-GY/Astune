from datetime import date, time

from pydantic import AliasChoices, BaseModel, Field, model_validator
from app.astro.schemas import RepresentativeStarResult


class PreviewRequest(BaseModel):
    birth_date: date
    birth_time: time = Field(validation_alias=AliasChoices("birth_time", "birth_time_local"))
    city_name: str | None = None
    location_name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = None
    dst_fold: int | None = Field(default=None, ge=0, le=1)
    max_magnitude: float = Field(default=2.0, ge=-2, le=8)

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
        if has_coords and not self.timezone:
            raise ValueError("좌표를 직접 입력할 때는 timezone이 필요합니다.")
        return self


class ResolvedLocation(BaseModel):
    source: str
    city_name: str | None = None
    latitude: float
    longitude: float
    timezone: str


class PreviewData(RepresentativeStarResult):
    local_datetime: str
    utc_datetime: str
    resolved_location: ResolvedLocation


class PreviewResponse(BaseModel):
    success: bool = True
    data: PreviewData