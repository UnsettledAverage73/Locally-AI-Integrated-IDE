import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service

config = {
    "name": "OllamaModels",
    "type": "api",
    "path": "/ollama/models",
    "method": "GET",
    "emits": []
}

async def handler(req, context):
    models = await ollama_service.list_models()
    return {"status": 200, "body": {"models": models}}
