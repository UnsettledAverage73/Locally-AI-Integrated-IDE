from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os

# These are custom modules likely defined in a separate 'services.py' file.
# They handle the heavy lifting for AI logic and Database logic.
from services import OllamaService, RAGService

app = FastAPI()

# --- CONFIGURATION ---
# CORS (Cross-Origin Resource Sharing) Setup
# This is a security feature. We are telling the server to accept requests 
# ONLY from the frontend running at http://localhost:5173.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"], 
    allow_credentials=True,
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, PUT, DELETE)
    allow_headers=["*"], # Allows all headers (like Content-Type, Authorization)
)

# --- SERVICE INITIALIZATION ---
# We create instances of our services once so they stay alive while the server runs.
ollama_service = OllamaService()
# The RAG service needs the Ollama service to generate embeddings, so we pass it in.
rag_service = RAGService(ollama_service=ollama_service)


# --- DATA MODELS (PYDANTIC) ---
# These classes define the "shape" of the JSON data we expect from the frontend.
# If the frontend sends data that doesn't match these shapes, FastAPI throws an error.

class ChatMessage(BaseModel):
    role: str       # e.g., "user" or "assistant"
    content: str    # e.g., "How do I write a for loop?"

class ChatRequest(BaseModel):
    model: str      # e.g., "llama3" or "mistral"
    messages: List[Dict[str, str]] # A history of the chat conversation

class GenerateEmbeddingRequest(BaseModel):
    text: str       # The text we want to convert into a vector

class IndexFileRequest(BaseModel):
    file_path: str  # Where the file is located
    content: str    # The actual code inside the file

class GetContextRequest(BaseModel):
    query: str
    current_file: str | None = None # Optional: The file the user is currently looking at

class FileOperationRequest(BaseModel):
    path: str       # Generic request for operations that just need a path

class WriteFileRequest(FileOperationRequest):
    content: str    # Inherits 'path' from FileOperationRequest and adds 'content'


# --- BASIC ENDPOINTS ---

@app.get("/")
async def read_root():
    """Simple health check to see if the server is up."""
    return {"message": "LocalDev Backend is running!"}

# --- OLLAMA (AI) ENDPOINTS ---

@app.get("/ollama/check")
async def ollama_check():
    """Checks if the Ollama application is actually running on the machine."""
    available = await ollama_service.check_connection()
    return {"available": available}

@app.get("/ollama/models")
async def ollama_models():
    """Asks Ollama what models (e.g., Llama3, Cody) are downloaded."""
    models = await ollama_service.list_models()
    return {"models": models}

@app.post("/ollama/chat")
async def ollama_chat(request: ChatRequest):
    """Sends the chat history to the LLM and waits for the response."""
    response_content = await ollama_service.chat_completion(request.model, request.messages)
    return {"content": response_content}

@app.post("/ollama/generate_embedding")
async def ollama_generate_embedding(request: GenerateEmbeddingRequest):
    """Converts text into a list of numbers (vector) for the database."""
    embedding = await ollama_service.generate_embedding(request.text)
    return {"embedding": embedding}


# --- RAG (MEMORY) ENDPOINTS ---

@app.post("/rag/index")
async def rag_index_file(request: IndexFileRequest):
    """
    Takes a file, breaks it into chunks, converts chunks to vectors, 
    and saves them in the vector database.
    """
    await rag_service.index_file(request.file_path, request.content)
    return {"status": "indexed"}

@app.post("/rag/context")
async def rag_get_context(request: GetContextRequest):
    """
    Searches the vector database for code snippets relevant to the user's query.
    Used to give the AI 'context' before it answers.
    """
    context = await rag_service.get_context(request.query, request.current_file)
    return {"context": context}

@app.post("/rag/clear")
async def rag_clear_index():
    """Wipes the vector database clean (useful when switching projects)."""
    await rag_service.clear_index()
    return {"status": "index cleared"}


# --- FILE SYSTEM ENDPOINTS ---
# NOTE: In a production app, strict security checks are needed here to prevent 
# users from accessing system files (like /etc/passwd) outside the project folder.

@app.post("/fs/read-directory")
async def fs_read_directory(request: FileOperationRequest):
    try:
        full_path = os.path.abspath(request.path)
        
        # Check if the folder actually exists
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Directory not found")
        
        entries = []
        # Scan the directory and gather details about every file/folder inside
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
        # If anything goes wrong (permissions, etc.), send a 500 error
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fs/read-file")
async def fs_read_file(request: FileOperationRequest):
    try:
        full_path = os.path.abspath(request.path)
        # Verify it exists and is actually a file (not a folder)
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
        
        # Ensure the folder structure exists before creating the file.
        # e.g., if writing to "src/components/Button.tsx", ensure "src/components" exists.
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(request.content)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
