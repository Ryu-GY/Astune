"""Compatibility helpers backed by the core's DST-aware time conversion."""
from datetime import UTC, datetime
from app.astro.time_utils import resolve_local_datetime
from app.schemas.preview import PreviewRequest, ResolvedLocation


def build_local_datetime(payload: PreviewRequest, location: ResolvedLocation) -> datetime:
    return resolve_local_datetime(
        local_date=payload.birth_date, local_time=payload.birth_time,
        timezone_name=location.timezone, dst_fold=payload.dst_fold,
    ).local_dt


def to_utc(local_dt: datetime) -> datetime:
    return local_dt.astimezone(UTC)