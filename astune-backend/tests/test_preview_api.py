from pathlib import Path
from datetime import date, time
import json

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.astro.catalog import load_bright_star_catalog
from app.astro.engine import AstronomyEngine, EngineConfig
from app.astro.time_utils import resolve_local_datetime
from app.core.config import get_settings
from app.core.exceptions import AstuneError
from app.services import preview_service

BASE = {"birth_date": "1995-05-05", "birth_time_local": "15:00:00", "city_name": "Seoul"}
client = TestClient(app, raise_server_exceptions=False)


def test_health_and_name():
    response = client.get("/health", headers={"X-Request-ID": "astune-test"})
    assert response.status_code == 200
    assert response.json()["data"]["app_name"] == "Astune API"
    assert response.headers["X-Request-ID"] == "astune-test"


def test_real_skyfield_preview():
    if not get_settings().astro_ephemeris_abspath.exists():
        pytest.skip("Run python -m app.astro.prepare_data for the real-data integration test")
    response = client.post("/api/v1/readings/preview", json=BASE)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["utc_datetime"] == "1995-05-05T06:00:00+00:00"
    assert data["astronomy_meta"]["engine_name"] == "Skyfield"
    assert data["astronomy_meta"]["candidate_count"] > 0
    assert data["selected_star"]["id"] == 24608  # Capella for this catalog and birth moment.
    assert 0 < data["metrics"]["altitude_deg"] <= 90
    assert abs(data["metrics"]["altitude_deg"] + data["metrics"]["zenith_distance_deg"] - 90) < 0.002
    assert data == client.post("/api/v1/readings/preview", json=BASE).json()["data"]


@pytest.mark.parametrize("body", [
    {"birth_date": "1995-05-05", "birth_time": "15:00:00"},
    {**BASE, "city_name": " "},
    {**BASE, "city_name": "x" * 101},
    {**BASE, "city_name": "", "latitude": 37.5, "longitude": 127},
    {**BASE, "birth_date": "2024-02-31"},
    {**BASE, "birth_time_local": "15:00:00+00:00"},
    {**BASE, "latitude": 91, "longitude": 0, "timezone": "Asia/Seoul"},
    {**BASE, "latitude": 37.5},
    {**BASE, "max_magnitude": 5.6},
])
def test_bad_input_returns_validation_error_not_500(body):
    response = client.post("/api/v1/readings/preview", json=body)
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(("patch", "code"), [
    ({"timezone": "Invalid/Zone"}, "TIMEZONE_NOT_FOUND"),
    ({"birth_date": "2021-03-14", "birth_time_local": "02:30:00", "city_name": "New York"}, "LOCAL_TIME_NONEXISTENT"),
    ({"birth_date": "2021-11-07", "birth_time_local": "01:30:00", "city_name": "New York"}, "LOCAL_TIME_AMBIGUOUS"),
])
def test_time_errors_are_preserved(patch, code):
    response = client.post("/api/v1/readings/preview", json={**BASE, **patch})
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == code


def test_dst_folds_select_distinct_instants():
    first = resolve_local_datetime(local_date=date(2021, 11, 7), local_time=time(1, 30), timezone_name="America/New_York", dst_fold=0)
    second = resolve_local_datetime(local_date=date(2021, 11, 7), local_time=time(1, 30), timezone_name="America/New_York", dst_fold=1)
    assert (second.utc_dt - first.utc_dt).total_seconds() == 3600


def test_unknown_city_is_404():
    response = client.post("/api/v1/readings/preview", json={**BASE, "city_name": "NotARealCity"})
    assert response.status_code == 404


def test_missing_ephemeris_is_actionable(monkeypatch, tmp_path):
    settings = get_settings()
    engine = AstronomyEngine(EngineConfig(catalog_path=settings.astro_catalog_abspath, ephemeris_path=tmp_path / "missing.bsp"))
    monkeypatch.setattr(preview_service, "get_astronomy_engine", lambda: engine)
    response = client.post("/api/v1/readings/preview", json=BASE)
    assert response.status_code == 503, response.text
    assert response.json()["error"]["code"] == "CATALOG_NOT_READY"


def test_empty_catalog_and_invalid_rows(tmp_path):
    for index, contents in enumerate([[], [None], [{"hip_id": 1, "ra_hours": 25, "dec_degrees": 0, "magnitude": 1}]]):
        path = tmp_path / f"catalog-{index}.json"
        path.write_text(json.dumps(contents), encoding="utf-8")
        with pytest.raises(AstuneError):
            load_bright_star_catalog(str(path))


@pytest.mark.parametrize(("patch", "code"), [
    ({"max_magnitude": -2}, "NO_VISIBLE_STAR_CANDIDATE"),
    ({"birth_date": "1800-01-01"}, "EPHEMERIS_OUT_OF_RANGE"),
])
def test_calculation_limits(patch, code):
    if not get_settings().astro_ephemeris_abspath.exists():
        pytest.skip("Local ephemeris required")
    response = client.post("/api/v1/readings/preview", json={**BASE, **patch})
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == code


def test_full_bright_subset_preview():
    if not get_settings().astro_ephemeris_abspath.exists():
        pytest.skip("Local ephemeris required")
    response = client.post("/api/v1/readings/preview", json={**BASE, "max_magnitude": 5.5})
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["astronomy_meta"]["catalog_version"] == "hipparcos-i239-vmag5.5-v1"
    assert data["astronomy_meta"]["candidate_count"] > 1000
    assert data["selected_star"]["magnitude"] <= 5.5
    assert data["metrics"]["altitude_deg"] > 81.5
    assert data["selected_constellation"]["code"]
