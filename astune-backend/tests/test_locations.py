from concurrent.futures import ThreadPoolExecutor
from datetime import date, time
import json

from fastapi.testclient import TestClient
import httpx
import pytest

from app.core.cache import TTLCache
from app.core.config import Settings
from app.core.exceptions import AppException
from app.main import app
from app.schemas.location import LocationRequest
from app.schemas.preview import PreviewRequest
from app.services.location_service import LocationResolver, resolve_location


@pytest.fixture
def resolver():
    instance = LocationResolver(Settings(_env_file=None))
    yield instance
    instance.close()


def test_shared_dictionary_aliases_country_and_cache(resolver):
    first = resolver.search(LocationRequest(query="  서울특별시  ", country_code="kr"))
    assert first.items[0].city_name == "Seoul"
    assert first.items[0].timezone == "Asia/Seoul"
    assert not first.cache_hit
    assert resolver.search(LocationRequest(query="서울특별시", country_code="KR")).cache_hit
    assert not resolver.search(LocationRequest(query="서울", country_code="JP")).items
    assert resolver.search(LocationRequest(query="파리")).items[0].country_code == "FR"
    assert resolver.search(LocationRequest(query="  NEW   YORK  ")).items[0].timezone == "America/New_York"
    assert len(resolver.cities) == 13
    for name in ["서울특별시", "부산광역시", "인천광역시", "대구광역시", "대전광역시", "광주광역시", "울산광역시", "제주시"]:
        assert resolver.search(LocationRequest(query=name)).items[0].timezone == "Asia/Seoul"


def test_external_is_disabled_by_default_even_when_requested(resolver, monkeypatch):
    monkeypatch.setattr(resolver.client, "get", lambda *a, **k: pytest.fail("external geocoder disabled"))
    assert not resolver.search(LocationRequest(query="Berlin", allow_external=True)).items


@pytest.mark.parametrize(("latitude", "longitude", "timezone"), [
    (37.5665, 126.978, "Asia/Seoul"),
    (40.7128, -74.006, "America/New_York"),
    (27.7172, 85.324, "Asia/Kathmandu"),
    (-33.8688, 151.2093, "Australia/Sydney"),
])
def test_coordinate_timezones_are_offline(resolver, latitude, longitude, timezone, monkeypatch):
    monkeypatch.setattr(resolver.client, "get", lambda *a, **k: pytest.fail("coordinate lookup must be offline"))
    result = resolver.search(LocationRequest(latitude=latitude, longitude=longitude))
    assert result.items[0].timezone == timezone
    assert result.items[0].timezone_source == "coordinates"
    assert resolver.search(LocationRequest(latitude=latitude, longitude=longitude)).cache_hit


def test_ocean_requires_manual_timezone_and_override_is_isolated(resolver):
    with pytest.raises(AppException) as error:
        resolver.search(LocationRequest(latitude=0, longitude=-140))
    assert error.value.code == "TIMEZONE_REQUIRED"
    manual = resolver.search(LocationRequest(latitude=0, longitude=-140, timezone="Etc/GMT+9"))
    assert manual.items[0].timezone_source == "manual"
    override = resolver.search(LocationRequest(query="Seoul", timezone="UTC"))
    assert override.items[0].timezone == "UTC"
    assert resolver.search(LocationRequest(query="Seoul")).items[0].timezone == "Asia/Seoul"
    with pytest.raises(AppException) as invalid:
        resolver.search(LocationRequest(latitude=0, longitude=0, timezone="Invalid/Zone"))
    assert invalid.value.code == "TIMEZONE_NOT_FOUND"


def test_cache_expiry_capacity_and_single_flight():
    now = [0.0]
    cache = TTLCache(2, 10, clock=lambda: now[0])
    calls = []
    def build():
        calls.append(1)
        return 42
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert all(value == 42 for value, _ in pool.map(lambda _: cache.get_or_create("a", build), range(20)))
    assert len(calls) == 1
    now[0] = 11
    assert cache.get_or_create("a", build) == (42, False)
    cache.get_or_create("b", build)
    cache.get_or_create("c", build)
    assert cache.get_or_create("a", build)[1] is False
    with pytest.raises(RuntimeError):
        cache.get_or_create("failure", lambda: (_ for _ in ()).throw(RuntimeError()))
    assert cache.get_or_create("failure", build)[1] is False


