from mcp.server.fastmcp import FastMCP
import subprocess
import os

mcp = FastMCP("LocalDev Git")

@mcp.tool()
def git_status() -> str:
    """
    Get the git status of the project.
    Returns:
        The git status or an error message.
    """
    try:
        process = subprocess.run(
            "git status",
            cwd=os.getcwd(),
            shell=True,
            capture_output=True,
            text=True
        )
        output = process.stdout
        if process.stderr:
            output += f"\nStderr: {process.stderr}"
        return output
    except Exception as e:
        return f"Error executing git status: {str(e)}"

@mcp.tool()
def git_diff() -> str:
    """
    Get the git diff of the project.
    Returns:
        The git diff or an error message.
    """
    try:
        process = subprocess.run(
            "git diff",
            cwd=os.getcwd(),
            shell=True,
            capture_output=True,
            text=True
        )
        output = process.stdout
        if process.stderr:
            output += f"\nStderr: {process.stderr}"
        return output
    except Exception as e:
        return f"Error executing git diff: {str(e)}"

@mcp.tool()
def git_log() -> str:
    """
    Get the git log of the project.
    Returns:
        The git log or an error message.
    """
    try:
        process = subprocess.run(
            "git log -n 10 --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset'",
            cwd=os.getcwd(),
            shell=True,
            capture_output=True,
            text=True
        )
        output = process.stdout
        if process.stderr:
            output += f"\nStderr: {process.stderr}"
        return output
    except Exception as e:
        return f"Error executing git log: {str(e)}"
