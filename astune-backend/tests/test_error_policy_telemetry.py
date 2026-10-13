from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import app
from app.core.error_policy import POLICIES
from app.core.exception_handlers import register_exception_handlers
from app.core.exceptions import AppException
from app.middlewares.request_id import RequestIdMiddleware
from app.services import preview_service
from app.astro.catalog import load_bright_star_catalog

BASE = {"birth_date":"1995-05-05", "birth_time_local":"15:00:00", "city_name":"Seoul"}


@pytest.mark.parametrize("code", list(POLICIES))
def test_shared_error_status_recovery_and_safe_details(code):
    probe = FastAPI()
    register_exception_handlers(probe)
    probe.add_middleware(RequestIdMiddleware)

    @probe.get("/probe")
    def fail():
        raise AppException(code=code, message="PRIVATE_MESSAGE", status_code=418,
                           details={"birth_date":"PRIVATE_BIRTH", "catalog_path":"PRIVATE_PATH", "available_folds":[0,1]})

    response = TestClient(probe).get("/probe", headers={"X-Request-ID":"policy-test"})
    error = response.json()["error"]
    assert response.status_code == POLICIES[code]["status"]
    assert error["code"] == code
    assert error["category"] == POLICIES[code]["category"]
    assert error["recovery"] == POLICIES[code]["recovery"]
    assert error["details"] == {"availableFolds":[0,1]}
    assert "PRIVATE" not in response.text
    assert response.headers["X-Request-ID"] == error["request_id"]
    assert "total;dur=" in response.headers["Server-Timing"]


@pytest.mark.parametrize("patch", [
    {"birth_date":0}, {"birth_date":"1995-05-05T00:00:00"}, {"birth_date":"2024-02-30"},
    {"birth_time_local":0}, {"birth_time_local":"12:00:00Z"}, {"birth_time_local":"12:00:00+09:00"},
    {"latitude":True,"longitude":127}, {"latitude":"37.5","longitude":127},
    {"longitude":181,"latitude":37.5}, {"max_magnitude":True}, {"dst_fold":True},
])
def test_internal_api_rejects_coercions_offsets_and_invalid_dates_without_echoing_inputs(patch):
    response = TestClient(app).post("/api/v1/readings/preview", json={**BASE, **patch, "location_name":"PRIVATE_LOCATION"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "PRIVATE_LOCATION" not in response.text
    assert "1995-05-05" not in response.text


def test_future_date_uses_birthplace_date_including_today_before_noon(monkeypatch):
    class FixedClock:
        @staticmethod
        def now(zone):
            return datetime(2026, 10, 13, 0, 30, tzinfo=UTC).astimezone(zone)

    monkeypatch.setattr(preview_service, "datetime", FixedClock)
    client = TestClient(app)
    seoul = client.post("/api/v1/readings/preview", json={**BASE,"birth_date":"2026-10-13","birth_time_local":"12:00:00"})
    assert seoul.status_code == 200
    previous_day = client.post("/api/v1/readings/preview", json={**BASE,"birth_date":"2026-10-13","timezone":"America/Los_Angeles"})
    assert previous_day.status_code == 422
    assert previous_day.json()["error"]["code"] == "BIRTH_DATE_IN_FUTURE"


def test_extreme_old_date_is_range_error_not_internal_failure():
    response = TestClient(app).post("/api/v1/readings/preview", json={**BASE,"birth_date":"0001-01-01","birth_time_local":"00:00:00"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "EPHEMERIS_OUT_OF_RANGE"


def test_concurrent_logs_and_headers_do_not_leak_birth_inputs_or_queries(caplog):
    def call(index):
        return TestClient(app).post("/api/v1/readings/preview?name=PRIVATE_QUERY", json={**BASE,"location_name":"PRIVATE_LOCATION"},
                                   headers={"X-Request-ID":f"trace-{index}","Authorization":"Bearer PRIVATE_TOKEN"})

    with ThreadPoolExecutor(max_workers=3) as executor:
        responses = list(executor.map(call, range(3)))
    logs = [json.loads(record.message) for record in caplog.records if record.name == "astune.request"]
    assert len(logs) == 3
    assert {row["requestId"] for row in logs} == {f"trace-{index}" for index in range(3)}
    for index, response in enumerate(responses):
        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == f"trace-{index}"
        assert "astronomy;dur=" in response.headers["Server-Timing"]
    for row in logs:
        assert row["durationMs"] >= 0
        assert set(row["stages"]) == {"location","validation","astronomy"}
        assert set(row["calculation"]) == {"engineName","catalogVersion","candidateCount"}
        assert "PRIVATE" not in json.dumps(row)
        assert "1995-05-05" not in json.dumps(row)


def test_unexpected_exception_is_traced_without_its_message_or_stack(monkeypatch, caplog):
    def fail(_payload):
        raise RuntimeError("PRIVATE_BIRTH PRIVATE_COORDINATES PRIVATE_TOKEN")

    monkeypatch.setattr(preview_service, "resolve_location", fail)
    response = TestClient(app).post("/api/v1/readings/preview", json=BASE, headers={"X-Request-ID":"failure-trace"})
    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == "failure-trace"
    assert response.json()["error"]["request_id"] == "failure-trace"
    assert "PRIVATE" not in response.text
    assert "PRIVATE" not in caplog.text
    row = json.loads([record.message for record in caplog.records if record.name == "astune.request"][-1])
    assert row["errorCode"] == "INTERNAL_SERVER_ERROR"
    assert row["stages"]["location"] >= 0


def test_corrupt_server_catalog_is_a_system_failure_not_user_input_error(tmp_path):
    for index, contents in enumerate([{}, [None], [{"hip_id":1}]]):
        path = tmp_path / f"invalid-{index}.json"
        path.write_text(json.dumps(contents), encoding="utf-8")
        with pytest.raises(AppException) as error:
            load_bright_star_catalog(str(path))
        assert error.value.code == "CATALOG_NOT_READY"
        assert error.value.status_code == 503
