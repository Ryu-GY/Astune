"""Rebuild the checked-in bright subset from the pinned ESA Hipparcos catalog.

Network access is opt-in (--download) and is never used by the API runtime.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import tempfile
from pathlib import Path
from urllib.request import urlopen

import pandas as pd
import skyfield
from skyfield.api import load_constellation_map, load_constellation_names, position_of_radec
from skyfield.data import hipparcos

from app.astro.catalog import catalog_digest

ROOT = Path(__file__).resolve().parents[3]
SOURCE_URL = "https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat"
SOURCE_SHA256 = "58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0"
SOURCE_ROWS = 118218
MAX_MAGNITUDE = 5.5
CATALOG_VERSION = "hipparcos-i239-vmag5.5-v1"
SOURCE_LABEL = "ESA Hipparcos (1997), I/239, Vmag <= 5.5"
DEFAULT_SOURCE = ROOT / "astune-backend/data/astro/hip_main.dat"
DEFAULT_OUTPUT = ROOT / "data/astro/bright-stars.json"
DEFAULT_NAMES = ROOT / "data/astro/star-names.json"


def sha256_file(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verify_source(path: Path) -> None:
    if sha256_file(path) != SOURCE_SHA256:
        raise ValueError("Hipparcos source checksum mismatch; use the pinned original hip_main.dat")


def download_source(path: Path) -> None:
    """Keep a previous source intact if a download is interrupted or invalid."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with urlopen(SOURCE_URL, timeout=60) as response, temporary_path.open("wb") as stream:
            shutil.copyfileobj(response, stream)
        verify_source(temporary_path)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def select_bright_records(
    frame: pd.DataFrame, names: dict[str, str],
) -> tuple[list[dict], dict]:
    """Use Johnson V magnitude, not Hipparcos Hp magnitude. No arbitrary row cap."""
    if frame.index.has_duplicates or any(int(hip) != hip or hip <= 0 for hip in frame.index):
        raise ValueError("source contains invalid or duplicate HIP IDs")
    if any(not math.isfinite(value) for value in frame["magnitude"].dropna()):
        raise ValueError("source contains non-finite magnitudes")
    bright = frame.loc[frame["magnitude"] <= MAX_MAGNITUDE].copy()
    missing_position = bright[["ra_hours", "dec_degrees"]].isna().any(axis=1)
    excluded = sorted(int(hip) for hip in bright.index[missing_position])
    bright = bright.loc[~missing_position]
    if bright.empty:
        raise ValueError("no bright stars with usable positions")

    constellation_at = load_constellation_map()
    constellation_names = dict(load_constellation_names())
    records: list[dict] = []
    fallback_motion: list[int] = []
    fallback_parallax: list[int] = []
    for hip, row in bright.iterrows():
        hip = int(hip)
        ra, dec = float(row["ra_hours"]), float(row["dec_degrees"])
        if not 0 <= ra < 24 or not -90 <= dec <= 90:
            raise ValueError(f"invalid coordinates for HIP {hip}")
        epoch = float(row["epoch_year"])
        if epoch != 1991.25:
            raise ValueError(f"unexpected Hipparcos epoch for HIP {hip}")
        motion = [float(row["ra_mas_per_year"]), float(row["dec_mas_per_year"])]
        if any(math.isnan(value) for value in motion):
            fallback_motion.append(hip)
            motion = [0.0 if math.isnan(value) else value for value in motion]
        parallax = float(row["parallax_mas"])
        if math.isnan(parallax) or parallax <= 0:
            fallback_parallax.append(hip)
            parallax = 0.0
        if not all(math.isfinite(value) for value in (*motion, parallax)):
            raise ValueError(f"non-finite astrometry for HIP {hip}")
        code = str(constellation_at(position_of_radec(ra, dec)))
        name = names.get(str(hip), f"HIP {hip}")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"invalid display name for HIP {hip}")
        records.append({
            "hipId": hip,
            "name": name,
            "constellationCode": code,
            "constellationName": constellation_names[code],
            "magnitude": float(row["magnitude"]),
            "raHours": ra,
            "decDegrees": dec,
            "epochYear": epoch,
            "raMasPerYear": motion[0],
            "decMasPerYear": motion[1],
            "parallaxMas": parallax,
        })
    records.sort(key=lambda record: (record["magnitude"], record["hipId"]))
    return records, {
        "sourceRows": len(frame),
        "missingMagnitudeRows": int(frame["magnitude"].isna().sum()),
        "brightRowsBeforePositionFilter": len(bright) + len(excluded),
        "excludedMissingPositionHipIds": excluded,
        "zeroMotionFallbackHipIds": sorted(fallback_motion),
        "zeroParallaxFallbackHipIds": sorted(fallback_parallax),
    }


def write_json(path: Path, value: object) -> None:
    contents = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        temporary_path.write_bytes(contents)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def build_bright_catalog(source: Path, output: Path, names_path: Path = DEFAULT_NAMES) -> dict:
    verify_source(source)
    with source.open("rb") as stream:
        frame = hipparcos.load_dataframe(stream)
    if len(frame) != SOURCE_ROWS:
        raise ValueError("unexpected Hipparcos source row count")
    names = json.loads(names_path.read_text(encoding="utf-8"))
    if not isinstance(names, dict):
        raise ValueError("star names must be an object keyed by HIP ID")
    records, quality = select_bright_records(frame, names)
    metadata = {
        "catalogVersion": CATALOG_VERSION,
        "sourceLabel": SOURCE_LABEL,
        "sourceUrl": SOURCE_URL,
        "sourceReference": "ESA 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200; CDS I/239/hip_main",
        "sourceSha256": SOURCE_SHA256,
        "catalogSha256": catalog_digest(records),
        "nameAliasesSha256": catalog_digest(names),
        "recordCount": len(records),
        "maxMagnitude": MAX_MAGNITUDE,
        "coordinateFrame": "ICRS",
        "epochYear": 1991.25,
        "properMotionUnits": "mas/year; RA includes cos(dec)",
        "parallaxUnits": "mas; missing or non-positive values use zero (unknown distance)",
        "radialVelocity": "not supplied by this catalog; Skyfield default 0 km/s",
        "constellations": "Skyfield bundled boundaries, evaluated at catalog ICRS position",
        "displayNames": "Existing Astune display aliases; otherwise HIP identifier. Not a complete IAU name list.",
        "generatorSkyfieldVersion": skyfield.__version__,
        "quality": quality,
    }
    write_json(output, records)
    write_json(output.with_suffix(".meta.json"), metadata)
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--names", type=Path, default=DEFAULT_NAMES)
    parser.add_argument("--download", action="store_true", help="download the source if absent")
    args = parser.parse_args()
    if not args.source.exists():
        if not args.download:
            parser.error("source is missing; supply --source or opt in with --download")
        download_source(args.source)
    metadata = build_bright_catalog(args.source, args.output, args.names)
    print(f"{metadata['catalogVersion']}: {metadata['recordCount']} stars -> {args.output}")


if __name__ == "__main__":
    main()
