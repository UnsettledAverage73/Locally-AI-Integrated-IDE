import ollama
import lancedb
import os
import traceback
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
LANCEDB_PATH = os.getenv("LANCEDB_PATH", "./.localdev-db")

class OllamaService:
    def __init__(self, host: str = OLLAMA_HOST):
        # Increased timeout to 30 minutes for large model downloads
        self.client = ollama.AsyncClient(base_url=host, timeout=1800.00)

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

    async def generate_embedding(self, text: str) -> List[float]:
        try:
            response = await self.client.embeddings(model=EMBEDDING_MODEL, prompt=text)
            return response["embedding"]
        except Exception as e:
            print(f"Embedding error: {str(e)}")
            return []

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
        self.ollama_service = ollama_service or OllamaService()
        self.db = None
        self.table = None
        self.indexed_files = set() 
        self.initialize_db()

    def initialize_db(self):
        try:
            self.db = lancedb.connect(self.db_path)
            try:
                self.table = self.db.open_table("code_index")
            except Exception:
                self.table = None
        except Exception as e:
            print(f"Error initializing LanceDB: {e}")
            self.db = None
            self.table = None

    async def _chunk_code(self, content: str, max_chunk_size: int = 1000) -> List[Dict[str, Any]]:
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
        return chunks

    async def index_file(self, file_path: str, content: str):
        if not self.ollama_service or not self.db:
            return

        if file_path in self.indexed_files:
            return 
        
        chunks = await self._chunk_code(content)
        records = []
        for chunk in chunks:
            embedding = await self.ollama_service.generate_embedding(chunk["content"])
            if embedding:
                records.append({
                    "path": file_path,
                    "content": chunk["content"],
                    "start_line": chunk["start_line"],
                    "end_line": chunk["end_line"],
                    "vector": embedding, 
                })
        
        if records:
            if not self.table:
                self.table = self.db.create_table("code_index", data=records)
            else:
                self.table.add(records)
            self.indexed_files.add(file_path)

    async def get_context(self, query: str, current_file: str = None, limit: int = 5) -> str:
        if not self.ollama_service or not self.table:
            return ""

        query_embedding = await self.ollama_service.generate_embedding(query)
        if not query_embedding:
            return ""

        results = self.table.search(query_embedding).limit(limit).to_list()

        context = []
        for res in results:
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
