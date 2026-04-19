from __future__ import annotations

import json
import os
import socket
import sys
from typing import Any

from . import PROTOCOL_VERSION
from .protocol import Request, error_response, ok_response


class SidecarServer:
    def __init__(self) -> None:
        self.client_name: str | None = None
        self.client_protocol_version: str | None = None
        self.workspace_root: str | None = None
        self.active_model = os.environ.get("LOCALDEV_ACTIVE_MODEL", "qwen2.5:0.5b")
        self._shutdown_requested = False

    def run_stdio(self) -> int:
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue

            response = self._handle_line(line)
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()

            if self._shutdown_requested:
                break

        return 0

    def _handle_line(self, line: str) -> dict[str, Any]:
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            return error_response("unknown", "invalid_json", str(exc))

        try:
            request = Request.from_dict(payload)
        except ValueError as exc:
            request_id = str(payload.get("id", "unknown"))
            return error_response(request_id, "invalid_request", str(exc))

        try:
            return self._dispatch(request)
        except Exception as exc:  # pragma: no cover
            return error_response(request.id, "internal_error", str(exc))

    def _dispatch(self, request: Request) -> dict[str, Any]:
        method = request.method

        if method == "initialize":
            self.client_name = str(request.params.get("client", "unknown"))
            self.client_protocol_version = str(
                request.params.get("protocol_version", "unknown")
            )
            return ok_response(
                request.id,
                {
                    "name": "localdev-sidecar",
                    "protocol_version": PROTOCOL_VERSION,
                    "capabilities": {
                        "transport": "stdio-jsonl",
                        "methods": [
                            "initialize",
                            "health",
                            "shutdown",
                            "workspace.open",
                            "models.list",
                            "chat.ask",
                        ],
                    },
                },
            )

        if method == "health":
            return ok_response(
                request.id,
                {
                    "status": "ok",
                    "hostname": socket.gethostname(),
                    "workspace_root": self.workspace_root,
                    "active_model": self.active_model,
                },
            )

        if method == "workspace.open":
            root = request.params.get("root")
            if not isinstance(root, str) or not root:
                return error_response(
                    request.id, "invalid_params", "workspace.open requires root"
                )
            self.workspace_root = os.path.abspath(root)
            return ok_response(
                request.id,
                {
                    "workspace_root": self.workspace_root,
                },
            )

        if method == "models.list":
            model_names = [
                name.strip()
                for name in os.environ.get(
                    "LOCALDEV_MODELS", "qwen2.5:0.5b,nomic-embed-text"
                ).split(",")
                if name.strip()
            ]
            return ok_response(
                request.id,
                {
                    "models": model_names,
                    "active_model": self.active_model,
                },
            )

        if method == "chat.ask":
            prompt = request.params.get("prompt")
            if not isinstance(prompt, str) or not prompt.strip():
                return error_response(
                    request.id, "invalid_params", "chat.ask requires prompt"
                )

            trimmed_prompt = prompt.strip()
            workspace = self.workspace_root or "no workspace opened"
            answer = (
                f"[localdev-sidecar]\n"
                f"model: {self.active_model}\n"
                f"workspace: {workspace}\n\n"
                f"Prompt received:\n{trimmed_prompt}\n\n"
                f"This is the first prompt bridge. Ollama-backed generation is the next upgrade."
            )
            return ok_response(
                request.id,
                {
                    "answer": answer,
                    "active_model": self.active_model,
                    "workspace_root": self.workspace_root,
                },
            )

        if method == "shutdown":
            self._shutdown_requested = True
            return ok_response(request.id, {"status": "shutting_down"})

        return error_response(
            request.id, "unknown_method", f"Unknown method: {request.method}"
        )
