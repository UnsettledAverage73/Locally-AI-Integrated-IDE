import httpx
import logging
import asyncio

# Configure Logging
logger = logging.getLogger("sovereign-ide")
logging.basicConfig(level=logging.INFO)

OLLAMA_API_URL = "http://localhost:11434/api"
REQUIRED_EMBEDDING_MODEL = "nomic-embed-text"

async def ensure_nomic_model():
    """
    Checks if the Nomic embedding model exists.
    If not, it triggers an automatic download.
    """
    try:
        # 1. Check installed models
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{OLLAMA_API_URL}/tags")
            except httpx.ConnectError:
                logger.error("❌ Failed to connect to Ollama. Is it running?")
                return False
            
            if response.status_code != 200:
                logger.error(f"❌ Failed to connect to Ollama. Status: {response.status_code}")
                return False

            data = response.json()
            # Handle different Ollama versions response structure
            installed_models = []
            if 'models' in data:
                installed_models = [m['name'] for m in data['models']]
            
            # Check for exact match or versioned match
            is_installed = any(REQUIRED_EMBEDDING_MODEL in name for name in installed_models)

            if is_installed:
                logger.info(f"✅ Embedding Model '{REQUIRED_EMBEDDING_MODEL}' is ready.")
                return True

            # 2. If missing, PULL it
            logger.warning(f"⚠️ Model '{REQUIRED_EMBEDDING_MODEL}' missing. Auto-downloading... (This may take a minute)")
            
            # Streaming the pull request to avoid timeout on large models
            # Note: Ollama pull API might take time. We use a long timeout.
            async with httpx.AsyncClient(timeout=600.0) as pull_client:
                async with pull_client.stream("POST", f"{OLLAMA_API_URL}/pull", json={"name": REQUIRED_EMBEDDING_MODEL}) as response:
                    async for line in response.aiter_lines():
                        if line:
                            # You can parse JSON here to show progress bars if you want
                            pass
            
            logger.info(f"🎉 Successfully downloaded '{REQUIRED_EMBEDDING_MODEL}'.")
            return True

    except Exception as e:
        logger.error(f"💥 Error provisioning models: {str(e)}")
        return False
