from functools import lru_cache
from datetime import datetime
from zoneinfo import ZoneInfo

from app.astro.catalog import load_catalog_metadata
from app.astro.engine import AstronomyEngine, EngineConfig
from app.astro.schemas import BirthMomentInput
from app.astro.time_utils import resolve_local_datetime
from app.core.config import get_settings
from app.schemas.preview import PreviewRequest, PreviewResponse, PreviewData
from app.services.location_service import resolve_location
from app.core.error_codes import ErrorCode
from app.core.exceptions import AstuneError
from app.core.telemetry import stage, record_calculation


@lru_cache(maxsize=1)
def get_astronomy_engine() -> AstronomyEngine:
    settings = get_settings()
    metadata = load_catalog_metadata(str(settings.astro_catalog_abspath))
    return AstronomyEngine(EngineConfig(
        catalog_path=settings.astro_catalog_abspath,
        ephemeris_path=settings.astro_ephemeris_abspath,
        source_label=metadata["sourceLabel"],
        catalog_version=metadata["catalogVersion"],
    ))


def build_preview(payload: PreviewRequest) -> PreviewResponse:
    with stage("location"):
        location = resolve_location(payload)
    with stage("validation"):
        if payload.birth_date > datetime.now(ZoneInfo(location.timezone)).date():
            raise AstuneError(ErrorCode.BIRTH_DATE_IN_FUTURE, "birth date is after today in the birthplace timezone")
        moment = resolve_local_datetime(
            local_date=payload.birth_date, local_time=payload.birth_time,
            timezone_name=location.timezone, dst_fold=payload.dst_fold,
        )
    with stage("astronomy"):
        result = get_astronomy_engine().calculate_representative_star(BirthMomentInput(
            birth_date=payload.birth_date, birth_time_local=payload.birth_time,
            timezone=location.timezone, location_name=payload.location_name or location.city_name or "Coordinates",
            latitude=location.latitude, longitude=location.longitude,
            dst_fold=payload.dst_fold, max_magnitude=payload.max_magnitude,
        ))
    record_calculation(result.astronomy_meta)
    return PreviewResponse(data=PreviewData(
        **result.model_dump(), local_datetime=moment.local_dt.isoformat(),
        utc_datetime=moment.utc_dt.isoformat(), resolved_location=location,
    ))
