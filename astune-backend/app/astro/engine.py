from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC
from functools import cached_property
from pathlib import Path

from app.astro.catalog import PreparedStarTarget, load_prepared_star_targets
from app.astro.schemas import (
    AstronomyMeta,
    BirthMomentInput,
    ReadingMetrics,
    RepresentativeStarResult,
    SelectedConstellation,
    SelectedStar,
)
from app.astro.time_utils import resolve_local_datetime
from app.core.error_codes import ErrorCode
from app.core.exceptions import AstuneError


@dataclass(frozen=True, slots=True)
class EngineConfig:
    catalog_path: Path
    ephemeris_path: Path
    source_label: str = "ESA Hipparcos bright subset"
    catalog_version: str = "hipparcos_bright_v1"
    engine_name: str = "Skyfield"


@dataclass(frozen=True, slots=True)
class CandidateScore:
    target: PreparedStarTarget
    altitude_deg: float
    azimuth_deg: float
    zenith_distance_deg: float


def _is_better_candidate(candidate: CandidateScore, best: CandidateScore | None) -> bool:
    if best is None:
        return True

    # 1) altitude 최대
    if candidate.altitude_deg != best.altitude_deg:
        return candidate.altitude_deg > best.altitude_deg

    # 2) zenith distance 최소
    if candidate.zenith_distance_deg != best.zenith_distance_deg:
        return candidate.zenith_distance_deg < best.zenith_distance_deg

    # 3) magnitude 최소(더 밝은 별)
    if candidate.target.record.magnitude != best.target.record.magnitude:
        return candidate.target.record.magnitude < best.target.record.magnitude

    # 4) 완전 동률이면 hip_id 안정 정렬
    return candidate.target.record.hip_id < best.target.record.hip_id


class AstronomyEngine:
    def __init__(self, config: EngineConfig) -> None:
        self.config = config

    @cached_property
    def _timescale(self):
        from skyfield.api import load

        # 오프라인 런타임을 위해 builtin=True 사용.
        return load.timescale(builtin=True)

    @cached_property
    def _earth(self):
        from skyfield.api import load_file

        if not self.config.ephemeris_path.exists():
            raise AstuneError(
                ErrorCode.CATALOG_NOT_READY,
                "ephemeris file not found",
                details={"ephemeris_path": str(self.config.ephemeris_path)},
            )

        try:
            eph = load_file(str(self.config.ephemeris_path))
        except Exception as exc:
            raise AstuneError(ErrorCode.CATALOG_NOT_READY, "ephemeris file could not be loaded") from exc
        return eph["earth"]

    @cached_property
    def _prepared_targets(self) -> tuple[PreparedStarTarget, ...]:
        return load_prepared_star_targets(str(self.config.catalog_path))

    def calculate_representative_star(
        self,
        request: BirthMomentInput,
    ) -> RepresentativeStarResult:
        from skyfield.api import wgs84
        from skyfield.errors import EphemerisRangeError

        if not self._prepared_targets:
            raise AstuneError(
                ErrorCode.BRIGHT_STAR_SUBSET_EMPTY,
                "bright star subset is empty",
            )

        resolved = resolve_local_datetime(
            local_date=request.birth_date,
            local_time=request.birth_time_local,
            timezone_name=request.timezone,
            dst_fold=request.dst_fold,
        )

        skyfield_time = self._timescale.from_datetime(resolved.utc_dt.astimezone(UTC))
        observer = self._earth + wgs84.latlon(request.latitude, request.longitude)

        best: CandidateScore | None = None
        candidate_count = 0
        try:
            observer_at_time = observer.at(skyfield_time)
            for prepared in self._prepared_targets:
                if prepared.record.magnitude > request.max_magnitude:
                    continue
                apparent = observer_at_time.observe(prepared.target).apparent()
                alt, az, _distance = apparent.altaz()
                if float(alt.degrees) <= 0:
                    continue
                candidate_count += 1
                candidate = CandidateScore(
                    target=prepared,
                    altitude_deg=float(alt.degrees),
                    azimuth_deg=float(az.degrees),
                    zenith_distance_deg=float(90.0 - alt.degrees),
                )
                if _is_better_candidate(candidate, best):
                    best = candidate
        except EphemerisRangeError as exc:
            raise AstuneError(ErrorCode.EPHEMERIS_OUT_OF_RANGE, "birth date is outside the ephemeris date range") from exc
        except Exception as exc:  # noqa: BLE001 - 라이브러리 예외를 도메인 에러로 래핑
            raise AstuneError(
                ErrorCode.CALCULATION_FAILED,
                "astronomical calculation failed",
                details={
                    "birth_date": request.birth_date.isoformat(),
                    "birth_time_local": request.birth_time_local.isoformat(),
                    "timezone": request.timezone,
                    "latitude": request.latitude,
                    "longitude": request.longitude,
                },
            ) from exc

        if best is None:
            raise AstuneError(
                ErrorCode.NO_VISIBLE_STAR_CANDIDATE,
                "no visible star satisfies max_magnitude",
            )

        record = best.target.record
        return RepresentativeStarResult(
            selected_star=SelectedStar(
                id=record.hip_id,
                display_name=record.display_name,
                magnitude=record.magnitude,
            ),
            selected_constellation=SelectedConstellation(
                code=record.constellation_code,
                name_ko=record.constellation_name_ko,
                name_en=record.constellation_name_en,
            ),
            metrics=ReadingMetrics(
                zenith_distance_deg=round(best.zenith_distance_deg, 3),
                altitude_deg=round(best.altitude_deg, 3),
                azimuth_deg=round(best.azimuth_deg, 3),
            ),
            astronomy_meta=AstronomyMeta(
                source_label=self.config.source_label,
                catalog_version=self.config.catalog_version,
                engine_name=self.config.engine_name,
                candidate_count=candidate_count,
                calculated_at_utc=resolved.utc_dt.isoformat(),
            ),
        )
