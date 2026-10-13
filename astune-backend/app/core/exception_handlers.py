from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import AppException
from app.core.error_policy import public_error
from app.core.telemetry import record_error


def error_response(request: Request, code: str, details=None) -> JSONResponse:
    status, error = public_error(code, details)
    record_error(error["code"])
    error["request_id"] = getattr(request.state, "request_id", None)
    return JSONResponse(status_code=status, content={"success": False, "error": error})


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def handle_app_exception(request: Request, exc: AppException) -> JSONResponse:
        return error_response(request, exc.code, exc.details)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Pydantic input/ctx/message can echo an entire submitted birth record.
        return error_response(request, "VALIDATION_ERROR", {
            "fields": [".".join(str(part) for part in issue["loc"][1:]) for issue in exc.errors()]
        })

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        return error_response(request, "INTERNAL_SERVER_ERROR")
