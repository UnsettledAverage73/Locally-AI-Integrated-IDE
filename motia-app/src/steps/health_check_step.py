import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

config = {
    "name": "HealthCheck",
    "type": "api",
    "path": "/health",
    "method": "GET",
    "emits": []
}

async def handler(req, context):
    return {"status": 200, "body": {"message": "LocalDev Backend is running!"}}
