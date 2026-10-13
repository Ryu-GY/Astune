from time import perf_counter
from uuid import uuid4
import re

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from app.core.error_policy import public_error
from app.core.telemetry import log_request, request_trace


class RequestIdMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        supplied = Headers(scope=scope).get("X-Request-ID", "")
        request_id = supplied if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}", supplied) else str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        trace = {"requestId": request_id, "stages": {}}
        token = request_trace.set(trace)
        started = perf_counter()
        status = 500
        response_started = False

        async def send_traced(message):
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status = message["status"]
                trace["durationMs"] = round((perf_counter() - started) * 1000, 3)
                trace["stages"] = {name: round(value, 3) for name, value in trace["stages"].items()}
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
                headers["Cache-Control"] = "no-store"
                headers["Server-Timing"] = ", ".join([f"{name};dur={value}" for name, value in trace["stages"].items()] + [f"total;dur={trace['durationMs']}"])
            await send(message)

        try:
            try:
                await self.app(scope, receive, send_traced)
            except Exception:
                # Never log exception text: it can include birth inputs or database values.
                trace["errorCode"] = "INTERNAL_SERVER_ERROR"
                if response_started:
                    raise
                status, error = public_error("INTERNAL_SERVER_ERROR")
                error["request_id"] = request_id
                await JSONResponse({"success": False, "error": error}, status_code=status)(scope, receive, send_traced)
        finally:
            trace["durationMs"] = round((perf_counter() - started) * 1000, 3)
            log_request(scope, trace, status)
            request_trace.reset(token)
