from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse
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
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Platform specific imports
if sys.platform != "win32":
    import pty
    import termios
    import fcntl
    import struct
    import select

# --- SERVICES ---
from services import OllamaService, RAGService
from services.resource_monitor import get_system_resources as get_full_system_resources
from bedrock_service import BedrockService
from git_service import GitService
from optimizer_service import OptimizerService
from services.llm_service import chat_with_tools, execute_tool_and_continue, stream_chat_with_tools, stream_execute_tool_and_continue
from services.model_loader import ensure_nomic_model
from ralph_engine import RalphEngine
from routers import files, search, chat, cloud
from file_watcher import start_watcher
from services.chat_history import history_service

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

# --- TERMINAL MANAGER ---
class TerminalManager:
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.cleanup_interval_seconds = 300  # Check every 5 minutes
        self.session_timeout_seconds = 1800   # 30 minutes of inactivity

    def create_session(self) -> str:
        session_id = str(uuid.uuid4())
        
        if sys.platform == "win32":
            self.sessions[session_id] = {"pid": None, "master_fd": None, "last_active": time.time()}
            return session_id

        master_fd, slave_fd = pty.openpty()
        pid = os.fork()
        if pid == 0: # Child process
            os.setsid()
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            os.close(master_fd)
            os.close(slave_fd)
            shell = os.environ.get("SHELL", "/bin/bash")
            os.execv(shell, [shell])
        else: # Parent process
            os.close(slave_fd)
            self.sessions[session_id] = {"pid": pid, "master_fd": master_fd, "last_active": time.time()}
            print(f"Terminal session {session_id} created with pid {pid}")
            return session_id

    def update_session_activity(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id]["last_active"] = time.time()

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            session = self.sessions.pop(session_id)
            if session["pid"] is not None:
                try:
                    os.killpg(os.getpgid(session["pid"]), 9) 
                    os.waitpid(session["pid"], 0)
                    print(f"Terminal session {session_id} (pid: {session['pid']}) killed.")
                except (ProcessLookupError, OSError):
                    pass # Process might have already exited
            if session["master_fd"] is not None:
                try:
                    os.close(session["master_fd"])
                except OSError:
                    pass

    async def cleanup_inactive_sessions(self):
        while True:
            await asyncio.sleep(self.cleanup_interval_seconds)
            current_time = time.time()
            sessions_to_remove = [
                sid for sid, data in self.sessions.items()
                if current_time - data["last_active"] > self.session_timeout_seconds
            ]
            for session_id in sessions_to_remove:
                print(f"Cleaning up inactive terminal session {session_id}")
                self.remove_session(session_id)

terminal_manager = TerminalManager()

# --- LIFESPAN MANAGER ---
file_observer = None
lsp_process = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP LOGIC ---
    print("🚀 Sovereign IDE Starting up...")
    
    # 1. Background Provisioning (Non-blocking)
    # We start it as a task so the IDE loads immediately
    async def provision_bg():
        print("🧠 Checking Neural Resources in background...")
        success = await ensure_nomic_model()
        if not success:
            print("❌ CRITICAL WARNING: Embedding model failed to load. RAG features will be broken.")
        else:
            print("✅ Neural Resources Active.")

    provision_task = asyncio.create_task(provision_bg())

    # 2. Parallel initialization of services
    global file_observer
    try:
        loop = asyncio.get_running_loop()
        # Start file watcher and terminal cleanup in parallel
        file_observer = start_watcher(".", loop, manager.broadcast)
        print("👀 File Watcher Started.")
        
        asyncio.create_task(terminal_manager.cleanup_inactive_sessions())
        print("🧹 Terminal session cleanup task started.")
    except Exception as e:
        print(f"⚠️ Failed to start background services: {e}")

    # 3. Fast LSP Spawn
    global lsp_process
    try:
        lsp_process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "backend.language_server",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        print("💡 Language Server Process started.")
    except Exception as e:
        print(f"⚠️ Failed to start LSP process: {e}")

    yield

    # --- SHUTDOWN LOGIC ---
    print("🛑 Shutting down...")
    provision_task.cancel()

