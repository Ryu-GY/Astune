import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.middlewares.internal_auth import InternalAuthMiddleware
from app.middlewares.request_id import RequestIdMiddleware

KEY = "test-only-internal-key-with-at-least-32-characters"


def test_production_requires_internal_key_and_does_not_display_it():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_ENV="production", ASTUNE_ASTRO_API_KEY="")
    settings = Settings(_env_file=None, APP_ENV="production", ASTUNE_ASTRO_API_KEY=KEY)
    assert KEY not in repr(settings)


def test_only_authenticated_calculations_reach_the_engine_and_health_remains_available(caplog):
    app = FastAPI()
    called = []

    @app.post("/api/v1/probe")
    def probe():
        called.append(True)
        return {"success": True}

    @app.get("/ready")
    def ready():
        return {"success": True}

    app.add_middleware(InternalAuthMiddleware, api_key=KEY)
    app.add_middleware(RequestIdMiddleware)
    client = TestClient(app)
    for supplied in [None, "wrong"]:
        headers = {"X-Request-ID": "deployment-auth-test"}
        if supplied is not None:
            headers["X-Astune-Internal-Key"] = supplied
        response = client.post("/api/v1/probe", headers=headers)
        assert response.status_code == 401
        assert response.json()["error"]["request_id"] == "deployment-auth-test"
    assert called == []
    assert client.get("/ready").status_code == 200
    assert client.post("/api/v1/probe", headers={"X-Astune-Internal-Key": KEY}).status_code == 200
    assert called == [True]
    assert KEY not in caplog.text
