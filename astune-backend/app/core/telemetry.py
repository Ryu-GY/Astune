from contextlib import contextmanager
from contextvars import ContextVar
from time import perf_counter
import json
import logging

request_trace: ContextVar[dict | None] = ContextVar("request_trace", default=None)
logger = logging.getLogger("astune.request")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())


@contextmanager
def stage(name: str):
    trace = request_trace.get()
    started = perf_counter()
    try:
        yield
    finally:
        if trace is not None:
            stages = trace["stages"]
            stages[name] = stages.get(name, 0) + (perf_counter() - started) * 1000


def record_error(code: str):
    trace = request_trace.get()
    if trace is not None:
        trace["errorCode"] = code


def record_calculation(meta):
    trace = request_trace.get()
    if trace is not None:
        trace["calculation"] = {"engineName": meta.engine_name,
                                "catalogVersion": meta.catalog_version, "candidateCount": meta.candidate_count}


def log_request(scope, trace, status: int):
    route = getattr(scope.get("route"), "path", "other")
    logger.info(json.dumps({"event": "request.completed", "service": "python",
                           "route": route, "method": scope["method"], "status": status,
                           **trace}, ensure_ascii=False))
