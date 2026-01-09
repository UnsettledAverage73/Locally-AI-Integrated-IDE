from mcp.server.fastmcp import FastMCP
import os
import json
from typing import Any

mcp = FastMCP("LocalDev Filesystem")


@mcp.tool()
def list_files(path: str = ".") -> str:
    """
    Lists files and directories in a given path.

    Args:
        path: The directory path (defaults to current directory).
    """
    try:
        full_path = os.path.abspath(path)
        if not os.path.exists(full_path):
            return f"❌ Error: Directory not found at {path}"
        
        items = os.listdir(full_path)
        # Add a trailing slash for directories for clarity
        formatted_items = []
        for item in items:
            if os.path.isdir(os.path.join(full_path, item)):
                formatted_items.append(f"{item}/")
            else:
                formatted_items.append(item)
                
        return "\n".join(sorted(formatted_items))
    except Exception as e:
        return f"❌ Error listing directory: {str(e)}"


@mcp.tool()
def read_file(path: str) -> str:
    """
    Reads content from a file.

    Args:
        path: The path to the file.
    """
    try:
        full_path = os.path.abspath(path)
        if not os.path.exists(full_path):
            return f"❌ Error: File not found at {path}"
        with open(full_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"❌ Error reading file: {str(e)}"


@mcp.tool()
def write_file(path: str, content: str) -> str:
    """
    Writes content to a single file.

    Args:
        path: The path to the file.
        content: The content to write.
    """
    try:
        full_path = os.path.abspath(path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"✅ Successfully wrote to {path}"
    except Exception as e:
        return f"❌ Error writing file: {str(e)}"


@mcp.tool()
def scaffold_project(base_path: str, file_structure: Any) -> str:
    """
    Creates multiple files and folders at once.

    Args:
        base_path: The root folder name (e.g., "snake_game")
        file_structure: A dictionary or JSON string mapping "filepath" to "content".
    """
    try:
        if isinstance(file_structure, str):
            files = json.loads(file_structure)
        else:
            files = file_structure

        # Create the Base Directory
        os.makedirs(base_path, exist_ok=True)

        created_log = []

        for rel_path, content in files.items():
            # Security: Ensure we don't escape the sandbox
            full_path = os.path.abspath(os.path.join(base_path, rel_path))
            abs_base = os.path.abspath(base_path)

            if not full_path.startswith(abs_base):
                # Simple escape check
                continue

            # Create subdirectories if needed (e.g., "src/utils.py")
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

            created_log.append(rel_path)

        return f"✅ Successfully created project '{base_path}' with files: {', '.join(created_log)}"

    except Exception as e:
        return f"❌ System Error: {str(e)}"


if __name__ == "__main__":
    mcp.run()
