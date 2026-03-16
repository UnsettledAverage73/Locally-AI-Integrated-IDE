import os
import json
from ollama import AsyncClient


class OllamaService:
    def __init__(self):
        config_path = os.path.expanduser("~/.sovereign/config.json")
        default_host = "http://localhost:11434"
        default_model = "qwen2.5:0.5b"
        
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                try:
                    config = json.load(f)
                    default_host = config.get("ollama_host", default_host)
                    default_model = config.get("active_model", default_model)
                except json.JSONDecodeError:
                    pass  # Use default if config is corrupt

        self.host = default_host
        self.active_model = default_model
        self.client = AsyncClient(host=self.host, timeout=5)

    async def update_host(self, host: str):
        """Updates the Ollama host and checks for availability."""
        if not host.startswith("http"):
            host = f"http://{host}"

        self.host = host
        self.client = AsyncClient(host=self.host, timeout=5)  # Re-initialize client
        print(f"⚡️ AI host updated to: {self.host}")

        # Save to a persistent config file
        self._save_config()

        return await self.check_connection()

    def _save_config(self):
        """Internal helper to save current configuration to disk."""
        config_path = os.path.expanduser("~/.sovereign/config.json")
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        config = {
            "ollama_host": self.host,
            "active_model": self.active_model
        }
        with open(config_path, "w") as f:
            json.dump(config, f)

    async def set_active_model(self, model_name: str):
        """Sets and persists the active model."""
        self.active_model = model_name
        self._save_config()
        print(f"🎯 Active model set to: {self.active_model}")
        return True

    async def check_connection(self):
        try:
            await self.client.list()
            return True
        except Exception:
            return False

    async def list_models(self):
        models_data = await self.client.list()
        # Ensure 'models' key exists and is a list
        if "models" not in models_data or not isinstance(models_data["models"], list):
            return []  # Return empty list if structure is unexpected

        # Safely extract 'name' from each model, filtering out entries without a name
        return [model["name"] for model in models_data["models"] if "name" in model]

    async def pull_model(self, model_name: str):
        await self.client.pull(model_name)

    async def pull_model_stream(self, model_name: str):
        async for progress in await self.client.pull(model_name, stream=True):
            yield progress

    async def delete_model(self, model_name: str):
        await self.client.delete(model_name)

    async def generate_completion(
        self, model: str, prefix: str, suffix: str, options: dict = None
    ):
        response = await self.client.generate(
            model=model, prompt=f"<PRE> {prefix} <SUF> {suffix} <MID>", options=options
        )
        return response["response"]

    async def generate_embedding(self, text):
        """Generates embeddings for a single text or a list of texts (batching)."""
        model = "nomic-embed-text:latest"
        try:
            # Try the modern 'embed' API first (Ollama 0.2.x+)
            response = await self.client.embed(model=model, input=text)
            if isinstance(text, str):
                return response["embeddings"][0]
            return response["embeddings"]
        except Exception as e:
            # Fallback to legacy 'embeddings' API
            print(f"⚠️ 'embed' API failed ({e}), falling back to legacy 'embeddings' API...")
            if isinstance(text, str):
                response = await self.client.embeddings(model=model, prompt=text)
                return response["embedding"]
            else:
                # Batch process for legacy API (sequential)
                results = []
                for t in text:
                    resp = await self.client.embeddings(model=model, prompt=t)
                    results.append(resp["embedding"])
                return results

    async def show_model_info(self, model_name: str):
        return await self.client.show(model_name)

    async def stream_chat(self, model: str, messages: list, options: dict = None):
        """Streams a chat response from the Ollama service."""
        async for chunk in await self.client.chat(
            model=model, messages=messages, stream=True, options=options
        ):
            yield chunk
