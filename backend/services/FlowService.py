import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
from .llm_service import stream_chat_response, mcp_manager
from .OllamaService import OllamaService

logger = logging.getLogger("sovereign-ide")

class FlowService:
    def __init__(self, ollama_service: OllamaService = None):
        self.ollama_service = ollama_service or OllamaService()
        self.active_flows: Dict[str, Dict[str, Any]] = {}

    async def start_flow(self, flow_id: str, goal: str, context: Optional[str] = None):
        """
        Starts an autonomous flow to achieve a specific goal.
        """
        self.active_flows[flow_id] = {
            "goal": goal,
            "state": "planning",
            "plan": [],
            "logs": [],
            "history": [
                {"role": "system", "content": f"You are an autonomous AI Agent in LocalDev. Your goal is: {goal}. \nContext: {context or 'None'}\nYou have access to tools. Plan your steps and execute them one by one. Use the 'scaffold_project' tool if this is a new project, or 'read_file'/'write_file' for existing files. Always verify your work by running commands if possible."}
            ]
        }
        
        # Initial planning step
        return await self._next_step(flow_id)

    async def _next_step(self, flow_id: str):
        flow = self.active_flows.get(flow_id)
        if not flow:
            return

        logger.info(f"Flow {flow_id} moving to next step. State: {flow['state']}")
        
        # Call LLM to decide next action
        messages = flow["history"]
        
        # In a real implementation, we would use a specialized agent prompt here
        # For now, we'll leverage the existing stream_chat_response logic which handles tools
        
        full_response = ""
        async for chunk in stream_chat_response(messages):
            if chunk.get("type") == "content":
                full_response += chunk.get("content", "")
            elif chunk.get("type") == "tool_call":
                # Autonomous auto-approval for "safe" tools in flow mode
                tool_name = chunk["tool_call"]["function"]["name"]
                if tool_name in ["read_file", "ls", "search_filenames", "get_context"]:
                    logger.info(f"Flow {flow_id} auto-approving tool: {tool_name}")
                    # We would execute it here and loop back
                else:
                    # For potentially destructive tools, we might still want user approval 
                    # OR if the user enabled "Full Auto", we proceed.
                    pass
        
        return full_response

    def get_flow_status(self, flow_id: str):
        return self.active_flows.get(flow_id)

flow_service = FlowService()
