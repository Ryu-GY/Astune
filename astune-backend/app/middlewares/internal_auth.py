from hmac import compare_digest

from starlette.datastructures import Headers
from starlette.responses import JSONResponse

from app.core.error_policy import public_error
from app.core.telemetry import record_error


class InternalAuthMiddleware:
    """Only Next.js may call the public host's calculation endpoints."""

    def __init__(self, app, api_key: str):
        self.app = app
        self.api_key = api_key

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and self.api_key and scope["path"].startswith("/api/"):
            supplied = Headers(scope=scope).get("X-Astune-Internal-Key", "")
            if not compare_digest(supplied.encode(), self.api_key.encode()):
                status, error = public_error("AUTH_REQUIRED")
                record_error(error["code"])
                error["request_id"] = scope.get("state", {}).get("request_id")
                return await JSONResponse({"success": False, "error": error}, status_code=status)(scope, receive, send)
        await self.app(scope, receive, send)
