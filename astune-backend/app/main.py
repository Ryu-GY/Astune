from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.root import router as root_router
from app.api.v1.router import router as v1_router
from app.core.config import get_settings
from app.core.exception_handlers import register_exception_handlers
from app.middlewares.request_id import RequestIdMiddleware


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
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
