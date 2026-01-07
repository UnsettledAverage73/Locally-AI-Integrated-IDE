from mcp.server.fastmcp import FastMCP
import subprocess
import os
import asyncio

mcp = FastMCP("LocalDev Terminal")
DEFAULT_WORKSPACE = os.path.join(os.getcwd(), "workspace")

@mcp.tool()
def run_shell_command(command: str) -> str:
    """
    Run a terminal command.
    Args:
        command: The shell command to run.
    Returns:
        The command output or an error message.
    """
    try:
        # Security Note: shell=True is dangerous. 
        # In a real app, we should sandbox this or use a safe execution environment.
        # For this local dev tool, we assume the user trusts the tool they are running locally.
        process = subprocess.run(
            command,
            cwd=os.getcwd(), # Run in current working directory of the backend (project root)
            shell=True,
            capture_output=True,
            text=True
        )
        output = process.stdout
        if process.stderr:
            output += f"\nStderr: {process.stderr}"
        return output
    except Exception as e:
        return f"Error executing command: {str(e)}"