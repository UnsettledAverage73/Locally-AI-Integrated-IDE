import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
from .llm_service import mcp_manager, get_ollama_client

logger = logging.getLogger("sovereign-ide")

class FlowService:
    def __init__(self):
        self.active_flows: Dict[str, Dict[str, Any]] = {}

    async def start_flow(self, flow_id: str, goal: str, context: Optional[str] = None):
        """
        Starts an autonomous flow to achieve a specific goal.
        """
        self.active_flows[flow_id] = {
            "id": flow_id,
            "goal": goal,
            "status": "executing",
            "steps": [],
            "logs": [],
            "history": [
                {"role": "system", "content": f"""You are an autonomous AI Software Architect in LocalDev. 
Your goal is: {goal}

Context of current codebase:
{context or 'Not provided.'}

RULES:
1. You have direct access to the filesystem and shell via tools.
2. Use tools to investigate the codebase (ls, read_file, search_filenames).
3. Use 'scaffold_project' for creating many files at once.
4. Use 'write_file' for individual file creation/edits.
5. ALWAYS verify your changes by running tests or checking the filesystem.
6. Work in discrete steps. Explain your thought process in the message, then call a tool.
7. If you have finished the goal, state 'GOAL_ACHIEVED' clearly in your message.
"""}
            ]
        }
        
        asyncio.create_task(self._run_loop(flow_id))

    async def _run_loop(self, flow_id: str):
        flow = self.active_flows.get(flow_id)
        if not flow: return

        max_steps = 20
        step_count = 0

        while step_count < max_steps and flow["status"] == "executing":
            step_count += 1
            logger.info(f"Flow {flow_id} step {step_count}")
            
            try:
                # 1. Get LLM response with tools
                client = get_ollama_client()
                tools = await mcp_manager.list_tools()
                
                # Use a capable model if available, fallback to default
                from services.OllamaService import ollama_service
                model = ollama_service.active_model or "qwen2.5:0.5b"
                
                response = await client.chat(
                    model=model,
                    messages=flow["history"],
                    tools=tools
                )
                
                message = response['message']
                flow["history"].append(message)
                
                content = message.get('content', '')
                if content:
                    flow["steps"].append({
                        "id": step_count, 
                        "title": f"Step {step_count}", 
                        "content": content,
                        "status": "completed"
                    })
                    flow["logs"].append(content)

                # 2. Check for goal completion
                if "GOAL_ACHIEVED" in content:
                    flow["status"] = "completed"
                    break

                # 3. Handle tool calls
                if message.get('tool_calls'):
                    for tool_call in message['tool_calls']:
                        name = tool_call['function']['name']
                        args = tool_call['function']['arguments']
                        
                        flow["logs"].append(f"🔧 Tool: {name}({json.dumps(args)})")
                        
                        # Execute tool
                        result = await mcp_manager.call_tool(name, args)
                        
                        # Add tool result to history
                        flow["history"].append({
                            'role': 'tool',
                            'content': str(result),
                            'name': name
                        })
                        
                # Small delay to prevent runaway loops
                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error in flow {flow_id}: {e}")
                flow["logs"].append(f"❌ Error: {str(e)}")
                flow["status"] = "error"
                break
        
        if step_count >= max_steps and flow["status"] == "executing":
            flow["status"] = "timeout"
            flow["logs"].append("Reached maximum step count.")

    def get_flow_status(self, flow_id: str):
        return self.active_flows.get(flow_id)

flow_service = FlowService()
