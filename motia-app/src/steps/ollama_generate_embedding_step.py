import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service
from src.services.types import GenerateEmbeddingRequest

config = {
    "name": "OllamaGenerateEmbedding",
    "type": "api",
    "path": "/ollama/generate_embedding",
    "method": "POST",
    "bodySchema": GenerateEmbeddingRequest.model_json_schema(),
    "emits": []
}

async def handler(req, context):
    request_data = GenerateEmbeddingRequest(**req)
    embedding = await ollama_service.generate_embedding(request_data.text)
    return {"status": 200, "body": {"embedding": embedding}}
