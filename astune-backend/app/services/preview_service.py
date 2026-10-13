from functools import lru_cache

from app.astro.engine import AstronomyEngine, EngineConfig
from app.astro.schemas import BirthMomentInput
from app.astro.time_utils import resolve_local_datetime
from app.core.config import get_settings
from app.schemas.preview import PreviewRequest, PreviewResponse, PreviewData
from app.services.location_service import resolve_location


@lru_cache(maxsize=1)
def get_astronomy_engine() -> AstronomyEngine:
    settings = get_settings()
    return AstronomyEngine(EngineConfig(
        catalog_path=settings.astro_catalog_abspath,
        ephemeris_path=settings.astro_ephemeris_abspath,
        source_label=settings.astro_source_label,
        catalog_version=settings.astro_catalog_version,
    ))


def build_preview(payload: PreviewRequest) -> PreviewResponse:
    location = resolve_location(payload)
    moment = resolve_local_datetime(
        local_date=payload.birth_date, local_time=payload.birth_time,
        timezone_name=location.timezone, dst_fold=payload.dst_fold,
    )
    result = get_astronomy_engine().calculate_representative_star(BirthMomentInput(
        birth_date=payload.birth_date, birth_time_local=payload.birth_time,
        timezone=location.timezone, location_name=payload.location_name or location.city_name or "Coordinates",
        latitude=location.latitude, longitude=location.longitude,
        dst_fold=payload.dst_fold, max_magnitude=payload.max_magnitude,
    ))
    return PreviewResponse(data=PreviewData(
        **result.model_dump(), local_datetime=moment.local_dt.isoformat(),
        utc_datetime=moment.utc_dt.isoformat(), resolved_location=location,
    ))