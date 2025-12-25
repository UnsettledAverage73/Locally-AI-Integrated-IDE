import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service, rag_service

config = {
    "name": "RAGClear",
    "type": "api",
    "path": "/rag/clear",
    "method": "POST",
    "emits": []
}

async def handler(req, context):
    await rag_service.clear_index()
    return {"status": 200, "body": {"status": "index cleared"}}