app = FastAPI(lifespan=lifespan)

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"🔥 UNHANDLED ERROR: {exc}")
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"message": "An unexpected server error occurred.", "detail": str(exc)},
    )

# --- CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://0.0.0.0:5000",
        "http://0.0.0.0:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- STATS ENGINE (SOVEREIGN OPERATIONS) ---
stats = {
    "total_requests": 0,
    "total_latency_ms": 0,
    "errors": 0,
    "tokens_generated": 0
}

# Cost of GPT-4 per 1k tokens (approx $0.03 for input+output)
GPT4_COST_PER_TOKEN = 0.00003 

@app.get("/api/stats")
async def get_stats():
    # Calculate averages on the fly
    avg_latency = 0
    if stats["total_requests"] > 0:
        avg_latency = stats["total_latency_ms"] / stats["total_requests"]
    
    # Calculate Cost Saved (The "Pitch" Metric)
    money_saved = stats["tokens_generated"] * GPT4_COST_PER_TOKEN

    # Calculate error rate
    error_rate = 0
    if stats["total_requests"] > 0:
        error_rate = (stats["errors"] / stats["total_requests"]) * 100

    return {
        "requests": stats["total_requests"],
        "avg_latency": int(avg_latency),
        "error_rate": round(error_rate, 1), 
        "cost_saved": f"${money_saved:.2f}"
    }

# --- APP STATE (IN-MEMORY SECURITY) ---
app_state = {
    "mode": os.getenv("MODE", "local"),  # 'local' or 'cloud'
    "aws_creds": {
        "access_key": os.getenv("AWS_ACCESS_KEY_ID"),
        "secret_key": os.getenv("AWS_SECRET_ACCESS_KEY"),
        "session_token": os.getenv("AWS_SESSION_TOKEN"),
        "region": os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    } if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY") else None,
}

# --- SERVICE INITIALIZATION ---
ollama_service = OllamaService()
rag_service = RAGService(ollama_service=ollama_service)
git_service = GitService(ollama_service=ollama_service)
optimizer = OptimizerService()
from services.MemoryService import MemoryService
memory_service = MemoryService(ollama_service=ollama_service, rag_service=rag_service)

# --- ROUTER REGISTRATION ---
app.include_router(files.router)
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(cloud.router, prefix="/cloud", tags=["cloud"])

# --- DATA MODELS ---

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[Dict[str, Any]]
    session_id: str | None = None
    options: Dict[str, Any] | None = None

class CreateSessionRequest(BaseModel):
    title: str | None = "New Chat"
    model: str | None = None

class ActiveModelRequest(BaseModel):
    model: str

class MemoryRequest(BaseModel):
    content: str
    category: str
    session_id: str

class ConfigRequest(BaseModel):
    mode: str
    aws_access_key: Optional[str] = None
    aws_secret_key: Optional[str] = None
    aws_session_token: Optional[str] = None
    aws_region: Optional[str] = None

class EnvConfigRequest(BaseModel):
    github_token: Optional[str] = None

class AIHostRequest(BaseModel):
    host: str

class GitStageRequest(BaseModel):
    path: str

class GitCommitRequest(BaseModel):
    message: str

class ExecuteToolRequest(BaseModel):
    model: str
    messages: List[Dict[str, Any]]
    tool_call: Dict[str, Any]

class CompletionRequest(BaseModel):
    model: str
    prefix: str
    suffix: str
    options: Optional[Dict[str, Any]] = None

class GenerateEmbeddingRequest(BaseModel):
    text: str

class IndexFileRequest(BaseModel):
    file_path: str
    content: str

class FileOperationRequest(BaseModel):
    path: str

class GetContextRequest(BaseModel):
    query: str
    current_file: str

class WriteFileRequest(BaseModel):
    path: str
    content: str

class DiffRequest(BaseModel):
    original_content: str
    proposed_content: str

class OptimizeRequest(BaseModel):
    file_path: str
    instruction: str
    model: str

