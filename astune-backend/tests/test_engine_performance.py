from concurrent.futures import ThreadPoolExecutor
from datetime import date, time
from pathlib import Path
import json

from fastapi.testclient import TestClient
import pytest
from skyfield.api import wgs84

from app.astro.engine import AstronomyEngine, EngineConfig
from app.astro.schemas import BirthMomentInput
from app.astro.time_utils import resolve_local_datetime
from app.core.config import get_settings
from app.core.exceptions import AstuneError


@pytest.fixture
def engine():
    settings = get_settings()
    if not settings.astro_ephemeris_abspath.exists():
        pytest.skip("Run npm run backend:data")
    instance = AstronomyEngine(EngineConfig(catalog_path=settings.astro_catalog_abspath, ephemeris_path=settings.astro_ephemeris_abspath))
    yield instance
    instance.close()


def moment(**changes):
    return BirthMomentInput(birth_date=date(2000, 1, 1), birth_time_local=time(12), timezone="UTC",
                            location_name="Synthetic benchmark", latitude=changes.pop("latitude", 37.5665),
                            longitude=changes.pop("longitude", 126.978), max_magnitude=changes.pop("max_magnitude", 5.5), **changes)


@pytest.mark.parametrize(("latitude", "longitude", "limit"), [(37.5665, 126.978, 5.5), (-33.8688, 151.2093, 5.5), (89, 0, 2.0)])
def test_vectorized_matches_independent_scalar_observation(engine, latitude, longitude, limit):
    request = moment(latitude=latitude, longitude=longitude, max_magnitude=limit)
    actual = engine.calculate_representative_star(request)
    resolved = resolve_local_datetime(local_date=request.birth_date, local_time=request.birth_time_local, timezone_name="UTC", dst_fold=None)
    observer = (engine._earth + wgs84.latlon(latitude, longitude)).at(engine._timescale.from_datetime(resolved.utc_dt))
    candidates = []
    for item in engine._prepared_targets:
        if item.record.magnitude > limit:
            continue
        alt, az, _ = observer.observe(item.target).apparent().altaz()
        if alt.degrees > 0:
            candidates.append((float(alt.degrees), item.record.magnitude, item.record.hip_id, float(az.degrees)))
    best = sorted(candidates, key=lambda item: (-item[0], item[1], item[2]))[0]
    assert actual.selected_star.id == best[2]
    assert actual.astronomy_meta.candidate_count == len(candidates)
    assert actual.metrics.altitude_deg == pytest.approx(best[0], abs=0.00051)
    assert actual.metrics.azimuth_deg == pytest.approx(best[3], abs=0.00051)


def test_warm_requests_do_not_reopen_files_and_are_thread_safe(engine, monkeypatch):
    engine.preflight()
    request = moment()
    expected = engine.calculate_representative_star(request)
    monkeypatch.setattr(Path, "open", lambda *a, **k: pytest.fail("warm request reopened a data file"))
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: engine.calculate_representative_star(request), range(16)))
    assert all(result == expected for result in results)


def test_vectorized_ties_keep_brightness_and_hip_order(engine, tmp_path):
    row = json.loads(engine.config.catalog_path.read_text(encoding="utf-8"))[0]
    # Identical astrometry guarantees a tie regardless of floating-point vector order.
    for bright in (False, True):
        path = tmp_path / f"ties-{bright}.json"
        path.write_text(json.dumps([{**row, "hipId": 8, "magnitude": 0 if bright else 1},
                                    {**row, "hipId": 3, "magnitude": 1}]), encoding="utf-8")
        candidate_engine = AstronomyEngine(EngineConfig(catalog_path=path, ephemeris_path=engine.config.ephemeris_path))
        try:
            # Sirius is above the horizon here.
            result = candidate_engine.calculate_representative_star(moment(latitude=0, longitude=100))
            assert result.selected_star.id == (8 if bright else 3)
        finally:
            candidate_engine.close()


def test_missing_or_invalid_ephemeris_fails_preflight(tmp_path):
    for path in (tmp_path / "missing.bsp", tmp_path / "corrupt.bsp"):
        if path.name == "corrupt.bsp":
            path.write_bytes(b"invalid SPK")
        instance = AstronomyEngine(EngineConfig(catalog_path=get_settings().astro_catalog_abspath, ephemeris_path=path))
        with pytest.raises(AstuneError) as error:
            instance.preflight()
        assert error.value.code == "CATALOG_NOT_READY"


def test_lifespan_warms_readiness_and_fails_closed(engine, monkeypatch, tmp_path):
    import app.main as main
    monkeypatch.setattr(main, "get_astronomy_engine", lambda: engine)
    # The real factory exposes cache_clear; supply it for lifecycle cleanup in this fixture.
    main.get_astronomy_engine.cache_clear = lambda: None
    with TestClient(main.create_app()) as client:
        ready = client.get("/ready")
        assert ready.status_code == 200
        assert ready.json()["data"]["catalog_count"] == 2848
        assert ready.json()["data"]["start_tdb"] == "1899-07-29"
        assert ready.json()["data"]["end_tdb"] == "2053-10-09"
    missing = AstronomyEngine(EngineConfig(catalog_path=engine.config.catalog_path, ephemeris_path=tmp_path / "missing.bsp"))
    monkeypatch.setattr(main, "get_astronomy_engine", lambda: missing)
    main.get_astronomy_engine.cache_clear = lambda: None
    with pytest.raises(AstuneError):
        with TestClient(main.create_app()):
            pytest.fail("server started with missing ephemeris")
