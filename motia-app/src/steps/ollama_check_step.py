import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service

config = {
    "name": "OllamaCheck",
    "type": "api",
    "path": "/ollama/check",
    "method": "GET",
    "emits": []
}

async def handler(req, context):
    available = await ollama_service.check_connection()
    return {"status": 200, "body": {"available": available}}
