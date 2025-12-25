import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service, rag_service
from src.services.types import IndexFileRequest

config = {
    "name": "RAGIndex",
    "type": "api",
    "path": "/rag/index",
    "method": "POST",
    "bodySchema": IndexFileRequest.model_json_schema(),
    "emits": []
}

async def handler(req, context):
    request_data = IndexFileRequest(**req)
    await rag_service.index_file(request_data.file_path, request_data.content)
    return {"status": 200, "body": {"status": "indexed"}}
