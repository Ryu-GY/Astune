from typing import Any

from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
    category: str
    recovery: str
    request_id: str | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorBody


class HealthData(BaseModel):
    app_name: str
    environment: str
    status: str


class HealthResponse(BaseModel):
    success: bool = True
    data: HealthData
