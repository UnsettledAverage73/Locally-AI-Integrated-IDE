from fastapi.testclient import TestClient
import unittest
from main import app

class TestModelManager(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_system_resources(self):
        response = self.client.get("/api/system-resources")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("ram_total_gb", data)
        self.assertIn("disk_free_gb", data)
        self.assertGreater(data["ram_total_gb"], 0)

    def test_config_status(self):
        response = self.client.get("/config/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("mode", data)

if __name__ == "__main__":
    unittest.main()
