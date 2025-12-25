import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.services.ai_services import ollama_service, rag_service
from src.services.types import FileOperationRequest

config = {
    "name": "FSReadDirectory",
    "type": "api",
    "path": "/fs/read-directory",
    "method": "POST",
    "bodySchema": FileOperationRequest.model_json_schema(),
    "emits": []
}

async def handler(req, context):
    try:
        full_path = os.path.abspath(req.path)
        
        if not os.path.exists(full_path):
            return {"status": 404, "body": {
                "detail": "Directory not found"
            }}
        
        entries = []
        with os.scandir(full_path) as it:
            for entry in it:
                stats = entry.stat()
                entries.append({
                    "name": entry.name,
                    "path": entry.path,
                    "isDirectory": entry.is_dir(),
                    "size": stats.st_size,
                })
        return {"status": 200, "body": {
            "entries": entries
        }}
    except Exception as e:
        return {"status": 500, "body": {
            "detail": str(e)
        }}
