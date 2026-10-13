from __future__ import annotations

from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field


class BirthMomentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    birth_date: date
    birth_time_local: time
    timezone: str = Field(min_length=1)
    location_name: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    dst_fold: int | None = Field(default=None, ge=0, le=1)
    max_magnitude: float = Field(default=2.0, ge=-2, le=5.5)


class AstronomyMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_label: str
    catalog_version: str
    engine_name: str
    candidate_count: int
    calculated_at_utc: str


class SelectedStar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    display_name: str
    magnitude: float


class SelectedConstellation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str | None = None
    name_ko: str | None = None
    name_en: str | None = None


class ReadingMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    zenith_distance_deg: float
    altitude_deg: float
    azimuth_deg: float


class RepresentativeStarResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selected_star: SelectedStar
    selected_constellation: SelectedConstellation
    metrics: ReadingMetrics
    astronomy_meta: AstronomyMeta
