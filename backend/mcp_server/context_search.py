from mcp.server.fastmcp import FastMCP
from services.RAGService import RAGService
import asyncio

mcp = FastMCP("LocalDev Context Search")

rag_service = RAGService()

@mcp.tool()
async def get_codebase_map(root_path: str = ".") -> str:
    """
    Returns a high-level map of the codebase, including file paths and key symbols (classes/functions).
    Useful for understanding the project structure and finding where logic might live.
    """
    try:
        from services.CodebaseMapService import codebase_map_service
        # Update root if provided
        if root_path != ".":
            from services.CodebaseMapService import CodebaseMapService
            mapper = CodebaseMapService(root_path)
            return mapper.generate_map()
        return codebase_map_service.generate_map()
    except Exception as e:
        return f"❌ Error generating codebase map: {str(e)}"

@mcp.tool()
async def context_search(query: str, root_path: str = ".") -> str:
    """
    Search for context based on a query with a special prefix.
    
    Args:
        query: The search query, e.g., "@filename.py", "@Docs", "@Web search query".
        root_path: The directory to start searching from.
    """
    if query.startswith("@"):
        parts = query[1:].split(" ", 1)
        context_type = parts[0]
        search_term = parts[1] if len(parts) > 1 else ""

        if context_type.lower() == "docs":
            # Placeholder for documentation search
            return "Documentation search is not yet implemented."
        elif context_type.lower() == "web":
            # Placeholder for web search
            return "Web search is not yet implemented."
        else:
            # Assume it's a filename search
            return await rag_service.get_context(query=context_type)
    else:
        # Default to regular text search
        return "Regular text search is not yet implemented in this tool."

if __name__ == "__main__":
    mcp.run()
