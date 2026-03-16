import httpx
import logging
import asyncio
import os
import json
import traceback

# Configure Logging
logger = logging.getLogger("sovereign-ide")
logging.basicConfig(level=logging.INFO)

def get_config():
    config_path = os.path.expanduser("~/.sovereign/config.json")
    default_host = "http://localhost:11434"
    default_model = "qwen2.5:0.5b"
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            try:
                config = json.load(f)
                return {
                    "host": config.get("ollama_host", default_host),
                    "active_model": config.get("active_model", default_model)
                }
            except json.JSONDecodeError:
                pass
    return {"host": default_host, "active_model": default_model}

def get_ollama_host():
    return get_config()["host"]

OLLAMA_API_URL = f"{get_ollama_host()}/api"
REQUIRED_MODELS = ["nomic-embed-text:latest", "qwen2.5:0.5b"]

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
    Initially checks the configured host, falls back to localhost if it fails.
    """
    config = get_config()
    configured_host = config["host"]
    active_model_name = config["active_model"]
    
    hosts_to_try = [configured_host]
    
    # If the configured host is not localhost, add localhost as a fallback
    if "localhost" not in configured_host and "127.0.0.1" not in configured_host:
        hosts_to_try.append("http://localhost:11434")

    # Combine static required models with the user's active model
    all_required = list(set(REQUIRED_MODELS + [active_model_name]))

    for host in hosts_to_try:
        api_url = f"{host}/api"
        logger.info(f"🧠 Checking Ollama connection at: {api_url}")
        
        try:
            # 1. Check installed models with a short timeout
            async with httpx.AsyncClient(timeout=5.0) as client:
                try:
                    response = await client.get(f"{api_url}/tags")
                    response.raise_for_status() # Force an exception if status is not 2xx
                except (httpx.ConnectError, httpx.ConnectTimeout, httpx.HTTPStatusError) as e:
                    logger.warning(f"⚠️ Ollama at {api_url} is unreachable or returned an error: {e}")
                    continue # Try the next host in the list

                data = response.json()
                # Ollama API returns a list of dictionaries under the 'models' key
                installed_models = []
                for m in data.get('models', []):
                    # Handle both 'qwen2.5:0.5b' and 'qwen2.5' naming conventions
                    installed_models.append(m.get('name', ''))

                missing_models = []
                for required in all_required:
                    # We do an exact match check based on the 'ollama list' output
                    if required not in installed_models:
                        missing_models.append(required)

                if not missing_models:
                    logger.info(f"✅ All required models {all_required} are ready on {host}.")
                    return True

                logger.info(f"⚠️ Missing models detected on {host}: {missing_models}")
                
                # 2. Pull missing models sequentially (Parallel pulls often crash local Ollama instances)
                for model in missing_models:
                    success = await pull_model(model, api_url)
                    if not success:
                        return False
                
                return True

        except Exception as e:
            # If it's a general exception, log it and try the next host
            logger.error(f"💥 Unexpected error checking {api_url}: {str(e)}")
            logger.debug(traceback.format_exc())
            continue

    logger.error("❌ CRITICAL: Could not connect to any Ollama instance. Is Ollama running?")
    return False
