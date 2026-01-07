from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import os
import difflib
import sys
import psutil
from telemetry import telemetry
import time
import httpx

# Platform specific imports
if sys.platform != "win32":
    import pty
    import termios
    import fcntl
    import struct
    import select

# --- SERVICES ---
from services import OllamaService, RAGService
from bedrock_service import BedrockService
from git_service import GitService
from optimizer_service import OptimizerService
from services.llm_service import chat_with_tools, execute_tool_and_continue, stream_chat_with_tools, stream_execute_tool_and_continue
from services.model_loader import ensure_nomic_model
from routers import files
from file_watcher import start_watcher

# --- WEBSOCKET MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass  # Handle disconnected clients

manager = ConnectionManager()

# --- LIFESPAN MANAGER ---
file_observer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP LOGIC ---
    print("🚀 Sovereign IDE Starting up...")
    
    # 1. Provision Nomic Model
    print("🧠 Checking Neural Resources...")
    success = await ensure_nomic_model()
    
    if not success:
        print("❌ CRITICAL WARNING: Embedding model failed to load. RAG features will be broken.")
    else:
        print("✅ Neural Resources Active.")

    # 2. Start File Watcher
    global file_observer
    try:
        loop = asyncio.get_running_loop()
        # Watch the current directory
        file_observer = start_watcher(".", loop, manager.broadcast)
        print("👀 File Watcher Started on root directory.")
    except Exception as e:
        print(f"⚠️ Failed to start file watcher: {e}")

    yield

    # --- SHUTDOWN LOGIC ---
    print("🛑 Shutting down...")
    if file_observer:
        print("🛑 Stopping File Watcher...")
        file_observer.stop()
        file_observer.join()

app = FastAPI(lifespan=lifespan)

# --- CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- APP STATE (IN-MEMORY SECURITY) ---
app_state = {
    "mode": "local",  # 'local' or 'cloud'
    "aws_creds": None,
}

# --- SERVICE INITIALIZATION ---
ollama_service = OllamaService()
rag_service = RAGService(ollama_service=ollama_service)
git_service = GitService(ollama_service=ollama_service)
optimizer = OptimizerService()

# --- ROUTER REGISTRATION ---
app.include_router(files.router)

# --- DATA MODELS ---

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[Dict[str, Any]]
    options: Dict[str, Any] | None = None

class CompletionRequest(BaseModel):
    model: str
    prefix: str
    suffix: str
    options: Dict[str, Any] | None = None

class ConfigRequest(BaseModel):
    mode: str
    aws_access_key: str | None = None
    aws_secret_key: str | None = None
    aws_session_token: str | None = None
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
    file_path: str

class GitStageRequest(BaseModel):
    path: str

class GitCommitRequest(BaseModel):
    message: str

class OptimizeRequest(BaseModel):
    file_path: str
    instruction: str
    model: str | None = "deepseek-coder"

class ExecuteToolRequest(BaseModel):
    model: str
    messages: List[Dict[str, Any]]
    tool_call: Dict[str, Any]
    approved: bool
    options: Dict[str, Any] | None = None

# --- ENDPOINTS ---

@app.get("/")
async def read_root():
    return {"message": "LocalDev Backend is running!"}

@app.post("/config/update")
async def update_config(request: ConfigRequest):
    app_state["mode"] = request.mode
    if request.aws_access_key and request.aws_secret_key:
        app_state["aws_creds"] = {
            "access_key": request.aws_access_key,
            "secret_key": request.aws_secret_key,
            "session_token": request.aws_session_token,
            "region": request.aws_region,
        }
    return {"status": "success", "mode": app_state["mode"]}

@app.get("/config/status")
async def get_config_status():
    return {"mode": app_state["mode"], "has_keys": app_state["aws_creds"] is not None}

# --- GIT ENDPOINTS ---

@app.get("/git/status")
async def git_status():
    try:
        changes = git_service.get_status()
        return {"changes": changes}
    except Exception as e:
        return {"error": str(e), "changes": []}

@app.post("/git/stage")
async def git_stage(request: GitStageRequest):
    try:
        git_service.stage_file(request.path)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/unstage")
async def git_unstage(request: GitStageRequest):
    try:
        git_service.unstage_file(request.path)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/generate-message")
async def git_generate_message():
    message = await git_service.generate_commit_message()
    return {"message": message}

