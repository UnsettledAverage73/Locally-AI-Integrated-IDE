import json
from .OllamaService import OllamaService
from .RAGService import RAGService
from .chat_history import history_service

MEMORY_EXTRACTION_PROMPT = """
Analyze the following conversation turn between a User and an AI Assistant.
Extract any important facts, user preferences, project details, or long-term insights that should be remembered for future interactions.

Criteria for memory:
- User preferences (e.g., "I prefer tabs over spaces", "I use React for frontend")
- Project-specific facts (e.g., "The backend is in FastAPI", "The database is PostgreSQL")
- Personal facts (e.g., "I am working on a healthcare app")
- Decisions made (e.g., "We decided to use Tailwind CSS")

If nothing important is found, return an empty list [].
If memories are found, return a JSON list of objects with 'content' and 'category'.

Example categories: 'preference', 'project', 'fact', 'decision'.

Conversation:
User: {user_message}
Assistant: {assistant_message}

JSON Output:
"""

class MemoryService:
    def __init__(self, ollama_service: OllamaService, rag_service: RAGService):
        self.ollama_service = ollama_service
        self.rag_service = rag_service

    async def process_turn(self, session_id: str, user_message: str, assistant_message: str):
        """Extracts and stores memories from a chat turn."""
        prompt = MEMORY_EXTRACTION_PROMPT.format(
            user_message=user_message,
            assistant_message=assistant_message
        )

        try:
            # We use a fast model for extraction
            response = await self.ollama_service.client.generate(
                model="qwen2.5:0.5b", # Or another small/fast model
                prompt=prompt,
                format="json",
                stream=False
            )
            
            content = response.get("response", "[]")
            memories = json.loads(content)

            if isinstance(memories, list):
                for mem in memories:
                    content = mem.get("content")
                    category = mem.get("category", "fact")
                    
                    if content:
                        print(f"🧠 New Memory Extracted: [{category}] {content}")
                        # 1. Save to SQLite
                        history_service.add_memory(content, category, session_id)
                        # 2. Save to LanceDB
                        await self.rag_service.index_memory(content, category, session_id)
            
        except Exception as e:
            print(f"⚠️ Error extracting memory: {e}")

memory_service = None # Will be initialized in main.py
