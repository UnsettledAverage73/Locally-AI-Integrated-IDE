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
    output, _ = run_shell_command_with_code(command)
    return output

def run_shell_command_with_code(command: str) -> tuple[str, int]:
    """
    Run a terminal command and return both output and exit code.
    """
    try:
        process = subprocess.run(
            command,
            cwd=os.getcwd(),
            shell=True,
            capture_output=True,
            text=True
        )
        output = process.stdout
        if process.stderr:
            output += f"\nStderr: {process.stderr}"
        return output, process.returncode
    except Exception as e:
        return f"Error executing command: {str(e)}", 1