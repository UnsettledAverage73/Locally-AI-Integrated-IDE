import json
import unittest

from localdev_sidecar.server import SidecarServer


class SidecarServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = SidecarServer()

    def _request(self, payload: dict) -> dict:
        return self.server._handle_line(json.dumps(payload))

    def test_initialize_returns_capabilities(self) -> None:
        response = self._request(
            {
                "id": "1",
                "method": "initialize",
                "params": {"client": "test", "protocol_version": "0.1.0"},
            }
        )
        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["name"], "localdev-sidecar")

    def test_workspace_open_sets_absolute_root(self) -> None:
        response = self._request(
            {
                "id": "2",
                "method": "workspace.open",
                "params": {"root": "."},
            }
        )
        self.assertTrue(response["ok"])
        self.assertTrue(response["result"]["workspace_root"].startswith("/"))

    def test_unknown_method_returns_error(self) -> None:
        response = self._request(
            {
                "id": "3",
                "method": "nope",
                "params": {},
            }
        )
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "unknown_method")

    def test_chat_ask_returns_answer(self) -> None:
        response = self._request(
            {
                "id": "4",
                "method": "chat.ask",
                "params": {"prompt": "Summarize this repo"},
            }
        )
        self.assertTrue(response["ok"])
        self.assertIn("Summarize this repo", response["result"]["answer"])


if __name__ == "__main__":
    unittest.main()
