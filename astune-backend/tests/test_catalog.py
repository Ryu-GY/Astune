import json

import numpy as np
import pandas as pd
import pytest
from skyfield.api import Star, load, load_constellation_names

from app.astro.build_bright_catalog import (
    DEFAULT_OUTPUT, DEFAULT_SOURCE, build_bright_catalog, select_bright_records,
)
from app.astro.catalog import (
    load_bright_star_catalog, load_catalog_metadata, load_prepared_star_targets,
)
from app.core.exceptions import AstuneError


def source_row(**changes):
    return {
        "hip": 32349, "magnitude": -1.44,
        "ra_hours": 101.28854105 / 15, "dec_degrees": -16.71314306,
        "epoch_year": 1991.25, "ra_mas_per_year": -546.01,
        "dec_mas_per_year": -1223.08, "parallax_mas": 379.21,
        **changes,
    }


def test_checked_in_catalog_coverage_and_identity():
    records = load_bright_star_catalog(str(DEFAULT_OUTPUT))
    metadata = load_catalog_metadata(str(DEFAULT_OUTPUT))
    assert len(records) == metadata["recordCount"] == 2848
    assert metadata["catalogVersion"] == "hipparcos-i239-vmag5.5-v1"
    assert metadata["quality"]["excludedMissingPositionHipIds"] == [55203, 78727, 115125]
    assert len({record.hip_id for record in records}) == len(records)
    assert max(record.magnitude for record in records) == 5.5
    assert min(record.dec_degrees for record in records) < -80
    assert max(record.dec_degrees for record in records) > 80
    codes = dict(load_constellation_names())
    assert all(record.constellation_code in codes for record in records)
    assert all(record.epoch_year == 1991.25 for record in records)
    names = {record.display_name: record for record in records}
    assert names["Betelgeuse"].hip_id == 27989
    assert names["Rigel"].hip_id == 24436
    assert names["Deneb"].hip_id == 102098
    assert names["Sirius"].magnitude == -1.44


def test_selection_includes_boundary_excludes_missing_positions_and_is_stable():
    frame = pd.DataFrame([
        source_row(hip=1, magnitude=5.5, parallax_mas=-1, ra_mas_per_year=np.nan),
        source_row(hip=2, magnitude=5.5001),
        source_row(hip=3, ra_hours=np.nan),
        source_row(hip=4, magnitude=np.nan),
        source_row(),
    ]).set_index("hip")
    records, quality = select_bright_records(frame, {"32349": "Sirius"})
    assert [record["hipId"] for record in records] == [32349, 1]
    assert records[0]["constellationCode"] == "CMa"
    assert records[1]["name"] == "HIP 1"
    assert records[1]["parallaxMas"] == records[1]["raMasPerYear"] == 0
    assert quality["excludedMissingPositionHipIds"] == [3]
    assert quality["missingMagnitudeRows"] == 1
    assert quality["zeroMotionFallbackHipIds"] == [1]
    assert quality["zeroParallaxFallbackHipIds"] == [1]
    assert (records, quality) == select_bright_records(frame.iloc[::-1], {"32349": "Sirius"})


@pytest.mark.parametrize("changes", [
    {"ra_hours": 24}, {"dec_degrees": np.inf}, {"epoch_year": 2000},
    {"ra_mas_per_year": np.inf}, {"magnitude": np.inf},
])
def test_builder_refuses_invalid_astrometry(changes):
    with pytest.raises(ValueError):
        select_bright_records(pd.DataFrame([source_row(**changes)]).set_index("hip"), {})


def test_builder_refuses_duplicate_ids_and_corrupt_source(tmp_path):
    with pytest.raises(ValueError, match="duplicate HIP"):
        select_bright_records(pd.DataFrame([source_row(), source_row()]).set_index("hip"), {})
    source = tmp_path / "hip_main.dat"
    source.write_bytes(b"incomplete download")
    output = tmp_path / "bright-stars.json"
    output.write_text("previous catalog", encoding="utf-8")
    with pytest.raises(ValueError, match="checksum mismatch"):
        build_bright_catalog(source, output)
    assert output.read_text(encoding="utf-8") == "previous catalog"


def test_metadata_is_newline_independent_and_detects_changed_catalog(tmp_path):
    path = tmp_path / "valid.json"
    path.write_bytes(DEFAULT_OUTPUT.read_bytes().replace(b"\n", b"\r\n"))
    path.with_suffix(".meta.json").write_bytes(DEFAULT_OUTPUT.with_suffix(".meta.json").read_bytes())
    assert load_catalog_metadata(str(path))["recordCount"] == 2848
    changed = tmp_path / "changed.json"
    changed.write_text("[]", encoding="utf-8")
    changed.with_suffix(".meta.json").write_bytes(path.with_suffix(".meta.json").read_bytes())
    with pytest.raises(AstuneError, match="inconsistent"):
        load_catalog_metadata(str(changed))
    with pytest.raises(AstuneError, match="missing"):
        load_catalog_metadata(str(tmp_path / "absent.json"))


@pytest.mark.parametrize("patch", [
    {"raMasPerYear": float("nan")}, {"decMasPerYear": float("inf")},
    {"epochYear": float("nan")}, {"parallaxMas": -1},
])
def test_runtime_rejects_invalid_motion(tmp_path, patch):
    record = json.loads(DEFAULT_OUTPUT.read_text(encoding="utf-8"))[0]
    path = tmp_path / "bad.json"
    path.write_text(json.dumps([{**record, **patch}]), encoding="utf-8")
    with pytest.raises(AstuneError):
        load_bright_star_catalog(str(path))


def test_sirius_matches_skyfield_reference_with_epoch_and_motion():
    # Independent source values from ESA I/239 hip_main.dat, HIP 32349.
    reference = Star.from_dataframe(pd.Series(source_row()))
    actual = next(item.target for item in load_prepared_star_targets(str(DEFAULT_OUTPUT)) if item.record.hip_id == 32349)
    ts = load.timescale(builtin=True)
    from skyfield.api import load_file
    from app.core.config import get_settings
    ephemeris = get_settings().astro_ephemeris_abspath
    if not ephemeris.exists():
        pytest.skip("Run npm run backend:data for the astrometric regression")
    eph = load_file(str(ephemeris))
    try:
        observer = eph["earth"].at(ts.utc(2050, 1, 1))
        expected_position = observer.observe(reference)
        actual_position = observer.observe(actual)
        assert actual_position.separation_from(expected_position).arcseconds() < 0.00001
        frozen = Star(ra_hours=reference.ra.hours, dec_degrees=reference.dec.degrees)
        assert observer.observe(frozen).separation_from(expected_position).arcseconds() > 60
    finally:
        eph.close()


def test_full_source_rebuild_is_reproducible(tmp_path):
    if not DEFAULT_SOURCE.exists():
        pytest.skip("Optional source replay: npm run backend:catalog -- --download")
    output = tmp_path / "bright-stars.json"
    metadata = build_bright_catalog(DEFAULT_SOURCE, output)
    assert json.loads(output.read_text(encoding="utf-8")) == json.loads(DEFAULT_OUTPUT.read_text(encoding="utf-8"))
    assert metadata == json.loads(DEFAULT_OUTPUT.with_suffix(".meta.json").read_text(encoding="utf-8"))
