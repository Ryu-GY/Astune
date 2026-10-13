import json
import re
from pathlib import Path

# One checked-in contract is consumed by both servers.
POLICIES = json.loads((Path(__file__).resolve().parents[3] / "data/contracts/error-policy.json").read_text(encoding="utf-8"))


def public_error(code: str, details=None) -> tuple[int, dict]:
    if code not in POLICIES:
        code = "INTERNAL_SERVER_ERROR"
    policy = POLICIES[code]
    safe = {}
    if isinstance(details, dict):
        fields = details.get("fields", [])
        if isinstance(fields, list):
            fields = [value for value in fields if isinstance(value, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_.]{0,79}", value)][:20]
            if fields:
                safe["fields"] = fields
        folds = details.get("availableFolds", details.get("available_folds", []))
        if isinstance(folds, list) and folds:
            safe["availableFolds"] = [value for value in folds if type(value) is int and value in (0, 1)]
    return policy["status"], {
        "code": code, "message": policy["message"] + " " + policy["recovery"],
        "category": policy["category"], "recovery": policy["recovery"], "details": safe or None,
    }
