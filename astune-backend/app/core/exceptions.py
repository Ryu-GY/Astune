from typing import Any

from app.core.error_codes import ErrorCode


class AppException(Exception):
    def __init__(
        self,
        *,
        code: ErrorCode,
        message: str,
        status_code: int,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class AstuneError(AppException):
    def __init__(self, code: ErrorCode, message: str, details: Any | None = None) -> None:
        status = 422
        if code == ErrorCode.CATALOG_NOT_READY:
            status = 503
        elif code == ErrorCode.CALCULATION_FAILED:
            status = 500
        super().__init__(code=code, message=message, status_code=status, details=details)


class ValidationError(AstuneError):
    def __init__(self, message: str, details: Any | None = None) -> None:
        super().__init__(ErrorCode.VALIDATION_ERROR, message, details)
