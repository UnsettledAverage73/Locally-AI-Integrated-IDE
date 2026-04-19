import asyncio
from mcp.server.fastmcp import FastMCP
import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

mcp = FastMCP("LocalDev Subagents")

@mcp.tool()
async def codebase_investigator(objective: str) -> str:
    """
    The specialized tool for codebase analysis, architectural mapping, and understanding system-wide dependencies.
    Invoke this tool for tasks like vague requests, bug root-cause analysis, system refactoring, comprehensive feature implementation or to answer questions about the codebase that require investigation.
    It returns a structured report with key file paths, symbols, and actionable architectural insights.
    
    Args:
        objective: A comprehensive and detailed description of the ultimate goal.
    """
    from ai_engine import run_autonomous_agent
    try:
        investigation_prompt = f"""
        You are a Codebase Investigator Sub-agent.
        Your objective is: {objective}
        
        Use tools to search and read the codebase. 
        Once you have thoroughly investigated, provide a detailed summary of your findings, including:
        1. Key files and their purposes.
        2. Important architectural patterns.
        3. Actionable insights or next steps.
        """
        # Run the autonomous agent loop with the investigation prompt
        # Wait for the task to complete
        result = await run_autonomous_agent(investigation_prompt, model="qwen2.5:0.5b")
        return result or "Investigation complete, but no output generated."
    except Exception as e:
        return f"❌ Error in codebase investigation: {str(e)}"

@mcp.tool()
async def generalist(request: str) -> str:
    """
    A general-purpose AI agent with access to all tools. Highly recommended for tasks that are turn-intensive or involve processing large amounts of data.
    Excellent for: batch refactoring/error fixing across multiple files, running commands with high-volume output, and speculative investigations.
    
    Args:
        request: The task or question for the generalist agent.
    """
    from ai_engine import run_autonomous_agent
    try:
        generalist_prompt = f"""
        You are a Generalist Sub-agent.
        Your task is: {request}
        
        Execute the necessary steps using your tools to accomplish the task.
        Provide a concise summary of the actions taken and the final result.
        """
        # Run the autonomous agent loop
        result = await run_autonomous_agent(generalist_prompt, model="qwen2.5:0.5b")
        return result or "Task complete, but no output generated."
    except Exception as e:
        return f"❌ Error in generalist execution: {str(e)}"

if __name__ == "__main__":
    mcp.run()
