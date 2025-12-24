import ollama
import lancedb
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

OLLAMA_HOST = "http://127.0.0.1:11434" # Explicitly set for debugging
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
LANCEDB_PATH = os.getenv("LANCEDB_PATH", "./.localdev-db")

class OllamaService:
    def __init__(self, host: str = OLLAMA_HOST):
        self.client = ollama.AsyncClient(base_url=host, timeout=300.00)

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
            return [m["name"] for m in models["models"]]
        except Exception as e:
            print(f"Error listing models: {e}")
            return []

    async def generate_embedding(self, text: str) -> List[float]:
        try:
            response = await self.client.embeddings(model=EMBEDDING_MODEL, prompt=text)
            return response["embedding"]
        except Exception:
            return []

    async def stream_completion(self, model: str, prompt: str):
        async for chunk in await self.client.generate(model=model, prompt=prompt, stream=True):
            yield chunk

    async def chat_completion(self, model: str, messages: List[Dict[str, str]]):
        # The ollama.AsyncClient.chat method expects messages as a list of dictionaries with 'role' and 'content'.
        # The incoming 'messages' from ChatRequest already conform to this.
        print(f"Sending messages to Ollama chat: {messages}")
        try:
            response = await self.client.chat(model=model, messages=messages)
            return response["message"]["content"]
        except Exception as e:
            print(f"CRITICAL OLLAMA ERROR: {str(e)}")
            # Return a friendly error message to the UI instead of crashing
            return f"Error: The model took too long or failed to respond. (Details: {str(e)})"

class RAGService:
    def __init__(self, db_path: str = LANCEDB_PATH, ollama_service: OllamaService = None):
        self.db_path = db_path
        self.ollama_service = ollama_service or OllamaService()
        self.db = None
        self.table = None
        self.indexed_files = set() # To keep track of indexed files
        self.initialize_db()

    def initialize_db(self):
        try:
            self.db = lancedb.connect(self.db_path)
            try:
                # Define the schema for the LanceDB table
                # The 'vector' field is for embeddings (List[float])
                # The other fields are for metadata
                self.table = self.db.open_table("code_index")
            except Exception:
                # Table doesn't exist, it will be created on first insert
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
            return # Already indexed
        
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
                    "vector": embedding, # LanceDB expects 'vector' field for embeddings
                })
        
        if records:
            if not self.table:
                # Create table with schema if it doesn't exist
                # The schema is inferred from the first record with a 'vector' field
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

        # LanceDB search expects a vector
        results = self.table.search(query_embedding).limit(limit).to_list()

        context = []
        for res in results:
            context.append(f"File: {res["path"]} (lines {res["start_line"]}-{res["end_line"]})\n{res["content"]}")
        
        return "\n\n".join(context)

    async def clear_index(self):
        if self.db:
            try:
                self.db.drop_table("code_index")
                self.table = None
                self.indexed_files.clear()
            except Exception as e:
                print(f"Error dropping LanceDB table: {e}")