@app.post("/git/commit")
async def git_commit(request: GitCommitRequest):
    try:
        git_service.commit(request.message)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/git/branch")
async def git_get_branch():
    current_branch = git_service.get_current_branch()
    branches = git_service.get_branches()
    return {"current": current_branch, "branches": branches}

@app.get("/git/branches")
async def git_list_branches():
    branches = git_service.get_branches()
    return {"branches": branches}

class GitBranchRequest(BaseModel):
    name: str

@app.post("/git/branch/checkout")
async def git_checkout_branch(request: GitBranchRequest):
    try:
        git_service.checkout_branch(request.name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/branch/create")
async def git_create_branch(request: GitBranchRequest):
    try:
        git_service.create_branch(request.name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/push")
async def git_push():
    try:
        git_service.push()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/pull")
async def git_pull():
    try:
        git_service.pull()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- OLLAMA / CHAT ENDPOINTS ---

@app.get("/ollama/check")
async def ollama_check():
    available = await ollama_service.check_connection()
    return {"available": available}

@app.get("/ollama/models")
async def ollama_models():
    models = await ollama_service.list_models()
    return {"models": models}

class PullModelRequest(BaseModel):
    model: str

@app.post("/ollama/pull")
async def ollama_pull(request: PullModelRequest):
    try:
        await ollama_service.pull_model(request.model)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/ollama/pull")
async def ollama_pull_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        model_name = await websocket.receive_text()
        print(f"Starting pull for: {model_name}")

        async for progress in ollama_service.pull_model_stream(model_name):
            data = progress
            if hasattr(progress, "model_dump"):
                data = progress.model_dump()
            elif hasattr(progress, "dict"):
                data = progress.dict()
            
            await websocket.send_json(data)

        await websocket.send_json({"status": "done"})
    except Exception as e:
        print(f"WebSocket Error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass
    finally:
        await websocket.close()

@app.delete("/ollama/models/{model_name}")
async def ollama_delete(model_name: str):
    try:
        await ollama_service.delete_model(model_name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system-resources")
async def get_system_resources():
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "ram_total_gb": round(mem.total / (1024**3), 2),
        "ram_available_gb": round(mem.available / (1024**3), 2),
        "disk_total_gb": round(disk.total / (1024**3), 2),
        "disk_free_gb": round(disk.free / (1024**3), 2),
    }

@app.post("/ollama/chat")
async def ollama_chat(request: ChatRequest):
    """Smart Chat Handler: Decides between Local (Ollama) or Cloud (Bedrock)."""
    start_time = time.time()
    try:
        if app_state["mode"] == "cloud" and app_state["aws_creds"]:
            try:
                bedrock = BedrockService(
                    aws_access_key=app_state["aws_creds"]["access_key"],
                    aws_secret_key=app_state["aws_creds"]["secret_key"],
                    aws_session_token=app_state["aws_creds"]["session_token"],
                    region=app_state["aws_creds"]["region"],
                )
                print("☁️ Using Cloud Brain (Bedrock)...")
                content = await bedrock.chat_completion(request.messages)
                response = {
                    "content": content,
                    "tool_calls": [],
                    "messages": request.messages + [{"role": "assistant", "content": content}],
                    "status": "complete"
                }
            except Exception as e:
                response = {"error": f"Cloud Error: {str(e)}"}
                raise HTTPException(status_code=500, detail=response["error"])
        else:
            print("💻 Using Local Brain (Ollama with Tools)...")
            response = await chat_with_tools(
                request.model, request.messages, request.options
            )

        telemetry.log_trace(
            feature="chat",
            model=request.model,
            start_time=start_time,
            input_text=str(request.messages),
            output_text=str(response.get("content", "")),
        )
        return response

    except Exception as e:
        telemetry.log_trace(
            feature="chat",
            model=request.model,
            start_time=start_time,
            input_text=str(request.messages),
            output_text=str(e),
            success=False,
        )
        raise e

@app.post("/ollama/tool/execute")
async def ollama_tool_execute(request: ExecuteToolRequest):
    try:
        response = await execute_tool_and_continue(
            request.model, 
            request.messages, 
            request.tool_call, 
            request.approved,
            request.options
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ollama/complete")
async def ollama_complete(request: CompletionRequest):
    content = await ollama_service.generate_completion(
        request.model, request.prefix, request.suffix, request.options
    )
    return {"content": content}

@app.post("/ollama/generate_embedding")
async def ollama_generate_embedding(request: GenerateEmbeddingRequest):
    embedding = await ollama_service.generate_embedding(request.text)
    return {"embedding": embedding}

# --- RAG ENDPOINTS ---

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
                entries.append(
                    {
                        "name": entry.name,
                        "path": entry.path,
                        "isDirectory": entry.is_dir(),
                        "size": stats.st_size,
                    }
                )
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
    original_lines = request.original_content.splitlines(keepends=True)
    proposed_lines = request.proposed_content.splitlines(keepends=True)
    diff = difflib.unified_diff(
        original_lines,
        proposed_lines,
        fromfile=f"a/{request.file_path}",
        tofile=f"b/{request.file_path}",
        lineterm="",
    )
    return {"diff": "".join(diff)}

@app.post("/fs/apply-diff")
async def fs_apply_diff(request: WriteFileRequest):
    try:
        full_path = os.path.abspath(request.path)
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            raise HTTPException(status_code=404, detail="File not found")

        with open(full_path, "w", encoding="utf-8") as f:
            f.write(request.content)
        return {
            "status": "success",
            "message": f"Successfully applied changes to {request.path}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/files/optimize")
def optimize_file_endpoint(req: OptimizeRequest):
    return optimizer.optimize_file(req.file_path, req.instruction, req.model)

# --- TERMINAL ENDPOINT ---

@app.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()

    if sys.platform == "win32":
        await websocket.send_text("Terminal not supported on Windows.\r\n")
        await websocket.close()
        return

    master_fd, slave_fd = pty.openpty()
    pid = os.fork()
    if pid == 0:
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(master_fd)
        os.close(slave_fd)
        shell = os.environ.get("SHELL", "/bin/bash")
        os.execv(shell, [shell])
    else:
        os.close(slave_fd)
        loop = asyncio.get_event_loop()

        async def read_from_pty():
            def _read():
                try:
                    return os.read(master_fd, 10240)
                except OSError:
                    return b""
            while True:
                output = await loop.run_in_executor(None, _read)
                if not output:
                    break
                try:
                    await websocket.send_text(output.decode(errors="replace"))
                except:
                    break

        async def write_to_pty():
            try:
                while True:
                    data = await websocket.receive_text()
                    if data.startswith("RESIZE:"):
                        try:
                            _, params = data.split(":", 1)
                            cols, rows = map(int, params.split(","))
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

        task_read = asyncio.create_task(read_from_pty())
        task_write = asyncio.create_task(write_to_pty())
        try:
            await asyncio.wait(
                [task_read, task_write], return_when=asyncio.FIRST_COMPLETED
            )
        finally:
            task_read.cancel()
            task_write.cancel()
            try:
                os.close(master_fd)
            except:
                pass
            try:
                os.kill(pid, 9)
                os.waitpid(pid, 0)
            except:
                pass

@app.get("/ops/stats")
async def get_ops_stats():
    return telemetry.get_stats()

@app.websocket("/ws/ollama/chat_v2")
async def websocket_chat_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            request_type = data.get("type")

            if request_type == "chat":
                model = data.get("model", "deepseek-coder")
                messages = data.get("messages", [])
                options = data.get("options", {})

                async for chunk in stream_chat_with_tools(model, messages, options):
                    await websocket.send_json(chunk)

            elif request_type == "tool_exec":
                model = data.get("model", "deepseek-coder")
                messages = data.get("messages", [])
                tool_call = data.get("tool_call")
                approved = data.get("approved")
                options = data.get("options", {})

                async for chunk in stream_execute_tool_and_continue(model, messages, tool_call, approved, options):
                    await websocket.send_json(chunk)
            else:
                await websocket.send_json({"type": "error", "error": "Invalid request type"})

    except WebSocketDisconnect:
        print("Client disconnected from chat websocket.")
    except Exception as e:
        print(f"Chat WebSocket Error: {e}")
        await websocket.send_json({"type": "error", "error": str(e)})

@app.websocket("/ws/files")
@app.websocket("/fs/file")
async def websocket_files_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/fs/watch")
async def watch_directory(request: FileOperationRequest):
    global file_observer
    try:
        if file_observer:
            file_observer.stop()
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, file_observer.join)

        loop = asyncio.get_running_loop()
        file_observer = start_watcher(request.path, loop, manager.broadcast)
        return {"status": "success", "watching": request.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)