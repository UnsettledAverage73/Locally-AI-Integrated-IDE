import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service, rag_service
from src.services.types import GetContextRequest

config = {
    "name": "RAGContext",
    "type": "api",
    "path": "/rag/context",
    "method": "POST",
    "bodySchema": GetContextRequest.model_json_schema(),
    "emits": []
}

async def handler(req, context):
    request_data = GetContextRequest(**req)
    context_data = await rag_service.get_context(request_data.query, request_data.current_file)
    return {"status": 200, "body": {"context": context_data}}
