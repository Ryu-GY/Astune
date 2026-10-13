import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.core.error_codes import ErrorCode
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def handle_app_exception(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "request_id": _request_id(request),
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {
                    "code": ErrorCode.VALIDATION_ERROR,
                    "message": "요청 형식이 올바르지 않습니다.",
                    "details": {"errors": jsonable_encoder(exc.errors(), custom_encoder={ValueError: str})},
                    "request_id": _request_id(request),
                },
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            # ServerErrorMiddleware runs outside the request-ID middleware.
            headers={"X-Request-ID": _request_id(request)} if _request_id(request) else {},
            content={
                "success": False,
                "error": {
                    "code": ErrorCode.INTERNAL_SERVER_ERROR,
                    "message": "서버 내부 오류가 발생했습니다.",
                    "details": {},
                    "request_id": _request_id(request),
                },
            },
        )
