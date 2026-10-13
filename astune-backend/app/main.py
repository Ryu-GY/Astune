from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.root import router as root_router
from app.api.v1.router import router as v1_router
from app.core.config import get_settings
from app.core.exception_handlers import register_exception_handlers
from app.middlewares.request_id import RequestIdMiddleware
from app.services.preview_service import get_astronomy_engine
from app.services.location_service import get_location_resolver


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = get_astronomy_engine()
    resolver = get_location_resolver()
    try:
        app.state.astronomy_ready = engine.preflight()
        resolver.cities
        resolver.timezone_finder
        yield
    finally:
        app.state.astronomy_ready = None
        engine.close()
        resolver.close()
        get_astronomy_engine.cache_clear()
        get_location_resolver.cache_clear()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(root_router)
    app.include_router(v1_router)
    return app


app = create_app()
