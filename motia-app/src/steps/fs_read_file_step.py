import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service, rag_service
from src.services.types import FileOperationRequest

config = {
    "name": "FSReadFile",
    "type": "api",
    "path": "/fs/read-file",
    "method": "POST",
    "bodySchema": FileOperationRequest.model_json_schema(),
    "emits": []
}

async def handler(req, context):
    try:
        full_path = os.path.abspath(req.path)
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return {"status": 404, "body": {
                "detail": "File not found"
            }}
        
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"status": 200, "body": {
            "content": content
        }}
    except Exception as e:
        return {"status": 500, "body": {
            "detail": str(e)
        }}
