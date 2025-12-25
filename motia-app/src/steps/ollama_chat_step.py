import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service
from src.services.types import ChatRequest

config = {
    "name": "OllamaChat",
    "type": "api",
    "path": "/ollama/chat",
    "method": "POST",
    "bodySchema": ChatRequest.model_json_schema(),
    "emits": []
}

async def handler(req, context):
    request_data = ChatRequest(**req)
    response_content = await ollama_service.chat_completion(request_data.model, request_data.messages)
    return {"status": 200, "body": {"content": response_content}}
