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

# Platform specific imports
if sys.platform != "win32":
    import pty
    import termios
    import fcntl
    import struct
    import select

# --- SERVICES ---
from services.OllamaService import OllamaService
from services.RAGService import RAGService
from services.resource_monitor import get_system_resources as get_full_system_resources
from bedrock_service import BedrockService
from git_service import GitService
from optimizer_service import OptimizerService
from services.llm_service import chat_with_tools, execute_tool_and_continue, stream_chat_with_tools, stream_execute_tool_and_continue
from services.model_loader import ensure_nomic_model
from routers import files, search
from file_watcher import start_watcher
from mcp_server.context_search import context_search
import uuid

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

class TerminalManager:
    def __init__(self):
        self.sessions: Dict[str, Any] = {}

    def create_session(self) -> str:
        session_id = str(uuid.uuid4())
        
        if sys.platform == "win32":
            # Mock session for Windows
            self.sessions[session_id] = {"pid": None, "master_fd": None}
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
            self.sessions[session_id] = {"pid": pid, "master_fd": master_fd}
            print(f"Terminal session {session_id} created with pid {pid}")
            return session_id

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            session = self.sessions.pop(session_id)
            if session["pid"] is not None:
                try:
                    os.kill(session["pid"], 9)
                    os.waitpid(session["pid"], 0)
                    print(f"Terminal session {session_id} killed.")
                except OSError:
                    pass
            if session["master_fd"] is not None:
                try:
                    os.close(session["master_fd"])
                except OSError:
                    pass

terminal_manager = TerminalManager()

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
    # Clean up all active terminal sessions
    for session_id in list(terminal_manager.sessions.keys()):
        terminal_manager.remove_session(session_id)
        
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
app.include_router(search.router, prefix="/search", tags=["search"])

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

class EnvConfigRequest(BaseModel):
    github_token: str | None = None

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

class EditCodeRequest(BaseModel):
    file_path: str
    selected_code: str
    instruction: str
    model: str | None = "deepseek-coder"

class ProposeFixRequest(BaseModel):
    file_path: str
    line_number: int
    error_message: str

class ExecuteToolRequest(BaseModel):
    model: str
    messages: List[Dict[str, Any]]
    tool_call: Dict[str, Any]
    approved: bool
    options: Dict[str, Any] | None = None

class ContextSearchRequest(BaseModel):
    context_type: str
    search_term: str

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
    return get_full_system_resources()

@app.post("/mcp/context-search")
async def mcp_context_search(request: ContextSearchRequest):
    try:
        context = await context_search(f"@{request.context_type} {request.search_term}")
        return {"context": context}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

        # Index the chat turn for RAG
        if response and not response.get("error"):
            user_message = request.messages[-1]["content"]
            assistant_message = response.get("content", "")
            if user_message and assistant_message:
                await rag_service.index_chat_turn(user_message, assistant_message)

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

        return FileResponse(full_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/files/optimize")
def optimize_file_endpoint(req: OptimizeRequest):
    return optimizer.optimize_file(req.file_path, req.instruction, req.model)

@app.post("/fs/edit_selection")
async def edit_selection_endpoint(req: EditCodeRequest):
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
    response = await chat_with_tools(req.model, messages)
    
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
        terminal_manager.remove_session(session_id)
        print(f"Cleaned up terminal session {session_id}")

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

                model = data.get("model", "deepseek-coder")
                messages = data.get("messages", [])
                options = data.get("options", {})

                async def run_chat():
                    try:
                        async for chunk in stream_chat_with_tools(model, messages, rag_service, options):
                            await websocket.send_json(chunk)
                    except asyncio.CancelledError:
                        pass
                    except Exception as e:
                        await websocket.send_json({"type": "error", "error": str(e)})

                current_task = asyncio.create_task(run_chat())

            elif request_type == "tool_exec":
                if current_task and not current_task.done():
                    current_task.cancel()

                model = data.get("model", "deepseek-coder")
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
    await websocket.accept()
    
    language_server_process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "backend.language_server",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    async def forward_to_server():
        try:
            while True:
                data = await websocket.receive_bytes()
                if language_server_process.stdin:
                    language_server_process.stdin.write(data)
                    await language_server_process.stdin.drain()
        except WebSocketDisconnect:
            pass
        finally:
            if language_server_process.returncode is None:
                language_server_process.kill()

    async def forward_to_client():
        try:
            while True:
                if language_server_process.stdout:
                    data = await language_server_process.stdout.read(4096)
                    if not data:
                        break
                    await websocket.send_bytes(data)
        except Exception:
            pass

    async def log_stderr():
        try:
            while True:
                if language_server_process.stderr:
                    line = await language_server_process.stderr.readline()
                    if not line:
                        break
                    print(f"LSP stderr: {line.decode().strip()}")
        except Exception:
            pass

    forward_to_server_task = asyncio.create_task(forward_to_server())
    forward_to_client_task = asyncio.create_task(forward_to_client())
    log_stderr_task = asyncio.create_task(log_stderr())

    try:
        done, pending = await asyncio.wait(
            {forward_to_server_task, forward_to_client_task, log_stderr_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    finally:
        if language_server_process.returncode is None:
            language_server_process.kill()
        await language_server_process.wait()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
