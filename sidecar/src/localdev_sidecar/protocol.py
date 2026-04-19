from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class Request:
    id: str
    method: str
    params: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "Request":
        request_id = str(payload.get("id", ""))
        method = payload.get("method")
        params = payload.get("params", {})
        if not request_id:
            raise ValueError("Request is missing id")
        if not isinstance(method, str) or not method:
            raise ValueError("Request is missing method")
        if params is None:
            params = {}
        if not isinstance(params, dict):
            raise ValueError("Request params must be an object")
        return cls(id=request_id, method=method, params=params)


def ok_response(request_id: str, result: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": request_id,
        "ok": True,
        "result": result,
    }


def error_response(request_id: str, code: str, message: str) -> dict[str, Any]:
    return {
        "id": request_id,
        "ok": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
