from typing import Any

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
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
