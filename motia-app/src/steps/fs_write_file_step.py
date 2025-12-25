import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service, rag_service
from src.services.types import WriteFileRequest

config = {
    "name": "FSWriteFile",
    "type": "api",
    "path": "/fs/write-file",
    "method": "POST",
    "bodySchema": WriteFileRequest.model_json_schema(),
    "emits": []
}

async def handler(req, context):
    try:
        full_path = os.path.abspath(req.path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": 200, "body": {
            "status": "success"
        }}
    except Exception as e:
        return {"status": 500, "body": {
            "detail": str(e)
        }}
