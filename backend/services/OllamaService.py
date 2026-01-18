
from ollama import AsyncClient

class OllamaService:
    def __init__(self):
        self.client = AsyncClient()

    async def check_connection(self):
        try:
            await self.client.list()
            return True
        except Exception:
            return False

    async def list_models(self):
        models = await self.client.list()
        return [model["name"] for model in models["models"]]

    async def pull_model(self, model_name: str):
        await self.client.pull(model_name)

    async def pull_model_stream(self, model_name: str):
        async for progress in self.client.pull(model_name, stream=True):
            yield progress

    async def delete_model(self, model_name: str):
        await self.client.delete(model_name)

    async def generate_completion(self, model: str, prefix: str, suffix: str, options: dict = None):
        response = await self.client.generate(
            model=model,
            prompt=f"<PRE> {prefix} <SUF> {suffix} <MID>",
            options=options
        )
        return response["response"]

    async def generate_embedding(self, text: str):
        response = await self.client.embeddings(
            model="nomic-embed-text",
            prompt=text
        )
        return response["embedding"]

    async def show_model_info(self, model_name: str):
        return await self.client.show(model_name)

