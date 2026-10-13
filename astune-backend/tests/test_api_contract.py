from fastapi.testclient import TestClient

from app.main import app
from app.schemas.location import LocationRequest
from app.services.location_service import LocationResolver
from app.core.config import Settings


def test_openapi_documents_internal_fields_examples_and_real_error_envelopes():
    client = TestClient(app)
    assert client.get("/docs").status_code == 200
    schema = client.get("/openapi.json").json()
    assert "Next.js" in schema["info"]["description"]
    location = schema["components"]["schemas"]["LocationRequest"]
    assert location["properties"]["limit"]["default"] == 5
    assert location["examples"][0]["query"] == "서울"
    preview = schema["components"]["schemas"]["PreviewRequest"]
    assert "birth_time_local" in preview["properties"]
    assert "birth_time" not in preview["properties"]
    for path in ["/api/v1/locations/resolve", "/api/v1/readings/preview"]:
        responses = schema["paths"][path]["post"]["responses"]
        for status in ["422", "429", "500", "503"]:
            assert responses[status]["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")
    properties = schema["components"]["schemas"]["PreviewData"]["properties"]
    assert "selected_star" in properties
    assert "sections" not in properties and "scores" not in properties


def test_location_limit_uses_cached_full_candidates_and_remains_strict(monkeypatch):
    resolver = LocationResolver(Settings(_env_file=None))
    try:
        candidates = tuple(location for location, _ in resolver.cities)[:4]
        monkeypatch.setattr(resolver, "_local", lambda *args: candidates)
        assert len(resolver.search(LocationRequest(query="same", limit=1)).items) == 1
        larger = resolver.search(LocationRequest(query="same", limit=3))
        assert larger.cache_hit
        assert len(larger.items) == 3
    finally:
        resolver.close()
    client = TestClient(app)
    for limit in [0, 11, 1.5, True, "3"]:
        response = client.post("/api/v1/locations/resolve", json={"query": "서울", "limit": limit})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_request_id_is_returned_on_domain_validation_and_success_responses():
    client = TestClient(app)
    for payload, status in [({"query": "서울", "limit": 1}, 200), ({"latitude": 91}, 422),
                            ({"latitude": 0, "longitude": -140}, 422)]:
        response = client.post("/api/v1/locations/resolve", json=payload, headers={"X-Request-ID": "contract-test"})
        assert response.status_code == status
        assert response.headers["X-Request-ID"] == "contract-test"
        if status != 200:
            assert response.json()["error"]["request_id"] == "contract-test"
    response = client.post("/api/v1/locations/resolve", content="{", headers={"X-Request-ID": "not valid"})
    assert response.status_code == 422
    assert response.headers["X-Request-ID"] != "not valid"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]


def test_unexpected_errors_keep_the_request_id_without_leaking_exception_details(monkeypatch):
    from app.api.v1.endpoints import locations

    def fail():
        raise RuntimeError("private implementation detail")

    monkeypatch.setattr(locations, "get_location_resolver", fail)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post("/api/v1/locations/resolve", json={"query": "서울"},
                           headers={"X-Request-ID": "unexpected-error"})
    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == "unexpected-error"
    assert response.json()["error"]["request_id"] == "unexpected-error"
    assert response.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert "private implementation detail" not in response.text
