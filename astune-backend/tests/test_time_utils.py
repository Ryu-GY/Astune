from __future__ import annotations

from datetime import date, time

import pytest

from app.astro.time_utils import resolve_local_datetime
from app.core.error_codes import ErrorCode
from app.core.exceptions import AstuneError


def test_asia_seoul_normal_case() -> None:
    resolved = resolve_local_datetime(
        local_date=date(1995, 3, 14),
        local_time=time(21, 30, 0),
        timezone_name="Asia/Seoul",
        dst_fold=None,
    )
    assert resolved.utc_dt.isoformat() == "1995-03-14T12:30:00+00:00"


def test_ambiguous_local_time_requires_fold() -> None:
    with pytest.raises(AstuneError) as exc_info:
        resolve_local_datetime(
            local_date=date(2021, 11, 7),
            local_time=time(1, 30, 0),
            timezone_name="America/New_York",
            dst_fold=None,
        )

    assert exc_info.value.code == ErrorCode.LOCAL_TIME_AMBIGUOUS


def test_nonexistent_local_time_raises() -> None:
    with pytest.raises(AstuneError) as exc_info:
        resolve_local_datetime(
            local_date=date(2021, 3, 14),
            local_time=time(2, 30, 0),
            timezone_name="America/New_York",
            dst_fold=None,
        )

    assert exc_info.value.code == ErrorCode.LOCAL_TIME_NONEXISTENT


def test_non_hour_offset_and_normal_fold_normalization():
    moment = resolve_local_datetime(local_date=date(2024, 1, 1), local_time=time(12), timezone_name="Asia/Kathmandu", dst_fold=1)
    assert moment.utc_dt.isoformat() == "2024-01-01T06:15:00+00:00"
    assert moment.fold == 0


def test_thirty_minute_dst_overlap():
    args = dict(local_date=date(2021, 4, 4), local_time=time(1, 45), timezone_name="Australia/Lord_Howe")
    first = resolve_local_datetime(**args, dst_fold=0)
    second = resolve_local_datetime(**args, dst_fold=1)
    assert (second.utc_dt - first.utc_dt).total_seconds() == 1800


@pytest.mark.parametrize(("day", "clock", "zone"), [
    (date(2011, 12, 30), time(12), "Pacific/Apia"),
    (date(1988, 5, 8), time(2, 30), "Asia/Seoul"),
])
def test_historical_skipped_wall_times(day, clock, zone):
    with pytest.raises(AstuneError) as error:
        resolve_local_datetime(local_date=day, local_time=clock, timezone_name=zone, dst_fold=None)
    assert error.value.code == ErrorCode.LOCAL_TIME_NONEXISTENT
