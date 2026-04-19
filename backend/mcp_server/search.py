from mcp.server.fastmcp import FastMCP
import os
import fnmatch
import re

mcp = FastMCP("LocalDev Search")

IGNORE_DIRS = {
    ".git", "__pycache__", "node_modules", "venv", ".venv", "dist", "build", ".idea", ".vscode"
}
IGNORE_EXTS = {
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".dylib", ".exe", ".bin", ".obj", ".o", ".a", ".lib",
    ".iso", ".tar", ".gz", ".zip", ".7z", ".rar", ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".ico", ".svg"
}

def _is_ignored(path: str) -> bool:
    parts = path.split(os.sep)
    for part in parts:
        if part in IGNORE_DIRS:
            return True
    return False

def _is_binary_ext(path: str) -> bool:
    _, ext = os.path.splitext(path)
    return ext.lower() in IGNORE_EXTS

@mcp.tool()
def glob(pattern: str, root_path: str = ".") -> str:
    """
    Search for files by name using a glob pattern.
    
    Args:
        pattern: The glob pattern to match (e.g., "*.py", "main.*).
        root_path: The directory to start searching from.
    """
    results = []
    try:
        abs_root = os.path.abspath(root_path)
        if not os.path.exists(abs_root):
            return f"❌ Error: Path not found: {root_path}"

        for dirpath, dirnames, filenames in os.walk(abs_root):
            # Filter directories in-place
            dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
            
            for filename in fnmatch.filter(filenames, pattern):
                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, abs_root)
                results.append(rel_path)
        
        if not results:
            return f"No files found matching '{pattern}' in '{root_path}'."
            
        return "\n".join(results)
    except Exception as e:
        return f"❌ Error searching filenames: {str(e)}"


def search_filenames(pattern: str, root_path: str = ".") -> str:
    return glob(pattern, root_path)

@mcp.tool()
def grep_search(query: str, root_path: str = ".") -> str:
    """
    Search for a text string or regex pattern in file contents.
    
    Args:
        query: The text or regex pattern to search for.
        root_path: The directory to start searching from.
    """
    results = []
    try:
        abs_root = os.path.abspath(root_path)
        if not os.path.exists(abs_root):
            return f"❌ Error: Path not found: {root_path}"

        # Try compiling regex; if fails, treat as literal string (manual check)
        try:
            regex = re.compile(query, re.IGNORECASE)
            is_regex = True
        except re.error:
            is_regex = False
        
        count = 0
        MAX_RESULTS = 100

        for dirpath, dirnames, filenames in os.walk(abs_root):
            # Filter directories
            dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
            
            for filename in filenames:
                full_path = os.path.join(dirpath, filename)
                if _is_binary_ext(full_path):
                    continue
                    
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            found = False
                            if is_regex:
                                if regex.search(line):
                                    found = True
                            else:
                                if query.lower() in line.lower():
                                    found = True
                            
                            if found:
                                rel_path = os.path.relpath(full_path, abs_root)
                                results.append(f"{rel_path}:{i+1}: {line.strip()}")
                                count += 1
                                if count >= MAX_RESULTS:
                                    results.append("... (limit reached)")
                                    return "\n".join(results)
                except Exception:
                    continue # Skip unreadable files

        if not results:
            return f"No matches found for '{query}' in '{root_path}'."
            
        return "\n".join(results)

    except Exception as e:
        return f"❌ Error searching text: {str(e)}"


def search_text(query: str, root_path: str = ".") -> str:
    return grep_search(query, root_path)

if __name__ == "__main__":
    mcp.run()
