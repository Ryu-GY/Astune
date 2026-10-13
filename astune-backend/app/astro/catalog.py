from __future__ import annotations

import json
import hashlib
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.error_codes import ErrorCode
from app.core.exceptions import AstuneError, ValidationError


@dataclass(frozen=True, slots=True)
class BrightStarRecord:
    hip_id: int
    display_name: str
    ra_hours: float
    dec_degrees: float
    magnitude: float
    constellation_code: str | None = None
    constellation_name_ko: str | None = None
    constellation_name_en: str | None = None
    epoch_year: float = 2000.0
    ra_mas_per_year: float = 0.0
    dec_mas_per_year: float = 0.0
    parallax_mas: float = 0.0


@dataclass(frozen=True, slots=True)
class PreparedStarTarget:
    record: BrightStarRecord
    target: Any


def _to_record(row: dict[str, Any]) -> BrightStarRecord:
    if not isinstance(row, dict):
        raise ValidationError("each catalog row must be an object")
    try:
        hip_id = int(row.get("hip_id") or row.get("hipId") or row.get("id"))
        display_name = str(
            row.get("display_name")
            or row.get("name")
            or row.get("proper_name")
            or f"HIP {hip_id}"
        )
        ra_hours = float(row.get("ra_hours", row.get("raHours")))
        dec_degrees = float(row.get("dec_degrees", row.get("decDegrees")))
        magnitude = float(row["magnitude"])
        epoch_year = float(row.get("epoch_year", row.get("epochYear", 2000.0)))
        ra_motion = float(row.get("ra_mas_per_year", row.get("raMasPerYear", 0.0)))
        dec_motion = float(row.get("dec_mas_per_year", row.get("decMasPerYear", 0.0)))
        parallax = float(row.get("parallax_mas", row.get("parallaxMas", 0.0)))
        if hip_id <= 0 or not 0 <= ra_hours < 24 or not -90 <= dec_degrees <= 90 or not math.isfinite(magnitude):
            raise ValueError("catalog value outside supported range")
        if not all(math.isfinite(value) for value in (epoch_year, ra_motion, dec_motion, parallax)) or parallax < 0:
            raise ValueError("invalid catalog astrometry")
    except (KeyError, TypeError, ValueError) as exc:
        raise ValidationError(
            "bright_stars.json row has invalid schema",
            details={"row": row},
        ) from exc

    constellation_code = row.get("constellation_code") or row.get("constellationCode") or row.get("constellation")
    constellation_name_ko = row.get("constellation_name_ko")
    constellation_name_en = row.get("constellation_name_en") or row.get("constellationName")

    return BrightStarRecord(
        hip_id=hip_id,
        display_name=display_name,
        ra_hours=ra_hours,
        dec_degrees=dec_degrees,
        magnitude=magnitude,
        constellation_code=str(constellation_code) if constellation_code else None,
        constellation_name_ko=str(constellation_name_ko) if constellation_name_ko else None,
        constellation_name_en=str(constellation_name_en) if constellation_name_en else None,
        epoch_year=epoch_year,
        ra_mas_per_year=ra_motion,
        dec_mas_per_year=dec_motion,
        parallax_mas=parallax,
    )


@lru_cache(maxsize=8)
def load_bright_star_catalog(catalog_path: str) -> tuple[BrightStarRecord, ...]:
    path = Path(catalog_path)
    if not path.exists():
        raise AstuneError(
            ErrorCode.CATALOG_NOT_READY,
            "bright star catalog file not found",
            details={"catalog_path": str(path)},
        )

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise AstuneError(
            ErrorCode.CATALOG_NOT_READY,
            "bright star catalog JSON is invalid",
            details={"catalog_path": str(path)},
        ) from exc

    if not isinstance(raw, list):
        raise ValidationError(
            "bright star catalog root must be a JSON array",
            details={"catalog_path": str(path)},
        )

    records = tuple(_to_record(row) for row in raw)
    if len({record.hip_id for record in records}) != len(records):
        raise ValidationError("catalog contains duplicate HIP IDs")
    if not records:
        raise AstuneError(
            ErrorCode.BRIGHT_STAR_SUBSET_EMPTY,
            "bright star subset is empty",
            details={"catalog_path": str(path)},
        )
    return records


@lru_cache(maxsize=8)
def load_prepared_star_targets(catalog_path: str) -> tuple[PreparedStarTarget, ...]:
    # Local import keeps syntax-checking lightweight even where Skyfield is not installed.
    from skyfield.api import Star

    records = load_bright_star_catalog(catalog_path)
    return tuple(
        PreparedStarTarget(
            record=record,
            target=Star(
                ra_hours=record.ra_hours, dec_degrees=record.dec_degrees,
                ra_mas_per_year=record.ra_mas_per_year,
                dec_mas_per_year=record.dec_mas_per_year,
                parallax_mas=record.parallax_mas,
                # Same Julian-year conversion as Skyfield Star.from_dataframe().
                epoch=1721045.0 + record.epoch_year * 365.25,
            ),
        )
        for record in records
    )


def catalog_digest(rows: Any) -> str:
    """Hash values, independent of Git/Windows newline conversion and indentation."""
    canonical = json.dumps(rows, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@lru_cache(maxsize=8)
def load_catalog_metadata(catalog_path: str) -> dict[str, Any]:
    path = Path(catalog_path)
    try:
        metadata = json.loads(path.with_suffix(".meta.json").read_text(encoding="utf-8"))
        rows = json.loads(path.read_text(encoding="utf-8"))
        if (
            not isinstance(metadata, dict) or not isinstance(rows, list)
            or metadata.get("catalogSha256") != catalog_digest(rows)
            or metadata.get("recordCount") != len(rows)
            or not isinstance(metadata.get("catalogVersion"), str) or not metadata["catalogVersion"]
            or not isinstance(metadata.get("sourceLabel"), str) or not metadata["sourceLabel"]
            or metadata.get("maxMagnitude") != 5.5
        ):
            raise ValueError("catalog metadata does not match data")
    except (OSError, ValueError, TypeError) as exc:
        raise AstuneError(ErrorCode.CATALOG_NOT_READY, "catalog or its metadata is missing or inconsistent") from exc
    return metadata
