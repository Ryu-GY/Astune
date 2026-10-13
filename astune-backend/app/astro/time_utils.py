from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.error_codes import ErrorCode
from app.core.exceptions import AstuneError, ValidationError


@dataclass(frozen=True, slots=True)
class ResolvedMoment:
    local_dt: datetime
    utc_dt: datetime
    timezone_name: str
    fold: int


def _roundtrip_candidate(
    naive_local_dt: datetime,
    zone: ZoneInfo,
    fold: int,
) -> tuple[bool, datetime, datetime]:
    local_dt = naive_local_dt.replace(tzinfo=zone, fold=fold)
    utc_dt = local_dt.astimezone(UTC)
    roundtripped_local = utc_dt.astimezone(zone)

    matches_same_wall_time = roundtripped_local.replace(tzinfo=None) == naive_local_dt
    matches_same_fold = roundtripped_local.fold == fold
    return matches_same_wall_time and matches_same_fold, local_dt, utc_dt


def resolve_local_datetime(
    *,
    local_date: date,
    local_time: time,
    timezone_name: str,
    dst_fold: int | None,
) -> ResolvedMoment:
    if local_time.tzinfo is not None:
        raise ValidationError("birth_time_local must be a wall time without an offset; use timezone")
    try:
        zone = ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise AstuneError(
            ErrorCode.TIMEZONE_NOT_FOUND,
            "IANA timezone could not be resolved",
            details={"timezone": timezone_name},
        ) from exc

    if dst_fold not in (None, 0, 1):
        raise ValidationError(
            "dst_fold must be 0, 1, or null",
            details={"dst_fold": dst_fold},
        )

    naive_local_dt = datetime.combine(local_date, local_time)
    candidates: list[ResolvedMoment] = []
    seen_offsets: set[tuple[object, object]] = set()

    for fold in (0, 1):
        try:
            is_valid, local_dt, utc_dt = _roundtrip_candidate(naive_local_dt, zone, fold)
        except OverflowError as exc:
            raise AstuneError(ErrorCode.EPHEMERIS_OUT_OF_RANGE, "local date exceeds supported UTC conversion range") from exc
        if not is_valid:
            continue

        offset_signature = (local_dt.utcoffset(), local_dt.dst())
        if offset_signature in seen_offsets:
            continue

        seen_offsets.add(offset_signature)
        candidates.append(
            ResolvedMoment(
                local_dt=local_dt,
                utc_dt=utc_dt,
                timezone_name=timezone_name,
                fold=fold,
            )
        )

    if not candidates:
        raise AstuneError(
            ErrorCode.LOCAL_TIME_NONEXISTENT,
            "local wall time does not exist in the given timezone",
            details={
                "local_date": local_date.isoformat(),
                "local_time": local_time.isoformat(),
                "timezone": timezone_name,
            },
        )

    if len(candidates) == 1:
        only = candidates[0]
        # fold 값이 의미 없는 일반 시각이라면 0/1 입력을 모두 허용하되, 실제 적용 fold 로 정규화한다.
        return only

    if dst_fold is None:
        raise AstuneError(
            ErrorCode.LOCAL_TIME_AMBIGUOUS,
            "local wall time is ambiguous; dst_fold must be specified",
            details={
                "local_date": local_date.isoformat(),
                "local_time": local_time.isoformat(),
                "timezone": timezone_name,
                "available_folds": [candidate.fold for candidate in candidates],
            },
        )

    for candidate in candidates:
        if candidate.fold == dst_fold:
            return candidate

    raise AstuneError(
        ErrorCode.LOCAL_TIME_AMBIGUOUS,
        "requested dst_fold is invalid for the given local time",
        details={
            "requested_fold": dst_fold,
            "available_folds": [candidate.fold for candidate in candidates],
        },
    )
