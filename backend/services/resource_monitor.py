import shutil
import subprocess
import psutil
import requests
import logging
import threading
import time
from .model_loader import get_ollama_host

logger = logging.getLogger(__name__)

_RESOURCE_CACHE_TTL_SECONDS = 2.0
_resource_cache_lock = threading.Lock()
_resource_cache: dict[str, object] = {"timestamp": 0.0, "data": None}

def get_cpu_usage() -> str:
    try:
        return f"{psutil.cpu_percent(interval=None)}%"
    except Exception as e:
        logger.error(f"Error getting CPU usage: {e}")
        return "0%"

def get_ram_usage() -> str:
    try:
        memory = psutil.virtual_memory()
        return f"{memory.percent}%"
    except Exception as e:
        logger.error(f"Error getting RAM usage: {e}")
        return "0%"

def get_gpu_stats():
    # Check if nvidia-smi exists
    if not shutil.which("nvidia-smi"):
        return {"available": False, "name": "Integrated Graphics", "vram": "0MB", "load": "0%"}

    try:
        # Run nvidia-smi to get name, memory used, and utilization
        # --query-gpu=name,memory.used,utilization.gpu --format=csv,noheader,nounits
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.used,utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            check=True
        )
        
        output = result.stdout.strip()
        if not output:
             return {"available": False, "name": "Integrated Graphics", "vram": "0MB", "load": "0%"}

        # Handle multiple GPUs? For now just take the first line
        first_line = output.split('\n')[0]
        parts = [p.strip() for p in first_line.split(',')]
        
        if len(parts) >= 3:
            name = parts[0]
            vram = f"{parts[1]}MB"
            load = f"{parts[2]}%"
            return {"available": True, "name": name, "vram": vram, "load": load}
        
        return {"available": False, "name": "Integrated Graphics", "vram": "0MB", "load": "0%"}

    except Exception as e:
        logger.error(f"Error getting GPU stats: {e}")
        return {"available": False, "name": "Integrated Graphics", "vram": "0MB", "load": "0%"}

def get_ollama_stats():
    status = "offline"
    mode = "N/A"
    host = get_ollama_host()
    is_remote = "localhost" not in host and "127.0.0.1" not in host
    
    # Check if online via HTTP
    try:
        # Normalize host URL
        check_url = host if host.endswith("/") else f"{host}/"
        response = requests.get(check_url, timeout=0.5)
        if response.status_code == 200:
            status = "online"
            # Default to CPU unless we find evidence of GPU
            mode = "🌐 Remote" if is_remote else "🐌 CPU"
    except requests.exceptions.RequestException:
        return {"status": "offline", "mode": "N/A"}

    # Determine mode via 'ollama ps' only if local
    if status == "online" and not is_remote and shutil.which("ollama"):
        try:
            # ollama ps lists running models. 
            # We want to see if any model is offloaded to GPU.
            result = subprocess.run(
                ["ollama", "ps"],
                capture_output=True,
                text=True
            )
            
            if "100% GPU" in result.stdout:
                mode = "🔥 GPU"
            elif "GPU" in result.stdout:
                 mode = "🔥 GPU (Partial)"
            
        except Exception as e:
            logger.error(f"Error running ollama ps: {e}")

    return {"status": status, "mode": mode}

def get_system_resources():
    now = time.monotonic()

    with _resource_cache_lock:
        cached_at = float(_resource_cache["timestamp"])
        cached_data = _resource_cache["data"]
        if cached_data is not None and now - cached_at < _RESOURCE_CACHE_TTL_SECONDS:
            return cached_data

    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    data = {
        "cpu": get_cpu_usage(),
        "ram": get_ram_usage(),
        "gpu": get_gpu_stats(),
        "ollama": get_ollama_stats(),
        # Legacy fields for ModelSettings.tsx
        "ram_total_gb": round(mem.total / (1024**3), 2),
        "ram_available_gb": round(mem.available / (1024**3), 2),
        "disk_total_gb": round(disk.total / (1024**3), 2),
        "disk_free_gb": round(disk.free / (1024**3), 2),
    }

    with _resource_cache_lock:
        _resource_cache["timestamp"] = now
        _resource_cache["data"] = data

    return data
