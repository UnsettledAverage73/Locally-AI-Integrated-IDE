# backend/mcp_server/ollama.py
from typing import Annotated
from mcp.server.fastmcp import FastMCP
from services.OllamaService import OllamaService

mcp = FastMCP(
    name="ollama_tools",
)

@mcp.tool(
    name="pull_model",
    description="Downloads a model from the Ollama model registry. Use this if the user asks to install, download, or get a new model.",
)
async def pull_model(
    model_name: Annotated[str, "The name of the model to pull, e.g., 'llama3' or 'mistral'"]
):
    """
    Tool to download a new model to the Ollama instance.
    """
    try:
        # We instantiate OllamaService here to ensure it uses the latest host
        # configuration from the config file.
        ollama_service = OllamaService()
        
        # This is a fire-and-forget operation from the agent's perspective.
        # The UI will handle the streaming progress.
        await ollama_service.pull_model(model_name)
        
        return f"Model '{model_name}' has started downloading. The user can monitor the progress in the UI."
    except Exception as e:
        return f"An error occurred while trying to pull the model: {str(e)}"
