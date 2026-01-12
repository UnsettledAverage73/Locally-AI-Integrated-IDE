import ollama
import lancedb
import os
import traceback
from typing import List, Dict, Any, Union
def log_debug(msg):
    with open("debug_rag.log", "a") as f:
        f.write(f"{msg}\n")
from dotenv import load_dotenv

load_dotenv()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

# Use a safe default path in the user's home directory
DEFAULT_LANCEDB_PATH = os.path.join(os.path.expanduser("~"), ".localdev", "lancedb")
LANCEDB_PATH = os.getenv("LANCEDB_PATH", DEFAULT_LANCEDB_PATH)

class OllamaService:
    def __init__(self, host: str = OLLAMA_HOST):
        # Increased timeout to 30 minutes for large model downloads
        self.client = ollama.AsyncClient(host=host, timeout=1800.00)

    async def check_connection(self) -> bool:
        try:
            await self.client.list()
            return True
        except Exception as e:
            print(f"Error checking Ollama connection: {e}")
            return False

    async def list_models(self) -> List[str]:
        try:
            if not await self.check_connection():
                print("Ollama server not reachable. Cannot list models.")
                return []
            models = await self.client.list()
            # Handle different versions of ollama library
            if isinstance(models, dict) and "models" in models:
                return [m["name"] for m in models["models"]]
            elif hasattr(models, 'models'):
                return [m.model for m in models.models]
            return []
        except Exception as e:
            print(f"Error listing models: {e}")
            return []

    async def generate_embedding(self, texts: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        log_debug(f"Generating embedding for type: {type(texts)}")
        try:
            if isinstance(texts, str):
                log_debug(f"Generating embedding for single string (len: {len(texts)})")
                response = await self.client.embeddings(model=EMBEDDING_MODEL, prompt=texts)
                log_debug("Got response for single embedding")
                return response["embedding"]
            elif isinstance(texts, list) and all(isinstance(t, str) for t in texts):
                log_debug(f"Generating embedding for list of strings (count: {len(texts)})")
                # Handle list of strings for batch embedding
                # The ollama client.embeddings method can take a list of prompts
                responses = await self.client.embeddings(model=EMBEDDING_MODEL, prompt=texts)
                log_debug("Got response for batch embedding")
                # The response structure for multiple prompts is a list of dicts, each with an 'embedding' key
                # Note: Check if response has 'embeddings' key (new API) or is a list (older API)
                if isinstance(responses, dict) and "embeddings" in responses:
                     log_debug(f"Returning {len(responses['embeddings'])} embeddings from dictionary response")
                     return [res["embedding"] for res in responses["embeddings"]]
                else:
                    log_debug(f"Unexpected batch response structure: {type(responses)}")
                    return []
            else:
                log_debug(f"Embedding error: Invalid input type for texts. Expected str or List[str], got {type(texts)}")
                return [] if isinstance(texts, list) else [] # Return appropriate empty type
        except Exception as e:
            log_debug(f"Embedding error: {str(e)}")
            traceback.print_exc()
            return [] if isinstance(texts, list) else [] # Return appropriate empty type

    async def stream_completion(self, model: str, prompt: str):
        try:
            async for chunk in await self.client.generate(model=model, prompt=prompt, stream=True):
                yield chunk
        except Exception as e:
            print(f"Stream completion error: {str(e)}")
            yield {"error": str(e)}

    async def chat_completion(self, model: str, messages: List[Dict[str, str]], options: Dict[str, Any] = None):
        print(f"Sending messages to Ollama chat: {messages}")
        try:
            # First, verify connection
            if not await self.check_connection():
                return "Error: Ollama server is not running. Please start it with 'ollama serve'."

            # Second, verify model exists
            available_models = await self.list_models()
            # Strip tags for comparison if needed (e.g., deepseek-coder:latest vs deepseek-coder)
            model_names = [m.split(':')[0] for m in available_models]
            if model.split(':')[0] not in model_names and model not in available_models:
                return f"Error: Model '{model}' not found. Please run 'ollama pull {model}'."

            default_options = {
                "temperature": 0.4,
                "top_p": 0.9,
                "num_predict": 2048,
                "stop": ["User:", "Assistant:", "Instruction:"]
            }
            
            # Merge provided options with defaults
            final_options = default_options.copy()
            if options:
                final_options.update(options)

            response = await self.client.chat(model=model, messages=messages, options=final_options)
            
            # Handle response format variations
            if isinstance(response, dict):
                return response["message"]["content"]
            else:
                return response.message.content

        except Exception as e:
            error_detail = f"{type(e).__name__}: {str(e)}"
            print(f"CRITICAL OLLAMA ERROR: {error_detail}")
            traceback.print_exc()
            return f"Error: The model failed to respond. (Details: {error_detail})"

    async def pull_model(self, model: str):
        try:
            return await self.client.pull(model=model)
        except Exception as e:
            print(f"Error pulling model {model}: {e}")
            raise e

    async def pull_model_stream(self, model: str):
        """Yields progress updates for model pulling."""
        try:
            async for progress in await self.client.pull(model=model, stream=True):
                yield progress
        except Exception as e:
            print(f"Error pulling model stream {model}: {e}")
            yield {"error": str(e)}

    async def generate_completion(self, model: str, prefix: str, suffix: str, options: Dict[str, Any] = None):
        """
        Fill-in-the-middle completion for ghost text.
        """
        try:
            # Determine FIM tokens based on model name
            model_lower = model.lower()
            if "qwen" in model_lower:
                prompt = f"<|fim_prefix|>{prefix}<|fim_suffix|>{suffix}<|fim_middle|>"
                stop = ["<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>", "<|endoftext|>", "\n\n"]
            else:
                # Default to DeepSeek tokens
                prompt = f"<｜fim_begin｜>{prefix}<｜fim_hole｜>{suffix}<｜fim_end｜>"
                stop = ["<｜fim_begin｜>", "<｜fim_hole｜>", "<｜fim_end｜>", "\n\n", "User:", "Assistant:"]
            
            # Optimized options for speed
            default_options = {
                "temperature": 0.0,
                "num_predict": 64, # Shorter for faster ghost text
                "top_p": 1,
                "stop": stop
            }
            
            final_options = default_options.copy()
            if options:
                final_options.update(options)

            response = await self.client.generate(
                model=model, 
                prompt=prompt, 
                options=final_options,
                raw=True 
            )
            
            content = response["response"]
            # Clean up any leaking FIM tokens if the model is being weird
            for s in stop:
                if s in content:
                    content = content.split(s)[0]
            
            # For ghost text, we usually only want the next relevant lines
            # If it's too long, truncate at the first double newline or similar
            lines = content.split("\n")
            if len(lines) > 5:
                content = "\n".join(lines[:5])

            return content.strip("\n")
        except Exception as e:
            print(f"Completion error: {str(e)}")
            return ""

class RAGService:
    def __init__(self, db_path: str = LANCEDB_PATH, ollama_service: OllamaService = None):
        self.db_path = db_path
        # Ensure the directory exists
        os.makedirs(os.path.dirname(self.db_path) if '.' in os.path.basename(self.db_path) else self.db_path, exist_ok=True)
        self.ollama_service = ollama_service or OllamaService()
        self.db = None
        self.table = None
        self.indexed_files = set() 
        self.initialize_db()

    def initialize_db(self):
        try:
            log_debug(f"Initializing LanceDB at {self.db_path}")
            self.db = lancedb.connect(self.db_path)
            log_debug(f"DB connection established. Type: {type(self.db)}, Truthy: {bool(self.db)}")
            try:
                self.table = self.db.open_table("code_index")
                log_debug("Opened existing table 'code_index'")
            except Exception:
                self.table = None
                log_debug("Table 'code_index' not found (will be created on first index)")
        except Exception as e:
            print(f"Error initializing LanceDB: {e}")
            log_debug(f"Error initializing LanceDB: {e}")
            self.db = None
            self.table = None

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

    async def index_file(self, file_path: str, content: str):
        log_debug(f"Attempting to index file: {file_path}")
        
        if not self.db:
            log_debug("DB not initialized. Attempting to initialize...")
            self.initialize_db()
            
        if not self.ollama_service:
            log_debug("Ollama service is missing. Cannot index.")
            return

        if not self.db:
            log_debug("DB initialization failed. Skipping indexing.")
            return

        if file_path in self.indexed_files:
            log_debug(f"File {file_path} already indexed. Skipping.")
            return 
        
        chunks = await self._chunk_code(content)
        
        if not chunks: # No chunks to index
            log_debug(f"No chunks generated for {file_path}. Skipping indexing.")
            return

        chunk_contents = [chunk["content"] for chunk in chunks]
        
        log_debug(f"Generating embeddings for {len(chunk_contents)} chunks from {file_path} in batch.")
        embeddings = await self.ollama_service.generate_embedding(chunk_contents)
        
        log_debug(f"Received {len(embeddings) if embeddings else 0} embeddings.")

        # Ensure that embeddings were generated and the count matches chunks
        if not embeddings or len(embeddings) != len(chunks):
            log_debug(f"Warning: Failed to generate embeddings for all chunks in {file_path}. Skipping indexing.")
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
                log_debug(f"Creating new LanceDB table 'code_index' for {file_path}.")
                self.table = self.db.create_table("code_index", data=records)
            else:
                log_debug(f"Adding {len(records)} records to existing 'code_index' table for {file_path}.")
                self.table.add(records)
            self.indexed_files.add(file_path)
            log_debug(f"Successfully indexed {file_path}.")
        else:
            log_debug(f"No records to add for {file_path}.")

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

    async def get_context(self, query: str, current_file: str = None, limit: int = 5) -> str:
        log_debug(f"Getting context for query: '{query}' (current_file: {current_file})")
        
        if not self.table:
             # Try initializing if table is missing (might be first run or connection issue)
             if not self.db:
                 self.initialize_db()
             # If db is now present but table still None, try opening it explicitly (in case it was created by another process/thread)
             if self.db and not self.table:
                 try:
                     self.table = self.db.open_table("code_index")
                 except:
                     pass

        if not self.ollama_service or not self.table:
            log_debug("Ollama service or DB table not initialized. Returning empty context.")
            return ""

        log_debug(f"Generating embedding for query: '{query}'")
        query_embedding = await self.ollama_service.generate_embedding(query)
        if not query_embedding:
            log_debug("Failed to generate embedding for query. Returning empty context.")
            return ""

        log_debug(f"Searching LanceDB with query embedding. Limit: {limit}")
        results = self.table.search(query_embedding).limit(limit).to_list()
        log_debug(f"Found {len(results)} results from LanceDB.")

        context = []
        for res in results:
            log_debug(f"Retrieved result from {res['path']} (lines {res['start_line']}-{res['end_line']})")
            context.append(f"File: {res['path']} (lines {res['start_line']}-{res['end_line']})\n{res['content']}")
        
        return "\n\n".join(context)

    async def clear_index(self):
        if self.db:
            try:
                self.db.drop_table("code_index")
                self.table = None
                self.indexed_files.clear()
            except Exception as e:
                print(f"Error dropping LanceDB table: {e}")
