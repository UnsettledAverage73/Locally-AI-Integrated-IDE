from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os

from services import OllamaService, RAGService

app = FastAPI()

# CORS middleware to allow communication from the Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ollama_service = OllamaService()
rag_service = RAGService(ollama_service=ollama_service)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[Dict[str, str]]

class GenerateEmbeddingRequest(BaseModel):
    text: str

class IndexFileRequest(BaseModel):
    file_path: str
    content: str

class GetContextRequest(BaseModel):
    query: str
    current_file: str | None = None

class FileOperationRequest(BaseModel):
    path: str

class WriteFileRequest(FileOperationRequest):
    content: str


@app.get("/")
async def read_root():
    return {"message": "LocalDev Backend is running!"}

@app.get("/ollama/check")
async def ollama_check():
    available = await ollama_service.check_connection()
    return {"available": available}

@app.get("/ollama/models")
async def ollama_models():
    models = await ollama_service.list_models()
    return {"models": models}

@app.post("/ollama/chat")
async def ollama_chat(request: ChatRequest):
    response_content = await ollama_service.chat_completion(request.model, request.messages)
    return {"content": response_content}

@app.post("/ollama/generate_embedding")
async def ollama_generate_embedding(request: GenerateEmbeddingRequest):
    embedding = await ollama_service.generate_embedding(request.text)
    return {"embedding": embedding}

@app.post("/rag/index")
async def rag_index_file(request: IndexFileRequest):
    await rag_service.index_file(request.file_path, request.content)
    return {"status": "indexed"}

@app.post("/rag/context")
async def rag_get_context(request: GetContextRequest):
    context = await rag_service.get_context(request.query, request.current_file)
    return {"context": context}

@app.post("/rag/clear")
async def rag_clear_index():
    await rag_service.clear_index()
    return {"status": "index cleared"}

# File System Endpoints (to replace Electron IPC for project-related files)
@app.post("/fs/read-directory")
async def fs_read_directory(request: FileOperationRequest):
    try:
        # This would ideally use a more robust file system access module
        # For now, a basic implementation that reads from the local file system
        # It's crucial to ensure paths are within the project scope for security
        full_path = os.path.abspath(request.path)
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Directory not found")
        
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
        return {"entries": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fs/read-file")
async def fs_read_file(request: FileOperationRequest):
    try:
        full_path = os.path.abspath(request.path)
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fs/write-file")
async def fs_write_file(request: WriteFileRequest):
    try:
        full_path = os.path.abspath(request.path)
        # Ensure directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(request.content)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
