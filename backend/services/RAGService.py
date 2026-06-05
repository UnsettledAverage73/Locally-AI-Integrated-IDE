import logging
import json
import ollama
import lancedb
import os
import traceback
from typing import List, Dict, Any, Union
from tree_sitter import Language, Parser
import tree_sitter_language_pack as tree_sitter_languages

logger = logging.getLogger("sovereign-ide")

def log_debug(msg):
    with open("debug_rag.log", "a") as f:
        f.write(f"{msg}\n")
from dotenv import load_dotenv
from .OllamaService import OllamaService
from pruner import prune_code
import asyncio
import httpx
from .model_loader import get_remote_rag_url

load_dotenv()

# Use a safe default path in the user's home directory
DEFAULT_LANCEDB_PATH = os.path.join(os.path.expanduser("~"), ".localdev", "lancedb")
LANCEDB_PATH = os.getenv("LANCEDB_PATH", DEFAULT_LANCEDB_PATH)

def get_language_from_path(path: str) -> str:
    ext = os.path.splitext(path)[1]
    lang_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".jsx": "javascript",
        ".html": "html",
        ".css": "css",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".md": "markdown",
    }
    # Fallback for unknown extensions; Tree-sitter might not support them.
    return lang_map.get(ext)


class RAGService:
    def __init__(self, db_path: str = LANCEDB_PATH, ollama_service: OllamaService = None):
        self.db_path = db_path
        # Ensure the directory exists
        os.makedirs(os.path.dirname(self.db_path) if '.' in os.path.basename(self.db_path) else self.db_path, exist_ok=True)
        self.ollama_service = ollama_service or OllamaService()
        self.db = None
        self.table = None
        self.chat_table = None
        self.indexed_files = set() 
        self.index_state_path = os.path.join(self.db_path, "index_state.txt")
        self.initialize_db()

    def initialize_db(self):
        try:
            log_debug(f"Initializing LanceDB at {self.db_path}")
            self.db = lancedb.connect(self.db_path)
            log_debug(f"DB connection established. Type: {type(self.db)}, Truthy: {bool(self.db)}")

            if os.path.exists(self.index_state_path):
                with open(self.index_state_path, "r") as f:
                    self.indexed_files = set(f.read().splitlines())
                log_debug(f"Loaded {len(self.indexed_files)} indexed files from state.")

            try:
                self.table = self.db.open_table("code_index")
                log_debug("Opened existing table 'code_index'")
            except Exception:
                self.table = None
                log_debug("Table 'code_index' not found (will be created on first index)")
            
            try:
                self.chat_table = self.db.open_table("chat_index")
                log_debug("Opened existing table 'chat_index'")
            except Exception:
                self.chat_table = None
                log_debug("Table 'chat_index' not found (will be created on first index)")

            try:
                self.memory_table = self.db.open_table("memory_index")
                log_debug("Opened existing table 'memory_index'")
            except Exception:
                self.memory_table = None
                log_debug("Table 'memory_index' not found (will be created on first memory)")

        except Exception as e:
            print(f"Error initializing LanceDB: {e}")
            log_debug(f"Error initializing LanceDB: {e}")
            self.db = None
            self.table = None
            self.chat_table = None
            self.memory_table = None

    async def _chunk_code_ast(self, content: str, file_path: str) -> List[Dict[str, Any]]:
        """
        Chunks code based on AST structure (classes, functions).
        """
        lang_ext = os.path.splitext(file_path)[1]
        lang_name = get_language_from_path(file_path)
        
        if not lang_name or lang_name not in ["python", "javascript", "typescript", "go", "rust"]:
             return await self._chunk_code(content) # Fallback to line-based

        try:
            language = tree_sitter_languages.get_language(lang_name)
            parser = Parser()
            parser.set_language(language)
            tree = parser.parse(bytes(content, "utf8"))
            
            chunks = []
            
            # Nodes we want to extract as distinct chunks
            target_types = {
                "python": ["function_definition", "class_definition"],
                "javascript": ["function_declaration", "class_definition", "method_definition"],
                "typescript": ["function_declaration", "class_definition", "method_definition", "interface_declaration"],
                "go": ["function_declaration", "type_declaration"],
                "rust": ["function_item", "struct_item", "impl_item", "trait_item"]
            }
            
            targets = target_types.get(lang_name, [])
            
            def traverse(node):
                if node.type in targets:
                    start_byte = node.start_byte
                    end_byte = node.end_byte
                    chunk_content = content[start_byte:end_byte]
                    
                    if len(chunk_content) > 50: # Avoid tiny chunks
                        chunks.append({
                            "content": chunk_content,
                            "start_line": node.start_point[0],
                            "end_line": node.end_point[0],
                            "type": node.type
                        })
                
                for child in node.children:
                    traverse(child)

            traverse(tree.root_node)
            
            if not chunks:
                return await self._chunk_code(content)
                
            return chunks
        except Exception as e:
            log_debug(f"AST Chunking failed for {file_path}: {e}. Falling back.")
            return await self._chunk_code(content)

    async def _chunk_code(self, content: str, max_chunk_size: int = 1000) -> List[Dict[str, Any]]:
        log_debug(f"Chunking content of size: {len(content)}")
        lines = content.split('\n')
        chunks = []
        current_chunk_lines = []
        current_chunk_size = 0
        start_line = 0

        for i, line in enumerate(lines):
            line_size = len(line)
            if current_chunk_size + line_size > max_chunk_size and current_chunk_lines:
                chunks.append({
                    "content": "\n".join(current_chunk_lines),
                    "start_line": start_line,
                    "end_line": i - 1,
                })
                current_chunk_lines = [line]
                current_chunk_size = line_size
                start_line = i
            else:
                current_chunk_lines.append(line)
                current_chunk_size += line_size

        if current_chunk_lines:
            chunks.append({
                "content": "\n".join(current_chunk_lines),
                "start_line": start_line,
                "end_line": len(lines) - 1,
            })
        log_debug(f"Generated {len(chunks)} chunks.")
        return chunks

    async def index_file(self, file_path: str, content: str, force: bool = False):
        log_debug(f"Attempting to index file: {file_path}")
        
        if not self.db:
            self.initialize_db()
            
        if not self.ollama_service or not self.db:
            return

        # If incremental update, delete old records first
        if file_path in self.indexed_files:
            if not force:
                log_debug(f"File {file_path} already indexed. Skipping.")
                return 
            
            log_debug(f"Incremental update for {file_path}. Deleting old records.")
            if self.table:
                self.table.delete(f'path = "{file_path}"')
        
        chunks = await self._chunk_code_ast(content, file_path)
        
        if not chunks:
            return

        chunk_contents = [chunk["content"] for chunk in chunks]
        embeddings = await self.ollama_service.generate_embedding(chunk_contents)
        
        if not embeddings or len(embeddings) != len(chunks):
            log_debug(f"Warning: Failed to generate embeddings for {file_path}.")
            return

        records = []
        for i, chunk in enumerate(chunks):
            records.append({
                "path": file_path,
                "content": chunk["content"],
                "start_line": chunk["start_line"],
                "end_line": chunk["end_line"],
                "vector": embeddings[i],
            })
        
        if records:
            if not self.table:
                self.table = self.db.create_table("code_index", data=records)
            else:
                self.table.add(records)
            
            if file_path not in self.indexed_files:
                self.indexed_files.add(file_path)
                with open(self.index_state_path, "w") as f:
                    f.write("\n".join(self.indexed_files))
            log_debug(f"Successfully indexed {file_path}.")

    async def index_directory(self, root_path: str):
        log_debug(f"Indexing directory: {root_path}")
        ignore_dirs = {'.git', 'node_modules', 'venv', '__pycache__', '.gemini', 'dist', 'build', '.idea', '.vscode'}
        # Common text-based source extensions
        valid_extensions = {
            '.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.md', 
            '.json', '.yaml', '.yml', '.sh', '.xml', '.java', '.c', 
            '.cpp', '.rs', '.go', '.php', '.sql'
        }
        
        tasks = []
        
        for root, dirs, files in os.walk(root_path):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for file in files:
                if any(file.endswith(ext) for ext in valid_extensions):
                    file_path = os.path.join(root, file)
                    # Skip if file is too large (e.g., > 1MB) to avoid choking
                    try:
                        if os.path.getsize(file_path) > 1024 * 1024:
                            log_debug(f"Skipping large file: {file_path}")
                            continue
                        
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            # Use relative path for cleaner context if possible, otherwise absolute
                            # Here we assume root_path is what we want context relative to.
                            # If root_path is ".", os.path.relpath works well.
                            rel_path = os.path.relpath(file_path, start=root_path)
                            # Add to tasks
                            tasks.append(self.index_file(rel_path, content))
                    except Exception as e:
                        log_debug(f"Error reading {file_path}: {e}")

        # Execute in batches to avoid overloading Ollama (concurrency limit)
        batch_size = 5
        log_debug(f"Found {len(tasks)} files to index. Processing in batches of {batch_size}...")
        
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i + batch_size]
            await asyncio.gather(*batch)
            
        log_debug("Directory indexing complete.")

    async def index_chat_turn(self, user_message: str, assistant_message: str):
        if not self.db or not self.ollama_service:
            log_debug("Cannot index chat turn, DB or Ollama service not available.")
            return

        try:
            log_debug("Indexing chat turn.")
            combined_text = f"User: {user_message}\nAssistant: {assistant_message}"
            embedding = await self.ollama_service.generate_embedding(combined_text)

            if not embedding:
                log_debug("Failed to generate embedding for chat turn.")
                return

            record = {
                "user_message": user_message,
                "assistant_message": assistant_message,
                "timestamp": asyncio.get_event_loop().time(),
                "vector": embedding,
            }

            if not self.chat_table:
                log_debug("Creating new LanceDB table 'chat_index'.")
                self.chat_table = self.db.create_table("chat_index", data=[record])
            else:
                self.chat_table.add([record])
            log_debug("Successfully indexed chat turn.")
        except Exception as e:
            log_debug(f"Error indexing chat turn: {e}")

    async def index_memory(self, content: str, category: str, session_id: str):
        if not self.db or not self.ollama_service:
            log_debug("Cannot index memory, DB or Ollama service not available.")
            return

        try:
            log_debug(f"Indexing memory: {content[:50]}...")
            embedding = await self.ollama_service.generate_embedding(content)

            if not embedding:
                log_debug("Failed to generate embedding for memory.")
                return

            record = {
                "content": content,
                "category": category,
                "session_id": session_id,
                "timestamp": asyncio.get_event_loop().time(),
                "vector": embedding,
            }

            if not self.memory_table:
                log_debug("Creating new LanceDB table 'memory_index'.")
                self.memory_table = self.db.create_table("memory_index", data=[record])
            else:
                self.memory_table.add([record])
            log_debug("Successfully indexed memory.")
        except Exception as e:
            log_debug(f"Error indexing memory: {e}")

    async def get_context(self, query: str, current_file: str = None, limit: int = 5) -> str:
        log_debug(f"Getting context for query: '{query}' (current_file: {current_file})")
        
        remote_url = get_remote_rag_url()
        if remote_url:
            try:
                logger.info(json.dumps({
                    "event": "rag_proxy",
                    "target": remote_url,
                    "query": query[:50]
                }))
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(f"{remote_url}/rag/context", json={
                        "query": query,
                        "current_file": current_file,
                        "limit": limit
                    })
                    if resp.status_code == 200:
                        return resp.json().get("context", "")
            except Exception as e:
                logger.error(json.dumps({
                    "event": "rag_proxy_failed",
                    "error": str(e),
                    "fallback": "local"
                }))

        if not self.db:
            self.initialize_db()

        if not self.ollama_service:
            log_debug("Ollama service not initialized. Returning empty context.")
            return ""

        query_embedding = await self.ollama_service.generate_embedding(query)
        if not query_embedding:
            log_debug("Failed to generate embedding for query. Returning empty context.")
            return ""

        code_context = []
        if self.table:
            log_debug(f"Searching code_index with query embedding. Limit: {limit}")
            results = self.table.search(query_embedding).limit(limit).to_list()
            log_debug(f"Found {len(results)} results from code_index.")
            for res in results:
                language = get_language_from_path(res['path'])
                content = res['content']
                if language:
                    content = prune_code(content, language, query)
                code_context.append(f"File: {res['path']} (lines {res['start_line']}-{res['end_line']})\n{content}")
        
        chat_context = []
        if self.chat_table:
            log_debug(f"Searching chat_index with query embedding. Limit: 3")
            results = self.chat_table.search(query_embedding).limit(3).to_list()
            log_debug(f"Found {len(results)} results from chat_index.")
            for res in results:
                chat_context.append(f"User: {res['user_message']}\nAssistant: {res['assistant_message']}")

        memories_context = []
        if self.memory_table:
            log_debug(f"Searching memory_index with query embedding. Limit: 3")
            results = self.memory_table.search(query_embedding).limit(3).to_list()
            log_debug(f"Found {len(results)} results from memory_index.")
            for res in results:
                memories_context.append(f"[{res['category']}] {res['content']}")

        final_context = ""
        if memories_context:
            final_context += "### Relevant Long-Term Memories:\n" + "\n".join(memories_context) + "\n\n"

        if chat_context:
            final_context += "### Relevant Chat History:\n" + "\n---\n".join(chat_context) + "\n\n"
        
        if code_context:
            final_context += "### Relevant Code:\n" + "\n\n".join(code_context)

        return final_context.strip()


    async def clear_index(self):
        if self.db:
            try:
                self.db.drop_table("code_index")
                self.table = None
                self.indexed_files.clear()
                if os.path.exists(self.index_state_path):
                    os.remove(self.index_state_path)
            except Exception as e:
                print(f"Error dropping LanceDB table: {e}")
    
    async def clear_chat_index(self):
        if self.db:
            try:
                self.db.drop_table("chat_index")
                self.chat_table = None
            except Exception as e:
                print(f"Error dropping LanceDB chat table: {e}")
