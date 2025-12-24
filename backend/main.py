from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
import difflib
import pty
import select
import struct
import fcntl
import termios
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

# --- SERVICES ---
# Ensure you have created bedrock_service.py and services.py!
from services import OllamaService, RAGService
from bedrock_service import BedrockService

app = FastAPI()

# --- CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# --- APP STATE (IN-MEMORY SECURITY) ---
# SECURITY NOTE: Credentials (aws_creds) are stored ONLY in memory.
# They are never written to disk, databases, or logs.
# They persist only for the duration of the backend process.
app_state = {
    "mode": "local", # 'local' or 'cloud'
    "aws_creds": None # { "access_key": "...", "secret_key": "...", "session_token": "..." }
}

# --- SERVICE INITIALIZATION ---
ollama_service = OllamaService()
rag_service = RAGService(ollama_service=ollama_service)

# --- DATA MODELS ---

class ChatMessage(BaseModel):
    role: str       
    content: str    

class ChatRequest(BaseModel):
    model: str      
    messages: List[Dict[str, str]] 

class ConfigRequest(BaseModel):
    mode: str 
    aws_access_key: str | None = None
    aws_secret_key: str | None = None
    aws_session_token: str | None = None  # <--- Add this field
    aws_region: str | None = "us-east-1"

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

class DiffRequest(BaseModel):
    original_content: str
    proposed_content: str
    file_path: str # Added to pass file path to diff

# --- ENDPOINTS ---

@app.get("/")
async def read_root():
    return {"message": "LocalDev Backend is running!"}

# 2. Update the Config Endpoint
@app.post("/config/update")
async def update_config(request: ConfigRequest):
    app_state["mode"] = request.mode
    
    if request.aws_access_key and request.aws_secret_key:
        app_state["aws_creds"] = {
            "access_key": request.aws_access_key,
            "secret_key": request.aws_secret_key,
            "session_token": request.aws_session_token, # <--- Store it
            "region": request.aws_region
        }
    
    return {"status": "success", "mode": app_state["mode"]}

@app.get("/config/status")
async def get_config_status():
    return {
        "mode": app_state["mode"], 
        "has_keys": app_state["aws_creds"] is not None
    }

# --- OLLAMA / CHAT ENDPOINTS ---

@app.get("/ollama/check")
async def ollama_check():
    available = await ollama_service.check_connection()
    return {"available": available}

@app.get("/ollama/models")
async def ollama_models():
    models = await ollama_service.list_models()
    return {"models": models}

# 3. Update the Chat Handler
@app.post("/ollama/chat")
async def ollama_chat(request: ChatRequest):
    """
    Smart Chat Handler: Decides between Local (Ollama) or Cloud (Bedrock).
    """
    
    # 1. Check if we should use Cloud Mode
    if app_state["mode"] == "cloud" and app_state["aws_creds"]:
        try:
            # Initialize with Session Token
            bedrock = BedrockService(
                aws_access_key=app_state["aws_creds"]["access_key"],
                aws_secret_key=app_state["aws_creds"]["secret_key"],
                aws_session_token=app_state["aws_creds"]["session_token"], # <--- Pass it here
                region=app_state["aws_creds"]["region"]
            )
            print("☁️ Using Cloud Brain (Bedrock)...")
            content = await bedrock.chat_completion(request.messages)
            return {"content": content}
            
        except Exception as e:
            return {"content": f"⚠️ Cloud Error: {str(e)}"}

    # 2. Default: Local Mode
    print("💻 Using Local Brain (Ollama)...")
    response_content = await ollama_service.chat_completion(request.model, request.messages)
    return {"content": response_content}

@app.post("/ollama/generate_embedding")
async def ollama_generate_embedding(request: GenerateEmbeddingRequest):
    embedding = await ollama_service.generate_embedding(request.text)
    return {"embedding": embedding}


# --- RAG (MEMORY) ENDPOINTS ---

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


# --- FILE SYSTEM ENDPOINTS ---

@app.post("/fs/read-directory")
async def fs_read_directory(request: FileOperationRequest):
    try:
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
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(request.content)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fs/diff")
async def fs_diff_content(request: DiffRequest):
    """Generates a unified diff between original and proposed content."""
    original_lines = request.original_content.splitlines(keepends=True)
    proposed_lines = request.proposed_content.splitlines(keepends=True)
    
    # Generate a unified diff
    diff = difflib.unified_diff(
        original_lines,
        proposed_lines,
        fromfile=f"a/{request.file_path}",
        tofile=f"b/{request.file_path}",
        lineterm='' # Prevent extra newlines
    )
    return {"diff": "".join(diff)}

@app.post("/fs/apply-diff")
async def fs_apply_diff(request: WriteFileRequest):
    """Applies changes to a file."""
    try:
        full_path = os.path.abspath(request.path)
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(request.content)
        return {"status": "success", "message": f"Successfully applied changes to {request.path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- TERMINAL ENDPOINT ---

@app.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()
    
    # Spawn a pseudo-terminal
    master_fd, slave_fd = pty.openpty()
    
    # Start the shell (bash)
    pid = os.fork()
    if pid == 0:
        # Child process
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(master_fd)
        os.close(slave_fd)
        
        # Default to bash
        shell = os.environ.get("SHELL", "/bin/bash")
        os.execv(shell, [shell])
    else:
        # Parent process (FastAPI)
        os.close(slave_fd)
        
        loop = asyncio.get_event_loop()

        async def read_from_pty():
            def _read():
                try:
                    # Read up to 10kb
                    return os.read(master_fd, 10240)
                except OSError:
                    return b""
            
            while True:
                output = await loop.run_in_executor(None, _read)
                if not output:
                    break
                try:
                    await websocket.send_text(output.decode(errors='replace'))
                except:
                    break

        async def write_to_pty():
            try:
                while True:
                    data = await websocket.receive_text()
                    # Check for resize command (custom protocol: "RESIZE:cols,rows")
                    if data.startswith("RESIZE:"):
                        try:
                            _, params = data.split(":", 1)
                            cols, rows = map(int, params.split(","))
                            # Set terminal size
                            winsize = struct.pack("HHHH", rows, cols, 0, 0)
                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                        except Exception as e:
                            print(f"Resize Error: {e}")
                        continue
                        
                    os.write(master_fd, data.encode())
            except WebSocketDisconnect:
                pass
            except Exception as e:
                print(f"Write PTY Error: {e}")

        # Run tasks concurrently
        task_read = asyncio.create_task(read_from_pty())
        task_write = asyncio.create_task(write_to_pty())
        
        try:
            await asyncio.wait([task_read, task_write], return_when=asyncio.FIRST_COMPLETED)
        finally:
            # Cleanup
            task_read.cancel()
            task_write.cancel()
            try:
                os.close(master_fd)
            except:
                pass
            # Kill child process
            try:
                os.kill(pid, 9)
                os.waitpid(pid, 0)
            except:
                pass

if __name__ == "__main__":
    import uvicorn
    # The 'app' must match your FastAPI variable name
    # '0.0.0.0' or '127.0.0.1' is fine. Port 8000 is standard.
    uvicorn.run(app, host="127.0.0.1", port=8000)