class EditCodeRequest(BaseModel):
    file_path: str
    original_content: str
    instruction: str
    start_line: int
    end_line: int
    start_char: int
    end_char: int

class ProposeFixRequest(BaseModel):
    file_path: str
    line_number: int
    error_message: str

class RalphRequest(BaseModel):
    model: str | None = None
    max_iterations: int = 10
    work_dir: str = "."


# --- CHAT HISTORY ENDPOINTS ---

@app.get("/chat/sessions")
async def list_sessions():
    return history_service.list_sessions()

@app.get("/chat/sessions/{session_id}")
async def get_session(session_id: str):
    session = history_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.post("/chat/sessions")
async def create_session(request: CreateSessionRequest):
    model = request.model or ollama_service.active_model
    session_id = history_service.create_session(request.title, model)
    return {"session_id": session_id}

@app.delete("/chat/sessions/{session_id}")
async def delete_session(session_id: str):
    history_service.delete_session(session_id)
    return {"status": "success"}

@app.get("/chat/memories")
async def get_memories():
    return history_service.get_memories()

@app.post("/chat/memories")
async def add_memory(request: MemoryRequest):
    history_service.add_memory(request.content, request.category, request.session_id)
    return {"status": "success"}

# --- ENDPOINTS ---

@app.get("/")
async def read_root():
    return {"message": "AVERAGE Backend is running!"}

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
    return {
        "mode": app_state["mode"], 
        "has_keys": app_state["aws_creds"] is not None,
        "active_model": ollama_service.active_model,
        "ollama_host": ollama_service.host
    }

@app.post("/config/active-model")
async def update_active_model(request: ActiveModelRequest):
    try:
        await ollama_service.set_active_model(request.model)
        return {"status": "success", "active_model": ollama_service.active_model}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/config/env")
async def update_env_config(request: EnvConfigRequest):
    try:
        env_path = os.path.join(os.getcwd(), ".env")
        
        # Read existing lines
        lines = []
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                lines = f.readlines()
        
        # Prepare new lines
        new_lines = []
        token_updated = False
        
        for line in lines:
            if line.startswith("GITHUB_TOKEN="):
                if request.github_token:
                    new_lines.append(f"GITHUB_TOKEN={request.github_token}\n")
                    token_updated = True
                else:
                    # Keep existing if not updating
                    new_lines.append(line)
            else:
                new_lines.append(line)
        
        if not token_updated and request.github_token:
            new_lines.append(f"GITHUB_TOKEN={request.github_token}\n")
            
        # Write back
        with open(env_path, "w") as f:
            f.writelines(new_lines)
            
        # Reload env vars for current process
        from dotenv import load_dotenv
        load_dotenv(override=True)
            
        return {"status": "success", "message": "Environment updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/config/env")
async def get_env_status():
    token = os.environ.get("GITHUB_TOKEN")
    return {
        "has_github_token": bool(token) and len(token) > 0,
        # Do not return the actual token for security, just presence
    }