def remote_resolver(handler, clock=lambda: 100.0):
    settings = Settings(_env_file=None, GEOCODER_ENABLED=True)
    return LocationResolver(settings, client=httpx.Client(transport=httpx.MockTransport(handler)), clock=clock)


def test_external_is_explicit_cached_and_rate_limited():
    calls = []
    now = [100.0]
    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"results": [{"name": "Berlin", "latitude": 52.52, "longitude": 13.405,
            "timezone": "Europe/Berlin", "country_code": "DE", "country": "Germany"}]})
    resolver = remote_resolver(handler, clock=lambda: now[0])
    try:
        assert not resolver.search(LocationRequest(query="Berlin")).items
        assert calls == []
        request = LocationRequest(query="Berlin", country_code="DE", allow_external=True)
        first = resolver.search(request)
        assert first.items[0].timezone == "Europe/Berlin"
        assert "GeoNames" in first.items[0].attribution
        assert resolver.search(request).cache_hit
        assert len(calls) == 1
        assert calls[0].url.params["countryCode"] == "DE"
        assert "birth_date" not in str(calls[0].url)
        with pytest.raises(AppException) as rate:
            resolver.search(LocationRequest(query="Rome", allow_external=True))
        assert rate.value.status_code == 429
        now[0] += 1.1
        resolver.search(LocationRequest(query="Rome", allow_external=True))
        assert len(calls) == 2
    finally:
        resolver.close()


@pytest.mark.parametrize("mode", ["timeout", "429", "bad_json", "bad_coords"])
def test_external_failures_are_actionable_and_not_cached(mode):
    calls = []
    now = [100.0]
    def handler(request):
        calls.append(1)
        if mode == "timeout":
            raise httpx.ReadTimeout("timeout")
        if mode == "429":
            return httpx.Response(429)
        if mode == "bad_json":
            return httpx.Response(200, text="not json")
        return httpx.Response(200, json={"results": [{"name": "broken", "latitude": 999, "longitude": 0, "timezone": "UTC"}]})
    resolver = remote_resolver(handler, clock=lambda: now[0])
    try:
        for _ in range(2):
            with pytest.raises(AppException) as error:
                resolver.search(LocationRequest(query="Berlin", allow_external=True))
            assert error.value.code == "GEOCODER_UNAVAILABLE"
            assert "직접 입력" in error.value.message
            now[0] += 2
        assert len(calls) == 2
    finally:
        resolver.close()


def test_ambiguous_city_requires_selection(tmp_path, monkeypatch):
    from app.services import location_service
    path = tmp_path / "cities.json"
    path.write_text(json.dumps([
        {"name": "Springfield", "country": "US", "latitude": 39.8, "longitude": -89.6, "timezone": "America/Chicago"},
        {"name": "Springfield", "country": "US", "latitude": 42.1, "longitude": -72.6, "timezone": "America/New_York"},
    ]), encoding="utf-8")
    resolver = LocationResolver(Settings(_env_file=None, CITY_DATA_PATH=str(path)))
    monkeypatch.setattr(location_service, "get_location_resolver", lambda: resolver)
    try:
        with pytest.raises(AppException) as error:
            resolve_location(PreviewRequest(birth_date=date(2000, 1, 1), birth_time=time(12), city_name="Springfield"))
        assert error.value.status_code == 409
        assert len(error.value.details["items"]) == 2
    finally:
        resolver.close()


def test_location_api_and_preview_without_timezone():
    client = TestClient(app)
    response = client.post("/api/v1/locations/resolve", json={"latitude": 37.5665, "longitude": 126.978})
    assert response.status_code == 200
    assert response.json()["data"]["items"][0]["timezone"] == "Asia/Seoul"
    assert client.get("/api/v1/locations/resolve", params={"q": "서울"}).json()["data"]["items"][0]["city_name"] == "Seoul"
    for invalid in [{}, {"latitude": 1}, {"latitude": 91, "longitude": 0}, {"query": "  "}, {"query": "Seoul", "timezone": " "}]:
        assert client.post("/api/v1/locations/resolve", json=invalid).status_code == 400
    from app.core.config import get_settings
    if get_settings().astro_ephemeris_abspath.exists():
        result = client.post("/api/v1/readings/preview", json={"birth_date": "1995-05-05", "birth_time_local": "15:00",
            "latitude": 37.5665, "longitude": 126.978})
        assert result.status_code == 200, result.text
        assert result.json()["data"]["utc_datetime"] == "1995-05-05T06:00:00+00:00"
