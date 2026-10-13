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