@app.post("/config/ai-host")
async def update_ai_host(request: AIHostRequest):
    try:
        success = await ollama_service.update_host(request.host)
        return {"status": "success" if success else "error", "host": ollama_service.host, "available": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

# --- RALPH ENGINE (AUTONOMOUS LOOP) ---
ralph_active_tasks = {}

@app.post("/ralph/start")
async def start_ralph_loop(request: RalphRequest):
    model = request.model or ollama_service.active_model
    work_dir = request.work_dir
    
    # Ensure directory exists
    os.makedirs(work_dir, exist_ok=True)
    
    task_id = str(uuid.uuid4())
    engine = RalphEngine(model=model, work_dir=work_dir)
    
    async def run_in_background():
        try:
            ralph_active_tasks[task_id]["status"] = "running"
            await engine.start(max_iterations=request.max_iterations)
            ralph_active_tasks[task_id]["status"] = "completed"
        except Exception as e:
            print(f"Ralph Task {task_id} Error: {e}")
            ralph_active_tasks[task_id]["status"] = "error"
            ralph_active_tasks[task_id]["error"] = str(e)
        finally:
            # REFACTOR: Prevent memory leak by removing the task reference
            # We keep the status/logs for the frontend to query, but drop the heavy object
            if task_id in ralph_active_tasks and "task" in ralph_active_tasks[task_id]:
                del ralph_active_tasks[task_id]["task"]

    task = asyncio.create_task(run_in_background())
    ralph_active_tasks[task_id] = {
        "task": task,
        "status": "pending",
        "work_dir": work_dir,
        "model": model,
        "start_time": time.time()
    }
    
    return {"task_id": task_id, "status": "started", "work_dir": work_dir}

@app.get("/ralph/status/{task_id}")
async def get_ralph_status(task_id: str):
    if task_id not in ralph_active_tasks:
        raise HTTPException(status_code=404, detail="Ralph task not found")
    
    task_info = ralph_active_tasks[task_id]
    work_dir = task_info["work_dir"]
    
    # Read the log file to get the latest progress
    log_path = os.path.join(work_dir, "ralph_log.txt")
    logs = ""
    if os.path.exists(log_path):
        with open(log_path, "r") as f:
            # Get last 20 lines of logs
            lines = f.readlines()
            logs = "".join(lines[-20:])
            
    progress_path = os.path.join(work_dir, "progress.txt")
    progress = ""
    if os.path.exists(progress_path):
        with open(progress_path, "r") as f:
            progress = f.read()

    return {
        "status": task_info["status"],
        "logs": logs,
        "current_progress": progress,
        "error": task_info.get("error")
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

@app.get("/ollama/show/{model_name:path}")
async def ollama_show(model_name: str):
    try:
        info = await ollama_service.show_model_info(model_name)
        return info
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found or error: {str(e)}")


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
    return get_full_system_resources()

@app.post("/api/benchmark")
async def run_benchmark(request: Dict[str, Any] = None):
    """Runs a performance benchmark on the local LLM."""
    model = (request or {}).get("model", "qwen2.5-coder:1.5b")
    prompt = "Write a Python function to calculate the Fibonacci sequence."
    endpoint = "http://localhost:11434/api/generate"
    
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(endpoint, json={
                "model": model,
                "prompt": prompt,
                "stream": False
            })
            resp.raise_for_status()
            data = resp.json()
            end_time = time.time()
            
            total_time = end_time - start_time
            content = data.get("response", "")
            # Rough token estimate (words + punctuations)
            token_count = len(content.split()) 
            tps = token_count / total_time if total_time > 0 else 0
            
            verdict = "EXCELLENT" if tps > 20 else "GOOD" if tps > 10 else "SLOW"
            
            return {
                "model": model,
                "total_time": round(total_time, 2),
                "tokens_per_second": round(tps, 2),
                "token_count": token_count,
                "verdict": verdict,
                "status": "success"
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/mcp/context-search")

@app.post("/ollama/chat")
async def ollama_chat(request: ChatRequest):
    """Smart Chat Handler: Decides between Local (Ollama) or Cloud (Bedrock)."""
    model = request.model or ollama_service.active_model
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
            print(f"💻 Using Local Brain (Ollama with {model})...")
            
            # --- RAG RETRIEVAL ---
            # Extract the user's last query
            last_user_msg = request.messages[-1]["content"]
            
            # Fetch relevant context from LanceDB
            rag_context = await rag_service.get_context(last_user_msg)
            
            if rag_context:
                print(f"📚 RAG Context Found ({len(rag_context)} chars)")
                context_msg = f"\n\n=== RELEVANT CODEBASE CONTEXT ===\n{rag_context}\n=================================\n"
                
                # Find existing system message
                system_msg = next((m for m in request.messages if m["role"] == "system"), None)
                if system_msg:
                    system_msg["content"] += context_msg
                else:
                    request.messages.insert(0, {"role": "system", "content": f"You are a helpful AI assistant.{context_msg}"})
            
            response = await chat_with_tools(
                model, request.messages, request.options
            )


        # Index the chat turn for RAG
        if response and not response.get("error"):
            user_message = request.messages[-1]["content"]
            assistant_message = response.get("content", "")
            
            # --- PERSIST TO HISTORY ---
            if request.session_id:
                history_service.add_message(request.session_id, "user", user_message)
                history_service.add_message(request.session_id, "assistant", assistant_message)
                
                # Auto-generate title if it's the first message
                session = history_service.get_session(request.session_id)
                if session and len(session.get("messages", [])) <= 2:
                    title = user_message[:30] + "..." if len(user_message) > 30 else user_message
                    history_service.update_session_title(request.session_id, title)

            if user_message and assistant_message:
                await rag_service.index_chat_turn(user_message, assistant_message)
                if request.session_id:
                    # Extract and store long-term memory in background
                    asyncio.create_task(memory_service.process_turn(request.session_id, user_message, assistant_message))

        # --- UPDATE STATS ---
        duration_ms = (time.time() - start_time) * 1000
        stats["total_requests"] += 1
        stats["total_latency_ms"] += duration_ms
        
        # Approximate tokens (4 chars ~= 1 token)
        response_content = response.get("content", "")
        if response_content:
            stats["tokens_generated"] += len(response_content) / 4

        telemetry.log_trace(
            feature="chat",
            model=request.model,
            start_time=start_time,
            input_text=str(request.messages),
            output_text=str(response.get("content", "")),
        )
        return response

    except Exception as e:
        # --- UPDATE STATS ON ERROR ---
        stats["errors"] += 1

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

@app.post("/rag/index-directory")
async def rag_index_directory(request: FileOperationRequest):
    try:
        full_path = os.path.abspath(request.path)
        if not os.path.exists(full_path):
             raise HTTPException(status_code=404, detail="Directory not found")
        
        await rag_service.index_directory(full_path)
        return {"status": "success", "message": f"Indexed directory {request.path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/preview/{file_path:path}")
async def preview_local_file(file_path: str):
    """Serves a local file for the browser preview."""
    try:
        # Standardize path
        if file_path.startswith("file://"):
            file_path = file_path[7:]
        
        # Handle absolute vs relative
        if os.path.isabs(file_path):
            full_path = file_path
        else:
            # Assume relative to project root
            full_path = os.path.abspath(file_path)

        if not os.path.exists(full_path):
            return HTMLResponse(
                content=f"<html><body style='background:#1e1e1e;color:#ff5555;font-family:sans-serif;padding:20px;'><h2>404 Not Found</h2><p>File does not exist: {full_path}</p></body></html>", 
                status_code=404
            )
            
        if os.path.isdir(full_path):
             return HTMLResponse(
                content=f"<html><body style='background:#1e1e1e;color:#f1fa8c;font-family:sans-serif;padding:20px;'><h2>Directory Preview</h2><p>Viewing directories is not supported. Please select an HTML or media file.</p></body></html>"
            )

        response = FileResponse(full_path)
        response.headers["X-Frame-Options"] = "ALLOWALL"
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/proxy")
async def proxy_url(url: str):
    """
    Simple proxy to bypass X-Frame-Options for embedding.
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(url)
            
            # Create response with content type
            content_type = resp.headers.get("content-type", "text/html")
            response = HTMLResponse(content=resp.text, media_type=content_type)
            
            # Remove restrictive headers
            response.headers["X-Frame-Options"] = "ALLOWALL" # Override
            del response.headers["Content-Security-Policy"] # Remove
            
            # Simple (naive) URL rewriting to make some assets work
            # This is not perfect but helps with basic pages
            # We replace 'src="/' with 'src="<base_url>/'
            # But extracting base_url correctly is key.
            # For now, let's just return the content and see.
            # Ideally we inject <base href="...">
            
            base_url = str(resp.url)
            if not base_url.endswith("/"):
                base_url += "/"
                
            # Inject base tag for relative links
            if "<head>" in resp.text:
                modified_content = resp.text.replace("<head>", f"<head><base href='{base_url}'>")
                return HTMLResponse(content=modified_content, media_type=content_type)
            
            return response
    except Exception as e:
        return HTMLResponse(content=f"Proxy Error: {str(e)}", status_code=500)

@app.post("/files/optimize")
def optimize_file_endpoint(req: OptimizeRequest):
    model = req.model or ollama_service.active_model
    return optimizer.optimize_file(req.file_path, req.instruction, model)

@app.post("/fs/edit_selection")
async def edit_selection_endpoint(req: EditCodeRequest):
    model = req.model or ollama_service.active_model
    prompt = f"""You are an expert code editor.
    
Your task is to rewrite the following code snippet based on the user's instruction.
Return ONLY the modified code. Do not include markdown markers like ```. Do not include explanations.

Original Code:
{req.selected_code}

Instruction:
{req.instruction}

Modified Code:"""
    
    # Use the chat API for better instruction following than 'complete'
    messages = [{"role": "user", "content": prompt}]
    response = await chat_with_tools(model, messages)

    
    # Clean up the response if it has markdown
    content = response.get("content", "")
    if content.startswith("```"):
        # Remove first line (```language) and last line (```)
        lines = content.splitlines()
        if len(lines) >= 2:
            content = "\n".join(lines[1:-1])
            
    return {"modified_code": content}

@app.post("/optimizer/propose-fix")
async def propose_fix_endpoint(req: ProposeFixRequest):
    return await optimizer.propose_fix(req.file_path, req.line_number, req.error_message)

# --- TERMINAL ENDPOINT ---

@app.post("/terminals")
async def create_terminal():
    session_id = terminal_manager.create_session()
    if not session_id:
        raise HTTPException(status_code=500, detail="Failed to create terminal session.")
    return {"session_id": session_id}

@app.websocket("/ws/terminal/{session_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()

    session = terminal_manager.sessions.get(session_id)
    if not session:
        await websocket.send_text("Terminal session not found.\r\n")
        await websocket.close()
        return

    master_fd = session["master_fd"]

    if sys.platform == "win32":
        await websocket.send_text("Terminal not supported on Windows.\r\n")
        await websocket.close()
        return

    loop = asyncio.get_event_loop()

    async def read_from_pty():
        def _read():
            try:
                return os.read(master_fd, 10240)
            except (OSError, IOError):
                return b""
        while True:
            output = await loop.run_in_executor(None, _read)
            if not output:
                break
            try:
                await websocket.send_text(output.decode(errors="replace"))
                terminal_manager.update_session_activity(session_id)
            except:
                break

    async def write_to_pty():
        try:
            while True:
                data = await websocket.receive_text()
                terminal_manager.update_session_activity(session_id)
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
        # Session is not removed on disconnect, it's handled by the cleanup task


@app.get("/ops/stats")
async def get_ops_stats():
    return telemetry.get_stats()

@app.websocket("/ws/ollama/chat_v2")
async def websocket_chat_endpoint(websocket: WebSocket):
    await websocket.accept()
    current_task = None
    try:
        while True:
            data = await websocket.receive_json()
            request_type = data.get("type")

            if request_type == "stop":
                if current_task and not current_task.done():
                    current_task.cancel()
                    print("🛑 AI Generation task cancelled by user.")
                    await websocket.send_json({"type": "complete", "content": "...[cancelled]"})
                continue

            if request_type == "chat":
                # Cancel existing task if any
                if current_task and not current_task.done():
                    current_task.cancel()

                model = data.get("model") or ollama_service.active_model
                messages = data.get("messages", [])

                session_id = data.get("session_id")
                options = data.get("options", {})

                async def run_chat():
                    try:
                        # --- RAG RETRIEVAL ---
                        if messages:
                            last_msg = messages[-1]["content"]
                            # Only fetch context if it's a user message
                            if messages[-1]["role"] == "user":
                                # Save user message to history
                                if session_id:
                                    history_service.add_message(session_id, "user", last_msg)

                                ctx = await rag_service.get_context(last_msg)
                                if ctx:
                                    print(f"📚 RAG Context Found ({len(ctx)} chars)")
                                    context_msg = f"\n\n=== RELEVANT CODEBASE CONTEXT ===\n{ctx}\n=================================\n"
                                    
                                    system_msg = next((m for m in messages if m["role"] == "system"), None)
                                    if system_msg:
                                        system_msg["content"] += context_msg
                                    else:
                                        messages.insert(0, {"role": "system", "content": f"You are a helpful AI assistant.{context_msg}"})

                        full_response = ""
                        async for chunk in stream_chat_with_tools(model, messages, options):
                            if chunk["type"] == "content_delta":
                                full_response += chunk["content"]
                            elif chunk["type"] == "complete":
                                # Save assistant response to history
                                if session_id:
                                    history_service.add_message(session_id, "assistant", full_response)
                                    
                                    # Auto-generate title
                                    session = history_service.get_session(session_id)
                                    if session and len(session.get("messages", [])) <= 2:
                                        title = messages[-1]["content"][:30] + "..." if len(messages[-1]["content"]) > 30 else messages[-1]["content"]
                                        history_service.update_session_title(session_id, title)
                                    
                                    # Extract and store long-term memory
                                    user_message = messages[-1]["content"]
                                    asyncio.create_task(memory_service.process_turn(session_id, user_message, full_response))

                            await websocket.send_json(chunk)
                    except asyncio.CancelledError:
                        pass
                    except Exception as e:
                        await websocket.send_json({"type": "error", "error": str(e)})

                current_task = asyncio.create_task(run_chat())

            elif request_type == "tool_exec":
                if current_task and not current_task.done():
                    current_task.cancel()

                model = data.get("model") or ollama_service.active_model
                messages = data.get("messages", [])

                tool_call = data.get("tool_call")
                approved = data.get("approved")
                options = data.get("options", {})

                async def run_tool():
                    try:
                        async for chunk in stream_execute_tool_and_continue(model, messages, tool_call, approved, options):
                            await websocket.send_json(chunk)
                    except asyncio.CancelledError:
                        pass
                    except Exception as e:
                        await websocket.send_json({"type": "error", "error": str(e)})

                current_task = asyncio.create_task(run_tool())
            
            elif request_type == "terminal_command":
                command = data.get("command")
                session_id = data.get("session_id")
                if command and session_id and session_id in terminal_manager.sessions:
                    master_fd = terminal_manager.sessions[session_id]["master_fd"]
                    os.write(master_fd, (command + "\n").encode())
                else:
                    await websocket.send_json({"type": "error", "error": "Invalid terminal command request"})

            else:
                await websocket.send_json({"type": "error", "error": "Invalid request type"})

    except WebSocketDisconnect:
        if current_task:
            current_task.cancel()
        print("Client disconnected from chat websocket.")
    except Exception as e:
        if current_task:
            current_task.cancel()
        print(f"Chat WebSocket Error: {e}")
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except:
            pass

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

@app.websocket("/ws/lsp")
async def lsp_websocket(websocket: WebSocket):
    global lsp_process
    await websocket.accept()

    if not lsp_process or lsp_process.returncode is not None:
        await websocket.close(code=1011, reason="LSP server is not running")
        return

    async def forward_to_server():
        try:
            while True:
                data = await websocket.receive_bytes()
                if lsp_process.stdin:
                    lsp_process.stdin.write(data)
                    await lsp_process.stdin.drain()
        except WebSocketDisconnect:
            print("LSP client disconnected.")
        except Exception as e:
            print(f"Error forwarding to LSP server: {e}")

    async def forward_to_client():
        try:
            while True:
                if lsp_process.stdout:
                    data = await lsp_process.stdout.read(4096)
                    if not data:
                        break
                    await websocket.send_bytes(data)
        except Exception as e:
            print(f"Error forwarding to LSP client: {e}")

    forward_to_server_task = asyncio.create_task(forward_to_server())
    forward_to_client_task = asyncio.create_task(forward_to_client())

    try:
        done, pending = await asyncio.wait(
            {forward_to_server_task, forward_to_client_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    except Exception:
        pass
    finally:
        if not forward_to_server_task.done():
            forward_to_server_task.cancel()
        if not forward_to_client_task.done():
            forward_to_client_task.cancel()
        print("Finished LSP websocket connection.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
