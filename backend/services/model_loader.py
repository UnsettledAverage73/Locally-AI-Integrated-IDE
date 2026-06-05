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
                hosts = config.get("ollama_hosts", [])
                if not hosts and "ollama_host" in config:
                    hosts = [config["ollama_host"]]
                
                return {
                    "host": hosts[0] if hosts else default_host,
                    "hosts": hosts if hosts else [default_host],
                    "active_model": config.get("active_model", default_model),
                    "remote_rag_url": config.get("remote_rag_url", None)
                }
            except json.JSONDecodeError:
                pass
    return {"host": default_host, "hosts": [default_host], "active_model": default_model, "remote_rag_url": None}

def get_ollama_host():
    return get_config()["host"]

def get_ollama_hosts():
    return get_config()["hosts"]

def get_remote_rag_url():
    return get_config().get("remote_rag_url")

def get_recommended_model():
    """
    Analyzes system resources to recommend the best starting model.
    """
    try:
        import psutil
        ram_gb = psutil.virtual_memory().total / (1024**3)
        
        # Check for GPU
        from .resource_monitor import get_gpu_stats
        gpu = get_gpu_stats()
        
        if gpu["available"]:
            # High-end GPU
            if "RTX" in gpu["name"] or "A100" in gpu["name"] or "H100" in gpu["name"]:
                return "qwen2.5-coder:7b"
            # Mid-range GPU
            return "qwen2.5-coder:3b"
        
        # CPU-only machines
        if ram_gb > 16:
            return "qwen2.5-coder:1.5b"
        
        # Potato PCs
        return "qwen2.5:0.5b"
    except:
        return "qwen2.5:0.5b"

OLLAMA_API_URL = f"{get_ollama_host()}/api"
REQUIRED_MODELS = ["nomic-embed-text:latest", "qwen2.5:0.5b", "qwen2.5-coder:latest"]

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

async def check_host_health(host: str, required_models: list):
    """Checks if a host is reachable and has the required models."""
    api_url = f"{host}/api"
    try:
        # Use a very short timeout for reachability
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{api_url}/tags")
            response.raise_for_status()
            
            data = response.json()
            installed_models = [m.get('name', '') for m in data.get('models', [])]
            
            missing = [r for r in required_models if r not in installed_models]
            return {"host": host, "api_url": api_url, "missing": missing, "reachable": True}
    except Exception:
        return {"host": host, "reachable": False}

async def ensure_nomic_model():
    """
    Checks if required models exist using parallel host probing across the pool.
    """
    config = get_config()
    hosts_to_try = config["hosts"]
    active_model_name = config["active_model"]
    
    # Always try local as fallback if not in list
    local_fallback = "http://localhost:11434"
    if local_fallback not in hosts_to_try:
        hosts_to_try.append(local_fallback)

    all_required = list(set(REQUIRED_MODELS + [active_model_name]))
    
    # Probe all hosts in parallel
    results = await asyncio.gather(*[check_host_health(h, all_required) for h in hosts_to_try])
    
    # Find the first reachable host
    healthy_host = next((r for r in results if r["reachable"]), None)
    
    if not healthy_host:
        logger.error("❌ CRITICAL: No reachable Ollama instance found.")
        return False

    host = healthy_host["host"]
    api_url = healthy_host["api_url"]
    missing_models = healthy_host["missing"]

    if not missing_models:
        logger.info(f"✅ All required models are ready on {host}.")
        return True

    logger.info(f"⚠️ Missing models detected on {host}: {missing_models}")
    
    # Pull missing models sequentially
    for model in missing_models:
        success = await pull_model(model, api_url)
        if not success:
            return False
    
    return True
