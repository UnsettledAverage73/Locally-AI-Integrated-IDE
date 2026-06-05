import os
import json
import logging
from ollama import AsyncClient

logger = logging.getLogger("sovereign-ide")

class OllamaService:
    def __init__(self):
        config_path = os.path.expanduser("~/.sovereign/config.json")
        default_host = "http://localhost:11434"
        default_model = "qwen2.5:0.5b"
        self.hosts = [default_host]
        
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                try:
                    config = json.load(f)
                    self.hosts = config.get("ollama_hosts", [])
                    if not self.hosts and "ollama_host" in config:
                        self.hosts = [config["ollama_host"]]
                    if not self.hosts:
                        self.hosts = [default_host]
                    default_model = config.get("active_model", default_model)
                except json.JSONDecodeError:
                    pass

        self.host = self.hosts[0]
        self.active_model = default_model
        self.client = AsyncClient(host=self.host, timeout=5)
        self._current_host_index = 0
        self._unhealthy_hosts = set()

    def _get_client(self):
        """Returns the current client or next in round-robin if multiple hosts exist."""
        healthy_hosts = [h for h in self.hosts if h not in self._unhealthy_hosts]
        if not healthy_hosts:
            # Fallback to all hosts if everything is marked unhealthy (might be a network issue)
            healthy_hosts = self.hosts
            self._unhealthy_hosts.clear()

        if len(healthy_hosts) == 1:
            return AsyncClient(host=healthy_hosts[0], timeout=5)
        
        # Simple round-robin for each request
        host = healthy_hosts[self._current_host_index % len(healthy_hosts)]
        self._current_host_index = (self._current_host_index + 1) % len(healthy_hosts)
        return AsyncClient(host=host, timeout=5)

    def mark_unhealthy(self, host: str):
        """Marks a host as unhealthy so it's temporarily skipped."""
        self._unhealthy_hosts.add(host)
        logger.warning(json.dumps({
            "event": "host_unhealthy",
            "host": host,
            "action": "skipped_in_rotation",
            "remaining_healthy": len(self.hosts) - len(self._unhealthy_hosts)
        }))

    async def update_host(self, host: str):
        """Updates the Ollama hosts list and checks for availability."""
        if not host.startswith("http"):
            host = f"http://{host}"

        # For single update, we replace the first host or just set it as the only host
        self.hosts = [host]
        self.host = host
        self.client = AsyncClient(host=self.host, timeout=5)
        self._current_host_index = 0
        self._unhealthy_hosts.clear()
        
        logger.info(json.dumps({
            "event": "host_updated",
            "new_primary_host": self.host,
            "pool_size": len(self.hosts)
        }))

        # Save to a persistent config file
        self._save_config()

        return await self.check_connection()

    async def add_host(self, host: str):
        """Adds a new host to the inference pool."""
        if not host.startswith("http"):
            host = f"http://{host}"
        
        if host not in self.hosts:
            self.hosts.append(host)
            self._save_config()
            return True
        return False

    def _save_config(self):
        """Internal helper to save current configuration to disk."""
        config_path = os.path.expanduser("~/.sovereign/config.json")
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        config = {
            "ollama_host": self.host,
            "ollama_hosts": self.hosts,
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
            # Check connection using the current primary client
            await self.client.list()
            return True
        except Exception:
            return False

    async def list_models(self):
        try:
            # We list models from the primary host
            models_data = await self.client.list()
            
            # Handle both dictionary (older versions) and object (v0.3.0+)
            models = []
            if hasattr(models_data, 'models'):
                models = models_data.models
            elif isinstance(models_data, dict) and 'models' in models_data:
                models = models_data['models']

            if not isinstance(models, list):
                return []

            result = []
            for model in models:
                # Handle both object (v0.3.0+) and dictionary (older versions)
                if hasattr(model, 'model'):
                    name = model.model
                    size = getattr(model, 'size', 0)
                elif isinstance(model, dict):
                    name = model.get('name') or model.get('model')
                    size = model.get('size', 0)
                else:
                    continue
                
                if name:
                    result.append({"name": name, "size": size})
            
            return result
        except Exception as e:
            print(f"Error listing models: {e}")
            return []

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
        client = self._get_client()
        try:
            response = await client.generate(
                model=model, prompt=f"<PRE> {prefix} <SUF> {suffix} <MID>", options=options
            )
            return response["response"]
        except Exception as e:
            # If a host fails, we could retry here, but for now we just mark unhealthy if possible
            # (In a real system, we'd catch specific connection errors)
            raise e

    async def generate_embedding(self, text):
        """Generates embeddings for a single text or a list of texts (batching)."""
        model = "nomic-embed-text:latest"
        client = self._get_client()
        try:
            # Try the modern 'embed' API first (Ollama 0.2.x+)
            response = await client.embed(model=model, input=text)
            if isinstance(text, str):
                return response["embeddings"][0]
            return response["embeddings"]
        except Exception as e:
            # Fallback to legacy 'embeddings' API
            print(f"⚠️ 'embed' API failed ({e}), falling back to legacy 'embeddings' API...")
            if isinstance(text, str):
                response = await client.embeddings(model=model, prompt=text)
                return response["embedding"]
            else:
                # Batch process for legacy API (sequential)
                results = []
                for t in text:
                    resp = await client.embeddings(model=model, prompt=t)
                    results.append(resp["embedding"])
                return results

    async def show_model_info(self, model_name: str):
        return await self._get_client().show(model_name)

    async def stream_chat(self, model: str, messages: list, options: dict = None):
        """Streams a chat response from the Ollama service."""
        payload_messages = []
        for msg in messages:
            m = {"role": msg["role"], "content": msg["content"]}
            if "images" in msg:
                m["images"] = msg["images"]
            payload_messages.append(m)

        async for chunk in await self._get_client().chat(
            model=model, messages=payload_messages, stream=True, options=options
        ):
            yield chunk
