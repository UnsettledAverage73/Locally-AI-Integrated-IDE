import os
import json
from ollama import AsyncClient


class OllamaService:
    def __init__(self):
        config_path = os.path.expanduser("~/.sovereign/config.json")
        default_host = "http://localhost:11434"
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                try:
                    config = json.load(f)
                    default_host = config.get("ollama_host", default_host)
                except json.JSONDecodeError:
                    pass  # Use default if config is corrupt

        self.host = default_host
        self.client = AsyncClient(host=self.host)

    async def update_host(self, host: str):
        """Updates the Ollama host and checks for availability."""
        if not host.startswith("http"):
            host = f"http://{host}"

        self.host = host
        self.client = AsyncClient(host=self.host)  # Re-initialize client
        print(f"⚡️ AI host updated to: {self.host}")

        # Save to a persistent config file
        config_path = os.path.expanduser("~/.sovereign/config.json")
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, "w") as f:
            json.dump({"ollama_host": self.host}, f)

        return await self.check_connection()

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

    async def generate_embedding(self, text: str):
        response = await self.client.embeddings(model="nomic-embed-text", prompt=text)
        return response["embedding"]

    async def show_model_info(self, model_name: str):
        return await self.client.show(model_name)

    async def stream_chat(self, model: str, messages: list, options: dict = None):
        """Streams a chat response from the Ollama service."""
        async for chunk in await self.client.chat(
            model=model, messages=messages, stream=True, options=options
        ):
            yield chunk
