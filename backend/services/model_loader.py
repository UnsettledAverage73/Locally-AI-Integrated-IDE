import httpx
import logging
import asyncio
import os
import json

# Configure Logging
logger = logging.getLogger("sovereign-ide")
logging.basicConfig(level=logging.INFO)

def get_ollama_host():
    config_path = os.path.expanduser("~/.sovereign/config.json")
    default_host = "http://localhost:11434"
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            try:
                config = json.load(f)
                return config.get("ollama_host", default_host)
            except json.JSONDecodeError:
                pass
    return default_host

OLLAMA_API_URL = f"{get_ollama_host()}/api"
REQUIRED_MODELS = ["nomic-embed-text", "qwen2.5:0.5b"]

async def pull_model(model_name: str, client_url: str):
    """Helper to pull a single model with streaming to avoid timeouts."""
    logger.info(f"⚠️ Model '{model_name}' missing. Auto-downloading...")
    try:
        async with httpx.AsyncClient(timeout=600.0) as pull_client:
            async with pull_client.stream("POST", f"{client_url}/pull", json={"name": model_name}) as response:
                async for line in response.aiter_lines():
                    pass # We could log progress here
        logger.info(f"🎉 Successfully downloaded '{model_name}'.")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to download '{model_name}': {e}")
        return False

async def ensure_nomic_model():
    """
    Checks if required models (embedding and chat) exist.
    If not, it triggers automatic downloads.
    """
    try:
        api_url = f"{get_ollama_host()}/api"
        # 1. Check installed models
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{api_url}/tags")
            except httpx.ConnectError:
                logger.error("❌ Failed to connect to Ollama. Is it running?")
                return False
            
            if response.status_code != 200:
                logger.error(f"❌ Failed to connect to Ollama. Status: {response.status_code}")
                return False

            data = response.json()
            installed_models = [m['name'].split(':')[0] if ':' in m['name'] else m['name'] for m in data.get('models', [])]
            installed_full_names = [m['name'] for m in data.get('models', [])]

            missing_models = []
            for required in REQUIRED_MODELS:
                base_name = required.split(':')[0]
                if not any(base_name == inst or required == inst for inst in installed_models + installed_full_names):
                    missing_models.append(required)

            if not missing_models:
                logger.info(f"✅ All required models {REQUIRED_MODELS} are ready.")
                return True

            # 2. Pull missing models in parallel
            tasks = [pull_model(model, api_url) for model in missing_models]
            results = await asyncio.gather(*tasks)
            
            return all(results)

    except Exception as e:
        logger.error(f"💥 Error provisioning models: {str(e)}")
        return False
